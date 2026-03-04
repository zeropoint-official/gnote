import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, DATABASE_ID, CATEGORIES_COLLECTION, ORGANIZED_NOTES_COLLECTION, USER_SETTINGS_COLLECTION } from "@/lib/appwrite-server";
import { Query } from "node-appwrite";
import { reorganizeNotes } from "@/lib/ai/reorganize";
import { differenceInDays } from "date-fns";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { databases } = createAdminClient();

    const allSettings = await databases.listDocuments(
      DATABASE_ID,
      USER_SETTINGS_COLLECTION,
      [Query.limit(100)]
    );

    const results = [];

    for (const settings of allSettings.documents) {
      const userId = settings.userId as string;
      const activeNoteLimit = (settings.activeNoteLimit as number) ?? 100;
      const archiveAfterDays = (settings.archiveAfterDays as number) ?? 30;

      try {
        const staleResult = await enforceStaleAndLimits(databases, userId, activeNoteLimit, archiveAfterDays);

        const categoriesDocs = await databases.listDocuments(
          DATABASE_ID,
          CATEGORIES_COLLECTION,
          [Query.equal("userId", userId), Query.equal("status", "active"), Query.limit(100)]
        );

        if (categoriesDocs.documents.length === 0) {
          results.push({ userId, stale: staleResult, reorganized: false, reason: "No categories" });
          continue;
        }

        const notesDocs = await databases.listDocuments(
          DATABASE_ID,
          ORGANIZED_NOTES_COLLECTION,
          [Query.equal("userId", userId), Query.equal("status", "active"), Query.limit(200)]
        );

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

        const aiResult = await reorganizeNotes(categoriesForAI, notesForAI, archiveAfterDays, userId);

        for (const catId of aiResult.categoriesToArchive) {
          await databases.updateDocument(DATABASE_ID, CATEGORIES_COLLECTION, catId, { status: "archived" });
        }
        for (const noteId of aiResult.notesToArchive) {
          await databases.updateDocument(DATABASE_ID, ORGANIZED_NOTES_COLLECTION, noteId, { status: "archived" });
        }
        for (const recategorize of aiResult.notesToRecategorize) {
          const targetCat = categoriesDocs.documents.find(
            (c) => (c.name as string).toLowerCase() === recategorize.newCategoryName.toLowerCase()
          );
          if (targetCat) {
            await databases.updateDocument(DATABASE_ID, ORGANIZED_NOTES_COLLECTION, recategorize.noteId, {
              categoryId: targetCat.$id,
            });
          }
        }

        await storeDigest(databases, userId, aiResult.summary, {
          archived: aiResult.notesToArchive.length + aiResult.categoriesToArchive.length,
          created: aiResult.categoriesToCreate.length,
          recategorized: aiResult.notesToRecategorize.length,
          merged: aiResult.categoriesToMerge.length,
        });

        results.push({
          userId,
          stale: staleResult,
          reorganized: true,
          summary: aiResult.summary,
        });
      } catch (err) {
        console.error(`Reorganize failed for ${userId}:`, err);
        results.push({ userId, error: "Failed" });
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} users`,
      results,
    });
  } catch (error) {
    console.error("Cron reorganize error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function enforceStaleAndLimits(
  databases: any,
  userId: string,
  activeNoteLimit: number,
  archiveAfterDays: number
) {
  const notesDocs = await databases.listDocuments(
    DATABASE_ID,
    ORGANIZED_NOTES_COLLECTION,
    [
      Query.equal("userId", userId),
      Query.equal("status", "active"),
      Query.orderAsc("lastMentionedAt"),
      Query.limit(500),
    ]
  );

  const now = new Date();
  let staleCount = 0;
  let limitCount = 0;

  for (const note of notesDocs.documents) {
    const lastMentioned = new Date(note.lastMentionedAt as string);
    const daysSince = differenceInDays(now, lastMentioned);

    if (daysSince >= archiveAfterDays) {
      await databases.updateDocument(DATABASE_ID, ORGANIZED_NOTES_COLLECTION, note.$id, {
        status: "stale",
      });
      staleCount++;
    }
  }

  const activeAfterStale = notesDocs.documents.length - staleCount;
  if (activeAfterStale > activeNoteLimit) {
    const overflow = activeAfterStale - activeNoteLimit;
    const oldestActive = notesDocs.documents
      .filter((n: any) => n.status === "active")
      .slice(0, overflow);

    for (const note of oldestActive) {
      await databases.updateDocument(DATABASE_ID, ORGANIZED_NOTES_COLLECTION, note.$id, {
        status: "archived",
      });
      limitCount++;
    }
  }

  return { staleMarked: staleCount, archivedByLimit: limitCount };
}

async function storeDigest(
  databases: any,
  userId: string,
  summary: string,
  changes: { archived: number; created: number; recategorized: number; merged: number }
) {
  const { ID } = await import("node-appwrite");

  try {
    await databases.createDocument(
      DATABASE_ID,
      "digests",
      ID.unique(),
      {
        userId,
        summary,
        changes: JSON.stringify(changes),
        createdAt: new Date().toISOString(),
      }
    );
  } catch {
    // digests collection may not exist yet — graceful fail
    console.log("Digest storage skipped (collection may not exist)");
  }
}
