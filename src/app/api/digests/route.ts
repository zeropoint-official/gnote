import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, DATABASE_ID } from "@/lib/appwrite-server";
import { Query } from "node-appwrite";

const DIGESTS_COLLECTION = "digests";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { databases } = createAdminClient();

    const digests = await databases.listDocuments(
      DATABASE_ID,
      DIGESTS_COLLECTION,
      [
        Query.equal("userId", userId),
        Query.orderDesc("createdAt"),
        Query.limit(5),
      ]
    );

    return NextResponse.json({ digests: digests.documents });
  } catch (error) {
    console.error("Error in GET /api/digests:", error);
    return NextResponse.json({ digests: [] });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { digestId } = await request.json();
    if (!digestId) {
      return NextResponse.json({ error: "digestId is required" }, { status: 400 });
    }

    const { databases } = createAdminClient();
    await databases.deleteDocument(DATABASE_ID, DIGESTS_COLLECTION, digestId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/digests:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
