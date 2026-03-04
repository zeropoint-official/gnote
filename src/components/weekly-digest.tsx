"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, X, Archive, FolderPlus, ArrowRightLeft, Merge, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import type { Digest, DigestChanges } from "@/types";

interface WeeklyDigestProps {
  userId: string;
}

export function WeeklyDigest({ userId }: WeeklyDigestProps) {
  const [digests, setDigests] = useState<Digest[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchDigests = useCallback(async () => {
    try {
      const res = await fetch(`/api/digests?userId=${userId}`);
      const data = await res.json();
      setDigests(data.digests || []);
    } catch {
      // graceful fail
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDigests();
  }, [fetchDigests]);

  const dismissDigest = async (digestId: string) => {
    setDigests((prev) => prev.filter((d) => d.$id !== digestId));
    try {
      await fetch("/api/digests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestId }),
      });
    } catch {
      // graceful fail
    }
  };

  if (loading || digests.length === 0) return null;

  const latest = digests[0];
  let changes: DigestChanges = { archived: 0, created: 0, recategorized: 0, merged: 0 };
  try {
    changes = JSON.parse(latest.changes);
  } catch {
    // invalid JSON
  }

  const totalChanges = changes.archived + changes.created + changes.recategorized + changes.merged;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        className="mb-4"
      >
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium">AI Reorganization</h4>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  {totalChanges > 0 && (
                    <div className="flex items-center flex-wrap gap-1.5 mb-2">
                      {changes.archived > 0 && (
                        <Badge variant="secondary" className="text-[10px] gap-1 font-normal">
                          <Archive className="w-2.5 h-2.5" />
                          {changes.archived} archived
                        </Badge>
                      )}
                      {changes.created > 0 && (
                        <Badge variant="secondary" className="text-[10px] gap-1 font-normal">
                          <FolderPlus className="w-2.5 h-2.5" />
                          {changes.created} created
                        </Badge>
                      )}
                      {changes.recategorized > 0 && (
                        <Badge variant="secondary" className="text-[10px] gap-1 font-normal">
                          <ArrowRightLeft className="w-2.5 h-2.5" />
                          {changes.recategorized} moved
                        </Badge>
                      )}
                      {changes.merged > 0 && (
                        <Badge variant="secondary" className="text-[10px] gap-1 font-normal">
                          <Merge className="w-2.5 h-2.5" />
                          {changes.merged} merged
                        </Badge>
                      )}
                    </div>
                  )}

                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {latest.summary}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(!expanded)}
                    className="h-5 px-1 mt-1 text-[10px] text-muted-foreground/50"
                  >
                    {expanded ? (
                      <><ChevronUp className="w-3 h-3 mr-0.5" />Less</>
                    ) : (
                      <><ChevronDown className="w-3 h-3 mr-0.5" />More</>
                    )}
                  </Button>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissDigest(latest.$id)}
                className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-muted-foreground shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
