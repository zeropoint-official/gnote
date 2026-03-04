"use client";

import { useState } from "react";
import { ChevronRight, Folder, FolderOpen, FileText, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { CategoryWithChildren } from "@/types";

interface CategoryTreeProps {
  categories: CategoryWithChildren[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export function CategoryTree({ categories, selectedCategoryId, onSelectCategory }: CategoryTreeProps) {
  return (
    <div className="space-y-1">
      <button
        onClick={() => onSelectCategory(null)}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors",
          selectedCategoryId === null
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        )}
      >
        <FileText className="w-4 h-4 shrink-0" />
        <span>All Notes</span>
      </button>

      {categories.map((category) => (
        <CategoryNode
          key={category.$id}
          category={category}
          depth={0}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={onSelectCategory}
        />
      ))}
    </div>
  );
}

function CategoryNode({
  category,
  depth,
  selectedCategoryId,
  onSelectCategory,
}: {
  category: CategoryWithChildren;
  depth: number;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = category.children.length > 0;
  const isSelected = selectedCategoryId === category.$id;
  const isArchived = category.status === "archived";

  return (
    <div>
      <button
        onClick={() => {
          onSelectCategory(category.$id);
          if (hasChildren) setExpanded(!expanded);
        }}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors group",
          isSelected
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          isArchived && "opacity-50"
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasChildren && (
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
              expanded && "rotate-90"
            )}
          />
        )}
        {!hasChildren && <div className="w-3.5" />}

        {isArchived ? (
          <Archive className="w-4 h-4 shrink-0" />
        ) : expanded && hasChildren ? (
          <FolderOpen className="w-4 h-4 shrink-0" />
        ) : (
          <Folder className="w-4 h-4 shrink-0" />
        )}

        <span className="truncate flex-1 text-left">{category.name}</span>

        <Badge
          variant="secondary"
          className="h-5 min-w-5 px-1.5 text-[10px] font-medium opacity-60 group-hover:opacity-100 transition-opacity"
        >
          {category.noteCount}
        </Badge>
      </button>

      <AnimatePresence initial={false}>
        {expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {category.children.map((child) => (
              <CategoryNode
                key={child.$id}
                category={child}
                depth={depth + 1}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={onSelectCategory}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
