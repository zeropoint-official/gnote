"use client";

import { useEffect, useCallback, useRef } from "react";
import { SwipeDrawer } from "./swipe-drawer";
import { NavDrawerContent } from "./nav-drawer";
import { TaskDrawerContent } from "./task-drawer";
import type { AppMode } from "@/components/mode-switcher";
import type { Task } from "@/types";

interface MobileShellProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onSettingsOpen: () => void;
  onLogout: () => void;
  userInitials: string;
  userName?: string;
  userEmail?: string;
  tasks: Task[];
  onTaskToggle: (taskId: string, newStatus: "pending" | "done") => void;
  onTaskCreate: (title: string) => void;
  onTaskDelete: (taskId: string) => void;
  loadingTasks: boolean;
  navOpen: boolean;
  onNavOpenChange: (open: boolean) => void;
  taskOpen: boolean;
  onTaskOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const EDGE_THRESHOLD = 30;
const SWIPE_MIN_DISTANCE = 50;

export function MobileShell({
  mode,
  onModeChange,
  onSettingsOpen,
  onLogout,
  userInitials,
  userName,
  userEmail,
  tasks,
  onTaskToggle,
  onTaskCreate,
  onTaskDelete,
  loadingTasks,
  navOpen,
  onNavOpenChange,
  taskOpen,
  onTaskOpenChange,
  children,
}: MobileShellProps) {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    const startX = touchStartRef.current.x;
    const screenWidth = window.innerWidth;

    if (Math.abs(dy) > Math.abs(dx) * 0.8) {
      touchStartRef.current = null;
      return;
    }

    if (dt > 500) {
      touchStartRef.current = null;
      return;
    }

    if (dx > SWIPE_MIN_DISTANCE && startX < EDGE_THRESHOLD && !taskOpen) {
      onNavOpenChange(true);
    }

    if (dx < -SWIPE_MIN_DISTANCE && startX > screenWidth - EDGE_THRESHOLD && !navOpen) {
      onTaskOpenChange(true);
    }

    touchStartRef.current = null;
  }, [navOpen, taskOpen, onNavOpenChange, onTaskOpenChange]);

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return (
    <div className="md:hidden flex flex-col flex-1 min-h-0 relative">
      {children}

      <SwipeDrawer side="left" open={navOpen} onClose={() => onNavOpenChange(false)}>
        <NavDrawerContent
          mode={mode}
          onModeChange={onModeChange}
          onSettingsOpen={onSettingsOpen}
          onLogout={onLogout}
          onClose={() => onNavOpenChange(false)}
          userInitials={userInitials}
          userName={userName}
          userEmail={userEmail}
        />
      </SwipeDrawer>

      <SwipeDrawer side="right" open={taskOpen} onClose={() => onTaskOpenChange(false)}>
        <TaskDrawerContent
          tasks={tasks}
          onTaskToggle={onTaskToggle}
          onTaskCreate={onTaskCreate}
          onTaskDelete={onTaskDelete}
          loading={loadingTasks}
        />
      </SwipeDrawer>
    </div>
  );
}
