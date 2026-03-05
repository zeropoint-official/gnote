"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Check, Sparkles, CheckCircle2, PenLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type InputMode = "note" | "task";

interface NoteInputProps {
  onSubmit: (content: string) => Promise<void>;
  onTaskCreate: (title: string) => Promise<void>;
}

type SubmitState = "idle" | "sending" | "organizing" | "done";

export function NoteInput({ onSubmit, onTaskCreate }: NoteInputProps) {
  const [content, setContent] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("note");
  const [state, setState] = useState<SubmitState>("idle");
  const [isMac, setIsMac] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || state !== "idle") return;

    if (inputMode === "task") {
      const taskContent = content;
      setState("sending");
      try {
        setState("organizing");
        await onTaskCreate(taskContent.trim());
        setState("done");
        setContent("");
        setTimeout(() => {
          setState("idle");
          textareaRef.current?.focus();
        }, 1500);
      } catch {
        setState("idle");
      }
      return;
    }

    const noteContent = content;
    setState("sending");

    try {
      setState("organizing");
      await onSubmit(noteContent);
      setState("done");
      setContent("");

      setTimeout(() => {
        setState("idle");
        textareaRef.current?.focus();
      }, 1500);
    } catch {
      setState("idle");
    }
  }, [content, state, onSubmit, onTaskCreate, inputMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Input mode toggle */}
      <div className="flex items-center gap-1 mb-2 p-0.5 rounded-lg bg-muted/50 border border-border/30 w-fit">
        <button
          onClick={() => setInputMode("note")}
          className={cn(
            "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            inputMode === "note" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {inputMode === "note" && (
            <motion.div
              layoutId="input-mode-pill"
              className="absolute inset-0 bg-background rounded-md shadow-sm border border-border/50"
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            />
          )}
          <PenLine className="w-3 h-3 relative z-10" />
          <span className="relative z-10">Note</span>
        </button>
        <button
          onClick={() => setInputMode("task")}
          className={cn(
            "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            inputMode === "task" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {inputMode === "task" && (
            <motion.div
              layoutId="input-mode-pill"
              className="absolute inset-0 bg-background rounded-md shadow-sm border border-border/50"
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            />
          )}
          <CheckCircle2 className="w-3 h-3 relative z-10" />
          <span className="relative z-10">Task</span>
        </button>
      </div>

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            inputMode === "note"
              ? "What's on your mind? Just dump your thoughts here..."
              : "What do you need to do?"
          }
          className={cn(
            "resize-none text-base leading-relaxed pr-4 pb-14",
            "border-border/50 focus-visible:ring-1 focus-visible:ring-ring/30",
            "placeholder:text-muted-foreground/50 transition-all duration-200",
            inputMode === "note" ? "min-h-[120px] md:min-h-[160px]" : "min-h-[80px] md:min-h-[100px]",
            state !== "idle" && "opacity-50 pointer-events-none"
          )}
          disabled={state !== "idle"}
          autoFocus
        />

        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <AnimatePresence mode="wait">
            {state === "idle" && content.trim() && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <span className="text-xs text-muted-foreground/50 mr-2 hidden sm:inline">
                  {isMac ? "\u2318" : "Ctrl"}+Enter
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim() || state !== "idle"}
            className={cn(
              "h-8 transition-all duration-300",
              state === "done" && "bg-green-600 hover:bg-green-600"
            )}
          >
            <AnimatePresence mode="wait">
              {state === "idle" && (
                <motion.div
                  key="send"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5"
                >
                  {inputMode === "note" ? (
                    <Send className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{inputMode === "note" ? "Save" : "Add Task"}</span>
                </motion.div>
              )}
              {state === "sending" && (
                <motion.div
                  key="sending"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving</span>
                </motion.div>
              )}
              {state === "organizing" && (
                <motion.div
                  key="organizing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>{inputMode === "task" ? "Rewriting" : "Organizing"}</span>
                </motion.div>
              )}
              {state === "done" && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Done</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </div>
    </div>
  );
}
