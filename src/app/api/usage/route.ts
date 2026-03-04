import { NextRequest, NextResponse } from "next/server";
import { getUsageStats } from "@/lib/ai/client";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const stats = await getUsageStats(userId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error in GET /api/usage:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
