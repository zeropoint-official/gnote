import { trackedAICall } from "./client";
import { ORGANIZE_SYSTEM_PROMPT, buildOrganizePrompt } from "./prompts";
import type { AIOrganizeResult } from "@/types";

export async function organizeNote(
  rawNote: string,
  existingCategories: { name: string; description: string; parentName: string | null }[],
  recentNotes: { title: string; categoryName: string }[],
  userId: string
): Promise<AIOrganizeResult> {
  const message = await trackedAICall({
    userId,
    operation: "organize",
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: ORGANIZE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildOrganizePrompt(rawNote, existingCategories, recentNotes),
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  return JSON.parse(cleaned) as AIOrganizeResult;
}
