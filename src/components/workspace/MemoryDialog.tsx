import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { listMemory, upsertMemory, deleteMemory } from "@/lib/workspace.functions";
import { toast } from "sonner";

const KEY_RE = /^[a-zA-Z0-9_.\-]+$/;

type MemoryRow = {
  id: string;
  kind: string;
  key: string | null;
  content: string;
  updated_at: string;
};

export function MemoryDialog({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMemory);
  const upsertFn = useServerFn(upsertMemory);
  const deleteFn = useServerFn(deleteMemory);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ key: string; content: string; original?: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MemoryRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["project-memory", projectId],
    queryFn: () => listFn({ data: { projectId } }),
    enabled: open,
  });

  const upsertMut = useMutation({
    mutationFn: (v: { key: string; content: string }) =>
      upsertFn({ data: { projectId, key: v.key, content: v.content } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-memory", projectId] });
      setEditing(null);
      toast.success("Memory saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-memory", projectId] });
      setPendingDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kv = rows.filter((r) => r.kind === "kv" && r.key);
  const summaries = rows.filter((r) => r.kind === "summary");
  const actions = rows.filter((r) => r.kind === "actions").slice(0, 20);

  const keyError = editing
    ? !editing.key.trim()
      ? "Key is required"
      : !KEY_RE.test(editing.key.trim())
        ? "Only letters, numbers, . _ -"
        : editing.original !== editing.key.trim() && kv.some((r) => r.key === editing.key.trim())
          ? "A memory with this key already exists"
          : null
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            title="Project memory"
          >
            <Brain className="h-3.5 w-3.5" />
            Memory
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Project memory</DialogTitle>
            <DialogDescription>
              Long-term facts the agent uses in every conversation. Add stack choices,
              style rules, and architectural decisions here.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {kv.length} key/value {kv.length === 1 ? "entry" : "entries"}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditing({ key: "", content: "" })}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> New
            </Button>
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : kv.length === 0 && !editing ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No memory yet. Add facts the agent should always know.
              </p>
            ) : (
              kv.map((r) => (
                <div
                  key={r.id}
                  className="group rounded-md border border-border bg-card/50 p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs font-semibold text-primary">
                      {r.key}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() =>
                          setEditing({ key: r.key ?? "", content: r.content, original: r.key ?? "" })
                        }
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setPendingDelete(r)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                    {r.content}
                  </p>
                </div>
              ))
            )}

            {editing && (
              <div className="rounded-md border border-primary/50 bg-card p-3">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Key
                </label>
                <Input
                  autoFocus
                  value={editing.key}
                  onChange={(e) => setEditing({ ...editing, key: e.target.value })}
                  placeholder="e.g. stack, style, rules"
                  aria-invalid={!!keyError}
                  className="mb-2 font-mono text-xs"
                />
                {keyError && (
                  <p className="mb-2 text-xs text-destructive">{keyError}</p>
                )}
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Value
                </label>
                <Textarea
                  value={editing.content}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  placeholder="React 19 + TanStack Start + Supabase. Never use default exports."
                  rows={4}
                  className="text-xs"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!!keyError || !editing.content.trim() || upsertMut.isPending}
                    onClick={() =>
                      upsertMut.mutate({
                        key: editing.key.trim(),
                        content: editing.content.trim(),
                      })
                    }
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}

            {summaries.length > 0 && (
              <details className="mt-4 rounded-md border border-border bg-muted/20 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                  Auto-generated conversation summaries ({summaries.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {summaries.map((r) => (
                    <div key={r.id} className="rounded border border-border/50 p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(r.updated_at).toLocaleString()}
                        </span>
                        <button
                          onClick={() => setPendingDelete(r)}
                          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {r.content}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {actions.length > 0 && (
              <details className="rounded-md border border-border bg-muted/20 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                  Recent agent actions ({actions.length})
                </summary>
                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  {actions.map((r) => (
                    <li key={r.id} className="truncate font-mono">
                      {r.content}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete memory?</AlertDialogTitle>
            <AlertDialogDescription>
              The agent will forget this on the next conversation. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
