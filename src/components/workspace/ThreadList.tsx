import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, Trash2, Search } from "lucide-react";
import { createThread, deleteThread, listThreads } from "@/lib/workspace.functions";

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function ThreadList({
  projectId,
  activeThreadId,
}: {
  projectId: string;
  activeThreadId: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);
  const [query, setQuery] = useState("");

  const { data: threads = [] } = useQuery({
    queryKey: ["threads", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { projectId } }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads", projectId] });
      navigate({
        to: "/p/$projectId/$threadId",
        params: { projectId, threadId: t.id },
      });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => {
      const res = await qc.fetchQuery({
        queryKey: ["threads", projectId],
        queryFn: () => listFn({ data: { projectId } }),
      });
      qc.invalidateQueries({ queryKey: ["threads", projectId] });
      if (res[0]) {
        navigate({
          to: "/p/$projectId/$threadId",
          params: { projectId, threadId: res[0].id },
        });
      } else {
        createMut.mutate();
      }
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, query]);

  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Chats
        </span>
        <button
          onClick={() => createMut.mutate()}
          className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/20"
          title="New chat"
        >
          <MessageSquarePlus className="h-3 w-3" />
          New
        </button>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="w-full rounded-md border border-border bg-background pl-7 pr-2 py-1 text-xs outline-none focus:border-primary"
          />
        </div>
      </div>
      <div className="max-h-56 overflow-auto pb-2">
        {filtered.length === 0 && (
          <div className="px-3 py-2 text-[11px] text-muted-foreground">No chats</div>
        )}
        {filtered.map((t) => {
          const active = t.id === activeThreadId;
          return (
            <div
              key={t.id}
              className={`group mx-2 mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              }`}
            >
              <button
                onClick={() =>
                  navigate({
                    to: "/p/$projectId/$threadId",
                    params: { projectId, threadId: t.id },
                  })
                }
                className="flex-1 min-w-0 text-left"
              >
                <div className="truncate font-medium">{t.title}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {relTime(t.updated_at)}
                </div>
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete chat?")) delMut.mutate(t.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
