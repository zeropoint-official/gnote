"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Layers,
  MoreVertical,
  RefreshCw,
  Archive,
  Sparkles,
  X,
  FolderOpen,
  ChevronUp,
  Briefcase,
  FolderKanban,
  User,
  Users,
  Heart,
  Target,
  Lightbulb,
  GraduationCap,
  DollarSign,
  Dumbbell,
  Plane,
  Code,
  Music,
  Camera,
  BookOpen,
  Home,
  ShoppingBag,
  Utensils,
  Car,
  Globe,
  Palette,
  Gamepad2,
  Wrench,
  Calendar,
  MessageCircle,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { NoteContent } from "@/components/note-content";
import type { CategoryWithChildren, OrganizedNote } from "@/types";

const CATEGORY_ICON_MAP: [RegExp, LucideIcon][] = [
  [/business|company|venture|agency|startup/i, Briefcase],
  [/project/i, FolderKanban],
  [/personal|self|me|life/i, User],
  [/contact|people|network/i, Users],
  [/interest|hobby|passion/i, Heart],
  [/goal|vision|ambition|plan/i, Target],
  [/idea|brainstorm|concept/i, Lightbulb],
  [/learn|education|course|study|school/i, GraduationCap],
  [/finance|money|invest|budget|income/i, DollarSign],
  [/health|fitness|workout|gym|exercise/i, Dumbbell],
  [/travel|trip|vacation|flight/i, Plane],
  [/code|dev|programming|software|tech|engineer/i, Code],
  [/music|song|playlist|audio/i, Music],
  [/camera|photo|video|film|cinema/i, Camera],
  [/book|read|writing|blog|content/i, BookOpen],
  [/home|house|apartment|real estate/i, Home],
  [/shop|ecommerce|store|product/i, ShoppingBag],
  [/food|recipe|restaurant|cook/i, Utensils],
  [/car|vehicle|transport/i, Car],
  [/marketing|social|brand|growth/i, Globe],
  [/design|art|creative|ui|ux/i, Palette],
  [/game|gaming|play/i, Gamepad2],
  [/tool|resource|utility|setup/i, Wrench],
  [/event|meeting|schedule|calendar/i, Calendar],
  [/chat|conversation|communication/i, MessageCircle],
];

function getCategoryIcon(name: string): LucideIcon {
  for (const [pattern, icon] of CATEGORY_ICON_MAP) {
    if (pattern.test(name)) return icon;
  }
  return FileText;
}

interface MemoriesViewProps {
  categories: CategoryWithChildren[];
  allNotes: OrganizedNote[];
  rawNotesMap: Record<string, string>;
  statusFilter: "active" | "archived";
  counts: { active: number; archived: number };
  onStatusFilterChange: (status: "active" | "archived") => void;
  onSelectNote: (noteId: string, categoryId: string) => void;
  onReorganize: () => void;
  reorganizing: boolean;
  loading: boolean;
}

const priorityDots: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
};

function flattenCategories(categories: CategoryWithChildren[]): CategoryWithChildren[] {
  const result: CategoryWithChildren[] = [];
  for (const cat of categories) {
    result.push(cat);
    if (cat.children.length > 0) {
      result.push(...flattenCategories(cat.children));
    }
  }
  return result;
}

