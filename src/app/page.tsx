"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { IconRail } from "@/components/icon-rail";
import { FileViewer } from "@/components/file-viewer";
import type { AppMode } from "@/components/mode-switcher";
import { SettingsSheet } from "@/components/settings-sheet";
import { NoteInput } from "@/components/note-input";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { MemoriesView } from "@/components/memories/memories-view";
import { TaskView } from "@/components/task-view";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain,
  Loader2,
  Send,
  Plus,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Building2,
  FolderKanban,
  Heart,
  Users,
  Target,
  MessageCircle,
  FolderPlus,
  Import,
  ClipboardList,
  Copy,
  Check,
  Trash2,
  Menu,
  ListTodo,
  Pencil,
  FolderOpen,
  Settings2,
  ChevronRight,
  ChevronDown,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type {
  CategoryWithChildren,
  OrganizedNote,
  Task,
  RawNote,
  ParsedProfile,
  ManualTrainAnswers,
} from "@/types";

type TrainStep = "loading" | "choose" | "chatgpt-prompt" | "chatgpt-paste" | "manual" | "processing" | "configure";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function generateSessionId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AppShell() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<AppMode>("note");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileTaskOpen, setMobileTaskOpen] = useState(false);

  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [allNotes, setAllNotes] = useState<OrganizedNote[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  const [counts, setCounts] = useState({ active: 0, archived: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [rawNotesMap, setRawNotesMap] = useState<Record<string, string>>({});
  const [reorganizing, setReorganizing] = useState(false);

  const [recentNotes, setRecentNotes] = useState<RawNote[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSessionId, setChatSessionId] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [trainStep, setTrainStep] = useState<TrainStep>("loading");
  const [profile, setProfile] = useState<ParsedProfile | null>(null);
  const [trainSubmitting, setTrainSubmitting] = useState(false);
  const [existingProfile, setExistingProfile] = useState(false);

  useKeyboardShortcuts({
    onModeChange: (m) => { setMode(m); setSelectedNoteId(null); },
    onSettingsOpen: () => setSettingsOpen(true),
  });

  const fetchMindData = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/mind?userId=${user.$id}&status=${statusFilter}`);
      const data = await res.json();
      setCategories(data.tree || []);
      setAllNotes(data.notes || []);
      if (data.counts) setCounts(data.counts);

      const rawRes = await fetch(`/api/notes?userId=${user.$id}`);
      const rawData = await rawRes.json();
      const map: Record<string, string> = {};
      for (const note of rawData.notes || []) {
        map[note.$id] = note.content;
      }
      setRawNotesMap(map);
      setRecentNotes(rawData.notes || []);
    } catch {} finally {
      setLoadingData(false);
    }
  }, [user, statusFilter]);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/tasks?userId=${user.$id}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch {} finally {
      setLoadingTasks(false);
    }
  }, [user]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/train?userId=${user.$id}`);
      const data = await res.json();
      if (data.profile && data.trainingComplete) {
        setProfile(data.profile);
        setExistingProfile(true);
        setTrainStep("configure");
      } else if (data.profile) {
        setProfile(data.profile);
        setExistingProfile(true);
        setTrainStep("choose");
      } else {
        setTrainStep("choose");
      }
    } catch {
      setTrainStep("choose");
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchMindData();
      fetchTasks();
      fetchProfile();
    }
  }, [user, fetchMindData, fetchTasks, fetchProfile]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleNoteSubmit = async (content: string) => {
    if (!user) return;
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, userId: user.$id }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error("Failed to save note"); throw new Error("Failed"); }
    if (data.organized) {
      toast.success(`Organized into "${data.categoryName}"`, {
        description: data.isNewCategory ? "New category created" : "Added to existing category",
      });
    }
    fetchMindData();
  };

  const handleTaskToggle = async (taskId: string, newStatus: "pending" | "done") => {
    setTasks((prev) => prev.map((t) => t.$id === taskId ? { ...t, status: newStatus } : t));
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: newStatus }),
      });
    } catch { fetchTasks(); }
  };

  const handleTaskCreate = async (title: string) => {
    if (!user) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.$id, title }),
      });
      const data = await res.json();
      if (data.task) setTasks((prev) => [data.task, ...prev]);
    } catch { toast.error("Failed to create task"); }
  };

  const handleTaskDelete = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.$id !== taskId));
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: "done" }),
      });
    } catch { fetchTasks(); }
  };

  const handleReorganize = async () => {
    if (!user || reorganizing) return;
    setReorganizing(true);
    try {
      const res = await fetch("/api/reorganize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.$id }),
      });
      const data = await res.json();
      if (data.summary) toast.success("Reorganization complete", { description: data.summary });
      else toast.info(data.message || "Nothing to reorganize");
      fetchMindData();
    } catch { toast.error("Reorganization failed"); }
    finally { setReorganizing(false); }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleSelectNote = (noteId: string, categoryId: string) => {
    setSelectedNoteId(noteId);
    setSelectedCategoryId(categoryId);
  };

  const handleChatSend = async () => {
    if (!user || !chatInput.trim() || chatSending) return;
    let sid = chatSessionId;
    if (!sid) { sid = generateSessionId(); setChatSessionId(sid); }
    const userMsg: ChatMessage = { id: `temp-${Date.now()}`, role: "user", content: chatInput.trim() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.$id, message: userMsg.content, sessionId: sid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChatMessages((prev) => [...prev, { id: `resp-${Date.now()}`, role: "assistant", content: data.reply }]);
    } catch {
      toast.error("Failed to get a response");
      setChatMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setChatInput(userMsg.content);
    } finally {
      setChatSending(false);
      chatInputRef.current?.focus();
    }
  };

  const handleChatGPTImport = async (importedProfile: ParsedProfile) => {
    if (!user) return;
    setTrainSubmitting(true);
    setTrainStep("processing");
    try {
      const res = await fetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.$id, step: "chatgpt-import", profile: importedProfile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(data.profile);
      setExistingProfile(true);
      setTrainStep("configure");
      toast.success("Profile imported successfully");
    } catch {
      toast.error("Failed to import profile");
      setTrainStep("chatgpt-paste");
    } finally { setTrainSubmitting(false); }
  };

  const handleManualSubmit = async (answers: ManualTrainAnswers) => {
    if (!user) return;
    setTrainSubmitting(true);
    setTrainStep("processing");
    try {
      const res = await fetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.$id, step: "manual", manualAnswers: answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(data.profile);
      setExistingProfile(true);
      setTrainStep("configure");
      toast.success("Profile created successfully");
    } catch {
      toast.error("Failed to generate profile");
      setTrainStep("manual");
    } finally { setTrainSubmitting(false); }
  };

  const handleProfileUpdate = async (updatedProfile: ParsedProfile) => {
    if (!user) return;
    try {
      const res = await fetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.$id, step: "update-profile", profile: updatedProfile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(data.profile);
      toast.success("Profile saved");
    } catch {
      toast.error("Failed to save profile");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Brain className="w-6 h-6 text-primary animate-pulse" />
      </div>
    );
  }

  if (!user) return null;

  const initials = user.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() ?? "?";

  const selectedNote = selectedNoteId ? allNotes.find((n) => n.$id === selectedNoteId) : null;
  const selectedCatName = selectedCategoryId
    ? categories.find((c) => c.$id === selectedCategoryId)?.name ??
      categories.flatMap((c) => c.children).find((c) => c.$id === selectedCategoryId)?.name ?? "Category"
    : "Category";

  const mainContent = (
    <AnimatePresence mode="wait">
      {selectedNote ? (
        <FileViewer
          key="viewer"
          note={selectedNote}
          categoryName={selectedCatName}
          rawContent={rawNotesMap[selectedNote.rawNoteId]}
          onBack={() => setSelectedNoteId(null)}
        />
      ) : mode === "note" ? (
        <NoteMode
          key="note"
          onSubmit={handleNoteSubmit}
          onTaskCreate={handleTaskCreate}
          recentNotes={recentNotes}
        />
      ) : mode === "chat" ? (
        <ChatMode
          key="chat"
          messages={chatMessages}
          input={chatInput}
          sending={chatSending}
          scrollRef={chatScrollRef}
          inputRef={chatInputRef}
          onInputChange={setChatInput}
          onSend={handleChatSend}
          onNewChat={() => { setChatSessionId(generateSessionId()); setChatMessages([]); }}
        />
      ) : mode === "memories" ? (
        <MemoriesView
          key="memories"
          categories={categories}
          allNotes={allNotes}
          rawNotesMap={rawNotesMap}
          statusFilter={statusFilter}
          counts={counts}
          onStatusFilterChange={(s) => { setStatusFilter(s); setSelectedNoteId(null); }}
          onSelectNote={handleSelectNote}
          onReorganize={handleReorganize}
          reorganizing={reorganizing}
          loading={loadingData}
        />
      ) : mode === "tasks" ? (
        <TaskView
          key="tasks"
          tasks={tasks}
          onTaskToggle={handleTaskToggle}
          onTaskCreate={handleTaskCreate}
          onTaskDelete={handleTaskDelete}
          loading={loadingTasks}
        />
      ) : (
        <TrainMode
          key="train"
          userId={user.$id}
          step={trainStep}
          profile={profile}
          submitting={trainSubmitting}
          existingProfile={existingProfile}
          categories={categories}
          allNotes={allNotes}
          onStepChange={setTrainStep}
          onChatGPTImport={handleChatGPTImport}
          onManualSubmit={handleManualSubmit}
          onProfileUpdate={handleProfileUpdate}
          onGoToChat={() => setMode("chat")}
          onMindRefresh={fetchMindData}
        />
      )}
    </AnimatePresence>
  );

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Desktop: icon rail + content */}
      <div className="hidden md:flex flex-1">
        <IconRail
          mode={mode}
          onModeChange={(m) => { setMode(m); setSelectedNoteId(null); }}
          onSettingsOpen={() => setSettingsOpen(true)}
          onLogout={handleLogout}
          userInitials={initials}
          userName={user.name}
          userEmail={user.email}
        />
        <main className="flex-1 flex flex-col min-w-0">
          {mainContent}
        </main>
      </div>

      {/* Mobile: header + swipe drawers + content */}
      <div className="md:hidden flex flex-col flex-1">
        <header className="h-11 border-b border-border/30 bg-background/80 backdrop-blur-xl flex items-center justify-between px-2 shrink-0 z-50">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center">
              <Brain className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-xs tracking-tight capitalize">{mode}</span>
          </div>
          <button
            onClick={() => setMobileTaskOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <ListTodo className="w-4 h-4" />
          </button>
        </header>

        <MobileShell
          mode={mode}
          onModeChange={(m) => { setMode(m); setSelectedNoteId(null); }}
          onSettingsOpen={() => setSettingsOpen(true)}
          onLogout={handleLogout}
          userInitials={initials}
          userName={user.name}
          userEmail={user.email}
          tasks={tasks}
          onTaskToggle={handleTaskToggle}
          onTaskCreate={handleTaskCreate}
          onTaskDelete={handleTaskDelete}
          loadingTasks={loadingTasks}
          navOpen={mobileNavOpen}
          onNavOpenChange={setMobileNavOpen}
          taskOpen={mobileTaskOpen}
          onTaskOpenChange={setMobileTaskOpen}
        >
          <main className="flex-1 flex flex-col min-w-0">
            {mainContent}
          </main>
        </MobileShell>
      </div>

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        userId={user.$id}
        userName={user.name}
        userEmail={user.email}
        userCreatedAt={user.$createdAt}
        onLogout={handleLogout}
      />
    </div>
  );
}

