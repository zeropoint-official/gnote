import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, DATABASE_ID, RAW_NOTES_COLLECTION, CATEGORIES_COLLECTION, ORGANIZED_NOTES_COLLECTION } from "@/lib/appwrite-server";
import { organizeNote } from "@/lib/ai/organize";
import { ID, Query } from "node-appwrite";

export async function POST(request: NextRequest) {
  try {
    const { content, userId } = await request.json();

    if (!content || !userId) {
      return NextResponse.json({ error: "Content and userId are required" }, { status: 400 });
    }

    const { databases } = createAdminClient();

    const rawNote = await databases.createDocument(
      DATABASE_ID,
      RAW_NOTES_COLLECTION,
      ID.unique(),
      {
        userId,
        content,
      }
    );

    const categoriesDocs = await databases.listDocuments(
      DATABASE_ID,
      CATEGORIES_COLLECTION,
      [
        Query.equal("userId", userId),
        Query.equal("status", "active"),
        Query.limit(100),
      ]
    );

    const existingCategories = categoriesDocs.documents.map((c) => ({
      name: c.name as string,
      description: c.description as string,
      parentName: c.parentId
        ? (categoriesDocs.documents.find((p) => p.$id === c.parentId)?.name as string) ?? null
        : null,
    }));

    const recentNotesDocs = await databases.listDocuments(
      DATABASE_ID,
      ORGANIZED_NOTES_COLLECTION,
      [
        Query.equal("userId", userId),
        Query.equal("status", "active"),
        Query.orderDesc("$createdAt"),
        Query.limit(10),
      ]
    );

    const recentNotes = recentNotesDocs.documents.map((n) => ({
      title: n.title as string,
      categoryName: categoriesDocs.documents.find((c) => c.$id === n.categoryId)?.name as string ?? "Uncategorized",
    }));

    let aiResult;
    try {
      aiResult = await organizeNote(content, existingCategories, recentNotes, userId);
    } catch (aiError) {
      console.error("AI organization failed:", aiError);
      return NextResponse.json({
        rawNote,
        organized: false,
        error: "AI organization failed — raw note saved",
      });
    }

    let categoryId: string;

    if (aiResult.isNewCategory) {
      let parentId: string | null = null;
      if (aiResult.parentCategoryName) {
        const parent = categoriesDocs.documents.find(
          (c) => (c.name as string).toLowerCase() === aiResult.parentCategoryName!.toLowerCase()
        );
        parentId = parent?.$id ?? null;
      }

      const newCategory = await databases.createDocument(
        DATABASE_ID,
        CATEGORIES_COLLECTION,
        ID.unique(),
        {
          userId,
          name: aiResult.categoryName,
          parentId,
          description: aiResult.categoryDescription,
          status: "active",
          noteCount: 1,
          lastActivityAt: new Date().toISOString(),
        }
      );
      categoryId = newCategory.$id;
    } else {
      const existing = categoriesDocs.documents.find(
        (c) => (c.name as string).toLowerCase() === aiResult.categoryName.toLowerCase()
      );

      if (existing) {
        categoryId = existing.$id;
        await databases.updateDocument(
          DATABASE_ID,
          CATEGORIES_COLLECTION,
          categoryId,
          {
            noteCount: (existing.noteCount as number) + 1,
            lastActivityAt: new Date().toISOString(),
          }
        );
      } else {
        const fallback = await databases.createDocument(
          DATABASE_ID,
          CATEGORIES_COLLECTION,
          ID.unique(),
          {
            userId,
            name: aiResult.categoryName,
            parentId: null,
            description: aiResult.categoryDescription || "Auto-created category",
            status: "active",
            noteCount: 1,
            lastActivityAt: new Date().toISOString(),
          }
        );
        categoryId = fallback.$id;
      }
    }

    const organizedNote = await databases.createDocument(
      DATABASE_ID,
      ORGANIZED_NOTES_COLLECTION,
      ID.unique(),
      {
        userId,
        categoryId,
        title: aiResult.title,
        content: aiResult.content,
        rawNoteId: rawNote.$id,
        tags: aiResult.tags,
        priority: aiResult.priority,
        status: "active",
        lastMentionedAt: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      rawNote,
      organizedNote,
      organized: true,
      isNewCategory: aiResult.isNewCategory,
      categoryName: aiResult.categoryName,
    });
  } catch (error) {
    console.error("Error in POST /api/notes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { databases } = createAdminClient();

    const rawNotes = await databases.listDocuments(
      DATABASE_ID,
      RAW_NOTES_COLLECTION,
      [
        Query.equal("userId", userId),
        Query.orderDesc("$createdAt"),
        Query.limit(50),
      ]
    );

    return NextResponse.json({ notes: rawNotes.documents });
  } catch (error) {
    console.error("Error in GET /api/notes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
