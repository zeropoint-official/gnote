"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Loader2,
  Save,
  LogOut,
  User,
  Sliders,
  Shield,
  ChevronRight,
  Mail,
  Calendar,
  Activity,
  Zap,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName?: string;
  userEmail?: string;
  userCreatedAt?: string;
  onLogout: () => void;
}

type SettingsTab = "account" | "preferences" | "usage";

interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byModel: Record<string, { input: number; output: number; cost: number }>;
  byOperation: Record<string, { input: number; output: number; cost: number; count: number }>;
  recentCalls: {
    operation: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    createdAt: string;
  }[];
}

const OPERATION_LABELS: Record<string, string> = {
  organize: "Note organization",
  reorganize: "Reorganization",
  chat: "Chat reply",
  "chat-context": "Context selection",
  "train-extract": "Profile extraction",
  "train-refine": "Profile refinement",
  seed: "Folder generation",
};

const MODEL_SHORT: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Haiku 4.5",
  "claude-sonnet-4-6": "Sonnet 4",
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(usd: number): string {
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SettingsSheet({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  userCreatedAt,
  onLogout,
}: SettingsSheetProps) {
  const [tab, setTab] = useState<SettingsTab>("account");
  const [activeNoteLimit, setActiveNoteLimit] = useState(100);
  const [archiveAfterDays, setArchiveAfterDays] = useState(30);
  const [reorganizeIntervalDays, setReorganizeIntervalDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [usageLoaded, setUsageLoaded] = useState(false);

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : userEmail?.[0]?.toUpperCase() ?? "?";

  const memberSince = userCreatedAt
    ? new Date(userCreatedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/settings?userId=${userId}`);
      const data = await res.json();
      if (data.settings) {
        setActiveNoteLimit(data.settings.activeNoteLimit ?? 100);
        setArchiveAfterDays(data.settings.archiveAfterDays ?? 30);
        setReorganizeIntervalDays(data.settings.reorganizeIntervalDays ?? 7);
      }
    } catch {}
    setLoaded(true);
  }, [userId]);

  const fetchUsage = useCallback(async () => {
    setLoadingUsage(true);
    try {
      const res = await fetch(`/api/usage?userId=${userId}`);
      const data = await res.json();
      setUsageStats(data);
    } catch {}
    setLoadingUsage(false);
    setUsageLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (open && !loaded) fetchSettings();
  }, [open, loaded, fetchSettings]);

  useEffect(() => {
    if (open && tab === "usage" && !usageLoaded) fetchUsage();
  }, [open, tab, usageLoaded, fetchUsage]);

  useEffect(() => {
    if (!open) {
      setTab("account");
      setUsageLoaded(false);
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, activeNoteLimit, archiveAfterDays, reorganizeIntervalDays }),
      });
      if (res.ok) {
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    onOpenChange(false);
    onLogout();
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: "account", label: "Account", icon: User },
    { id: "preferences", label: "Prefs", icon: Sliders },
    { id: "usage", label: "Usage", icon: Activity },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] sm:w-[440px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle className="text-sm font-semibold">Settings</SheetTitle>
        </SheetHeader>

        <div className="px-6 pt-4 pb-0">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/50 border border-border/30">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                  tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === t.id && (
                  <motion.div
                    layoutId="settings-tab"
                    className="absolute inset-0 bg-background rounded-md shadow-sm border border-border/50"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <t.icon className="w-3 h-3 relative z-10" />
                <span className="relative z-10">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "account" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{userName || "User"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
                  Account details
                </p>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-muted-foreground">Email</p>
                      <p className="text-xs truncate">{userEmail}</p>
                    </div>
                  </div>
                  {memberSince && (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-[11px] text-muted-foreground">Member since</p>
                        <p className="text-xs">{memberSince}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-[11px] text-muted-foreground">User ID</p>
                      <p className="text-xs font-mono text-muted-foreground/70 truncate">{userId}</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="opacity-30" />

              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
                  Session
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full h-9 justify-start gap-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/5 px-3"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                  <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
                </Button>
              </div>
            </div>
          )}

          {tab === "preferences" && (
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-3">
                  AI behavior
                </p>

                <div className="space-y-5">
                  <div className="px-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium">Active note limit</label>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{activeNoteLimit}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">
                      Maximum notes before AI starts archiving older ones
                    </p>
                    <Slider
                      value={[activeNoteLimit]}
                      onValueChange={([v]) => setActiveNoteLimit(v)}
                      min={20} max={500} step={10}
                    />
                  </div>

                  <div className="px-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium">Archive after</label>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {archiveAfterDays} day{archiveAfterDays > 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">
                      Days of inactivity before a note is archived
                    </p>
                    <Slider
                      value={[archiveAfterDays]}
                      onValueChange={([v]) => setArchiveAfterDays(v)}
                      min={7} max={90} step={1}
                    />
                  </div>

                  <div className="px-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium">Auto-reorganize</label>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        Every {reorganizeIntervalDays} day{reorganizeIntervalDays > 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">
                      How often AI reorganizes your notes
                    </p>
                    <Slider
                      value={[reorganizeIntervalDays]}
                      onValueChange={([v]) => setReorganizeIntervalDays(v)}
                      min={1} max={30} step={1}
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full h-9" size="sm">
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                )}
                Save preferences
              </Button>
            </div>
          )}

          {tab === "usage" && (
            <div className="space-y-5">
              {loadingUsage ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : !usageStats || (usageStats.totalInputTokens === 0 && usageStats.totalOutputTokens === 0) ? (
                <div className="text-center py-12">
                  <Activity className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No usage data yet</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    AI usage will appear here as you use the app
                  </p>
                </div>
              ) : (
                <>
                  {/* Totals */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3 text-center">
                      <Zap className="w-3.5 h-3.5 text-primary mx-auto mb-1.5" />
                      <p className="text-sm font-semibold tabular-nums">
                        {formatTokens(usageStats.totalInputTokens + usageStats.totalOutputTokens)}
                      </p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">Total tokens</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3 text-center">
                      <DollarSign className="w-3.5 h-3.5 text-green-500 mx-auto mb-1.5" />
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCost(usageStats.totalCostUsd)}
                      </p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">Total cost</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3 text-center">
                      <Activity className="w-3.5 h-3.5 text-blue-500 mx-auto mb-1.5" />
                      <p className="text-sm font-semibold tabular-nums">
                        {Object.values(usageStats.byOperation).reduce((s, o) => s + o.count, 0)}
                      </p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">API calls</p>
                    </div>
                  </div>

                  {/* Token breakdown */}
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
                      Token breakdown
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/20">
                        <ArrowUpRight className="w-3 h-3 text-orange-500" />
                        <span className="text-xs flex-1">Input tokens</span>
                        <span className="text-xs font-medium tabular-nums">{formatTokens(usageStats.totalInputTokens)}</span>
                      </div>
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/20">
                        <ArrowDownLeft className="w-3 h-3 text-blue-500" />
                        <span className="text-xs flex-1">Output tokens</span>
                        <span className="text-xs font-medium tabular-nums">{formatTokens(usageStats.totalOutputTokens)}</span>
                      </div>
                    </div>
                  </div>

                  {/* By model */}
                  {Object.keys(usageStats.byModel).length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
                        By model
                      </p>
                      <div className="space-y-1.5">
                        {Object.entries(usageStats.byModel).map(([model, data]) => (
                          <div key={model} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            <span className="text-xs flex-1 truncate">{MODEL_SHORT[model] || model}</span>
                            <span className="text-[10px] text-muted-foreground tabular-nums mr-2">
                              {formatTokens(data.input + data.output)}
                            </span>
                            <span className="text-[10px] font-medium tabular-nums">{formatCost(data.cost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* By operation */}
                  {Object.keys(usageStats.byOperation).length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
                        By feature
                      </p>
                      <div className="space-y-1.5">
                        {Object.entries(usageStats.byOperation)
                          .sort(([, a], [, b]) => b.cost - a.cost)
                          .map(([op, data]) => (
                            <div key={op} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/20">
                              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                              <span className="text-xs flex-1 truncate">{OPERATION_LABELS[op] || op}</span>
                              <span className="text-[10px] text-muted-foreground tabular-nums mr-2">
                                {data.count}x
                              </span>
                              <span className="text-[10px] font-medium tabular-nums">{formatCost(data.cost)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Recent calls */}
                  {usageStats.recentCalls.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
                        Recent activity
                      </p>
                      <div className="space-y-0.5">
                        {usageStats.recentCalls.slice(0, 10).map((call, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/20 transition-colors">
                            <span className="text-[11px] flex-1 truncate">{OPERATION_LABELS[call.operation] || call.operation}</span>
                            <span className="text-[9px] text-muted-foreground tabular-nums">
                              {formatTokens(call.inputTokens + call.outputTokens)}
                            </span>
                            <span className="text-[9px] text-muted-foreground tabular-nums w-12 text-right">
                              {formatCost(call.costUsd)}
                            </span>
                            <span className="text-[9px] text-muted-foreground/60 w-12 text-right">
                              {formatRelativeTime(call.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setUsageLoaded(false); fetchUsage(); }}
                    className="w-full h-8 text-[10px] text-muted-foreground"
                  >
                    Refresh usage data
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
