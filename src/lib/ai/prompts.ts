export const ORGANIZE_SYSTEM_PROMPT = `You are an intelligent note organizer. Your job is to take a raw, unstructured note from a user and:

1. Determine which category it belongs to (or create a new one)
2. Rewrite it as a clean, well-structured note
3. Assign relevant tags and priority

You have access to the user's existing category structure. Always try to fit notes into existing categories before creating new ones. Only create a new category when the note clearly doesn't fit anywhere.

Categories should be broad enough to be useful (e.g. "Business - Agency", "Health & Fitness", "Ideas") but specific enough to be meaningful. Avoid overly generic categories like "Misc" or "Other".

Priority rules:
- high: Action items, deadlines, urgent decisions
- medium: Important but not urgent ideas, plans, references
- low: Casual thoughts, observations, things to maybe revisit later

When rewriting, preserve all the factual content but make it clear, concise, and scannable. Use bullet points where appropriate. Never add information the user didn't provide.

IMPORTANT: Respond with ONLY valid JSON, no markdown or explanation.`;

export function buildOrganizePrompt(
  rawNote: string,
  existingCategories: { name: string; description: string; parentName: string | null }[],
  recentNotes: { title: string; categoryName: string }[]
) {
  const categoryList = existingCategories.length > 0
    ? existingCategories.map(c =>
        `- ${c.parentName ? `${c.parentName} > ` : ""}${c.name}: ${c.description}`
      ).join("\n")
    : "No categories yet — create the first one.";

  const recentList = recentNotes.length > 0
    ? recentNotes.map(n => `- [${n.categoryName}] ${n.title}`).join("\n")
    : "No recent notes.";

  return `Here is the user's new note:

"""
${rawNote}
"""

Existing categories:
${categoryList}

Recent organized notes (for context):
${recentList}

Respond with this exact JSON structure:
{
  "categoryName": "string - name of existing or new category",
  "categoryDescription": "string - short description of what goes in this category (only needed if new)",
  "parentCategoryName": "string or null - parent category name if this is a subcategory",
  "isNewCategory": boolean,
  "title": "string - concise title for this note",
  "content": "string - clean, well-structured rewrite of the note",
  "tags": ["array", "of", "relevant", "tags"],
  "priority": "high | medium | low"
}`;
}

export const REORGANIZE_SYSTEM_PROMPT = `You are an AI knowledge manager. You review a user's entire note collection and reorganize it for clarity, relevance, and usefulness.

Your responsibilities:
1. Merge categories that overlap significantly
2. Split categories that have become too broad
3. Archive categories with no recent activity
4. Identify notes that should be archived (stale, no longer relevant)
5. Recategorize notes that would fit better elsewhere
6. Provide a human-readable summary of all changes

Rules:
- Be conservative. Don't reorganize for the sake of it. Only make changes that genuinely improve the structure.
- Stale = no new notes or mentions in the category for the configured number of days
- When archiving, never delete — just move to archive status
- When merging, pick the best name from the source categories or suggest a new one

IMPORTANT: Respond with ONLY valid JSON, no markdown or explanation.`;

export function buildReorganizePrompt(
  categories: { id: string; name: string; description: string; noteCount: number; lastActivityAt: string; parentName: string | null }[],
  notes: { id: string; title: string; categoryName: string; status: string; lastMentionedAt: string; tags: string[] }[],
  archiveAfterDays: number
) {
  const now = new Date().toISOString();

  return `Current date: ${now}
Archive threshold: ${archiveAfterDays} days of inactivity

Categories:
${categories.map(c =>
  `- [${c.id}] ${c.parentName ? `${c.parentName} > ` : ""}${c.name} (${c.noteCount} notes, last active: ${c.lastActivityAt}): ${c.description}`
).join("\n")}

Active notes:
${notes.map(n =>
  `- [${n.id}] "${n.title}" in ${n.categoryName} (status: ${n.status}, last mentioned: ${n.lastMentionedAt}, tags: ${n.tags.join(", ")})`
).join("\n")}

Respond with this exact JSON structure:
{
  "categoriesToCreate": [{"name": "string", "description": "string", "parentCategoryName": "string or null"}],
  "categoriesToArchive": ["category-id-1"],
  "categoriesToMerge": [{"sourceIds": ["id1", "id2"], "targetName": "string", "targetDescription": "string"}],
  "notesToArchive": ["note-id-1"],
  "notesToRecategorize": [{"noteId": "note-id", "newCategoryName": "string"}],
  "summary": "Human-readable summary of what was changed and why"
}`;
}
