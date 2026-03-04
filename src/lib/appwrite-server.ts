import { Client, Databases, Users, Account } from "node-appwrite";

export function createAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  return {
    databases: new Databases(client),
    users: new Users(client),
  };
}

export function createSessionClient(session: string) {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setSession(session);

  return {
    databases: new Databases(client),
    account: new Account(client),
  };
}

export const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
export const RAW_NOTES_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_RAW_NOTES_COLLECTION_ID!;
export const CATEGORIES_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_CATEGORIES_COLLECTION_ID!;
export const ORGANIZED_NOTES_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_ORGANIZED_NOTES_COLLECTION_ID!;
export const USER_SETTINGS_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_USER_SETTINGS_COLLECTION_ID!;
export const USER_PROFILE_COLLECTION = "user-profile";
export const CHAT_HISTORY_COLLECTION = "chat-history";
export const TASKS_COLLECTION = "tasks";
export const AI_USAGE_COLLECTION = "ai-usage";
