import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMessages } from "@/lib/workspace.functions";

type OpenFile = { path: string; language: string | null; content: string };

export function ChatPanel({
  projectId,
  threadId,
  openFiles,
  allFilePaths,
  activeFilePath,
}: {
  projectId: string;
  threadId: string;
  openFiles: OpenFile[];
  allFilePaths: string[];
  activeFilePath?: string;
}) {
  const listFn = useServerFn(listMessages);
  const { data: history } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => listFn({ data: { threadId } }),
  });

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!history) return [];
    return history.map((m) => ({
      id: m.id,
      role: m.role as UIMessage["role"],
      parts: (m.parts as UIMessage["parts"]) ?? [],
    }));
  }, [history]);

  // Use a ref to keep latest context on every send
  const ctxRef = useRef({ openFiles, allFilePaths });
  ctxRef.current = { openFiles, allFilePaths };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (url, init) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          // augment body with context
          const bodyObj = init?.body ? JSON.parse(init.body as string) : {};
          const augmented = JSON.stringify({
            ...bodyObj,
            threadId,
            projectId,
            openFiles: ctxRef.current.openFiles,
            allFilePaths: ctxRef.current.allFilePaths,
          });
          return fetch(url, { ...init, headers, body: augmented });
        },
      }),
    [projectId, threadId],
  );

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => console.error(e),
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  const isLoading = status === "submitted" || status === "streaming";

  const submit = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage({ text });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          AI Assistant
        </span>
        {activeFilePath && (
          <span className="ml-auto truncate text-[10px] text-muted-foreground">
            ctx: {activeFilePath}
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">Try asking:</p>
            <ul className="space-y-1">
              <li>• "Add a login function to this file"</li>
              <li>• "Refactor this into smaller functions"</li>
              <li>• "Split this into multiple files"</li>
              <li>• "Explain what this code does"</li>
            </ul>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="space-y-1">
            <div
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                m.role === "user" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {m.role === "user" ? "You" : "CodeMind"}
            </div>
            <div className="prose prose-sm prose-invert max-w-none break-words text-sm leading-relaxed">
              {m.parts.map((p, i) => {
                if (p.type === "text") {
                  return <ReactMarkdown key={i}>{p.text}</ReactMarkdown>;
                }
                return null;
              })}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-border p-2">
        <div className="relative rounded-md border border-border bg-background focus-within:border-primary">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask CodeMind to write or refactor code…"
            rows={2}
            className="w-full resize-none bg-transparent px-3 py-2 pr-10 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={submit}
            disabled={!input.trim() || isLoading}
            className="absolute bottom-2 right-2 rounded-md bg-primary p-1.5 text-primary-foreground disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
