"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PenLine,
  MessageCircle,
  Layers,
  GraduationCap,
  Settings,
  LogOut,
  Plus,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppMode } from "@/components/mode-switcher";

const modeItems = [
  { id: "note" as AppMode, label: "Note", icon: PenLine, description: "Capture thoughts" },
  { id: "chat" as AppMode, label: "Chat", icon: MessageCircle, description: "Ask about your notes" },
  { id: "memories" as AppMode, label: "Memories", icon: Layers, description: "Browse all notes" },
  { id: "train" as AppMode, label: "Train", icon: GraduationCap, description: "Teach the AI about you" },
];

interface NavDrawerProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onSettingsOpen: () => void;
  onLogout: () => void;
  onClose: () => void;
  userInitials: string;
  userName?: string;
  userEmail?: string;
}

export function NavDrawerContent({
  mode,
  onModeChange,
  onSettingsOpen,
  onLogout,
  onClose,
  userInitials,
  userName,
  userEmail,
}: NavDrawerProps) {
  const handleModeSelect = (m: AppMode) => {
    onModeChange(m);
    onClose();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* User section */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{userName || "User"}</p>
            <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
          </div>
        </div>
      </div>

      <Separator className="opacity-30" />

      {/* Mode navigation */}
      <div className="px-3 py-3 space-y-1">
        {modeItems.map(({ id, label, icon: Icon, description }) => (
          <button
            key={id}
            onClick={() => handleModeSelect(id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left",
              mode === id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              mode === id ? "bg-primary/10" : "bg-muted/50"
            )}>
              <Icon className={cn("w-4 h-4", mode === id && "text-primary")} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium">{label}</p>
              <p className="text-[10px] text-muted-foreground">{description}</p>
            </div>
          </button>
        ))}
      </div>

      <Separator className="opacity-30" />

      {/* Chat history section */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Chat History
          </span>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="pb-3">
            <div className="text-center py-6">
              <Clock className="w-5 h-5 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground/50">
                Chat sessions will appear here
              </p>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Bottom actions */}
      <div className="p-3 border-t border-border/20 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { onSettingsOpen(); onClose(); }}
          className="w-full h-9 justify-start gap-2.5 text-xs text-muted-foreground px-3"
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { onLogout(); onClose(); }}
          className="w-full h-9 justify-start gap-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/5 px-3"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
