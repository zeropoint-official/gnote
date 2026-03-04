import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, DATABASE_ID, CATEGORIES_COLLECTION, ORGANIZED_NOTES_COLLECTION } from "@/lib/appwrite-server";
import { Query } from "node-appwrite";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const status = request.nextUrl.searchParams.get("status") || "active";

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { databases } = createAdminClient();

    const statusFilters = status === "archived"
      ? [Query.or([Query.equal("status", "archived"), Query.equal("status", "stale")])]
      : [Query.equal("status", status)];

    const categories = await databases.listDocuments(
      DATABASE_ID,
      CATEGORIES_COLLECTION,
      [
        Query.equal("userId", userId),
        ...(status === "archived"
          ? [Query.equal("status", "archived")]
          : [Query.equal("status", "active")]),
        Query.orderDesc("lastActivityAt"),
        Query.limit(100),
      ]
    );

    const activeCategories = status === "archived"
      ? []
      : categories.documents;

    const allActiveCategories = status === "archived"
      ? (await databases.listDocuments(DATABASE_ID, CATEGORIES_COLLECTION, [
          Query.equal("userId", userId),
          Query.equal("status", "active"),
          Query.limit(100),
        ])).documents
      : categories.documents;

    const noteQueries = [
      Query.equal("userId", userId),
      Query.orderDesc("$createdAt"),
      Query.limit(200),
    ];

    if (status === "archived") {
      noteQueries.push(Query.or([
        Query.equal("status", "archived"),
        Query.equal("status", "stale"),
      ]));
    } else {
      noteQueries.push(Query.equal("status", "active"));
    }

    const notes = await databases.listDocuments(
      DATABASE_ID,
      ORGANIZED_NOTES_COLLECTION,
      noteQueries,
    );

    const allCategoriesForTree = status === "archived"
      ? [...categories.documents, ...allActiveCategories]
      : categories.documents;

    const categoryTree = buildCategoryTree(
      status === "archived" ? categories.documents : allCategoriesForTree,
      notes.documents
    );

    const activeCount = status === "active"
      ? notes.total
      : (await databases.listDocuments(DATABASE_ID, ORGANIZED_NOTES_COLLECTION, [
          Query.equal("userId", userId),
          Query.equal("status", "active"),
          Query.limit(1),
        ])).total;

    const archivedCount = status === "archived"
      ? notes.total
      : (await databases.listDocuments(DATABASE_ID, ORGANIZED_NOTES_COLLECTION, [
          Query.equal("userId", userId),
          Query.or([Query.equal("status", "archived"), Query.equal("status", "stale")]),
          Query.limit(1),
        ])).total;

    return NextResponse.json({
      categories: categories.documents,
      notes: notes.documents,
      tree: categoryTree,
      counts: { active: activeCount, archived: archivedCount },
    });
  } catch (error) {
    console.error("Error in GET /api/mind:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function buildCategoryTree(categories: any[], notes: any[]) {
  const rootCategories = categories.filter((c) => !c.parentId);
  const childCategories = categories.filter((c) => c.parentId);

  return rootCategories.map((root) => ({
    ...root,
    children: childCategories
      .filter((c) => c.parentId === root.$id)
      .map((child) => ({
        ...child,
        children: [],
        notes: notes.filter((n) => n.categoryId === child.$id),
      })),
    notes: notes.filter((n) => n.categoryId === root.$id),
  }));
}
