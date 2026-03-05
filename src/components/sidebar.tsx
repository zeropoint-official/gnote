"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TaskPanel } from "@/components/task-panel";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Archive,
  Settings,
  RefreshCw,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { CategoryWithChildren, OrganizedNote, Task } from "@/types";

interface SidebarProps {
  categories: CategoryWithChildren[];
  tasks: Task[];
  userId: string;
  statusFilter: "active" | "archived";
  counts: { active: number; archived: number };
  selectedNoteId: string | null;
  onSelectNote: (noteId: string, categoryId: string) => void;
  onStatusFilterChange: (status: "active" | "archived") => void;
  onTaskToggle: (taskId: string, newStatus: "pending" | "done") => void;
  onTaskCreate: (title: string) => Promise<void>;
  onReorganize: () => void;
  onSettingsOpen: () => void;
  reorganizing: boolean;
  loadingTasks: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  categories,
  tasks,
  userId,
  statusFilter,
  counts,
  selectedNoteId,
  onSelectNote,
  onStatusFilterChange,
  onTaskToggle,
  onTaskCreate,
  onReorganize,
  onSettingsOpen,
  reorganizing,
  loadingTasks,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  if (collapsed) {
    return (
      <aside className="w-12 border-r border-border/30 bg-card/20 flex flex-col items-center py-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 mb-2"
          onClick={onToggleCollapse}
        >
          <PanelLeft className="w-4 h-4 text-muted-foreground" />
        </Button>
      </aside>
    );
  }

  return (
    <aside className="w-64 border-r border-border/30 bg-card/20 flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-1 flex-1">
          <Button
            variant={statusFilter === "active" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onStatusFilterChange("active")}
            className="h-6 text-[10px] flex-1 gap-1 px-2"
          >
            <Sparkles className="w-3 h-3" />
            Active
            {counts.active > 0 && (
              <Badge variant="secondary" className="h-3.5 min-w-3.5 px-1 text-[8px] ml-0.5">
                {counts.active}
              </Badge>
            )}
          </Button>
          <Button
            variant={statusFilter === "archived" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onStatusFilterChange("archived")}
            className="h-6 text-[10px] flex-1 gap-1 px-2"
          >
            <Archive className="w-3 h-3" />
            Archive
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 ml-1"
          onClick={onToggleCollapse}
        >
          <PanelLeftClose className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2 px-1">
          {categories.length === 0 ? (
            <div className="text-center py-6 px-3">
              <Folder className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground/40">
                {statusFilter === "archived"
                  ? "No archived items"
                  : "Categories appear as you add notes"}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {categories.map((category) => (
                <FolderNode
                  key={category.$id}
                  category={category}
                  depth={0}
                  selectedNoteId={selectedNoteId}
                  onSelectNote={onSelectNote}
                />
              ))}
            </div>
          )}
        </div>

        <Separator className="mx-3 my-1 opacity-30" />

        <div className="py-1">
          <TaskPanel
            tasks={tasks}
            userId={userId}
            onTaskToggle={onTaskToggle}
            onTaskCreate={onTaskCreate}
            loading={loadingTasks}
          />
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-border/20 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReorganize}
          disabled={reorganizing}
          className="w-full h-7 text-[10px] text-muted-foreground gap-1.5 justify-start"
        >
          <RefreshCw className={cn("w-3 h-3", reorganizing && "animate-spin")} />
          {reorganizing ? "Reorganizing..." : "Reorganize"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSettingsOpen}
          className="w-full h-7 text-[10px] text-muted-foreground gap-1.5 justify-start"
        >
          <Settings className="w-3 h-3" />
          Settings
        </Button>
      </div>
    </aside>
  );
}

function FolderNode({
  category,
  depth,
  selectedNoteId,
  onSelectNote,
}: {
  category: CategoryWithChildren;
  depth: number;
  selectedNoteId: string | null;
  onSelectNote: (noteId: string, categoryId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = category.children.length > 0;
  const hasNotes = (category.notes?.length || 0) > 0;
  const isExpandable = hasChildren || hasNotes;
  const isArchived = category.status === "archived";

  return (
    <div>
      <button
        onClick={() => {
          if (isExpandable) setExpanded(!expanded);
        }}
        className={cn(
          "flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs transition-colors group",
          "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          isArchived && "opacity-50"
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {isExpandable ? (
          <ChevronRight
            className={cn(
              "w-3 h-3 shrink-0 transition-transform duration-200",
              expanded && "rotate-90"
            )}
          />
        ) : (
          <div className="w-3" />
        )}

        {isArchived ? (
          <Archive className="w-3.5 h-3.5 shrink-0 opacity-60" />
        ) : expanded && isExpandable ? (
          <FolderOpen className="w-3.5 h-3.5 shrink-0 text-primary/60" />
        ) : (
          <Folder className="w-3.5 h-3.5 shrink-0 text-primary/60" />
        )}

        <span className="truncate flex-1 text-left font-medium">{category.name}</span>

        <Badge
          variant="secondary"
          className="h-4 min-w-4 px-1 text-[9px] font-normal opacity-50 group-hover:opacity-100"
        >
          {category.noteCount}
        </Badge>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {category.children.map((child) => (
              <FolderNode
                key={child.$id}
                category={child}
                depth={depth + 1}
                selectedNoteId={selectedNoteId}
                onSelectNote={onSelectNote}
              />
            ))}

            {category.notes?.map((note) => (
              <button
                key={note.$id}
                onClick={() => onSelectNote(note.$id, category.$id)}
                className={cn(
                  "flex items-center gap-1.5 w-full px-2 py-1 rounded-md text-[11px] transition-colors",
                  selectedNoteId === note.$id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                )}
                style={{ paddingLeft: `${22 + depth * 14}px` }}
              >
                <FileText className="w-3 h-3 shrink-0 opacity-50" />
                <span className="truncate text-left">{note.title}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
