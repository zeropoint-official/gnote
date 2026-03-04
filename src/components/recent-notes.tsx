"use client";

import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import type { RawNote } from "@/types";

interface RecentNotesProps {
  notes: RawNote[];
}

export function RecentNotes({ notes }: RecentNotesProps) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground/60 text-sm">
          Your notes will appear here as you add them
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
        Recent
      </h3>
      <AnimatePresence initial={false}>
        {notes.map((note, i) => (
          <motion.div
            key={note.$id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group relative rounded-lg border border-border/40 bg-card/50 p-3 hover:border-border/80 transition-colors"
          >
            <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">
              {note.content}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-2">
              {formatDistanceToNow(new Date(note.$createdAt), { addSuffix: true })}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
