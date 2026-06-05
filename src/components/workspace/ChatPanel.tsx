import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Sparkles, Loader2, Copy, Check, FilePlus2, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMessages, createFile, updateFile, listFiles } from "@/lib/workspace.functions";

type OpenFile = { path: string; language: string | null; content: string };

function CodeBlock({
  code,
  language,
  projectId,
  onApplied,
}: {
  code: string;
  language: string;
  projectId: string;
  onApplied: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const createFn = useServerFn(createFile);
  const updateFn = useServerFn(updateFile);
  const listFn = useServerFn(listFiles);

  // Detect file path from first line (// path or # path)
  const firstLine = code.split("\n", 1)[0] ?? "";
  const m = firstLine.match(/^\s*(?:\/\/|#|<!--)\s*([\w./\-]+\.\w+)\s*(?:-->)?\s*$/);
  const path = m?.[1];
  const bodyCode = path ? code.split("\n").slice(1).join("\n") : code;

  const copy = async () => {
    await navigator.clipboard.writeText(bodyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const apply = async () => {
    if (!path) return;
    setApplying(true);
    try {
      const files = await listFn({ data: { projectId } });
      const existing = files.find((f) => f.path === path && !f.is_folder);
      if (existing) {
        await updateFn({ data: { id: existing.id, content: bodyCode } });
      } else {
        const created = await createFn({ data: { projectId, path } });
        await updateFn({ data: { id: created.id, content: bodyCode } });
      }
      setApplied(true);
      onApplied();
      setTimeout(() => setApplied(false), 2000);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-md border border-border bg-[#1e1e1e]">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-2 py-1 text-[10px] text-muted-foreground">
        <span className="truncate font-mono">{path ?? language}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent"
            title="Copy"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          {path && (
            <button
              onClick={apply}
              disabled={applying}
              className="flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-primary-foreground hover:opacity-90 disabled:opacity-50"
              title={`Apply to ${path}`}
            >
              {applying ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : applied ? (
                <Check className="h-3 w-3" />
              ) : (
                <FilePlus2 className="h-3 w-3" />
              )}
              {applied ? "Applied" : "Apply"}
            </button>
          )}
        </div>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={vscDarkPlus}
        customStyle={{ margin: 0, padding: "0.6rem 0.75rem", fontSize: 12, background: "transparent" }}
        wrapLongLines
      >
        {bodyCode}
      </SyntaxHighlighter>
    </div>
  );
}

function ToolPart({ part }: { part: { type: string; state?: string; input?: unknown; output?: unknown; toolName?: string } }) {
  const [open, setOpen] = useState(false);
  // AI SDK 5 tool parts come as type: `tool-${toolName}`
  const toolName = part.toolName ?? part.type.replace(/^tool-/, "");
  const state = part.state ?? "";
  const running = state === "input-streaming" || state === "input-available";
  const output = part.output as { ok?: boolean; action?: string; path?: string; from?: string; to?: string; error?: string } | undefined;

  let summary = toolName;
  if (output?.ok) {
    if (output.action === "created") summary = `Created ${output.path}`;
    else if (output.action === "updated") summary = `Updated ${output.path}`;
    else if (output.action === "deleted") summary = `Deleted ${output.path}`;
    else if (output.action === "renamed") summary = `Renamed ${output.from} → ${output.to}`;
    else summary = `${toolName} ✓`;
  } else if (output && !output.ok) {
    summary = `${toolName} failed: ${output.error ?? "error"}`;
  }

  return (
    <div className="my-1 rounded-md border border-border bg-card/50 text-[11px]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 px-2 py-1 text-left">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {running ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <Wrench className="h-3 w-3 text-primary" />}
        <span className="truncate font-mono">{summary}</span>
      </button>
      {open && (
        <div className="border-t border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">
          {part.input != null && (
            <div className="mb-1">
              <div className="opacity-60">input:</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(part.input, null, 2)}</pre>
            </div>
          )}
          {output != null && (
            <div>
              <div className="opacity-60">output:</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(output, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatPanel({
  projectId,
  threadId,
  openFiles,
  allFilePaths,
  activeFilePath,
  onAgentWrite,
}: {
  projectId: string;
  threadId: string;
  openFiles: OpenFile[];
  allFilePaths: string[];
  activeFilePath?: string;
  onAgentWrite?: (path: string, content: string) => void;
}) {
  const qc = useQueryClient();
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

  // Refetch files whenever the assistant likely mutated them (tool calls present).
  const lastMsgFingerprint = messages
    .map((m) => m.parts.filter((p) => p.type.startsWith("tool-")).length)
    .join(",");
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["files", projectId] });
  }, [lastMsgFingerprint, qc, projectId]);

  const isLoading = status === "submitted" || status === "streaming";

  const submit = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage({ text });
  };

  const onApplied = () => qc.invalidateQueries({ queryKey: ["files", projectId] });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          AI Agent
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
            <p className="mb-2 font-medium text-foreground">The agent can edit your files directly. Try:</p>
            <ul className="space-y-1">
              <li>• "Add a login() function to src/main.py"</li>
              <li>• "Create src/utils/auth.ts with JWT helpers"</li>
              <li>• "Rename src/main.py to src/app.py"</li>
              <li>• "Split this file into smaller modules"</li>
              <li>• "Find where 'handleError' is used in the project"</li>
              <li>• "Delete README.md"</li>
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
                  return (
                    <ReactMarkdown
                      key={i}
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || "");
                          const text = String(children).replace(/\n$/, "");
                          const isBlock = text.includes("\n") || !!match;
                          if (!isBlock) {
                            return (
                              <code className="rounded bg-muted px-1 py-0.5 text-[12px]" {...props}>
                                {children}
                              </code>
                            );
                          }
                          return (
                            <CodeBlock
                              code={text}
                              language={match?.[1] ?? "text"}
                              projectId={projectId}
                              onApplied={onApplied}
                            />
                          );
                        },
                      }}
                    >
                      {p.text}
                    </ReactMarkdown>
                  );
                }
                if (p.type.startsWith("tool-")) {
                  return <ToolPart key={i} part={p as never} />;
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
            placeholder="Tell the agent what to build, refactor, or fix…"
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
