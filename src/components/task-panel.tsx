"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Plus, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Task } from "@/types";

interface TaskPanelProps {
  tasks: Task[];
  userId: string;
  onTaskToggle: (taskId: string, newStatus: "pending" | "done") => void;
  onTaskCreate: (title: string) => void;
  loading?: boolean;
}

export function TaskPanel({ tasks, userId, onTaskToggle, onTaskCreate, loading }: TaskPanelProps) {
  const [newTask, setNewTask] = useState("");
  const [showInput, setShowInput] = useState(false);

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const doneTasks = tasks.filter((t) => t.status === "done").slice(0, 3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    onTaskCreate(newTask.trim());
    setNewTask("");
    setShowInput(false);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Tasks
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => setShowInput(!showInput)}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      <AnimatePresence>
        {showInput && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onSubmit={handleSubmit}
            className="overflow-hidden px-2"
          >
            <Input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="New task..."
              className="h-7 text-xs mb-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowInput(false);
              }}
            />
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        </div>
      ) : pendingTasks.length === 0 && doneTasks.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/50 px-3 py-2">
          No tasks yet
        </p>
      ) : (
        <div className="space-y-0.5">
          <AnimatePresence>
            {pendingTasks.map((task) => (
              <motion.div
                key={task.$id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="group"
              >
                <button
                  onClick={() => onTaskToggle(task.$id, "done")}
                  className="flex items-start gap-2 w-full px-3 py-1.5 rounded-md hover:bg-accent/50 transition-colors text-left"
                >
                  <Circle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                  <span className="text-xs leading-snug">{task.title}</span>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {doneTasks.length > 0 && (
            <div className="pt-1">
              {doneTasks.map((task) => (
                <button
                  key={task.$id}
                  onClick={() => onTaskToggle(task.$id, "pending")}
                  className="flex items-start gap-2 w-full px-3 py-1 rounded-md hover:bg-accent/50 transition-colors text-left opacity-40 hover:opacity-60"
                >
                  <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-xs leading-snug line-through">{task.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
