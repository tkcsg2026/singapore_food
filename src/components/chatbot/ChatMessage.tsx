"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function renderWithBold(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest.length > 0) {
    const open = rest.indexOf("**");
    if (open === -1) {
      out.push(<span key={`${keyPrefix}-${i++}`}>{rest}</span>);
      break;
    }
    if (open > 0) {
      out.push(<span key={`${keyPrefix}-${i++}`}>{rest.slice(0, open)}</span>);
    }
    const close = rest.indexOf("**", open + 2);
    if (close === -1) {
      out.push(<span key={`${keyPrefix}-${i++}`}>{rest.slice(open)}</span>);
      break;
    }
    out.push(
      <strong key={`${keyPrefix}-${i++}`} className="font-semibold text-foreground">
        {rest.slice(open + 2, close)}
      </strong>,
    );
    rest = rest.slice(close + 2);
  }
  return out;
}

export function ChatMessage({
  role,
  children,
  className,
}: {
  role: "user" | "assistant";
  children: string;
  className?: string;
}) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
        className,
      )}
    >
      <div
        className={cn(
          "inline-block w-fit max-w-[min(92%,22rem)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm transition-colors",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted/90 text-foreground border border-border/60 rounded-bl-md",
        )}
      >
        <div className="whitespace-pre-wrap break-words">{renderWithBold(children, role)}</div>
      </div>
    </div>
  );
}
