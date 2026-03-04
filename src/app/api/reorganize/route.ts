import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, DATABASE_ID, CATEGORIES_COLLECTION, ORGANIZED_NOTES_COLLECTION, USER_SETTINGS_COLLECTION } from "@/lib/appwrite-server";
import { reorganizeNotes } from "@/lib/ai/reorganize";
import { ID, Query } from "node-appwrite";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { databases } = createAdminClient();

    const settingsDocs = await databases.listDocuments(
      DATABASE_ID,
      USER_SETTINGS_COLLECTION,
      [Query.equal("userId", userId), Query.limit(1)]
    );

    const archiveAfterDays = settingsDocs.documents[0]?.archiveAfterDays ?? 30;

    const categoriesDocs = await databases.listDocuments(
      DATABASE_ID,
      CATEGORIES_COLLECTION,
      [Query.equal("userId", userId), Query.equal("status", "active"), Query.limit(100)]
    );

    const notesDocs = await databases.listDocuments(
      DATABASE_ID,
      ORGANIZED_NOTES_COLLECTION,
      [Query.equal("userId", userId), Query.equal("status", "active"), Query.limit(200)]
    );

    if (categoriesDocs.documents.length === 0) {
      return NextResponse.json({ message: "Nothing to reorganize yet", changes: null });
    }

    const categoriesForAI = categoriesDocs.documents.map((c) => ({
      id: c.$id,
      name: c.name as string,
      description: c.description as string,
      noteCount: c.noteCount as number,
      lastActivityAt: c.lastActivityAt as string,
      parentName: c.parentId
        ? (categoriesDocs.documents.find((p) => p.$id === c.parentId)?.name as string) ?? null
        : null,
    }));

    const notesForAI = notesDocs.documents.map((n) => ({
      id: n.$id,
      title: n.title as string,
      categoryName: categoriesDocs.documents.find((c) => c.$id === n.categoryId)?.name as string ?? "Unknown",
      status: n.status as string,
      lastMentionedAt: n.lastMentionedAt as string,
      tags: (n.tags as string[]) || [],
    }));

    const result = await reorganizeNotes(categoriesForAI, notesForAI, archiveAfterDays, userId);

    for (const catId of result.categoriesToArchive) {
      await databases.updateDocument(DATABASE_ID, CATEGORIES_COLLECTION, catId, {
        status: "archived",
      });
    }

    for (const noteId of result.notesToArchive) {
      await databases.updateDocument(DATABASE_ID, ORGANIZED_NOTES_COLLECTION, noteId, {
        status: "archived",
      });
    }

    for (const newCat of result.categoriesToCreate) {
      let parentId: string | null = null;
      if (newCat.parentCategoryName) {
        const parent = categoriesDocs.documents.find(
          (c) => (c.name as string).toLowerCase() === newCat.parentCategoryName!.toLowerCase()
        );
        parentId = parent?.$id ?? null;
      }

      await databases.createDocument(DATABASE_ID, CATEGORIES_COLLECTION, ID.unique(), {
        userId,
        name: newCat.name,
        parentId,
        description: newCat.description,
        status: "active",
        noteCount: 0,
        lastActivityAt: new Date().toISOString(),
      });
    }

    for (const merge of result.categoriesToMerge) {
      let targetCat = categoriesDocs.documents.find(
        (c) => (c.name as string).toLowerCase() === merge.targetName.toLowerCase()
      );

      if (!targetCat) {
        const created = await databases.createDocument(DATABASE_ID, CATEGORIES_COLLECTION, ID.unique(), {
          userId,
          name: merge.targetName,
          parentId: null,
          description: merge.targetDescription,
          status: "active",
          noteCount: 0,
          lastActivityAt: new Date().toISOString(),
        });
        targetCat = created;
      }

      for (const sourceId of merge.sourceIds) {
        const notesInSource = notesDocs.documents.filter((n) => n.categoryId === sourceId);
        for (const note of notesInSource) {
          await databases.updateDocument(DATABASE_ID, ORGANIZED_NOTES_COLLECTION, note.$id, {
            categoryId: targetCat.$id,
          });
        }
        await databases.updateDocument(DATABASE_ID, CATEGORIES_COLLECTION, sourceId, {
          status: "archived",
        });
      }

      await databases.updateDocument(DATABASE_ID, CATEGORIES_COLLECTION, targetCat.$id, {
        noteCount: notesDocs.documents.filter((n) =>
          merge.sourceIds.includes(n.categoryId as string) || n.categoryId === targetCat!.$id
        ).length,
      });
    }

    for (const recategorize of result.notesToRecategorize) {
      const allCats = await databases.listDocuments(DATABASE_ID, CATEGORIES_COLLECTION, [
        Query.equal("userId", userId),
        Query.equal("status", "active"),
        Query.limit(100),
      ]);
      const targetCat = allCats.documents.find(
        (c) => (c.name as string).toLowerCase() === recategorize.newCategoryName.toLowerCase()
      );
      if (targetCat) {
        await databases.updateDocument(DATABASE_ID, ORGANIZED_NOTES_COLLECTION, recategorize.noteId, {
          categoryId: targetCat.$id,
        });
      }
    }

    return NextResponse.json({
      message: "Reorganization complete",
      summary: result.summary,
      changes: {
        archived: result.notesToArchive.length + result.categoriesToArchive.length,
        created: result.categoriesToCreate.length,
        recategorized: result.notesToRecategorize.length,
        merged: result.categoriesToMerge.length,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/reorganize:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
