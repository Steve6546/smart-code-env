import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Sparkles,
  Loader2,
  Copy,
  Check,
  FilePlus2,
  Wrench,
  ChevronDown,
  ChevronRight,
  Undo2,
  Pencil,
  User as UserIcon,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMessages,
  createFile,
  updateFile,
  listFiles,
  deleteMessage,
  updateMessage,
  rollbackMessage,
} from "@/lib/workspace.functions";
import { motion, AnimatePresence } from "framer-motion";


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
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-2 py-1 text-[11px] text-muted-foreground">
        <span className="truncate font-mono">{path ?? language}</span>
        <div className="flex items-center gap-1">
          <button onClick={copy} className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          {path && (
            <button
              onClick={apply}
              disabled={applying}
              className="flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-primary-foreground hover:opacity-90 disabled:opacity-50"
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
        customStyle={{ margin: 0, padding: "0.7rem 0.85rem", fontSize: 13, background: "transparent" }}
        wrapLongLines
      >
        {bodyCode}
      </SyntaxHighlighter>
    </div>
  );
}

function ToolPart({
  part,
}: {
  part: { type: string; state?: string; input?: unknown; output?: unknown; toolName?: string };
}) {
  const [open, setOpen] = useState(false);
  const toolName = part.toolName ?? part.type.replace(/^tool-/, "");
  const state = part.state ?? "";
  const running = state === "input-streaming" || state === "input-available";
  const output = part.output as
    | { ok?: boolean; action?: string; path?: string; from?: string; to?: string; error?: string }
    | undefined;
  const failed = output && !output.ok;
  const done = output?.ok === true;

  const verb: Record<string, string> = {
    read_file: "Read",
    write_file: "Wrote",
    edit_file: "Patched",
    delete_file: "Deleted",
    delete_path: "Deleted",
    create_folder: "Created folder",
    rename_file: "Renamed",
    move_path: "Moved",
    list_files: "Listed files",
    grep: "Searched",
  };
  const input = part.input as { path?: string; from?: string; to?: string; pattern?: string } | undefined;
  const target =
    input?.path ?? (input?.from && input?.to ? `${input.from} → ${input.to}` : input?.pattern ?? "");
  const summary = output?.ok
    ? output.action === "renamed"
      ? `Renamed ${output.from} → ${output.to}`
      : `${verb[toolName] ?? toolName} ${output.path ?? target}`.trim()
    : output && !output.ok
      ? `${toolName} failed: ${output.error ?? "error"}`
      : `${verb[toolName] ?? toolName}${target ? ` ${target}` : "…"}`;

  const Icon = running ? Loader2 : failed ? XCircle : done ? CheckCircle2 : Wrench;

  return (
    <div
      className={`my-1.5 rounded-md border text-[12px] ${
        failed
          ? "border-destructive/40 bg-destructive/5"
          : done
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-border bg-card/60"
      }`}
    >
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Icon
          className={`h-3.5 w-3.5 flex-shrink-0 ${
            running ? "animate-spin text-primary" : failed ? "text-destructive" : done ? "text-emerald-500" : "text-primary"
          }`}
        />
        <span className="truncate font-mono">{summary}</span>
      </button>
      {open && (
        <div className="border-t border-border px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
          {part.input != null && (
            <div className="mb-1">
              <div className="opacity-60">input:</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(part.input, null, 2)}
              </pre>
            </div>
          )}
          {output != null && (
            <div>
              <div className="opacity-60">output:</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all max-h-48">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({
  projectId,
  threadId,
  openFiles,
  allFilePaths,
  activeFilePath,
  onAgentWrite,
  onAgentTouchPath,
}: {
  projectId: string;
  threadId: string;
  openFiles: OpenFile[];
  allFilePaths: string[];
  activeFilePath?: string;
  onAgentWrite?: (path: string, content: string) => void;
  onAgentTouchPath?: (path: string) => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMessages);
  const deleteMsgFn = useServerFn(deleteMessage);
  const updateMsgFn = useServerFn(updateMessage);
  const rollbackFn = useServerFn(rollbackMessage);


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

  const timestamps = useMemo(() => {
    const map = new Map<string, string>();
    history?.forEach((m) => map.set(m.id, m.created_at));
    return map;
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

  const { messages, sendMessage, setMessages, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => console.error(e),
  });

  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  const seenToolCallsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    let touched = false;
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const p of m.parts as Array<{
        type: string;
        state?: string;
        toolCallId?: string;
        toolName?: string;
        input?: { path?: string; from?: string; to?: string; content?: string };
        output?: { ok?: boolean; action?: string };
      }>) {
        if (!p.type.startsWith("tool-")) continue;
        if (p.state !== "output-available") continue;
        const id = p.toolCallId ?? `${m.id}-${p.type}`;
        if (seenToolCallsRef.current.has(id)) continue;
        seenToolCallsRef.current.add(id);
        if (!p.output?.ok) continue;
        const tool = p.toolName ?? p.type.replace(/^tool-/, "");
        touched = true;
        if (tool === "write_file" && p.input?.path && typeof p.input.content === "string") {
          onAgentWrite?.(p.input.path, p.input.content);
        } else if (tool === "edit_file" && p.input?.path) {
          onAgentTouchPath?.(p.input.path);
        } else if (tool === "move_path" || tool === "rename_file") {
          if (p.input?.from) onAgentTouchPath?.(p.input.from);
          if (p.input?.to) onAgentTouchPath?.(p.input.to);
        }
      }
    }
    if (touched) qc.invalidateQueries({ queryKey: ["files", projectId] });
  }, [messages, qc, projectId, onAgentWrite, onAgentTouchPath]);

  const isLoading = status === "submitted" || status === "streaming";
  const lastMsg = messages[messages.length - 1];
  const showThinking = isLoading && (!lastMsg || lastMsg.role === "user" || !lastMsg.parts?.length);

  const submit = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage({ text });
  };

  const onApplied = () => qc.invalidateQueries({ queryKey: ["files", projectId] });

  const undoMut = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await deleteMsgFn({ data: { id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", threadId] }),
  });

  const undoLast = () => {
    if (isLoading || messages.length === 0) return;
    // Remove the last assistant turn + the user turn that triggered it
    const toRemove: string[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      toRemove.push(m.id);
      if (m.role === "user") break;
    }
    if (!toRemove.length) return;
    if (!confirm("Undo the last exchange? This cannot be reversed.")) return;
    const removeSet = new Set(toRemove);
    setMessages((prev) => prev.filter((m) => !removeSet.has(m.id)));
    // Only delete persisted messages (skip optimistic IDs that haven't synced)
    undoMut.mutate(toRemove.filter((id) => timestamps.has(id)));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const text = editingText.trim();
    if (!text) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === editingId ? { ...m, parts: [{ type: "text", text }] } : m)),
    );
    if (timestamps.has(editingId)) {
      await updateMsgFn({ data: { id: editingId, text } });
      qc.invalidateQueries({ queryKey: ["messages", threadId] });
    }
    setEditingId(null);
    setEditingText("");
  };

  const rollbackOne = async (messageId: string) => {
    if (!confirm("Roll back the file changes from this reply?")) return;
    try {
      const res = await rollbackFn({ data: { projectId, messageId } });
      qc.invalidateQueries({ queryKey: ["files", projectId] });
      if (res.restored === 0) {
        alert("No file changes were recorded for this reply.");
      } else {
        // Force any open tabs to reload from disk
        for (const m of messages) {
          if (m.id !== messageId) continue;
          for (const p of m.parts as Array<{ type: string; input?: { path?: string; from?: string; to?: string } }>) {
            if (!p.type.startsWith("tool-")) continue;
            if (p.input?.path) onAgentTouchPath?.(p.input.path);
            if (p.input?.from) onAgentTouchPath?.(p.input.from);
            if (p.input?.to) onAgentTouchPath?.(p.input.to);
          }
        }
      }
    } catch (e) {
      console.error(e);
      alert("Rollback failed.");
    }
  };


  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          AI Agent
        </span>
        <div className="ml-auto flex items-center gap-1">
          {activeFilePath && (
            <span className="hidden sm:inline truncate text-[10px] text-muted-foreground max-w-[160px]">
              ctx: {activeFilePath}
            </span>
          )}
          <button
            onClick={undoLast}
            disabled={isLoading || messages.length === 0}
            title="Undo last exchange"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">
              The agent can edit your files directly. Try:
            </p>
            <ul className="space-y-1">
              <li>• "Add a login() function to src/main.py"</li>
              <li>• "Create src/utils/auth.ts with JWT helpers"</li>
              <li>• "Rename src/main.py to src/app.py"</li>
              <li>• "Split this file into smaller modules"</li>
              <li>• "Find where 'handleError' is used in the project"</li>
            </ul>
          </div>
        )}
        {messages.map((m) => {
          const ts = timestamps.get(m.id);
          const time = ts ? formatTime(new Date(ts)) : "";
          const isUser = m.role === "user";
          const textOfMsg = m.parts
            .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
            .join("");
          const isEditing = editingId === m.id;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="group flex gap-2.5"
            >
              <div
                className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                  isUser ? "bg-primary/20 text-primary" : "bg-emerald-500/15 text-emerald-400"
                }`}
              >
                {isUser ? <UserIcon className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className={`font-semibold ${isUser ? "text-primary" : "text-emerald-400"}`}>
                    {isUser ? "You" : "CodeMind"}
                  </span>
                  {time && <span>{time}</span>}
                  {isUser && !isEditing && textOfMsg && (
                    <button
                      onClick={() => {
                        setEditingId(m.id);
                        setEditingText(textOfMsg);
                      }}
                      className="ml-auto opacity-0 transition group-hover:opacity-100 hover:text-foreground"
                      title="Edit message"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  {!isUser && timestamps.has(m.id) && (
                    <button
                      onClick={() => rollbackOne(m.id)}
                      className="ml-auto opacity-0 transition group-hover:opacity-100 hover:text-foreground flex items-center gap-1"
                      title="Roll back file changes from this reply"
                    >
                      <Undo2 className="h-3 w-3" />
                      <span>Undo</span>
                    </button>
                  )}
                </div>
                {isEditing ? (

                  <div className="space-y-2">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded border border-border px-2 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none break-words text-[14px] leading-relaxed">
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
                                    <code className="rounded bg-muted px-1 py-0.5 text-[13px]" {...props}>
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
                            {(p as { text: string }).text}
                          </ReactMarkdown>
                        );
                      }
                      if (p.type.startsWith("tool-")) {
                        return <ToolPart key={i} part={p as never} />;
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            </motion.div>

          );
        })}
        {showThinking && (
          <div className="flex gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-2 sm:p-3">
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
            className="w-full resize-none bg-transparent px-3 py-2 pr-11 text-[14px] outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={submit}
            disabled={!input.trim() || isLoading}
            className="absolute bottom-2 right-2 rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
