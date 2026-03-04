import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  DATABASE_ID,
  USER_PROFILE_COLLECTION,
  CATEGORIES_COLLECTION,
  ORGANIZED_NOTES_COLLECTION,
  CHAT_HISTORY_COLLECTION,
} from "@/lib/appwrite-server";
import { chat, selectContext } from "@/lib/ai/chat";
import { ID, Query } from "node-appwrite";
import type { ParsedProfile } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { userId, message, sessionId } = await request.json();

    if (!userId || !message || !sessionId) {
      return NextResponse.json(
        { error: "userId, message, and sessionId are required" },
        { status: 400 }
      );
    }

    const { databases } = createAdminClient();

    const [profileDocs, categoryDocs, historyDocs] = await Promise.all([
      databases.listDocuments(DATABASE_ID, USER_PROFILE_COLLECTION, [
        Query.equal("userId", userId),
        Query.limit(1),
      ]),
      databases.listDocuments(DATABASE_ID, CATEGORIES_COLLECTION, [
        Query.equal("userId", userId),
        Query.limit(100),
      ]),
      databases.listDocuments(DATABASE_ID, CHAT_HISTORY_COLLECTION, [
        Query.equal("sessionId", sessionId),
        Query.orderAsc("createdAt"),
        Query.limit(50),
      ]),
    ]);

    const profile: ParsedProfile | null =
      profileDocs.total > 0
        ? JSON.parse(profileDocs.documents[0].profile as string)
        : null;

    const categories = categoryDocs.documents.map((c) => ({
      name: c.name as string,
      description: c.description as string,
    }));

    const contextSelection = await selectContext(message, categories, userId);

    const noteQueries = [
      Query.equal("userId", userId),
      Query.limit(30),
      Query.orderDesc("lastMentionedAt"),
    ];

    if (contextSelection.categoryNames.length > 0) {
      const relevantCategoryIds = categoryDocs.documents
        .filter((c) =>
          contextSelection.categoryNames.some(
            (name) => (c.name as string).toLowerCase() === name.toLowerCase()
          )
        )
        .map((c) => c.$id);

      if (relevantCategoryIds.length > 0) {
        noteQueries.push(Query.equal("categoryId", relevantCategoryIds));
      }
    }

    const noteDocs = await databases.listDocuments(
      DATABASE_ID,
      ORGANIZED_NOTES_COLLECTION,
      noteQueries
    );

    const notes = noteDocs.documents.map((n) => ({
      title: n.title as string,
      content: n.content as string,
      categoryName:
        (categoryDocs.documents.find((c) => c.$id === n.categoryId)?.name as string) ??
        "Uncategorized",
      status: n.status as string,
      tags: (n.tags as string[]) || [],
    }));

    const history = historyDocs.documents.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }));

    await databases.createDocument(
      DATABASE_ID,
      CHAT_HISTORY_COLLECTION,
      ID.unique(),
      {
        userId,
        role: "user",
        content: message,
        sessionId,
        createdAt: new Date().toISOString(),
      }
    );

    const reply = await chat(message, profile, notes, categories, history, userId);

    await databases.createDocument(
      DATABASE_ID,
      CHAT_HISTORY_COLLECTION,
      ID.unique(),
      {
        userId,
        role: "assistant",
        content: reply,
        sessionId,
        createdAt: new Date().toISOString(),
      }
    );

    return NextResponse.json({ reply, sessionId });
  } catch (error) {
    console.error("Error in POST /api/chat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const { databases } = createAdminClient();

    if (sessionId) {
      const messages = await databases.listDocuments(
        DATABASE_ID,
        CHAT_HISTORY_COLLECTION,
        [
          Query.equal("sessionId", sessionId),
          Query.orderAsc("createdAt"),
          Query.limit(100),
        ]
      );

      return NextResponse.json({ messages: messages.documents });
    }

    const recentMessages = await databases.listDocuments(
      DATABASE_ID,
      CHAT_HISTORY_COLLECTION,
      [
        Query.equal("userId", userId),
        Query.equal("role", "user"),
        Query.orderDesc("createdAt"),
        Query.limit(20),
      ]
    );

    const sessionMap = new Map<string, { sessionId: string; lastMessage: string; createdAt: string }>();
    for (const msg of recentMessages.documents) {
      const sid = msg.sessionId as string;
      if (!sessionMap.has(sid)) {
        sessionMap.set(sid, {
          sessionId: sid,
          lastMessage: (msg.content as string).slice(0, 100),
          createdAt: msg.createdAt as string,
        });
      }
    }

    return NextResponse.json({
      sessions: Array.from(sessionMap.values()),
    });
  } catch (error) {
    console.error("Error in GET /api/chat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
