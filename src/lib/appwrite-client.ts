import { Client, Account, Databases } from "appwrite";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

export const account = new Account(client);
export const databases = new Databases(client);
export { client };

export const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
export const RAW_NOTES_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_RAW_NOTES_COLLECTION_ID!;
export const CATEGORIES_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_CATEGORIES_COLLECTION_ID!;
export const ORGANIZED_NOTES_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_ORGANIZED_NOTES_COLLECTION_ID!;
export const USER_SETTINGS_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_USER_SETTINGS_COLLECTION_ID!;
