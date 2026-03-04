import { trackedAICall } from "./client";
import type { AITrainResult, ManualTrainAnswers, ParsedProfile } from "@/types";

const TRAIN_SYSTEM_PROMPT = `You are an intelligent assistant helping a user set up their personal knowledge profile. Your goal is to extract structured information from a freeform text dump about the user's life, work, projects, and interests.

Extract these categories:
- Businesses: companies or ventures the user runs or is involved in
- Projects: ongoing or planned projects with their status
- Interests: topics, hobbies, or areas the user cares about
- People: important people mentioned and their relationship/role
- Goals: things the user wants to achieve
- Other: anything else notable that doesn't fit the above

After extracting, identify 3-5 follow-up questions that would fill important gaps. For example, if the user mentions a business but doesn't describe what it does, ask about it. If they mention goals but no timeline, ask about priority.

Questions should be specific and contextual — NOT generic. Reference the user's actual content.

IMPORTANT: Respond with ONLY valid JSON, no markdown or explanation.`;

function buildTrainPrompt(rawContext: string): string {
  return `Here is what the user shared about themselves:

"""
${rawContext}
"""

Parse this into a structured profile and generate follow-up questions for any gaps.

Respond with this exact JSON structure:
{
  "profile": {
    "businesses": [{"name": "string", "description": "string"}],
    "projects": [{"name": "string", "description": "string", "status": "active | planned | on-hold | completed"}],
    "interests": ["string"],
    "people": [{"name": "string", "role": "string"}],
    "goals": ["string"],
    "other": "string - anything else notable"
  },
  "followUpQuestions": ["string - specific contextual question"]
}`;
}

const REFINE_SYSTEM_PROMPT = `You are refining a user's knowledge profile based on their answers to follow-up questions. Merge the new information into the existing profile, adding or updating entries as needed. Generate 2-3 more follow-up questions if there are still significant gaps, or return an empty array if the profile feels complete.

IMPORTANT: Respond with ONLY valid JSON, no markdown or explanation.`;

function buildRefinePrompt(
  existingProfile: ParsedProfile,
  questions: string[],
  answers: string[]
): string {
  const qaPairs = questions
    .map((q, i) => `Q: ${q}\nA: ${answers[i] || "(skipped)"}`)
    .join("\n\n");

  return `Existing profile:
${JSON.stringify(existingProfile, null, 2)}

Follow-up Q&A:
${qaPairs}

Merge the answers into the profile and determine if more questions are needed.

Respond with this exact JSON structure:
{
  "profile": {
    "businesses": [{"name": "string", "description": "string"}],
    "projects": [{"name": "string", "description": "string", "status": "active | planned | on-hold | completed"}],
    "interests": ["string"],
    "people": [{"name": "string", "role": "string"}],
    "goals": ["string"],
    "other": "string"
  },
  "followUpQuestions": ["string - or empty array if profile is complete"]
}`;
}

export async function extractProfile(rawContext: string, userId: string): Promise<AITrainResult> {
  const message = await trackedAICall({
    userId,
    operation: "train-extract",
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: TRAIN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildTrainPrompt(rawContext) }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as AITrainResult;
}

export async function refineProfile(
  existingProfile: ParsedProfile,
  questions: string[],
  answers: string[],
  userId: string
): Promise<AITrainResult> {
  const message = await trackedAICall({
    userId,
    operation: "train-refine",
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: REFINE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildRefinePrompt(existingProfile, questions, answers) }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as AITrainResult;
}

const MANUAL_SYSTEM_PROMPT = `You are an intelligent assistant helping a user set up their personal knowledge profile from structured form answers. Synthesize the provided answers into a rich, well-organized profile. Fill in reasonable descriptions where the user gave brief answers. Do NOT invent information that wasn't provided or implied.

IMPORTANT: Respond with ONLY valid JSON, no markdown or explanation.`;

function buildManualPrompt(answers: ManualTrainAnswers): string {
  const sections: string[] = [];

  if (answers.name) sections.push(`Name: ${answers.name}`);
  if (answers.work) sections.push(`Work / Industry: ${answers.work}`);

  if (answers.businesses.length > 0) {
    sections.push(
      "Businesses:\n" +
        answers.businesses
          .map((b) => `- ${b.name}${b.description ? `: ${b.description}` : ""}`)
          .join("\n")
    );
  }

  if (answers.projects.length > 0) {
    sections.push(
      "Projects:\n" +
        answers.projects
          .map(
            (p) =>
              `- ${p.name} (${p.status})${p.description ? `: ${p.description}` : ""}`
          )
          .join("\n")
    );
  }

  if (answers.goals.length > 0) {
    sections.push("Goals:\n" + answers.goals.map((g) => `- ${g}`).join("\n"));
  }

  if (answers.interests.length > 0) {
    sections.push("Interests: " + answers.interests.join(", "));
  }

  if (answers.people.length > 0) {
    sections.push(
      "Key People:\n" +
        answers.people.map((p) => `- ${p.name} (${p.role})`).join("\n")
    );
  }

  return `Here are the user's answers from a guided setup form:

${sections.join("\n\n")}

Synthesize this into a structured profile. Expand brief answers into proper descriptions where appropriate, but do not invent facts.

Respond with this exact JSON structure:
{
  "profile": {
    "businesses": [{"name": "string", "description": "string"}],
    "projects": [{"name": "string", "description": "string", "status": "active | planned | on-hold | completed"}],
    "interests": ["string"],
    "people": [{"name": "string", "role": "string"}],
    "goals": ["string"],
    "other": "string - anything else notable"
  },
  "followUpQuestions": []
}`;
}

export async function generateProfileFromAnswers(
  answers: ManualTrainAnswers,
  userId: string
): Promise<AITrainResult> {
  const message = await trackedAICall({
    userId,
    operation: "train-extract",
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: MANUAL_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildManualPrompt(answers) }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as AITrainResult;
}
