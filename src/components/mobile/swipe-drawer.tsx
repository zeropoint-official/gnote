"use client";

import { useEffect } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DrawerSide = "left" | "right";

interface SwipeDrawerProps {
  side: DrawerSide;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function SwipeDrawer({ side, open, onClose, children, className }: SwipeDrawerProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 80;
    if (side === "left" && info.offset.x < -threshold) {
      onClose();
    } else if (side === "right" && info.offset.x > threshold) {
      onClose();
    }
  };

  const initial = side === "left" ? { x: "-100%" } : { x: "100%" };
  const animate = { x: 0 };
  const exit = side === "left" ? { x: "-100%" } : { x: "100%" };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-[100] md:hidden"
            onClick={onClose}
          />

          <motion.div
            initial={initial}
            animate={animate}
            exit={exit}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={side === "left" ? { left: 0.5, right: 0 } : { left: 0, right: 0.5 }}
            onDragEnd={handleDragEnd}
            className={cn(
              "fixed top-0 bottom-0 z-[101] md:hidden w-[85%] max-w-[360px]",
              "bg-background shadow-2xl",
              "flex flex-col overflow-hidden",
              side === "left" ? "left-0 border-r border-border/30 rounded-r-2xl" : "right-0 border-l border-border/30 rounded-l-2xl",
              className
            )}
          >
            <div className={cn(
              "flex items-center pt-3 pb-1 px-3",
              side === "left" ? "justify-end" : "justify-start"
            )}>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
