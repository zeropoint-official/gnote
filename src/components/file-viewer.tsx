"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { NoteContent } from "@/components/note-content";
import type { OrganizedNote } from "@/types";

interface FileViewerProps {
  note: OrganizedNote;
  categoryName: string;
  rawContent?: string;
  onBack: () => void;
}

export function FileViewer({ note, categoryName, rawContent, onBack }: FileViewerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="h-full flex flex-col"
    >
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-7 text-xs gap-1 text-muted-foreground"
        >
          <ArrowLeft className="w-3 h-3" />
          Back
        </Button>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs text-muted-foreground">{categoryName}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto">
          <NoteContent
            note={note}
            categoryName={categoryName}
            rawContent={rawContent}
          />
        </div>
      </div>
    </motion.div>
  );
}
