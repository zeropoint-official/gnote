import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, DATABASE_ID, TASKS_COLLECTION } from "@/lib/appwrite-server";
import { ID, Query } from "node-appwrite";
import { rewriteTask } from "@/lib/ai/organize";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const status = request.nextUrl.searchParams.get("status");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { databases } = createAdminClient();

    const queries = [
      Query.equal("userId", userId),
      Query.orderDesc("createdAt"),
      Query.limit(100),
    ];

    if (status) {
      queries.push(Query.equal("status", status));
    }

    const tasks = await databases.listDocuments(DATABASE_ID, TASKS_COLLECTION, queries);

    return NextResponse.json({ tasks: tasks.documents });
  } catch (error) {
    console.error("Error in GET /api/tasks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, title, description, dueDate } = await request.json();

    if (!userId || !title) {
      return NextResponse.json({ error: "userId and title are required" }, { status: 400 });
    }

    const { databases } = createAdminClient();

    const rewritten = await rewriteTask(title, userId);

    const task = await databases.createDocument(
      DATABASE_ID,
      TASKS_COLLECTION,
      ID.unique(),
      {
        userId,
        title: rewritten.title,
        description: rewritten.description || description || "",
        status: "pending",
        sourceNoteId: null,
        dueDate: rewritten.dueDate || dueDate || null,
        createdAt: new Date().toISOString(),
      }
    );

    return NextResponse.json({ task, rewritten: true });
  } catch (error) {
    console.error("Error in POST /api/tasks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { taskId, status } = await request.json();

    if (!taskId || !status) {
      return NextResponse.json({ error: "taskId and status are required" }, { status: 400 });
    }

    const { databases } = createAdminClient();

    const task = await databases.updateDocument(
      DATABASE_ID,
      TASKS_COLLECTION,
      taskId,
      { status }
    );

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Error in PATCH /api/tasks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
