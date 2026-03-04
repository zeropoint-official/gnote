import {
  createAdminClient,
  DATABASE_ID,
  CATEGORIES_COLLECTION,
  ORGANIZED_NOTES_COLLECTION,
  RAW_NOTES_COLLECTION,
} from "@/lib/appwrite-server";
import { ID, Query } from "node-appwrite";
import { trackedAICall } from "./client";
import type { ParsedProfile } from "@/types";

interface SeedNote {
  categoryName: string;
  categoryDescription: string;
  title: string;
  content: string;
  tags: string[];
  priority: "low" | "medium" | "high";
}

async function generateRichNotes(
  profile: ParsedProfile,
  rawContext: string,
  userId: string
): Promise<SeedNote[]> {
  const contextSnippet = rawContext.length > 3000 ? rawContext.slice(0, 3000) + "..." : rawContext;

  const prompt = `Generate notes for a note-taking app from this user profile and context. Pull real details from the context — revenue, tech, strategies, timelines, etc.

Context:
"""
${contextSnippet}
"""

Profile:
${JSON.stringify(profile, null, 2)}

Rules:
- 1 note per business, 1 per project, 1 for interests, 1 for goals, 1 for people
- Each note: 3-6 sentences with real details from context. Use markdown (bold, lists).
- Categories: "Business — Name", "Project — Name", "Personal — Interests", "Personal — Goals", "Contacts"
- Keep it concise but informative

Return ONLY valid JSON (no markdown fences, no trailing commas):
{"notes":[{"categoryName":"str","categoryDescription":"str","title":"str","content":"str","tags":["str"],"priority":"low|medium|high"}]}`;

  const message = await trackedAICall({
    userId,
    operation: "seed",
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return parsed.notes as SeedNote[];
  } catch {
    console.error("AI returned invalid JSON for seed notes, falling back. Raw length:", text.length);
    if (message.stop_reason === "max_tokens") {
      console.error("Response was truncated by max_tokens limit");
    }
    return generateFallbackNotes(profile);
  }
}

export async function seedFromProfile(
  userId: string,
  profile: ParsedProfile,
  rawContext: string = ""
) {
  const { databases } = createAdminClient();

  const existingCats = await databases.listDocuments(
    DATABASE_ID,
    CATEGORIES_COLLECTION,
    [Query.equal("userId", userId), Query.limit(200)]
  );

  const existingNotes = await databases.listDocuments(
    DATABASE_ID,
    ORGANIZED_NOTES_COLLECTION,
    [Query.equal("userId", userId), Query.limit(500)]
  );

  const catNameToId = new Map<string, string>();
  for (const c of existingCats.documents) {
    catNameToId.set((c.name as string).toLowerCase(), c.$id);
  }

  const existingNoteTitles = new Set(
    existingNotes.documents.map(
      (n) => `${(n.categoryId as string)}::${(n.title as string).toLowerCase()}`
    )
  );

  const now = new Date().toISOString();
  let categoriesCreated = 0;
  let notesCreated = 0;

  const notes = rawContext.trim()
    ? await generateRichNotes(profile, rawContext, userId)
    : generateFallbackNotes(profile);

  for (const note of notes) {
    let categoryId = catNameToId.get(note.categoryName.toLowerCase());

    if (!categoryId) {
      const cat = await databases.createDocument(
        DATABASE_ID,
        CATEGORIES_COLLECTION,
        ID.unique(),
        {
          userId,
          name: note.categoryName,
          parentId: null,
          description: note.categoryDescription,
          status: "active",
          noteCount: 0,
          lastActivityAt: now,
        }
      );
      categoryId = cat.$id;
      catNameToId.set(note.categoryName.toLowerCase(), categoryId);
      categoriesCreated++;
    }

    const noteKey = `${categoryId}::${note.title.toLowerCase()}`;
    if (existingNoteTitles.has(noteKey)) {
      continue;
    }

    const rawNote = await databases.createDocument(
      DATABASE_ID,
      RAW_NOTES_COLLECTION,
      ID.unique(),
      { userId, content: `[Training] ${note.title}: ${note.content}` }
    );

    await databases.createDocument(
      DATABASE_ID,
      ORGANIZED_NOTES_COLLECTION,
      ID.unique(),
      {
        userId,
        categoryId,
        title: note.title,
        content: note.content,
        rawNoteId: rawNote.$id,
        tags: note.tags,
        priority: note.priority,
        status: "active",
        lastMentionedAt: now,
      }
    );

    existingNoteTitles.add(noteKey);
    notesCreated++;

    const catDoc = existingCats.documents.find((c) => c.$id === categoryId);
    const currentCount = (catDoc?.noteCount as number) || 0;
    await databases.updateDocument(
      DATABASE_ID,
      CATEGORIES_COLLECTION,
      categoryId,
      { noteCount: currentCount + 1, lastActivityAt: now }
    ).catch(() => {});
  }

  return { categoriesCreated, notesCreated };
}

function generateFallbackNotes(profile: ParsedProfile): SeedNote[] {
  const notes: SeedNote[] = [];

  for (const biz of profile.businesses) {
    notes.push({
      categoryName: `Business — ${biz.name}`,
      categoryDescription: `Notes about ${biz.name}`,
      title: `${biz.name} Overview`,
      content: `## ${biz.name}\n\n${biz.description}\n\nThis is a business/venture in the portfolio. Add more notes here as things develop.`,
      tags: ["business", "overview"],
      priority: "high",
    });
  }

  for (const proj of profile.projects) {
    notes.push({
      categoryName: `Project — ${proj.name}`,
      categoryDescription: `Notes about the ${proj.name} project`,
      title: `${proj.name} Overview`,
      content: `## ${proj.name}\n\n**Status:** ${proj.status}\n\n${proj.description}\n\nTrack progress, ideas, and decisions for this project here.`,
      tags: ["project", proj.status],
      priority: proj.status === "active" ? "high" : "medium",
    });
  }

  if (profile.interests.length > 0) {
    notes.push({
      categoryName: "Personal — Interests",
      categoryDescription: "Personal interests, hobbies, and areas of curiosity",
      title: "My Interests & Focus Areas",
      content: `## Interests & Focus Areas\n\n${profile.interests.map((i) => `- **${i}**`).join("\n")}\n\nThese are areas of interest and expertise. New notes related to these topics will be organized here.`,
      tags: ["interests", "personal"],
      priority: "medium",
    });
  }

  if (profile.goals.length > 0) {
    notes.push({
      categoryName: "Personal — Goals",
      categoryDescription: "Personal and professional goals",
      title: "Goals & Objectives",
      content: `## Goals & Objectives\n\n${profile.goals.map((g, i) => `${i + 1}. ${g}`).join("\n")}\n\nThese goals guide prioritization and decision-making across all projects and businesses.`,
      tags: ["goals", "planning"],
      priority: "high",
    });
  }

  if (profile.people.length > 0) {
    notes.push({
      categoryName: "Contacts",
      categoryDescription: "Important people and contacts",
      title: "Key People",
      content: `## Key People\n\n${profile.people.map((p) => `- **${p.name}** — ${p.role}`).join("\n")}\n\nImportant contacts and collaborators across projects and businesses.`,
      tags: ["people", "contacts"],
      priority: "medium",
    });
  }

  return notes;
}
