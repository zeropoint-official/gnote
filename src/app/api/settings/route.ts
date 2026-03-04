import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, DATABASE_ID, USER_SETTINGS_COLLECTION } from "@/lib/appwrite-server";
import { ID, Query } from "node-appwrite";

export async function POST(request: NextRequest) {
  try {
    const { userId, activeNoteLimit, archiveAfterDays, reorganizeIntervalDays } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { databases } = createAdminClient();

    const existing = await databases.listDocuments(
      DATABASE_ID,
      USER_SETTINGS_COLLECTION,
      [Query.equal("userId", userId), Query.limit(1)]
    );

    const data = { userId, activeNoteLimit, archiveAfterDays, reorganizeIntervalDays };

    if (existing.documents.length > 0) {
      const doc = await databases.updateDocument(
        DATABASE_ID,
        USER_SETTINGS_COLLECTION,
        existing.documents[0].$id,
        data
      );
      return NextResponse.json({ settings: doc });
    } else {
      const doc = await databases.createDocument(
        DATABASE_ID,
        USER_SETTINGS_COLLECTION,
        ID.unique(),
        data
      );
      return NextResponse.json({ settings: doc });
    }
  } catch (error) {
    console.error("Error in POST /api/settings:", error);
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

    const existing = await databases.listDocuments(
      DATABASE_ID,
      USER_SETTINGS_COLLECTION,
      [Query.equal("userId", userId), Query.limit(1)]
    );

    if (existing.documents.length > 0) {
      return NextResponse.json({ settings: existing.documents[0] });
    }

    return NextResponse.json({
      settings: {
        activeNoteLimit: 100,
        archiveAfterDays: 30,
        reorganizeIntervalDays: 7,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
