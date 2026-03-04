"use client";

import { useEffect } from "react";
import type { AppMode } from "@/components/mode-switcher";

interface ShortcutOptions {
  onModeChange?: (mode: AppMode) => void;
  onSettingsOpen?: () => void;
}

export function useKeyboardShortcuts({ onModeChange, onSettingsOpen }: ShortcutOptions = {}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "/" && !(e.metaKey || e.ctrlKey)) {
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
      }

      if ((e.metaKey || e.ctrlKey) && onModeChange) {
        const modeMap: Record<string, AppMode> = {
          "1": "note",
          "2": "chat",
          "3": "memories",
          "4": "tasks",
          "5": "train",
        };
        const mode = modeMap[e.key];
        if (mode) {
          e.preventDefault();
          onModeChange(mode);
        }
      }

      if (e.key === "," && (e.metaKey || e.ctrlKey) && onSettingsOpen) {
        e.preventDefault();
        onSettingsOpen();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onModeChange, onSettingsOpen]);
}
