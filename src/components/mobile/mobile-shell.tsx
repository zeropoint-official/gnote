"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  children,
}: MobileShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
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
      setNavOpen(true);
    }

    if (dx < -SWIPE_MIN_DISTANCE && startX > screenWidth - EDGE_THRESHOLD && !navOpen) {
      setTaskOpen(true);
    }

    touchStartRef.current = null;
  }, [navOpen, taskOpen]);

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
      {/* Edge indicators */}
      {!navOpen && !taskOpen && (
        <>
          <div className="fixed left-0 top-1/2 -translate-y-1/2 w-1 h-16 rounded-r-full bg-border/20 z-[90]" />
          <div className="fixed right-0 top-1/2 -translate-y-1/2 w-1 h-16 rounded-l-full bg-border/20 z-[90]" />
        </>
      )}

      {/* Main content */}
      {children}

      {/* Nav Drawer (left) */}
      <SwipeDrawer side="left" open={navOpen} onClose={() => setNavOpen(false)}>
        <NavDrawerContent
          mode={mode}
          onModeChange={onModeChange}
          onSettingsOpen={onSettingsOpen}
          onLogout={onLogout}
          onClose={() => setNavOpen(false)}
          userInitials={userInitials}
          userName={userName}
          userEmail={userEmail}
        />
      </SwipeDrawer>

      {/* Task Drawer (right) */}
      <SwipeDrawer side="right" open={taskOpen} onClose={() => setTaskOpen(false)}>
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
