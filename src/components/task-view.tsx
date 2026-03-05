"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check,
  Plus,
  Loader2,
  Circle,
  CheckCircle2,
  ListTodo,
  ChevronDown,
  Trash2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Task } from "@/types";

type TaskFilter = "all" | "pending" | "done";

interface TaskViewProps {
  tasks: Task[];
  onTaskToggle: (taskId: string, newStatus: "pending" | "done") => void;
  onTaskCreate: (title: string) => Promise<void>;
  onTaskDelete: (taskId: string) => void;
  loading?: boolean;
}

export function TaskView({ tasks, onTaskToggle, onTaskCreate, onTaskDelete, loading }: TaskViewProps) {
  const [newTask, setNewTask] = useState("");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const visibleTasks = filter === "pending" ? pendingTasks : filter === "done" ? doneTasks : tasks;
  const displayPending = filter === "done" ? [] : pendingTasks;
  const displayDone = filter === "pending" ? [] : doneTasks;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim() || creating) return;
    setCreating(true);
    try {
      await onTaskCreate(newTask.trim());
      setNewTask("");
    } catch {
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex items-center justify-center"
      >
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
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
      {/* Header */}
      <div className="border-b border-border/20 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Tasks</h2>
            <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              {pendingTasks.length} pending
            </span>
          </div>
          <div className="flex items-center gap-1">
            {(["all", "pending", "done"] as TaskFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors capitalize",
                  filter === f
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Add task input */}
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl mx-auto">
          <Input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 h-8 text-xs"
            disabled={creating}
          />
          <Button type="submit" size="sm" disabled={!newTask.trim() || creating} className="h-8 px-3 gap-1">
            {creating ? (
              <>
                <Sparkles className="w-3 h-3 animate-pulse" />
                <span className="hidden sm:inline">Writing...</span>
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" />
                Add
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {tasks.length === 0 ? (
            <div className="text-center py-20">
              <ListTodo className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No tasks yet</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                Add tasks above or switch to Note mode and use the task toggle
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Pending tasks */}
              <AnimatePresence>
                {(filter !== "done" ? pendingTasks : []).map((task) => (
                  <motion.div
                    key={task.$id}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      className={cn(
                        "group rounded-lg border border-border/30 bg-card/30 transition-colors hover:bg-accent/20",
                        expandedId === task.$id && "bg-accent/10"
                      )}
                    >
                      <div className="flex items-center gap-3 p-3">
                        <button
                          onClick={() => onTaskToggle(task.$id, "done")}
                          className="shrink-0 mt-0.5"
                        >
                          <Circle className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </button>
                        <button
                          onClick={() => setExpandedId(expandedId === task.$id ? null : task.$id)}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="text-xs font-medium leading-snug">{task.title}</p>
                          {task.sourceNoteId && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">From note</p>
                          )}
                        </button>
                        <button
                          onClick={() => onTaskDelete(task.$id)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                        </button>
                      </div>

                      <AnimatePresence>
                        {expandedId === task.$id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 pt-0 ml-7 space-y-1.5">
                              {task.description && (
                                <p className="text-[11px] text-muted-foreground leading-relaxed">{task.description}</p>
                              )}
                              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                                <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
                                {task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Done tasks */}
              {filter !== "pending" && doneTasks.length > 0 && (
                <div className="pt-3">
                  <button
                    onClick={() => setShowDone(!showDone)}
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-2 px-1"
                  >
                    <ChevronDown className={cn("w-3 h-3 transition-transform", showDone && "rotate-180")} />
                    Completed ({doneTasks.length})
                  </button>

                  <AnimatePresence>
                    {showDone && doneTasks.map((task) => (
                      <motion.div
                        key={task.$id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <div className="group flex items-center gap-3 p-3 rounded-lg border border-border/20 bg-card/20 opacity-50 hover:opacity-70 transition-opacity mb-1">
                          <button
                            onClick={() => onTaskToggle(task.$id, "pending")}
                            className="shrink-0"
                          >
                            <Check className="w-4 h-4 text-green-500" />
                          </button>
                          <span className="text-xs line-through flex-1 min-w-0 truncate">{task.title}</span>
                          <button
                            onClick={() => onTaskDelete(task.$id)}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
