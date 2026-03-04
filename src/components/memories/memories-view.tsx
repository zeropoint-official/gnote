"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Layers,
  FileText,
  Clock,
  Tag,
  RefreshCw,
  Archive,
  Sparkles,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import type { CategoryWithChildren, OrganizedNote } from "@/types";

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

const priorityColors: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-blue-500",
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
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const flatCats = useMemo(() => flattenCategories(categories), [categories]);

  const notesByCategory = useMemo(() => {
    const map: Record<string, OrganizedNote[]> = {};
    for (const note of allNotes) {
      if (!map[note.categoryId]) map[note.categoryId] = [];
      map[note.categoryId].push(note);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime());
    }
    return map;
  }, [allNotes]);

  const sortedCategories = useMemo(() => {
    return flatCats
      .filter((cat) => (notesByCategory[cat.$id]?.length || 0) > 0)
      .sort((a, b) => {
        const aLatest = notesByCategory[a.$id]?.[0]?.$createdAt || "";
        const bLatest = notesByCategory[b.$id]?.[0]?.$createdAt || "";
        return new Date(bLatest).getTime() - new Date(aLatest).getTime();
      });
  }, [flatCats, notesByCategory]);

  const filteredData = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sortedCategories
      .map((cat) => {
        let notes = notesByCategory[cat.$id] || [];
        if (activeChip && cat.$id !== activeChip) return null;
        if (q) {
          const catMatch = cat.name.toLowerCase().includes(q);
          const filteredNotes = notes.filter(
            (n) =>
              n.title.toLowerCase().includes(q) ||
              n.content.toLowerCase().includes(q) ||
              n.tags.some((t) => t.toLowerCase().includes(q))
          );
          if (!catMatch && filteredNotes.length === 0) return null;
          if (!catMatch) notes = filteredNotes;
        }
        return { category: cat, notes };
      })
      .filter(Boolean) as { category: CategoryWithChildren; notes: OrganizedNote[] }[];
  }, [sortedCategories, notesByCategory, search, activeChip]);

  const handleChipClick = (catId: string) => {
    if (activeChip === catId) {
      setActiveChip(null);
    } else {
      setActiveChip(catId);
      sectionRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/20 px-4 pt-3 pb-2 space-y-2.5">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes, tags, categories..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={statusFilter === "active" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onStatusFilterChange("active")}
              className="h-8 text-[10px] gap-1 px-2.5"
            >
              <Sparkles className="w-3 h-3" />
              Active
              {counts.active > 0 && (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[8px] ml-0.5">
                  {counts.active}
                </Badge>
              )}
            </Button>
            <Button
              variant={statusFilter === "archived" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onStatusFilterChange("archived")}
              className="h-8 text-[10px] gap-1 px-2.5"
            >
              <Archive className="w-3 h-3" />
              Archive
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReorganize}
            disabled={reorganizing}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", reorganizing && "animate-spin")} />
          </Button>
        </div>

        {/* Category chips */}
        {sortedCategories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-3xl mx-auto pb-0.5">
            <button
              onClick={() => setActiveChip(null)}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors border",
                !activeChip
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border/40 hover:border-border"
              )}
            >
              All
            </button>
            {sortedCategories.map((cat) => (
              <button
                key={cat.$id}
                onClick={() => handleChipClick(cat.$id)}
                className={cn(
                  "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors border",
                  activeChip === cat.$id
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border/40 hover:border-border"
                )}
              >
                {cat.name}
                <span className="ml-1 opacity-60">{notesByCategory[cat.$id]?.length || 0}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {filteredData.length === 0 ? (
            <div className="text-center py-20">
              <Layers className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? "No notes match your search" : "No notes yet"}
              </p>
              {!search && (
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  Switch to Note mode to start capturing thoughts
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredData.map(({ category, notes }) => (
                <div
                  key={category.$id}
                  ref={(el) => { sectionRefs.current[category.$id] = el; }}
                >
                  {/* Sticky category header */}
                  <div className="sticky top-[105px] z-[5] bg-background/90 backdrop-blur-sm py-2 -mx-1 px-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-primary/60" />
                      <span className="text-xs font-semibold">{category.name}</span>
                      <span className="text-[10px] text-muted-foreground">{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* Note cards */}
                  <div className="space-y-1 pb-3">
                    {notes.map((note) => (
                      <button
                        key={note.$id}
                        onClick={() => onSelectNote(note.$id, category.$id)}
                        className={cn(
                          "w-full text-left rounded-lg border border-border/30 bg-card/30 p-3 transition-colors hover:bg-accent/30 hover:border-border/50",
                          "border-l-2",
                          priorityColors[note.priority] || "border-l-transparent"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{note.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 leading-relaxed">
                              {note.content.replace(/[#*_`>\-\[\]]/g, "").slice(0, 120)}
                            </p>
                          </div>
                          <span className="text-[9px] text-muted-foreground/60 shrink-0 mt-0.5">
                            {formatDistanceToNow(new Date(note.$createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        {note.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5 overflow-hidden">
                            {note.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                            {note.tags.length > 3 && (
                              <span className="text-[9px] text-muted-foreground/50">
                                +{note.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
