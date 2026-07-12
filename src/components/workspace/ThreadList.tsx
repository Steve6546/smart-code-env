import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquarePlus,
  Trash2,
  Search,
  Pin,
  PinOff,
  Pencil,
  Check,
  X,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import {
  createThread,
  deleteThread,
  listThreads,
  updateThread,
} from "@/lib/workspace.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Thread = {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
  pinned: boolean;
  auto_titled: boolean;
  archived: boolean;
};


const DAY = 86_400_000;
function bucketOf(iso: string): "today" | "yesterday" | "week" | "older" {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = new Date(iso).getTime();
  if (t >= startToday) return "today";
  if (t >= startToday - DAY) return "yesterday";
  if (t >= startToday - 7 * DAY) return "week";
  return "older";
}
const BUCKET_LABEL: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Last 7 days",
  older: "Older",
};

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
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
  const updateFn = useServerFn(updateThread);
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Thread | null>(null);

  const [showArchived, setShowArchived] = useState(false);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads", projectId, showArchived],
    queryFn: () =>
      listFn({ data: { projectId, includeArchived: showArchived } }) as Promise<Thread[]>,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["threads", projectId] });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { projectId } }),
    onSuccess: (t) => {
      invalidate();
      navigate({
        to: "/p/$projectId/$threadId",
        params: { projectId, threadId: t.id },
      });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => {
      const res = (await qc.fetchQuery({
        queryKey: ["threads", projectId, false],
        queryFn: () =>
          listFn({ data: { projectId, includeArchived: false } }) as Promise<Thread[]>,
      })) as Thread[];
      invalidate();
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

  const updateMut = useMutation({
    mutationFn: (v: { id: string; title?: string; pinned?: boolean; archived?: boolean }) =>
      updateFn({ data: v }),
    onSuccess: invalidate,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, query]);

  const active = filtered.filter((t) => !t.archived);
  const archived = filtered.filter((t) => t.archived);
  const pinned = active.filter((t) => t.pinned);
  const rest = active.filter((t) => !t.pinned);
  const byBucket: Record<string, Thread[]> = { today: [], yesterday: [], week: [], older: [] };
  for (const t of rest) byBucket[bucketOf(t.updated_at)].push(t);


  const commitRename = (id: string) => {
    const v = renameValue.trim();
    if (v) updateMut.mutate({ id, title: v });
    setRenamingId(null);
    setRenameValue("");
  };

  const renderRow = (t: Thread) => {
    const active = t.id === activeThreadId;
    const isRenaming = renamingId === t.id;
    return (
      <div
        key={t.id}
        className={`group mx-2 mb-0.5 flex items-center gap-1 rounded-md px-2 py-1.5 text-xs ${
          active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
        }`}
      >
        {isRenaming ? (
          <>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(t.id);
                if (e.key === "Escape") {
                  setRenamingId(null);
                  setRenameValue("");
                }
              }}
              className="flex-1 min-w-0 rounded border border-primary bg-background px-1 py-0.5 text-xs outline-none"
            />
            <button
              onClick={() => commitRename(t.id)}
              className="text-emerald-500 hover:text-emerald-400"
              title="Save"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                setRenamingId(null);
                setRenameValue("");
              }}
              className="text-muted-foreground hover:text-foreground"
              title="Cancel"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() =>
                navigate({
                  to: "/p/$projectId/$threadId",
                  params: { projectId, threadId: t.id },
                })
              }
              className="flex-1 min-w-0 text-left"
            >
              <div className="flex items-center gap-1">
                {t.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                <span className="truncate font-medium">{t.title}</span>
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                {relTime(t.updated_at)}
              </div>
            </button>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
              <button
                onClick={() => updateMut.mutate({ id: t.id, pinned: !t.pinned })}
                className="p-0.5 hover:text-primary"
                title={t.pinned ? "Unpin" : "Pin"}
              >
                {t.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </button>
              <button
                onClick={() => {
                  setRenamingId(t.id);
                  setRenameValue(t.title);
                }}
                className="p-0.5 hover:text-foreground"
                title="Rename"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => setPendingDelete(t)}
                className="p-0.5 hover:text-destructive"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

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
      <div className="max-h-72 overflow-auto pb-2">
        {filtered.length === 0 && (
          <div className="px-3 py-2 text-[11px] text-muted-foreground">No chats</div>
        )}
        {pinned.length > 0 && (
          <div>
            <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pinned
            </div>
            {pinned.map(renderRow)}
          </div>
        )}
        {(["today", "yesterday", "week", "older"] as const).map((b) =>
          byBucket[b].length > 0 ? (
            <div key={b}>
              <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {BUCKET_LABEL[b]}
              </div>
              {byBucket[b].map(renderRow)}
            </div>
          ) : null,
        )}
      </div>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete “{pendingDelete?.title}” and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) delMut.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
