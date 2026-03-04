import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  DATABASE_ID,
  CATEGORIES_COLLECTION,
  ORGANIZED_NOTES_COLLECTION,
  RAW_NOTES_COLLECTION,
} from "@/lib/appwrite-server";
import { ID, Query } from "node-appwrite";

export async function POST(request: NextRequest) {
  try {
    const { userId, name, description } = await request.json();

    if (!userId || !name?.trim()) {
      return NextResponse.json(
        { error: "userId and name are required" },
        { status: 400 }
      );
    }

    const { databases } = createAdminClient();

    const category = await databases.createDocument(
      DATABASE_ID,
      CATEGORIES_COLLECTION,
      ID.unique(),
      {
        userId,
        name: name.trim(),
        parentId: null,
        description: description?.trim() || "",
        status: "active",
        noteCount: 0,
        lastActivityAt: new Date().toISOString(),
      }
    );

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error in POST /api/categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { categoryId, name } = await request.json();

    if (!categoryId || !name?.trim()) {
      return NextResponse.json(
        { error: "categoryId and name are required" },
        { status: 400 }
      );
    }

    const { databases } = createAdminClient();

    const category = await databases.updateDocument(
      DATABASE_ID,
      CATEGORIES_COLLECTION,
      categoryId,
      { name: name.trim() }
    );

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error in PATCH /api/categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { categoryId } = await request.json();

    if (!categoryId) {
      return NextResponse.json(
        { error: "categoryId is required" },
        { status: 400 }
      );
    }

    const { databases } = createAdminClient();

    const notes = await databases.listDocuments(
      DATABASE_ID,
      ORGANIZED_NOTES_COLLECTION,
      [Query.equal("categoryId", categoryId), Query.limit(500)]
    );

    for (const note of notes.documents) {
      if (note.rawNoteId) {
        await databases.deleteDocument(
          DATABASE_ID,
          RAW_NOTES_COLLECTION,
          note.rawNoteId as string
        ).catch(() => {});
      }
      await databases.deleteDocument(
        DATABASE_ID,
        ORGANIZED_NOTES_COLLECTION,
        note.$id
      );
    }

    await databases.deleteDocument(
      DATABASE_ID,
      CATEGORIES_COLLECTION,
      categoryId
    );

    return NextResponse.json({ success: true, notesDeleted: notes.total });
  } catch (error) {
    console.error("Error in DELETE /api/categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
