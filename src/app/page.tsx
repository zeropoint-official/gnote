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
  GraduationCap,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  Building2,
  FolderKanban,
  Heart,
  Users,
  Target,
  MessageCircle,
  FolderPlus,
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
} from "@/types";

type TrainStep = "loading" | "intro" | "dump" | "processing" | "questions" | "complete";

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
  const [trainContext, setTrainContext] = useState("");
  const [profile, setProfile] = useState<ParsedProfile | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [trainAnswers, setTrainAnswers] = useState<string[]>([]);
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
        setTrainStep("complete");
      } else if (data.profile) {
        setProfile(data.profile);
        setExistingProfile(true);
        setTrainStep("intro");
      } else {
        setTrainStep("intro");
      }
    } catch {
      setTrainStep("intro");
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

  const handleTrainInitial = async () => {
    if (!user || !trainContext.trim()) return;
    setTrainSubmitting(true);
    setTrainStep("processing");
    try {
      const res = await fetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.$id, step: "initial", context: trainContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(data.profile);
      if (data.trainingComplete) {
        setTrainStep("complete");
        toast.success("Profile created — categories seeded");
        fetchMindData();
      } else {
        setFollowUpQuestions(data.followUpQuestions);
        setTrainAnswers(new Array(data.followUpQuestions.length).fill(""));
        setTrainStep("questions");
      }
    } catch {
      toast.error("Failed to process your context");
      setTrainStep("dump");
    } finally { setTrainSubmitting(false); }
  };

  const handleTrainRefine = async () => {
    if (!user) return;
    setTrainSubmitting(true);
    try {
      const res = await fetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.$id, step: "refine", questions: followUpQuestions, answers: trainAnswers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(data.profile);
      if (data.trainingComplete || data.followUpQuestions.length === 0) {
        setTrainStep("complete");
        toast.success("Profile training complete — categories seeded");
        fetchMindData();
      } else {
        setFollowUpQuestions(data.followUpQuestions);
        setTrainAnswers(new Array(data.followUpQuestions.length).fill(""));
      }
    } catch { toast.error("Failed to refine profile"); }
    finally { setTrainSubmitting(false); }
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
          context={trainContext}
          profile={profile}
          followUpQuestions={followUpQuestions}
          answers={trainAnswers}
          submitting={trainSubmitting}
          existingProfile={existingProfile}
          onContextChange={setTrainContext}
          onAnswerChange={(i, v) => { const next = [...trainAnswers]; next[i] = v; setTrainAnswers(next); }}
          onStepChange={setTrainStep}
          onInitialSubmit={handleTrainInitial}
          onRefineSubmit={handleTrainRefine}
          onRetrain={() => { setTrainStep("dump"); setTrainContext(""); setProfile(null); }}
          onGoToChat={() => setMode("chat")}
          onMindRefresh={fetchMindData}
        />
      )}
    </AnimatePresence>
  );

  return (
    <div className="h-screen flex bg-background">
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
        <header className="h-11 border-b border-border/30 bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 shrink-0 z-50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-xs tracking-tight">Gnote</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground capitalize">{mode}</span>
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

function TrainMode({
  userId, step, context, profile, followUpQuestions, answers, submitting, existingProfile,
  onContextChange, onAnswerChange, onStepChange, onInitialSubmit, onRefineSubmit, onRetrain, onGoToChat, onMindRefresh,
}: {
  userId: string;
  step: TrainStep;
  context: string;
  profile: ParsedProfile | null;
  followUpQuestions: string[];
  answers: string[];
  submitting: boolean;
  existingProfile: boolean;
  onContextChange: (v: string) => void;
  onAnswerChange: (i: number, v: string) => void;
  onStepChange: (s: TrainStep) => void;
  onInitialSubmit: () => void;
  onRefineSubmit: () => void;
  onRetrain: () => void;
  onGoToChat: () => void;
  onMindRefresh: () => void;
}) {
  const [seeding, setSeeding] = useState(false);

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

          {step === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
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
              <Card className="p-4 border-dashed cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onStepChange("dump")}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{existingProfile ? "Retrain from scratch" : "Start training"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Write a freeform dump — AI extracts structure from it</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto mt-1 shrink-0" />
                </div>
              </Card>
              {existingProfile && profile && (
                <Card className="p-4 mt-3 overflow-hidden">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Current Profile</p>
                  <ProfileSummary profile={profile} />
                </Card>
              )}
            </motion.div>
          )}

          {step === "dump" && (
            <motion.div key="dump" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs text-primary mb-3">
                  <Sparkles className="w-3 h-3" />
                  Step 1 of 2
                </div>
                <h1 className="text-lg font-semibold tracking-tight">Brain dump</h1>
                <p className="text-xs text-muted-foreground mt-1">Write freely about your businesses, projects, goals, and interests</p>
              </div>
              <Textarea
                value={context}
                onChange={(e) => onContextChange(e.target.value)}
                placeholder="Example: I run a digital agency called Pixel Labs..."
                className="min-h-[200px] resize-none text-sm leading-relaxed mb-4"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {context.length > 0 ? `${context.length} characters` : "The more detail, the better"}
                </p>
                <Button onClick={onInitialSubmit} disabled={!context.trim() || submitting} size="sm" className="gap-1.5">
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  Process with AI
                </Button>
              </div>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-sm font-medium">Analyzing your context...</p>
              <p className="text-xs text-muted-foreground mt-1">Creating your profile and seeding categories</p>
            </motion.div>
          )}

          {step === "questions" && (
            <motion.div key="questions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs text-primary mb-3">
                  <Sparkles className="w-3 h-3" />
                  Step 2 of 2
                </div>
                <h1 className="text-lg font-semibold tracking-tight">Follow-up questions</h1>
                <p className="text-xs text-muted-foreground mt-1">Answer what you can, skip what you want</p>
              </div>

              {profile && (
                <Card className="p-4 mb-6 overflow-hidden">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Extracted so far</p>
                  <ProfileSummary profile={profile} />
                </Card>
              )}

              <div className="space-y-5">
                {followUpQuestions.map((q, i) => (
                  <div key={i} className="space-y-2">
                    <label className="text-sm font-medium leading-snug block">{q}</label>
                    <Input
                      value={answers[i] || ""}
                      onChange={(e) => onAnswerChange(i, e.target.value)}
                      placeholder="Type your answer or leave blank"
                      className="text-sm h-10"
                    />
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-3 border-t border-border/20">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { onStepChange("complete"); toast.info("Skipped follow-up questions"); }}
                    className="text-xs"
                  >
                    Skip all
                  </Button>
                  <Button onClick={onRefineSubmit} disabled={submitting} size="sm" className="gap-1.5">
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Submit answers
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "complete" && (
            <motion.div key="complete" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-xs text-green-600 dark:text-green-400 mb-3">
                  <CheckCircle2 className="w-3 h-3" />
                  Training Complete
                </div>
                <h1 className="text-lg font-semibold tracking-tight">Your profile is ready</h1>
                <p className="text-xs text-muted-foreground mt-1">Review your profile and generate folders & notes from it</p>
              </div>

              {profile && (
                <Card className="p-5 mb-6 overflow-hidden">
                  <ProfileSummary profile={profile} detailed />
                </Card>
              )}

              <div className="flex flex-col items-center gap-3">
                <Button
                  onClick={handleSeedFolders}
                  disabled={seeding}
                  className="gap-2 h-10 px-6"
                >
                  {seeding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderPlus className="w-4 h-4" />
                  )}
                  {seeding ? "Generating..." : "Generate folders & notes"}
                </Button>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={onRetrain} className="gap-1.5 text-xs text-muted-foreground">
                    <RotateCcw className="w-3 h-3" />
                    Retrain
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onGoToChat} className="gap-1.5 text-xs text-muted-foreground">
                    <ArrowRight className="w-3 h-3" />
                    Go to Chat
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
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