export function MemoriesView({
  categories,
  allNotes,
  rawNotesMap,
  statusFilter,
  counts,
  onStatusFilterChange,
  onSelectNote,
  onReorganize,
  reorganizing,
  loading,
}: MemoriesViewProps) {
  const [search, setSearch] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const categoryMap = useMemo(() => {
    const flat = flattenCategories(categories);
    const map: Record<string, string> = {};
    for (const cat of flat) {
      map[cat.$id] = cat.name;
    }
    return map;
  }, [categories]);

  const sortedNotes = useMemo(() => {
    return [...allNotes].sort(
      (a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
    );
  }, [allNotes]);

  const filteredNotes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sortedNotes.filter((note) => {
      if (activeCategoryId && note.categoryId !== activeCategoryId) return false;
      if (q) {
        const catName = categoryMap[note.categoryId] || "";
        return (
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q) ||
          note.tags.some((t) => t.toLowerCase().includes(q)) ||
          catName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sortedNotes, search, activeCategoryId, categoryMap]);

  const activeCategoryName = activeCategoryId ? categoryMap[activeCategoryId] : null;
  const ActiveFilterIcon = activeCategoryName ? getCategoryIcon(activeCategoryName) : FolderOpen;

  const handleNoteClick = useCallback((noteId: string) => {
    setExpandedNoteId((prev) => (prev === noteId ? null : noteId));
  }, []);

  const handleCategoryFilter = useCallback((categoryId: string) => {
    setActiveCategoryId((prev) => (prev === categoryId ? null : categoryId));
    setExpandedNoteId(null);
  }, []);

  const clearFilter = useCallback(() => {
    setActiveCategoryId(null);
    setExpandedNoteId(null);
  }, []);

  useEffect(() => {
    if (expandedNoteId && expandedRef.current) {
      const timer = setTimeout(() => {
        expandedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [expandedNoteId]);

  useEffect(() => {
    if (!expandedNoteId) return;
    const handleDismiss = (e: MouseEvent | TouchEvent) => {
      if (expandedRef.current && !expandedRef.current.contains(e.target as Node)) {
        setExpandedNoteId(null);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleDismiss);
      document.addEventListener("touchstart", handleDismiss, { passive: true });
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleDismiss);
      document.removeEventListener("touchstart", handleDismiss);
    };
  }, [expandedNoteId]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-2">
          <Layers className="w-5 h-5 text-muted-foreground animate-pulse" />
          <p className="text-xs text-muted-foreground">Loading memories...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col min-h-0"
    >
      {/* Top bar: search + overflow menu */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/20 px-4 py-2.5">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setExpandedNoteId(null); }}
              placeholder="Search notes, tags, categories..."
              className="pl-8 h-9 text-xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => onStatusFilterChange("active")}
                className="gap-2 text-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Active notes
                {statusFilter === "active" && (
                  <Badge variant="secondary" className="ml-auto h-4 px-1 text-[8px]">
                    {counts.active}
                  </Badge>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStatusFilterChange("archived")}
                className="gap-2 text-xs"
              >
                <Archive className="w-3.5 h-3.5" />
                Archived notes
                {statusFilter === "archived" && (
                  <Badge variant="secondary" className="ml-auto h-4 px-1 text-[8px]">
                    {counts.archived}
                  </Badge>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onReorganize}
                disabled={reorganizing}
                className="gap-2 text-xs"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", reorganizing && "animate-spin")} />
                {reorganizing ? "Reorganizing..." : "Reorganize"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Active filter pill */}
        <AnimatePresence>
          {activeCategoryName && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden max-w-2xl mx-auto"
            >
              <div className="pt-2">
                <button
                  onClick={clearFilter}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/15 transition-colors"
                >
                  <ActiveFilterIcon className="w-3 h-3" />
                  {activeCategoryName}
                  <X className="w-3 h-3 ml-0.5 opacity-60" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-20">
              <Layers className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {search
                  ? "No notes match your search"
                  : activeCategoryId
                  ? "No notes in this category"
                  : "No notes yet"}
              </p>
              {!search && !activeCategoryId && (
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  Switch to Note mode to start capturing thoughts
                </p>
              )}
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-[11px] text-primary mt-2 hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotes.map((note) => {
                const isExpanded = expandedNoteId === note.$id;
                const catName = categoryMap[note.categoryId];
                const CatIcon = catName ? getCategoryIcon(catName) : null;

                return (
                  <div
                    key={note.$id}
                    ref={isExpanded ? expandedRef : undefined}
                  >
                    <AnimatePresence mode="wait">
                      {isExpanded ? (
                        <motion.div
                          key="expanded"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="rounded-xl border border-border/50 bg-card shadow-lg overflow-hidden"
                        >
                          {/* Collapse header */}
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/30">
                            {catName && CatIcon && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCategoryFilter(note.categoryId);
                                }}
                                className="flex items-center gap-1.5 text-[10px] font-medium text-primary/70 hover:text-primary transition-colors"
                              >
                                <CatIcon className="w-3 h-3" />
                                {catName}
                              </button>
                            )}
                            <button
                              onClick={() => setExpandedNoteId(null)}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-auto"
                            >
                              <ChevronUp className="w-3 h-3" />
                              Collapse
                            </button>
                          </div>

                          {/* Full note content */}
                          <div className="px-4 py-4 max-h-[70vh] overflow-y-auto">
                            <NoteContent
                              note={note}
                              rawContent={rawNotesMap[note.rawNoteId]}
                              compact
                            />
                          </div>
                        </motion.div>
                      ) : (
                        <motion.button
                          key="collapsed"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          onClick={() => handleNoteClick(note.$id)}
                          className={cn(
                            "w-full text-left rounded-xl border border-border/30 bg-card/30 p-3.5 transition-all",
                            "hover:bg-accent/30 hover:border-border/50 active:scale-[0.99]",
                            expandedNoteId && "opacity-40"
                          )}
                        >
                          {/* Title row with category icon + priority dot */}
                          <div className="flex items-start gap-2.5">
                            {CatIcon && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCategoryFilter(note.categoryId);
                                }}
                                className="shrink-0 mt-[1px] text-muted-foreground/50 hover:text-primary transition-colors"
                                title={catName}
                              >
                                <CatIcon className="w-4 h-4" />
                              </button>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-1.5">
                                <div className={cn(
                                  "w-1.5 h-1.5 rounded-full shrink-0 mt-[5px]",
                                  priorityDots[note.priority] || "bg-muted-foreground/30"
                                )} />
                                <p className="text-[13px] font-medium leading-snug line-clamp-2 flex-1">
                                  {note.title}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Content preview */}
                          <p className="text-[11px] text-muted-foreground mt-1 ml-[26px] line-clamp-2 leading-relaxed">
                            {note.content.replace(/[#*_`>\-\[\]]/g, "").slice(0, 200)}
                          </p>

                          {/* Timestamp */}
                          <p className="text-[10px] text-muted-foreground/50 mt-2 ml-[26px]">
                            {formatDistanceToNow(new Date(note.$createdAt), { addSuffix: true })}
                          </p>
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
