import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Code2, Plus, Trash2, FolderGit2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createProject,
  deleteProject,
  listProjects,
} from "@/lib/workspace.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

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
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
          <Dialog open={open} onOpenChange={setOpen}>
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
                  if (e.key === "Enter" && name.trim()) createMut.mutate(name.trim());
                }}
              />
              <DialogFooter>
                <Button
                  disabled={!name.trim() || createMut.isPending}
                  onClick={() => createMut.mutate(name.trim())}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

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
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group relative rounded-xl border border-border bg-card p-4 transition hover:border-primary/50"
              >
                <Link
                  to="/p/$projectId"
                  params={{ projectId: p.id }}
                  className="block"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <FolderGit2 className="h-4 w-4 text-primary" />
                    <span className="truncate font-medium">{p.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </Link>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${p.name}"?`)) delMut.mutate(p.id);
                  }}
                  className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
