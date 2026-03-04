"use client";

import { cn } from "@/lib/utils";
import {
  PenLine,
  MessageCircle,
  GraduationCap,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";

export type AppMode = "note" | "chat" | "memories" | "tasks" | "train";

interface ModeSwitcherProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export const modes = [
  { id: "note" as const, label: "Note", icon: PenLine },
  { id: "chat" as const, label: "Chat", icon: MessageCircle },
  { id: "memories" as const, label: "Memories", icon: Layers },
  { id: "tasks" as const, label: "Tasks", icon: CheckCircle2 },
  { id: "train" as const, label: "Train", icon: GraduationCap },
];

export function ModeSwitcher({ mode, onModeChange }: ModeSwitcherProps) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/50 border border-border/30">
      {modes.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onModeChange(id)}
          className={cn(
            "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            mode === id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {mode === id && (
            <motion.div
              layoutId="mode-pill"
              className="absolute inset-0 bg-background rounded-md shadow-sm border border-border/50"
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            />
          )}
          <Icon className="w-3.5 h-3.5 relative z-10" />
          <span className="relative z-10 hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
