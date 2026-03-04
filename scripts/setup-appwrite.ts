/**
 * Automated Appwrite database setup for Gnote.
 *
 * Usage:
 *   pnpm setup-db          # create everything
 *   pnpm setup-db --reset  # wipe and recreate everything
 *
 * Prerequisites: fill in .env.local with your Appwrite credentials.
 */

import { Client, Databases, ID, IndexType, Permission, Role } from "node-appwrite";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const API_KEY = process.env.APPWRITE_API_KEY!;
const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

if (!ENDPOINT || !PROJECT || !API_KEY || !DB_ID) {
  console.error("Missing env vars. Make sure .env.local is filled in:");
  console.error("  NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID,");
  console.error("  APPWRITE_API_KEY, NEXT_PUBLIC_APPWRITE_DATABASE_ID");
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const db = new Databases(client);

const isReset = process.argv.includes("--reset");

const COLLECTION_IDS = {
  rawNotes: process.env.NEXT_PUBLIC_APPWRITE_RAW_NOTES_COLLECTION_ID || "raw-notes",
  categories: process.env.NEXT_PUBLIC_APPWRITE_CATEGORIES_COLLECTION_ID || "categories",
  organizedNotes: process.env.NEXT_PUBLIC_APPWRITE_ORGANIZED_NOTES_COLLECTION_ID || "organized-notes",
  userSettings: process.env.NEXT_PUBLIC_APPWRITE_USER_SETTINGS_COLLECTION_ID || "user-settings",
  digests: "digests",
  userProfile: "user-profile",
  chatHistory: "chat-history",
  tasks: "tasks",
  aiUsage: "ai-usage",
};

const PERMISSIONS = [
  Permission.read(Role.users()),
  Permission.create(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForAttribute(collectionId: string, key: string, maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const attr = await db.getAttribute(DB_ID, collectionId, key);
      if ((attr as any).status === "available") return;
    } catch {
      // attribute might not exist yet
    }
    await wait(500);
  }
  console.warn(`  ⚠ Timed out waiting for attribute "${key}" on "${collectionId}"`);
}

async function createAttr(
  collectionId: string,
  fn: () => Promise<any>,
  key: string
) {
  try {
    const existing = await db.getAttribute(DB_ID, collectionId, key);
    if (existing) {
      console.log(`    - attribute: ${key} (exists)`);
      return;
    }
  } catch {
    // attribute doesn't exist yet, proceed to create
  }

  try {
    await fn();
    console.log(`    + attribute: ${key}`);
    await waitForAttribute(collectionId, key);
  } catch (e: any) {
    if (e.code === 409) {
      console.log(`    - attribute: ${key} (exists)`);
    } else {
      throw e;
    }
  }
}

async function createIdx(fn: () => Promise<any>, name: string) {
  try {
    await fn();
    console.log(`    + index: ${name}`);
    await wait(1000);
  } catch (e: any) {
    if (e.code === 409) {
      console.log(`    - index: ${name} (exists)`);
    } else {
      throw e;
    }
  }
}

// ─── Teardown ──────────────────────────────────────────────────

async function teardown() {
  console.log("\n🗑  Tearing down existing database...\n");
  for (const [name, id] of Object.entries(COLLECTION_IDS)) {
    try {
      await db.deleteCollection(DB_ID, id);
      console.log(`  ✓ Deleted collection: ${name} (${id})`);
    } catch (e: any) {
      if (e.code === 404) console.log(`  - Collection ${name} doesn't exist`);
      else throw e;
    }
  }
  try {
    await db.delete(DB_ID);
    console.log(`  ✓ Deleted database: ${DB_ID}`);
  } catch (e: any) {
    if (e.code === 404) console.log(`  - Database doesn't exist`);
    else throw e;
  }
}

// ─── Setup ─────────────────────────────────────────────────────

async function setup() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   Gnote — Appwrite Database Setup    ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log(`Endpoint : ${ENDPOINT}`);
  console.log(`Project  : ${PROJECT}`);
  console.log(`Database : ${DB_ID}`);
  console.log(`Reset    : ${isReset}\n`);

  if (isReset) {
    await teardown();
    console.log("");
  }

  // ── Database ──

  try {
    await db.create(DB_ID, "Gnote");
    console.log("✓ Database created");
  } catch (e: any) {
    if (e.code === 409) console.log("- Database already exists");
    else throw e;
  }

  // ── raw-notes ──

  const RAW = COLLECTION_IDS.rawNotes;
  console.log(`\n── raw-notes (${RAW}) ──`);
  try {
    await db.createCollection(DB_ID, RAW, "Raw Notes", PERMISSIONS);
    console.log("  ✓ Collection created");
  } catch (e: any) {
    if (e.code === 409) console.log("  - Collection exists");
    else throw e;
  }

  await createAttr(RAW, () => db.createStringAttribute(DB_ID, RAW, "userId", 255, true), "userId");
  await createAttr(RAW, () => db.createStringAttribute(DB_ID, RAW, "content", 10000, true), "content");

  await createIdx(
    () => db.createIndex(DB_ID, RAW, "idx_userId", IndexType.Key, ["userId"]),
    "idx_userId"
  );

  // ── categories ──

  const CAT = COLLECTION_IDS.categories;
  console.log(`\n── categories (${CAT}) ──`);
  try {
    await db.createCollection(DB_ID, CAT, "Categories", PERMISSIONS);
    console.log("  ✓ Collection created");
  } catch (e: any) {
    if (e.code === 409) console.log("  - Collection exists");
    else throw e;
  }

  await createAttr(CAT, () => db.createStringAttribute(DB_ID, CAT, "userId", 255, true), "userId");
  await createAttr(CAT, () => db.createStringAttribute(DB_ID, CAT, "name", 255, true), "name");
  await createAttr(CAT, () => db.createStringAttribute(DB_ID, CAT, "parentId", 255, false), "parentId");
  await createAttr(CAT, () => db.createStringAttribute(DB_ID, CAT, "description", 2000, true), "description");
  await createAttr(CAT, () => db.createEnumAttribute(DB_ID, CAT, "status", ["active", "archived"], false, "active"), "status");
  await createAttr(CAT, () => db.createIntegerAttribute(DB_ID, CAT, "noteCount", false, 0), "noteCount");
  await createAttr(CAT, () => db.createDatetimeAttribute(DB_ID, CAT, "lastActivityAt", true), "lastActivityAt");

  await createIdx(
    () => db.createIndex(DB_ID, CAT, "idx_userId_status", IndexType.Key, ["userId", "status"]),
    "idx_userId_status"
  );

  // ── organized-notes ──

  const ORG = COLLECTION_IDS.organizedNotes;
  console.log(`\n── organized-notes (${ORG}) ──`);
  try {
    await db.createCollection(DB_ID, ORG, "Organized Notes", PERMISSIONS);
    console.log("  ✓ Collection created");
  } catch (e: any) {
    if (e.code === 409) console.log("  - Collection exists");
    else throw e;
  }

  await createAttr(ORG, () => db.createStringAttribute(DB_ID, ORG, "userId", 255, true), "userId");
  await createAttr(ORG, () => db.createStringAttribute(DB_ID, ORG, "categoryId", 255, true), "categoryId");
  await createAttr(ORG, () => db.createStringAttribute(DB_ID, ORG, "title", 500, true), "title");
  await createAttr(ORG, () => db.createStringAttribute(DB_ID, ORG, "content", 10000, true), "content");
  await createAttr(ORG, () => db.createStringAttribute(DB_ID, ORG, "rawNoteId", 255, true), "rawNoteId");
  await createAttr(ORG, () => db.createStringAttribute(DB_ID, ORG, "tags", 100, true, undefined, true), "tags");
  await createAttr(ORG, () => db.createEnumAttribute(DB_ID, ORG, "priority", ["high", "medium", "low"], false, "medium"), "priority");
  await createAttr(ORG, () => db.createEnumAttribute(DB_ID, ORG, "status", ["active", "stale", "archived"], false, "active"), "status");
  await createAttr(ORG, () => db.createDatetimeAttribute(DB_ID, ORG, "lastMentionedAt", true), "lastMentionedAt");

  await createIdx(
    () => db.createIndex(DB_ID, ORG, "idx_userId_status", IndexType.Key, ["userId", "status"]),
    "idx_userId_status"
  );
  await createIdx(
    () => db.createIndex(DB_ID, ORG, "idx_categoryId", IndexType.Key, ["categoryId"]),
    "idx_categoryId"
  );

  // ── user-settings ──

  const SET = COLLECTION_IDS.userSettings;
  console.log(`\n── user-settings (${SET}) ──`);
  try {
    await db.createCollection(DB_ID, SET, "User Settings", PERMISSIONS);
    console.log("  ✓ Collection created");
  } catch (e: any) {
    if (e.code === 409) console.log("  - Collection exists");
    else throw e;
  }

  await createAttr(SET, () => db.createStringAttribute(DB_ID, SET, "userId", 255, true), "userId");
  await createAttr(SET, () => db.createIntegerAttribute(DB_ID, SET, "activeNoteLimit", false, 100), "activeNoteLimit");
  await createAttr(SET, () => db.createIntegerAttribute(DB_ID, SET, "archiveAfterDays", false, 30), "archiveAfterDays");
  await createAttr(SET, () => db.createIntegerAttribute(DB_ID, SET, "reorganizeIntervalDays", false, 7), "reorganizeIntervalDays");

  await createIdx(
    () => db.createIndex(DB_ID, SET, "idx_userId", IndexType.Unique, ["userId"]),
    "idx_userId (unique)"
  );

  // ── digests ──

  const DIG = COLLECTION_IDS.digests;
  console.log(`\n── digests (${DIG}) ──`);
  try {
    await db.createCollection(DB_ID, DIG, "Digests", PERMISSIONS);
    console.log("  ✓ Collection created");
  } catch (e: any) {
    if (e.code === 409) console.log("  - Collection exists");
    else throw e;
  }

  await createAttr(DIG, () => db.createStringAttribute(DB_ID, DIG, "userId", 255, true), "userId");
  await createAttr(DIG, () => db.createStringAttribute(DB_ID, DIG, "summary", 5000, true), "summary");
  await createAttr(DIG, () => db.createStringAttribute(DB_ID, DIG, "changes", 2000, true), "changes");
  await createAttr(DIG, () => db.createDatetimeAttribute(DB_ID, DIG, "createdAt", true), "createdAt");

  await createIdx(
    () => db.createIndex(DB_ID, DIG, "idx_userId", IndexType.Key, ["userId"]),
    "idx_userId"
  );

  // ── user-profile ──

  const UP = COLLECTION_IDS.userProfile;
  console.log(`\n── user-profile (${UP}) ──`);
  try {
    await db.createCollection(DB_ID, UP, "User Profile", PERMISSIONS);
    console.log("  ✓ Collection created");
  } catch (e: any) {
    if (e.code === 409) console.log("  - Collection exists");
    else throw e;
  }

  await createAttr(UP, () => db.createStringAttribute(DB_ID, UP, "userId", 255, true), "userId");
  await createAttr(UP, () => db.createStringAttribute(DB_ID, UP, "context", 50000, false), "context");
  await createAttr(UP, () => db.createStringAttribute(DB_ID, UP, "profile", 50000, false), "profile");
  await createAttr(UP, () => db.createBooleanAttribute(DB_ID, UP, "trainingComplete", false, false), "trainingComplete");
  await createAttr(UP, () => db.createDatetimeAttribute(DB_ID, UP, "lastTrainedAt", false), "lastTrainedAt");

  await createIdx(
    () => db.createIndex(DB_ID, UP, "idx_userId", IndexType.Unique, ["userId"]),
    "idx_userId (unique)"
  );

  // ── chat-history ──

  const CH = COLLECTION_IDS.chatHistory;
  console.log(`\n── chat-history (${CH}) ──`);
  try {
    await db.createCollection(DB_ID, CH, "Chat History", PERMISSIONS);
    console.log("  ✓ Collection created");
  } catch (e: any) {
    if (e.code === 409) console.log("  - Collection exists");
    else throw e;
  }

  await createAttr(CH, () => db.createStringAttribute(DB_ID, CH, "userId", 255, true), "userId");
  await createAttr(CH, () => db.createEnumAttribute(DB_ID, CH, "role", ["user", "assistant"], true), "role");
  await createAttr(CH, () => db.createStringAttribute(DB_ID, CH, "content", 50000, true), "content");
  await createAttr(CH, () => db.createStringAttribute(DB_ID, CH, "sessionId", 255, true), "sessionId");
  await createAttr(CH, () => db.createDatetimeAttribute(DB_ID, CH, "createdAt", true), "createdAt");

  await createIdx(
    () => db.createIndex(DB_ID, CH, "idx_userId_session", IndexType.Key, ["userId", "sessionId"]),
    "idx_userId_session"
  );
  await createIdx(
    () => db.createIndex(DB_ID, CH, "idx_sessionId", IndexType.Key, ["sessionId"]),
    "idx_sessionId"
  );

  // ── tasks ──

  const TSK = COLLECTION_IDS.tasks;
  console.log(`\n── tasks (${TSK}) ──`);
  try {
    await db.createCollection(DB_ID, TSK, "Tasks", PERMISSIONS);
    console.log("  ✓ Collection created");
  } catch (e: any) {
    if (e.code === 409) console.log("  - Collection exists");
    else throw e;
  }

  await createAttr(TSK, () => db.createStringAttribute(DB_ID, TSK, "userId", 255, true), "userId");
  await createAttr(TSK, () => db.createStringAttribute(DB_ID, TSK, "title", 500, true), "title");
  await createAttr(TSK, () => db.createStringAttribute(DB_ID, TSK, "description", 2000, false), "description");
  await createAttr(TSK, () => db.createEnumAttribute(DB_ID, TSK, "status", ["pending", "done"], false, "pending"), "status");
  await createAttr(TSK, () => db.createStringAttribute(DB_ID, TSK, "sourceNoteId", 255, false), "sourceNoteId");
  await createAttr(TSK, () => db.createDatetimeAttribute(DB_ID, TSK, "dueDate", false), "dueDate");
  await createAttr(TSK, () => db.createDatetimeAttribute(DB_ID, TSK, "createdAt", true), "createdAt");

  await createIdx(
    () => db.createIndex(DB_ID, TSK, "idx_userId_status", IndexType.Key, ["userId", "status"]),
    "idx_userId_status"
  );

  // ── ai-usage ──

  const AUI = COLLECTION_IDS.aiUsage;
  console.log(`\n── ai-usage (${AUI}) ──`);
  try {
    await db.createCollection(DB_ID, AUI, "AI Usage", PERMISSIONS);
    console.log("  ✓ Collection created");
  } catch (e: any) {
    if (e.code === 409) console.log("  - Collection exists");
    else throw e;
  }
  await createAttr(AUI, () => db.createStringAttribute(DB_ID, AUI, "userId", 255, true), "userId");
  await createAttr(AUI, () => db.createStringAttribute(DB_ID, AUI, "operation", 50, true), "operation");
  await createAttr(AUI, () => db.createStringAttribute(DB_ID, AUI, "model", 100, true), "model");
  await createAttr(AUI, () => db.createIntegerAttribute(DB_ID, AUI, "inputTokens", true, 0), "inputTokens");
  await createAttr(AUI, () => db.createIntegerAttribute(DB_ID, AUI, "outputTokens", true, 0), "outputTokens");
  await createAttr(AUI, () => db.createFloatAttribute(DB_ID, AUI, "costUsd", true, 0), "costUsd");
  await createAttr(AUI, () => db.createDatetimeAttribute(DB_ID, AUI, "createdAt", true), "createdAt");
  await createIdx(
    () => db.createIndex(DB_ID, AUI, "idx_userId_createdAt", IndexType.Key, ["userId", "createdAt"]),
    "idx_userId_createdAt"
  );

  // ── Done ──

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║          ✓ Setup Complete!            ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log("All 9 collections created with permissions for authenticated users.");
  console.log("You can now run: pnpm dev\n");
}

setup().catch((err) => {
  console.error("\n✗ Setup failed:\n", err);
  process.exit(1);
});
