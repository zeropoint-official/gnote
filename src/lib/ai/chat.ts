import { trackedAICall } from "./client";
import type { ParsedProfile } from "@/types";

const CHAT_SYSTEM_PROMPT = `You are an intelligent assistant that helps a user interact with their personal knowledge base (notes, categories, and profile). You answer questions, surface insights, and help the user think through their ideas.

Rules:
- Always ground your answers in the user's actual notes and profile data. Cite specific notes by their title when referencing them.
- If the user asks about something you have no data on, say so clearly rather than making things up.
- Be conversational but concise. Use bullet points for clarity when listing multiple items.
- When the user asks about a topic, look across ALL relevant categories — don't limit yourself to exact keyword matches.
- You can reference archived notes if they're relevant, but mention they are archived.
- Format citations as [Note: "title"] inline.`;

interface NoteContext {
  title: string;
  content: string;
  categoryName: string;
  status: string;
  tags: string[];
}

interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

function buildChatPrompt(
  userMessage: string,
  profile: ParsedProfile | null,
  notes: NoteContext[],
  categories: { name: string; description: string }[]
): string {
  const profileSection = profile
    ? `User Profile:
- Businesses: ${profile.businesses.map(b => `${b.name} (${b.description})`).join(", ") || "none"}
- Projects: ${profile.projects.map(p => `${p.name} [${p.status}]`).join(", ") || "none"}
- Interests: ${profile.interests.join(", ") || "none"}
- Goals: ${profile.goals.join(", ") || "none"}
- People: ${profile.people.map(p => `${p.name} (${p.role})`).join(", ") || "none"}
${profile.other ? `- Other: ${profile.other}` : ""}`
    : "No user profile available.";

  const categorySection = categories.length > 0
    ? categories.map(c => `- ${c.name}: ${c.description}`).join("\n")
    : "No categories yet.";

  const noteSection = notes.length > 0
    ? notes.map(n =>
        `[${n.status === "archived" ? "ARCHIVED" : "ACTIVE"}] "${n.title}" (${n.categoryName}, tags: ${n.tags.join(", ")})\n${n.content}`
      ).join("\n---\n")
    : "No notes available.";

  return `${profileSection}

Categories:
${categorySection}

Relevant Notes:
${noteSection}

User's question:
${userMessage}`;
}

export async function chat(
  userMessage: string,
  profile: ParsedProfile | null,
  notes: NoteContext[],
  categories: { name: string; description: string }[],
  history: ChatHistoryMessage[],
  userId: string
): Promise<string> {
  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...history.slice(-20),
    { role: "user", content: buildChatPrompt(userMessage, profile, notes, categories) },
  ];

  const message = await trackedAICall({
    userId,
    operation: "chat",
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: CHAT_SYSTEM_PROMPT,
    messages,
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

const CONTEXT_SELECTOR_PROMPT = `You are a context selector. Given a user's question and available categories, determine which categories and search terms are most relevant. Be broad — include anything that might be tangentially related.

IMPORTANT: Respond with ONLY valid JSON, no markdown or explanation.`;

export async function selectContext(
  userMessage: string,
  categories: { name: string; description: string }[],
  userId: string
): Promise<{ categoryNames: string[]; searchTerms: string[] }> {
  const message = await trackedAICall({
    userId,
    operation: "chat-context",
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: CONTEXT_SELECTOR_PROMPT,
    messages: [
      {
        role: "user",
        content: `Available categories:\n${categories.map(c => `- ${c.name}: ${c.description}`).join("\n")}\n\nUser's question: "${userMessage}"\n\nRespond with:\n{"categoryNames": ["relevant category names"], "searchTerms": ["keywords to search notes for"]}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return { categoryNames: categories.map(c => c.name), searchTerms: [] };
  }
}
