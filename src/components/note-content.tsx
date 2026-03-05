"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronDown, ChevronUp, Tag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import type { OrganizedNote } from "@/types";

const priorityConfig = {
  high: { label: "High", className: "bg-red-500/10 text-red-600 border-red-500/20" },
  medium: { label: "Medium", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  low: { label: "Low", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
};

interface NoteContentProps {
  note: OrganizedNote;
  categoryName?: string;
  rawContent?: string;
  compact?: boolean;
}

export function NoteContent({ note, categoryName, rawContent, compact }: NoteContentProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const priority = priorityConfig[note.priority];

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      <div>
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <h2 className={cn("font-semibold leading-snug", compact ? "text-sm" : "text-lg")}>
            {note.title}
          </h2>
          <Badge variant="outline" className={cn("text-[10px] shrink-0 mt-0.5", priority.className)}>
            {priority.label}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(note.$createdAt), { addSuffix: true })}
          </span>
          {categoryName && (
            <span className="text-muted-foreground/60">{categoryName}</span>
          )}
          {note.status !== "active" && (
            <Badge variant="outline" className="text-[10px]">{note.status}</Badge>
          )}
        </div>
      </div>

      <div className="border-t border-border/30 pt-4">
        <MarkdownRenderer content={note.content} />
      </div>

      {note.tags.length > 0 && (
        <div className="border-t border-border/30 pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Tag className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Tags</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {rawContent && (
        <div className="border-t border-border/30 pt-3">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showOriginal ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Original note
          </button>
          <AnimatePresence>
            {showOriginal && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/30">
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {rawContent}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
