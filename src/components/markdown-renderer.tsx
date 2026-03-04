"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("prose-sm", className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-base font-semibold mt-3 mb-1.5 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-semibold mt-3 mb-1 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-medium mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-2 space-y-0.5 text-sm">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-2 space-y-0.5 text-sm">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        code: ({ children, className: codeClassName }) => {
          const isInline = !codeClassName;
          if (isInline) {
            return (
              <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                {children}
              </code>
            );
          }
          return (
            <code className="block p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto mb-2">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-2 last:mb-0">{children}</pre>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-border pl-3 italic text-muted-foreground mb-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-border/50" />,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border/50 px-2 py-1 bg-muted text-left font-medium">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border/50 px-2 py-1">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
