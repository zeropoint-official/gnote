import { trackedAICall } from "./client";
import { REORGANIZE_SYSTEM_PROMPT, buildReorganizePrompt } from "./prompts";
import type { AIReorganizeResult } from "@/types";

export async function reorganizeNotes(
  categories: { id: string; name: string; description: string; noteCount: number; lastActivityAt: string; parentName: string | null }[],
  notes: { id: string; title: string; categoryName: string; status: string; lastMentionedAt: string; tags: string[] }[],
  archiveAfterDays: number,
  userId: string
): Promise<AIReorganizeResult> {
  const message = await trackedAICall({
    userId,
    operation: "reorganize",
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: REORGANIZE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildReorganizePrompt(categories, notes, archiveAfterDays),
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  return JSON.parse(cleaned) as AIReorganizeResult;
}
