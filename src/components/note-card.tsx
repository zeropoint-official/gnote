"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Clock, ArrowUpRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { OrganizedNote } from "@/types";

interface NoteCardProps {
  note: OrganizedNote;
  rawContent?: string;
  categoryName?: string;
}

const priorityConfig = {
  high: { label: "High", className: "bg-red-500/10 text-red-600 border-red-500/20" },
  medium: { label: "Medium", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  low: { label: "Low", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
};

export function NoteCard({ note, rawContent, categoryName }: NoteCardProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const priority = priorityConfig[note.priority];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card
        className={cn(
          "border-border/40 hover:border-border/70 transition-all duration-200",
          note.status === "stale" && "opacity-60",
          note.status === "archived" && "opacity-40"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-medium text-sm leading-snug">{note.title}</h3>
            <Badge variant="outline" className={cn("text-[10px] shrink-0", priority.className)}>
              {priority.label}
            </Badge>
          </div>

          <div className="text-sm text-foreground/70 leading-relaxed whitespace-pre-wrap mb-3">
            {note.content}
          </div>

          <div className="flex items-center flex-wrap gap-1.5 mb-3">
            {note.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px] font-normal px-2 py-0"
              >
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(note.$createdAt), { addSuffix: true })}
              </span>
              {categoryName && (
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  {categoryName}
                </span>
              )}
            </div>

            {rawContent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOriginal(!showOriginal)}
                className="h-6 text-[11px] text-muted-foreground/50 hover:text-muted-foreground px-2"
              >
                {showOriginal ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Hide original
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Show original
                  </>
                )}
              </Button>
            )}
          </div>

          <AnimatePresence>
            {showOriginal && rawContent && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-border/30">
                  <p className="text-xs text-muted-foreground/60 mb-1 font-medium">
                    Original note
                  </p>
                  <p className="text-xs text-muted-foreground/50 leading-relaxed whitespace-pre-wrap">
                    {rawContent}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
