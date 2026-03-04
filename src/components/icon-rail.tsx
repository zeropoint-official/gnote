"use client";

import { cn } from "@/lib/utils";
import {
  PenLine,
  MessageCircle,
  Layers,
  CheckCircle2,
  GraduationCap,
  Settings,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";
import { motion } from "framer-motion";
import type { AppMode } from "@/components/mode-switcher";

const navItems = [
  { id: "note" as const, label: "Note", icon: PenLine },
  { id: "chat" as const, label: "Chat", icon: MessageCircle },
  { id: "memories" as const, label: "Memories", icon: Layers },
  { id: "tasks" as const, label: "Tasks", icon: CheckCircle2 },
  { id: "train" as const, label: "Train", icon: GraduationCap },
];

interface IconRailProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onSettingsOpen: () => void;
  onLogout: () => void;
  userInitials: string;
  userName?: string;
  userEmail?: string;
}

export function IconRail({
  mode,
  onModeChange,
  onSettingsOpen,
  onLogout,
  userInitials,
  userName,
  userEmail,
}: IconRailProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <aside className="w-[60px] border-r border-border/30 bg-card/20 flex flex-col items-center py-3 shrink-0">
        <div className="flex flex-col items-center gap-1 flex-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onModeChange(id)}
                  className={cn(
                    "relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                    mode === id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  {mode === id && (
                    <motion.div
                      layoutId="rail-active"
                      className="absolute inset-0 bg-accent rounded-xl"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  <Icon className="w-4 h-4 relative z-10" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p className="text-xs">{label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="flex flex-col items-center gap-1 mt-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onSettingsOpen}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p className="text-xs">Settings</p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-accent/50 transition-colors">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[9px] font-medium bg-primary/10 text-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-52">
              <div className="px-3 py-2">
                <p className="text-xs font-medium">{userName || "User"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSettingsOpen} className="cursor-pointer text-xs gap-2">
                <Settings className="w-3.5 h-3.5" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-destructive text-xs gap-2">
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
}
