import Anthropic from "@anthropic-ai/sdk";
import {
  createAdminClient,
  DATABASE_ID,
  AI_USAGE_COLLECTION,
} from "@/lib/appwrite-server";
import { ID, Query } from "node-appwrite";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Pricing per million tokens (as of Feb 2026)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.80, output: 4.00 },
  "claude-sonnet-4-6": { input: 3.00, output: 15.00 },
};

export type UsageOperation =
  | "organize"
  | "reorganize"
  | "chat"
  | "chat-context"
  | "train-extract"
  | "train-refine"
  | "seed"
  | "task-rewrite";

interface TrackedCallOptions {
  userId: string;
  operation: UsageOperation;
  model: string;
  max_tokens: number;
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export async function trackedAICall(options: TrackedCallOptions) {
  const { userId, operation, model, max_tokens, system, messages } = options;

  const params: any = { model, max_tokens, messages };
  if (system) params.system = system;

  const message = await anthropic.messages.create(params);

  const inputTokens = message.usage?.input_tokens ?? 0;
  const outputTokens = message.usage?.output_tokens ?? 0;
  const pricing = MODEL_PRICING[model] ?? { input: 3.0, output: 15.0 };
  const costUsd =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output;

  logUsage(userId, operation, model, inputTokens, outputTokens, costUsd).catch(
    (err) => console.error("Failed to log AI usage:", err)
  );

  return message;
}

async function logUsage(
  userId: string,
  operation: UsageOperation,
  model: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number
) {
  const { databases } = createAdminClient();

  await databases.createDocument(DATABASE_ID, AI_USAGE_COLLECTION, ID.unique(), {
    userId,
    operation,
    model,
    inputTokens,
    outputTokens,
    costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
    createdAt: new Date().toISOString(),
  });
}

export interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byModel: Record<string, { input: number; output: number; cost: number }>;
  byOperation: Record<string, { input: number; output: number; cost: number; count: number }>;
  recentCalls: {
    operation: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    createdAt: string;
  }[];
}

export async function getUsageStats(userId: string): Promise<UsageStats> {
  const { databases } = createAdminClient();

  const allDocs: any[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const batch = await databases.listDocuments(DATABASE_ID, AI_USAGE_COLLECTION, [
      Query.equal("userId", userId),
      Query.orderDesc("createdAt"),
      Query.limit(limit),
      Query.offset(offset),
    ]);
    allDocs.push(...batch.documents);
    if (batch.documents.length < limit) break;
    offset += limit;
  }

  const stats: UsageStats = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    byModel: {},
    byOperation: {},
    recentCalls: [],
  };

  for (const doc of allDocs) {
    const inp = (doc.inputTokens as number) || 0;
    const out = (doc.outputTokens as number) || 0;
    const cost = (doc.costUsd as number) || 0;
    const model = doc.model as string;
    const op = doc.operation as string;

    stats.totalInputTokens += inp;
    stats.totalOutputTokens += out;
    stats.totalCostUsd += cost;

    if (!stats.byModel[model]) stats.byModel[model] = { input: 0, output: 0, cost: 0 };
    stats.byModel[model].input += inp;
    stats.byModel[model].output += out;
    stats.byModel[model].cost += cost;

    if (!stats.byOperation[op]) stats.byOperation[op] = { input: 0, output: 0, cost: 0, count: 0 };
    stats.byOperation[op].input += inp;
    stats.byOperation[op].output += out;
    stats.byOperation[op].cost += cost;
    stats.byOperation[op].count += 1;
  }

  stats.totalCostUsd = Math.round(stats.totalCostUsd * 1_000_000) / 1_000_000;

  stats.recentCalls = allDocs.slice(0, 15).map((doc) => ({
    operation: doc.operation as string,
    model: doc.model as string,
    inputTokens: (doc.inputTokens as number) || 0,
    outputTokens: (doc.outputTokens as number) || 0,
    costUsd: (doc.costUsd as number) || 0,
    createdAt: doc.createdAt as string,
  }));

  return stats;
}
