"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { StarterPrompts } from "./StarterPrompts";
import type { ChatbotApiResponse } from "@/types/chatbot";

const SESSION_KEY = "fb-portal-chatbot-session";

type Msg = { id: string; role: "user" | "assistant"; content: string };

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `s-${Date.now()}`;
  }
}

export function ChatbotWidget() {
  const { t, lang } = useTranslation();
  const c = t.chatbot;
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  const sendText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loading) return;

      const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setLoading(true);

      let authHeader: Record<string, string> = {};
      try {
        const sb = getSupabase();
        if (sb) {
          const { data } = await sb.auth.getSession();
          const token = data.session?.access_token;
          if (token) authHeader = { Authorization: `Bearer ${token}` };
        }
      } catch {
        /* ignore */
      }

      try {
        const res = await fetch("/api/chatbot", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({
            message: text,
            sessionId: getOrCreateSessionId(),
            language: lang,
          }),
        });
        const data = (await res.json()) as ChatbotApiResponse & { error?: string };
        if (!res.ok) throw new Error(data.error || "request failed");
        const assistantMsg: Msg = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.answer,
        };
        setMessages((m) => [...m, assistantMsg]);
      } catch {
        setMessages((m) => [
          ...m,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: c.error,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, lang, c.error],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendText(input);
  };

  return (
    <>
      <div
        className={cn(
          "fixed z-[56] flex flex-col items-end gap-2 pointer-events-none",
          "right-[max(1rem,env(safe-area-inset-right))]",
          // Stack above the back-to-top control (≈44px + margin)
          "bottom-[max(5.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div
          id={panelId}
          role="dialog"
          aria-label={c.title}
          aria-hidden={!open}
          className={cn(
            "pointer-events-auto w-[min(100vw-2rem,22rem)] sm:w-[24rem] origin-bottom-right transition-all duration-200 ease-out motion-reduce:transition-none",
            open
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-2 pointer-events-none h-0 overflow-hidden",
          )}
        >
          <div className="flex max-h-[min(70vh,28rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xl shadow-black/10">
            <div className="flex items-start justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold tracking-tight text-foreground">{c.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{c.subtitle}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full"
                onClick={() => setOpen(false)}
                aria-label={c.closeAssistant}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="min-h-[10rem] max-h-[min(42vh,18rem)] flex-1 basis-0 px-3 py-3">
              <div className="space-y-3 pr-2">
                {messages.length === 0 && !loading && (
                  <p className="text-xs text-muted-foreground leading-relaxed px-0.5">{c.subtitle}</p>
                )}
                {messages.map((m) => (
                  <ChatMessage key={m.id} role={m.role}>
                    {m.content}
                  </ChatMessage>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 py-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    <span>{c.thinking}</span>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-border px-3 pt-2 pb-3 space-y-2 bg-card">
              <StarterPrompts
                prompts={messages.length === 0 && !loading ? c.starters : []}
                onSelect={(p) => void sendText(p)}
                disabled={loading}
              />
              <form onSubmit={onSubmit} className="flex gap-2 items-end">
                <label htmlFor="chatbot-input" className="sr-only">
                  {c.placeholder}
                </label>
                <textarea
                  id="chatbot-input"
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendText(input);
                    }
                  }}
                  placeholder={c.placeholder}
                  disabled={loading}
                  className={cn(
                    "flex-1 min-h-[44px] max-h-24 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm",
                    "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                    "disabled:opacity-60",
                  )}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl"
                  disabled={loading || !input.trim()}
                  aria-label={c.send}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "pointer-events-auto h-14 w-14 rounded-full shadow-lg",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "transition-transform duration-200 active:scale-95",
          )}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? c.closeAssistant : c.openAssistant}
        >
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </Button>
      </div>
    </>
  );
}
