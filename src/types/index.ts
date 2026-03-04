export interface RawNote {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  userId: string;
  content: string;
}

export type CategoryStatus = "active" | "archived";

export interface Category {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  userId: string;
  name: string;
  parentId: string | null;
  description: string;
  status: CategoryStatus;
  noteCount: number;
  lastActivityAt: string;
}

export type NotePriority = "high" | "medium" | "low";
export type NoteStatus = "active" | "stale" | "archived";

export interface OrganizedNote {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  userId: string;
  categoryId: string;
  title: string;
  content: string;
  rawNoteId: string;
  tags: string[];
  priority: NotePriority;
  status: NoteStatus;
  lastMentionedAt: string;
}

export interface UserSettings {
  $id: string;
  userId: string;
  activeNoteLimit: number;
  archiveAfterDays: number;
  reorganizeIntervalDays: number;
}

export type TaskStatus = "pending" | "done";

export interface Task {
  $id: string;
  $createdAt: string;
  userId: string;
  title: string;
  description: string;
  status: TaskStatus;
  sourceNoteId: string | null;
  dueDate: string | null;
  createdAt: string;
}

export interface AIOrganizeResult {
  categoryName: string;
  categoryDescription: string;
  parentCategoryName: string | null;
  isNewCategory: boolean;
  title: string;
  content: string;
  tags: string[];
  priority: NotePriority;
}

export interface AIReorganizeResult {
  categoriesToCreate: {
    name: string;
    description: string;
    parentCategoryName: string | null;
  }[];
  categoriesToArchive: string[];
  categoriesToMerge: {
    sourceIds: string[];
    targetName: string;
    targetDescription: string;
  }[];
  notesToArchive: string[];
  notesToRecategorize: {
    noteId: string;
    newCategoryName: string;
  }[];
  summary: string;
}

export interface Digest {
  $id: string;
  $createdAt: string;
  userId: string;
  summary: string;
  changes: string;
  createdAt: string;
}

export interface DigestChanges {
  archived: number;
  created: number;
  recategorized: number;
  merged: number;
}

export interface UserProfile {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  userId: string;
  context: string;
  profile: string;
  trainingComplete: boolean;
  lastTrainedAt: string;
}

export interface ParsedProfile {
  businesses: { name: string; description: string }[];
  projects: { name: string; description: string; status: string }[];
  interests: string[];
  people: { name: string; role: string }[];
  goals: string[];
  other: string;
}

export interface ChatMessage {
  $id: string;
  $createdAt: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  sessionId: string;
  createdAt: string;
}

export interface ManualTrainAnswers {
  name: string;
  work: string;
  businesses: { name: string; description: string }[];
  projects: { name: string; description: string; status: string }[];
  goals: string[];
  interests: string[];
  people: { name: string; role: string }[];
}

export interface AITrainResult {
  profile: ParsedProfile;
  followUpQuestions: string[];
}

export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
  notes?: OrganizedNote[];
}
