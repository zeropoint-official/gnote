"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Check,
  Plus,
  Circle,
  CheckCircle2,
  ChevronDown,
  Trash2,
  Loader2,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Task } from "@/types";

type TaskFilter = "all" | "pending" | "done";

interface TaskDrawerContentProps {
  tasks: Task[];
  onTaskToggle: (taskId: string, newStatus: "pending" | "done") => void;
  onTaskCreate: (title: string) => void;
  onTaskDelete: (taskId: string) => void;
  loading?: boolean;
}

export function TaskDrawerContent({
  tasks,
  onTaskToggle,
  onTaskCreate,
  onTaskDelete,
  loading,
}: TaskDrawerContentProps) {
  const [newTask, setNewTask] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [showDone, setShowDone] = useState(false);

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    onTaskCreate(newTask.trim());
    setNewTask("");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Tasks</h2>
          </div>
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
                "flex-1 py-1.5 rounded-md text-[10px] font-medium transition-colors capitalize",
                filter === f
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task..."
            className="flex-1 h-8 text-xs"
          />
          <Button type="submit" size="sm" disabled={!newTask.trim()} className="h-8 w-8 p-0">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>

      {/* Task list */}
      <ScrollArea className="flex-1">
        <div className="px-3 pb-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <ListTodo className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground">No tasks yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              <AnimatePresence>
                {(filter !== "done" ? pendingTasks : []).map((task) => (
                  <motion.div
                    key={task.$id}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, height: 0 }}
                    className="group"
                  >
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/30 bg-card/30 hover:bg-accent/20 transition-colors">
                      <button onClick={() => onTaskToggle(task.$id, "done")} className="shrink-0">
                        <Circle className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </button>
                      <span className="text-xs flex-1 min-w-0 leading-snug">{task.title}</span>
                      <button
                        onClick={() => onTaskDelete(task.$id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filter !== "pending" && doneTasks.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowDone(!showDone)}
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-1.5 px-1"
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
                      >
                        <div className="group flex items-center gap-2.5 p-2.5 rounded-lg border border-border/20 bg-card/20 opacity-50 hover:opacity-70 transition-opacity mb-1">
                          <button onClick={() => onTaskToggle(task.$id, "pending")} className="shrink-0">
                            <Check className="w-4 h-4 text-green-500" />
                          </button>
                          <span className="text-xs line-through flex-1 min-w-0 truncate">{task.title}</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
