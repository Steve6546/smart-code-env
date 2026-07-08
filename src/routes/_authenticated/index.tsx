import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Code2, Plus, Trash2, FolderGit2, LogOut, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createProject,
  deleteProject,
  listProjects,
} from "@/lib/workspace.functions";
import { toast } from "sonner";

type SortKey = "updated" | "name" | "created";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Your projects — CodeMind dashboard" },
      {
        name: "description",
        content:
          "Manage your CodeMind AI workspaces: create new projects, open recent ones, and pick up where you left off.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Your projects — CodeMind dashboard" },
      {
        property: "og:description",
        content: "Manage your CodeMind AI workspaces and open a project to keep building.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://smart-code-env.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://smart-code-env.lovable.app/" }],
  }),
});

const NAME_RE = /^[a-zA-Z0-9 _.\-]+$/;

function Dashboard() {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const listFn = useServerFn(listProjects);
  const createFn = useServerFn(createProject);
  const deleteFn = useServerFn(deleteProject);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listFn(),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(
    null,
  );

  const existingNames = useMemo(
    () => new Set(projects.map((p) => p.name.trim().toLowerCase())),
    [projects],
  );

  const trimmed = name.trim();
  const nameError = !trimmed
    ? "Name is required"
    : trimmed.length > 100
      ? "Name is too long"
      : !NAME_RE.test(trimmed)
        ? "Only letters, numbers, spaces, dots, dashes, underscores"
        : existingNames.has(trimmed.toLowerCase())
          ? "A project with this name already exists"
          : null;

  const createMut = useMutation({
    mutationFn: (n: string) => createFn({ data: { name: n } }),
    onSuccess: (p) => {
      setOpen(false);
      setName("");
      qc.invalidateQueries({ queryKey: ["projects"] });
      navigate({ to: "/p/$projectId", params: { projectId: p.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : [...projects];
    list.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "created")
        return new Date(b.created_at ?? b.updated_at).getTime() -
          new Date(a.created_at ?? a.updated_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return list;
  }, [projects, query, sortKey]);

  const useGrid = projects.length > 4;

  const signOut = async () => {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Code2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">CodeMind</h1>
            <p className="text-xs text-muted-foreground">Your AI workspaces</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setName("");
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a project</DialogTitle>
              </DialogHeader>
              <Input
                autoFocus
                placeholder="my-cool-app"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !nameError) createMut.mutate(trimmed);
                }}
                aria-invalid={!!nameError}
              />
              {nameError && name.length > 0 && (
                <p className="text-xs text-destructive">{nameError}</p>
              )}
              <DialogFooter>
                <Button
                  disabled={!!nameError || createMut.isPending}
                  onClick={() => createMut.mutate(trimmed)}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {projects.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects by name…"
                className="pl-9"
              />
            </div>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Last modified</SelectItem>
                <SelectItem value="name">Name (A → Z)</SelectItem>
                <SelectItem value="created">Date created</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <FolderGit2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-1 font-medium">No projects yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first AI-powered workspace.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects match "{query}".
          </p>
        ) : (
          <div
            className={
              useGrid
                ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                : "flex flex-col gap-3"
            }
          >
            {visible.map((p) => (
              <div
                key={p.id}
                className="group relative rounded-xl border border-border bg-card p-4 transition hover:border-primary/50"
              >
                <Link
                  to="/p/$projectId"
                  params={{ projectId: p.id }}
                  className="block"
                >
                  <div className="mb-3 flex h-20 items-center justify-center rounded-md bg-gradient-to-br from-primary/10 to-primary/5">
                    <FolderGit2 className="h-8 w-8 text-primary/70" />
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="truncate font-medium">{p.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </Link>
                <button
                  aria-label={`Delete project ${p.name}`}
                  onClick={() => setPendingDelete({ id: p.id, name: p.name })}
                  className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the project, all files, chats, and history.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && delMut.mutate(pendingDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