function NoteMode({
  onSubmit,
  onTaskCreate,
  recentNotes,
}: {
  onSubmit: (content: string) => Promise<void>;
  onTaskCreate: (title: string) => void;
  recentNotes: RawNote[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-start overflow-y-auto"
    >
      <div className="w-full max-w-2xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs text-primary mb-3">
            <Brain className="w-3 h-3" />
            AI-powered organization
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Capture your thoughts</h1>
          <p className="text-xs text-muted-foreground mt-1">Write anything — the AI will organize it for you</p>
        </div>

        <NoteInput onSubmit={onSubmit} onTaskCreate={onTaskCreate} />

        {recentNotes.length > 0 && (
          <div className="mt-10 space-y-2">
            <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Recent</h3>
            {recentNotes.slice(0, 5).map((note) => (
              <div key={note.$id} className="rounded-lg border border-border/30 bg-card/30 p-3">
                <p className="text-xs text-foreground/70 leading-relaxed line-clamp-2">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ChatMode({
  messages, input, sending, scrollRef, inputRef, onInputChange, onSend, onNewChat,
}: {
  messages: ChatMessage[];
  input: string;
  sending: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onNewChat: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col min-h-0"
    >
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20">
        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={onNewChat}>
          <Plus className="w-3 h-3" />
          New chat
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="py-6 space-y-4 max-w-2xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <MessageCircle className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Ask a question about your notes</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {["What are my active projects?", "Summarize my business notes", "What ideas have I been exploring?"].map((s) => (
                  <button
                    key={s}
                    onClick={() => { onInputChange(s); inputRef.current?.focus(); }}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted rounded-bl-md"
              )}>
                {msg.role === "assistant" ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            </motion.div>
          ))}

          {sending && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/30 p-3">
        <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="max-w-2xl mx-auto flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Ask about your notes..."
            className="flex-1 text-sm h-9"
            disabled={sending}
            autoFocus
          />
          <Button type="submit" size="sm" disabled={!input.trim() || sending} className="h-9 px-3">
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </motion.div>
  );
}

const CHATGPT_EXPORT_PROMPT = `Based on everything you know about me from our past conversations, generate a structured JSON profile of my current life, work, and interests. Use your memory to fill in as much detail as possible.

Think through:
- Any businesses, companies, or ventures I run, work at, or am involved in
- Projects I'm actively working on, planning, or have put on hold
- Topics, hobbies, and areas I'm passionate about or frequently discuss
- Important people I've mentioned — co-founders, colleagues, clients, collaborators, friends
- Goals, ambitions, or plans I've shared — both short-term and long-term
- Anything else notable about my situation, lifestyle, or context

For each business, include what it does and its current state. For each project, include a brief description and its status. For people, include how they relate to me. Be as comprehensive as possible.

Output ONLY valid JSON in this exact format — no explanation, no markdown fences, just the JSON:

{
  "businesses": [{"name": "...", "description": "..."}],
  "projects": [{"name": "...", "description": "...", "status": "active | planned | on-hold | completed"}],
  "interests": ["..."],
  "people": [{"name": "...", "role": "..."}],
  "goals": ["..."],
  "other": "..."
}`;

const EMPTY_MANUAL_ANSWERS: ManualTrainAnswers = {
  name: "",
  work: "",
  businesses: [],
  projects: [],
  goals: [],
  interests: [],
  people: [],
};

function TrainMode({
  userId, step, profile, submitting, existingProfile, categories, allNotes,
  onStepChange, onChatGPTImport, onManualSubmit, onProfileUpdate, onGoToChat, onMindRefresh,
}: {
  userId: string;
  step: TrainStep;
  profile: ParsedProfile | null;
  submitting: boolean;
  existingProfile: boolean;
  categories: CategoryWithChildren[];
  allNotes: OrganizedNote[];
  onStepChange: (s: TrainStep) => void;
  onChatGPTImport: (profile: ParsedProfile) => void;
  onManualSubmit: (answers: ManualTrainAnswers) => void;
  onProfileUpdate: (profile: ParsedProfile) => void;
  onGoToChat: () => void;
  onMindRefresh: () => void;
}) {
  const [seeding, setSeeding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [manual, setManual] = useState<ManualTrainAnswers>({ ...EMPTY_MANUAL_ANSWERS });

  const [editProfile, setEditProfile] = useState<ParsedProfile | null>(null);
  const [profileDirty, setProfileDirty] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    if (profile && !editProfile) {
      setEditProfile(JSON.parse(JSON.stringify(profile)));
    }
  }, [profile, editProfile]);

  const handleSeedFolders = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, step: "seed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const parts = [];
      if (data.categoriesCreated > 0) parts.push(`${data.categoriesCreated} folder${data.categoriesCreated > 1 ? "s" : ""}`);
      if (data.notesCreated > 0) parts.push(`${data.notesCreated} note${data.notesCreated > 1 ? "s" : ""}`);
      toast.success(parts.length > 0 ? `Created ${parts.join(" and ")}` : "Everything is already up to date");
      onMindRefresh();
    } catch {
      toast.error("Failed to generate folders");
    } finally {
      setSeeding(false);
    }
  };

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(CHATGPT_EXPORT_PROMPT);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePasteSubmit = () => {
    setPasteError("");
    try {
      let text = pasteValue.trim();
      text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(text);
      if (!parsed.businesses || !parsed.projects || !parsed.interests || !parsed.people || !parsed.goals) {
        setPasteError("Missing required fields. Make sure the JSON has: businesses, projects, interests, people, goals.");
        return;
      }
      onChatGPTImport(parsed as ParsedProfile);
    } catch {
      setPasteError("Invalid JSON. Make sure you copied the full response from ChatGPT.");
    }
  };

  const handleSaveProfile = async () => {
    if (!editProfile) return;
    setSavingProfile(true);
    await onProfileUpdate(editProfile);
    setProfileDirty(false);
    setSavingProfile(false);
  };

  const updateEditProfile = (updates: Partial<ParsedProfile>) => {
    if (!editProfile) return;
    setEditProfile({ ...editProfile, ...updates });
    setProfileDirty(true);
  };

  const handleRenameCategory = async (categoryId: string) => {
    if (!renameValue.trim()) return;
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, name: renameValue.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success("Folder renamed");
      onMindRefresh();
    } catch {
      toast.error("Failed to rename folder");
    } finally {
      setRenamingCat(null);
      setRenameValue("");
    }
  };

  const handleDeleteCategory = async (categoryId: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its notes?`)) return;
    try {
      const res = await fetch("/api/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Deleted "${name}"`);
      onMindRefresh();
    } catch {
      toast.error("Failed to delete folder");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch("/api/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Note deleted");
      onMindRefresh();
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name: newFolderName.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success("Folder created");
      setNewFolderName("");
      setAddingFolder(false);
      onMindRefresh();
    } catch {
      toast.error("Failed to create folder");
    }
  };

  const toggleCat = (id: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const hasManualContent = manual.name.trim() || manual.work.trim() ||
    manual.businesses.length > 0 || manual.projects.length > 0 ||
    manual.goals.length > 0 || manual.interests.length > 0 || manual.people.length > 0;

  const flatCategories = [...categories, ...categories.flatMap((c) => c.children)];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 overflow-y-auto"
    >
      <div className="max-w-2xl mx-auto px-6 pt-12 pb-24">
        <AnimatePresence mode="wait">
          {step === "loading" && (
            <div className="flex justify-center py-20">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {step === "choose" && (
            <motion.div key="choose" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs text-primary mb-3">
                  <GraduationCap className="w-3 h-3" />
                  Training Mode
                </div>
                <h1 className="text-lg font-semibold tracking-tight">
                  {existingProfile ? "Update your profile" : "Teach Gnote about you"}
                </h1>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Tell the AI about your businesses, projects, and goals. It will create folders and notes automatically.
                </p>
              </div>

              <div className="space-y-3">
                <Card className="p-4 border-dashed cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onStepChange("chatgpt-prompt")}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Import className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Import from ChatGPT</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Get a head start by importing from ChatGPT</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto mt-1 shrink-0" />
                  </div>
                </Card>

                <Card className="p-4 border-dashed cursor-pointer hover:border-primary/30 transition-colors" onClick={() => { setManual({ ...EMPTY_MANUAL_ANSWERS }); onStepChange("manual"); }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Set up manually</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Answer a few questions and we'll build your profile</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto mt-1 shrink-0" />
                  </div>
                </Card>
              </div>

              {existingProfile && profile && (
                <Card className="p-4 mt-4 overflow-hidden">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Current Profile</p>
                  <ProfileSummary profile={profile} />
                </Card>
              )}
            </motion.div>
          )}

          {step === "chatgpt-prompt" && (
            <motion.div key="chatgpt-prompt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs text-primary mb-3">
                  <Import className="w-3 h-3" />
                  Step 1 of 2
                </div>
                <h1 className="text-lg font-semibold tracking-tight">Copy this prompt</h1>
                <p className="text-xs text-muted-foreground mt-1">Paste it into ChatGPT — it will use its memory of you to generate your profile</p>
              </div>

              <div className="relative">
                <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                  {CHATGPT_EXPORT_PROMPT}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2 gap-1.5 h-7 text-[11px]"
                  onClick={handleCopyPrompt}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>

              <div className="flex items-center justify-between mt-4">
                <Button variant="ghost" size="sm" onClick={() => onStepChange("choose")} className="gap-1.5 text-xs">
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </Button>
                <Button size="sm" onClick={() => onStepChange("chatgpt-paste")} className="gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5" />
                  I have the response
                </Button>
              </div>
            </motion.div>
          )}

          {step === "chatgpt-paste" && (
            <motion.div key="chatgpt-paste" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs text-primary mb-3">
                  <Import className="w-3 h-3" />
                  Step 2 of 2
                </div>
                <h1 className="text-lg font-semibold tracking-tight">Paste the JSON response</h1>
                <p className="text-xs text-muted-foreground mt-1">Paste the JSON that ChatGPT generated for you</p>
              </div>

              <Textarea
                value={pasteValue}
                onChange={(e) => { setPasteValue(e.target.value); setPasteError(""); }}
                placeholder='{"businesses": [...], "projects": [...], ...}'
                className="min-h-[200px] resize-none text-sm leading-relaxed font-mono mb-2"
                autoFocus
              />

              {pasteError && (
                <p className="text-xs text-destructive mb-3">{pasteError}</p>
              )}

              <div className="flex items-center justify-between mt-2">
                <Button variant="ghost" size="sm" onClick={() => onStepChange("chatgpt-prompt")} className="gap-1.5 text-xs">
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </Button>
                <Button onClick={handlePasteSubmit} disabled={!pasteValue.trim() || submitting} size="sm" className="gap-1.5">
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  Import profile
                </Button>
              </div>
            </motion.div>
          )}

          {step === "manual" && (
            <motion.div key="manual" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs text-primary mb-3">
                  <ClipboardList className="w-3 h-3" />
                  Guided Setup
                </div>
                <h1 className="text-lg font-semibold tracking-tight">Tell us about yourself</h1>
                <p className="text-xs text-muted-foreground mt-1">Fill in what you can, skip what you want</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">About You</h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium block">What&apos;s your name?</label>
                    <Input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="Your name" className="text-sm h-9" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium block">What do you do for work? What industry?</label>
                    <Input value={manual.work} onChange={(e) => setManual({ ...manual, work: e.target.value })} placeholder="e.g. Software engineer in fintech" className="text-sm h-9" />
                  </div>
                </div>
                <ManualListSection label="Businesses & Ventures" items={manual.businesses} onAdd={() => setManual({ ...manual, businesses: [...manual.businesses, { name: "", description: "" }] })} addLabel="Add business" onRemove={(i) => setManual({ ...manual, businesses: manual.businesses.filter((_, j) => j !== i) })} renderItem={(biz, i) => (
                  <div className="flex-1 space-y-2">
                    <Input value={biz.name} onChange={(e) => { const n = [...manual.businesses]; n[i] = { ...n[i], name: e.target.value }; setManual({ ...manual, businesses: n }); }} placeholder="Business name" className="text-sm h-9" />
                    <Input value={biz.description} onChange={(e) => { const n = [...manual.businesses]; n[i] = { ...n[i], description: e.target.value }; setManual({ ...manual, businesses: n }); }} placeholder="Brief description" className="text-sm h-9" />
                  </div>
                )} />
                <ManualListSection label="Projects" items={manual.projects} onAdd={() => setManual({ ...manual, projects: [...manual.projects, { name: "", description: "", status: "active" }] })} addLabel="Add project" onRemove={(i) => setManual({ ...manual, projects: manual.projects.filter((_, j) => j !== i) })} renderItem={(proj, i) => (
                  <div className="flex-1 space-y-2">
                    <Input value={proj.name} onChange={(e) => { const n = [...manual.projects]; n[i] = { ...n[i], name: e.target.value }; setManual({ ...manual, projects: n }); }} placeholder="Project name" className="text-sm h-9" />
                    <Input value={proj.description} onChange={(e) => { const n = [...manual.projects]; n[i] = { ...n[i], description: e.target.value }; setManual({ ...manual, projects: n }); }} placeholder="Brief description" className="text-sm h-9" />
                    <select value={proj.status} onChange={(e) => { const n = [...manual.projects]; n[i] = { ...n[i], status: e.target.value }; setManual({ ...manual, projects: n }); }} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="active">Active</option>
                      <option value="planned">Planned</option>
                      <option value="on-hold">On Hold</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                )} />
                <ManualStringListSection label="Goals" items={manual.goals} placeholder="What do you want to achieve?" addLabel="Add goal" onChange={(goals) => setManual({ ...manual, goals })} />
                <ManualStringListSection label="Interests" items={manual.interests} placeholder="Topic, hobby, or area of interest" addLabel="Add interest" onChange={(interests) => setManual({ ...manual, interests })} />
                <ManualListSection label="Key People" items={manual.people} onAdd={() => setManual({ ...manual, people: [...manual.people, { name: "", role: "" }] })} addLabel="Add person" onRemove={(i) => setManual({ ...manual, people: manual.people.filter((_, j) => j !== i) })} renderItem={(person, i) => (
                  <div className="flex-1 space-y-2">
                    <Input value={person.name} onChange={(e) => { const n = [...manual.people]; n[i] = { ...n[i], name: e.target.value }; setManual({ ...manual, people: n }); }} placeholder="Person's name" className="text-sm h-9" />
                    <Input value={person.role} onChange={(e) => { const n = [...manual.people]; n[i] = { ...n[i], role: e.target.value }; setManual({ ...manual, people: n }); }} placeholder="Their role (e.g. co-founder, designer)" className="text-sm h-9" />
                  </div>
                )} />
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/20">
                <Button variant="ghost" size="sm" onClick={() => onStepChange("choose")} className="gap-1.5 text-xs">
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </Button>
                <Button onClick={() => { const cleaned: ManualTrainAnswers = { ...manual, businesses: manual.businesses.filter((b) => b.name.trim()), projects: manual.projects.filter((p) => p.name.trim()), goals: manual.goals.filter((g) => g.trim()), interests: manual.interests.filter((i) => i.trim()), people: manual.people.filter((p) => p.name.trim()) }; onManualSubmit(cleaned); }} disabled={!hasManualContent || submitting} size="sm" className="gap-1.5">
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Generate profile
                </Button>
              </div>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-sm font-medium">Building your profile...</p>
              <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
            </motion.div>
          )}

          {step === "configure" && editProfile && (
            <motion.div key="configure" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs text-primary mb-3">
                  <Settings2 className="w-3 h-3" />
                  Configure
                </div>
                <h1 className="text-lg font-semibold tracking-tight">Your Gnote Profile</h1>
                <p className="text-xs text-muted-foreground mt-1">Edit your profile and manage your folders & notes</p>
              </div>

              {/* Profile Editor */}
              <Card className="p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Profile</h2>
                  </div>
                  <div className="flex gap-2">
                    {profileDirty && (
                      <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile} className="gap-1.5 h-7 text-[11px]">
                        {savingProfile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Save changes
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  {/* Businesses */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Businesses</span>
                    </div>
                    {editProfile.businesses.map((biz, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1.5">
                          <Input value={biz.name} onChange={(e) => { const n = [...editProfile.businesses]; n[i] = { ...n[i], name: e.target.value }; updateEditProfile({ businesses: n }); }} placeholder="Name" className="text-sm h-8" />
                          <Input value={biz.description} onChange={(e) => { const n = [...editProfile.businesses]; n[i] = { ...n[i], description: e.target.value }; updateEditProfile({ businesses: n }); }} placeholder="Description" className="text-sm h-8 text-muted-foreground" />
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => updateEditProfile({ businesses: editProfile.businesses.filter((_, j) => j !== i) })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="gap-1 text-[11px] h-7 text-muted-foreground" onClick={() => updateEditProfile({ businesses: [...editProfile.businesses, { name: "", description: "" }] })}>
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>

                  {/* Projects */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <FolderKanban className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Projects</span>
                    </div>
                    {editProfile.projects.map((proj, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1.5">
                          <Input value={proj.name} onChange={(e) => { const n = [...editProfile.projects]; n[i] = { ...n[i], name: e.target.value }; updateEditProfile({ projects: n }); }} placeholder="Name" className="text-sm h-8" />
                          <Input value={proj.description} onChange={(e) => { const n = [...editProfile.projects]; n[i] = { ...n[i], description: e.target.value }; updateEditProfile({ projects: n }); }} placeholder="Description" className="text-sm h-8 text-muted-foreground" />
                          <select value={proj.status} onChange={(e) => { const n = [...editProfile.projects]; n[i] = { ...n[i], status: e.target.value }; updateEditProfile({ projects: n }); }} className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs">
                            <option value="active">Active</option>
                            <option value="planned">Planned</option>
                            <option value="on-hold">On Hold</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => updateEditProfile({ projects: editProfile.projects.filter((_, j) => j !== i) })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="gap-1 text-[11px] h-7 text-muted-foreground" onClick={() => updateEditProfile({ projects: [...editProfile.projects, { name: "", description: "", status: "active" }] })}>
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>

                  {/* Interests */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Interests</span>
                    </div>
                    {editProfile.interests.map((interest, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={interest} onChange={(e) => { const n = [...editProfile.interests]; n[i] = e.target.value; updateEditProfile({ interests: n }); }} placeholder="Interest" className="text-sm h-8 flex-1" />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => updateEditProfile({ interests: editProfile.interests.filter((_, j) => j !== i) })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="gap-1 text-[11px] h-7 text-muted-foreground" onClick={() => updateEditProfile({ interests: [...editProfile.interests, ""] })}>
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>

                  {/* People */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">People</span>
                    </div>
                    {editProfile.people.map((person, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1.5">
                          <Input value={person.name} onChange={(e) => { const n = [...editProfile.people]; n[i] = { ...n[i], name: e.target.value }; updateEditProfile({ people: n }); }} placeholder="Name" className="text-sm h-8" />
                          <Input value={person.role} onChange={(e) => { const n = [...editProfile.people]; n[i] = { ...n[i], role: e.target.value }; updateEditProfile({ people: n }); }} placeholder="Role" className="text-sm h-8 text-muted-foreground" />
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => updateEditProfile({ people: editProfile.people.filter((_, j) => j !== i) })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="gap-1 text-[11px] h-7 text-muted-foreground" onClick={() => updateEditProfile({ people: [...editProfile.people, { name: "", role: "" }] })}>
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>

                  {/* Goals */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Goals</span>
                    </div>
                    {editProfile.goals.map((goal, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={goal} onChange={(e) => { const n = [...editProfile.goals]; n[i] = e.target.value; updateEditProfile({ goals: n }); }} placeholder="Goal" className="text-sm h-8 flex-1" />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => updateEditProfile({ goals: editProfile.goals.filter((_, j) => j !== i) })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="gap-1 text-[11px] h-7 text-muted-foreground" onClick={() => updateEditProfile({ goals: [...editProfile.goals, ""] })}>
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>
                </div>

                <div className="flex justify-center mt-5 pt-4 border-t border-border/20">
                  <Button onClick={handleSeedFolders} disabled={seeding} variant="outline" size="sm" className="gap-1.5">
                    {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
                    {seeding ? "Generating..." : "Regenerate folders & notes"}
                  </Button>
                </div>
              </Card>

              {/* Folders & Notes Manager */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Folders & Notes</h2>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1 text-[11px] h-7 text-muted-foreground" onClick={() => setAddingFolder(true)}>
                    <Plus className="w-3 h-3" /> Add folder
                  </Button>
                </div>

                {addingFolder && (
                  <div className="flex gap-2 mb-3">
                    <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name" className="text-sm h-8 flex-1" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleAddFolder(); if (e.key === "Escape") { setAddingFolder(false); setNewFolderName(""); } }} />
                    <Button size="sm" className="h-8 text-xs" onClick={handleAddFolder} disabled={!newFolderName.trim()}>Create</Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setAddingFolder(false); setNewFolderName(""); }}>Cancel</Button>
                  </div>
                )}

                {flatCategories.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No folders yet. Generate them from your profile or add one manually.</p>
                ) : (
                  <div className="space-y-1">
                    {flatCategories.map((cat) => {
                      const catNotes = allNotes.filter((n) => n.categoryId === cat.$id);
                      const isExpanded = expandedCats.has(cat.$id);
                      const isRenaming = renamingCat === cat.$id;

                      return (
                        <div key={cat.$id}>
                          <div className="flex items-center gap-1 group rounded-md hover:bg-muted/40 px-2 py-1.5 transition-colors">
                            <button onClick={() => toggleCat(cat.$id)} className="shrink-0 text-muted-foreground">
                              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                            {isRenaming ? (
                              <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="text-xs h-7 flex-1" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleRenameCategory(cat.$id); if (e.key === "Escape") { setRenamingCat(null); setRenameValue(""); } }} onBlur={() => handleRenameCategory(cat.$id)} />
                            ) : (
                              <span className="text-xs font-medium flex-1 truncate cursor-pointer" onClick={() => toggleCat(cat.$id)}>{cat.name}</span>
                            )}
                            <span className="text-[10px] text-muted-foreground mr-1">{catNotes.length}</span>
                            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                              <button onClick={() => { setRenamingCat(cat.$id); setRenameValue(cat.name); }} className="p-1 rounded text-muted-foreground hover:text-foreground">
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                              <button onClick={() => handleDeleteCategory(cat.$id, cat.name)} className="p-1 rounded text-muted-foreground hover:text-destructive">
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>

                          {isExpanded && catNotes.length > 0 && (
                            <div className="ml-6 space-y-0.5 mb-1">
                              {catNotes.map((note) => (
                                <div key={note.$id} className="flex items-center gap-2 group/note rounded px-2 py-1 hover:bg-muted/30 transition-colors">
                                  <span className="text-[11px] text-muted-foreground flex-1 truncate">{note.title}</span>
                                  <button onClick={() => handleDeleteNote(note.$id)} className="opacity-0 group-hover/note:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-opacity">
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {isExpanded && catNotes.length === 0 && (
                            <p className="ml-6 text-[10px] text-muted-foreground/60 py-1 px-2">No notes in this folder</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <div className="flex justify-center mt-4">
                <Button variant="ghost" size="sm" onClick={onGoToChat} className="gap-1.5 text-xs text-muted-foreground">
                  <ArrowRight className="w-3 h-3" />
                  Go to Chat
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ManualListSection<T>({ label, items, onAdd, addLabel, onRemove, renderItem }: {
  label: string; items: T[]; onAdd: () => void; addLabel: string; onRemove: (i: number) => void; renderItem: (item: T, i: number) => React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</h3>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          {renderItem(item, i)}
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onRemove(i)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onAdd}>
        <Plus className="w-3 h-3" /> {addLabel}
      </Button>
    </div>
  );
}

function ManualStringListSection({ label, items, placeholder, addLabel, onChange }: {
  label: string; items: string[]; placeholder: string; addLabel: string; onChange: (items: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</h3>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input value={item} onChange={(e) => { const n = [...items]; n[i] = e.target.value; onChange(n); }} placeholder={placeholder} className="text-sm h-9 flex-1" />
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onChange([...items, ""])}>
        <Plus className="w-3 h-3" /> {addLabel}
      </Button>
    </div>
  );
}

function ProfileSummary({ profile, detailed }: { profile: ParsedProfile; detailed?: boolean }) {
  const sections = [
    { icon: Building2, label: "Businesses", items: profile.businesses, renderName: (b: any) => b.name, renderDetail: (b: any) => b.description },
    { icon: FolderKanban, label: "Projects", items: profile.projects, renderName: (p: any) => p.name, renderDetail: (p: any) => `${p.status} — ${p.description}` },
    { icon: Heart, label: "Interests", items: profile.interests, renderName: (i: string) => i, renderDetail: null },
    { icon: Users, label: "People", items: profile.people, renderName: (p: any) => p.name, renderDetail: (p: any) => p.role },
    { icon: Target, label: "Goals", items: profile.goals, renderName: (g: string) => g, renderDetail: null },
  ];

  if (detailed) {
    return (
      <div className="space-y-4">
        {sections.map(({ icon: Icon, label, items, renderName, renderDetail }) =>
          items.length > 0 ? (
            <div key={label}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              </div>
              <div className="space-y-1.5">
                {items.map((item: any, i: number) => (
                  <div key={i} className="rounded-lg bg-muted/30 px-3 py-2">
                    <p className="text-xs font-medium">{renderName(item)}</p>
                    {renderDetail && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed break-words">
                        {renderDetail(item)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )}
        {profile.other && (
          <div>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Other</span>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed break-words">{profile.other}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map(({ icon: Icon, label, items, renderName }) =>
        items.length > 0 ? (
          <div key={label}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item: any, i: number) => (
                <Badge key={i} variant="secondary" className="text-[11px] font-normal max-w-full">
                  <span className="truncate">{renderName(item)}</span>
                </Badge>
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
