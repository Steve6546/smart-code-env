import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  FolderPlus,
  MoreVertical,
} from "lucide-react";
import { FileNodeIcon, FolderNodeIcon } from "./file-icons";
import { createFile, deletePath, movePath } from "@/lib/workspace.functions";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type FileRow = {
  id: string;
  path: string;
  language: string | null;
  is_folder: boolean;
};

type Node = {
  name: string;
  path: string;
  file?: FileRow;
  children: Map<string, Node>;
};

function buildTree(files: FileRow[]): Node {
  const root: Node = { name: "", path: "", children: new Map() };
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let cur = root;
    parts.forEach((part, i) => {
      const isLast = i === parts.length - 1;
      const childPath = parts.slice(0, i + 1).join("/");
      let next = cur.children.get(part);
      if (!next) {
        next = { name: part, path: childPath, children: new Map() };
        cur.children.set(part, next);
      }
      if (isLast) next.file = f;
      cur = next;
    });
  }
  return root;
}

function countDescendants(node: Node): number {
  let n = node.file ? 1 : 0;
  for (const c of node.children.values()) n += countDescendants(c);
  return n;
}

export function FileTree({
  projectId,
  files,
  onOpen,
  onChanged,
  activeFileId,
}: {
  projectId: string;
  files: FileRow[];
  onOpen: (id: string) => void;
  onChanged: () => void;
  activeFileId: string | null;
}) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["src"]));
  const [pendingDelete, setPendingDelete] = useState<{ path: string; isFolder: boolean; count: number } | null>(null);
  const [createDialog, setCreateDialog] = useState<{ parent: string; kind: "file" | "folder" } | null>(null);

  const createFn = useServerFn(createFile);
  const deletePathFn = useServerFn(deletePath);
  const movePathFn = useServerFn(movePath);

  // Auto-expand ancestors of active file
  useEffect(() => {
    if (!activeFileId) return;
    const active = files.find((f) => f.id === activeFileId);
    if (!active) return;
    const parts = active.path.split("/").filter(Boolean);
    setExpanded((prev) => {
      const next = new Set(prev);
      for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join("/"));
      return next;
    });
  }, [activeFileId, files]);

  const createMut = useMutation({
    mutationFn: (v: { path: string; isFolder?: boolean }) =>
      createFn({ data: { projectId, path: v.path, isFolder: v.isFolder } }),
    onSuccess: () => onChanged(),
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (path: string) => deletePathFn({ data: { projectId, path } }),
    onSuccess: () => {
      setPendingDelete(null);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const renameMut = useMutation({
    mutationFn: (v: { from: string; to: string }) =>
      movePathFn({ data: { projectId, from: v.from, to: v.to } }),
    onSuccess: () => onChanged(),
    onError: (e: Error) => toast.error(e.message),
  });

  const newFileAt = (parent: string) => setCreateDialog({ parent, kind: "file" });
  const newFolderAt = (parent: string) => setCreateDialog({ parent, kind: "folder" });

  const toggle = (p: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const renderNode = (node: Node, depth: number): React.ReactNode => {
    const entries = Array.from(node.children.values()).sort((a, b) => {
      const aFolder = !a.file || a.file.is_folder || a.children.size > 0;
      const bFolder = !b.file || b.file.is_folder || b.children.size > 0;
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return entries.map((child) => {
      const isFolder = child.children.size > 0 || child.file?.is_folder;
      const isOpen = expanded.has(child.path);
      const isActive = child.file?.id === activeFileId;
      const descendantCount = isFolder ? countDescendants(child) : 1;

      return (
        <div key={child.path}>
          <div
            className={`group flex items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-accent ${
              isActive ? "bg-accent text-accent-foreground" : ""
            }`}
            style={{ paddingLeft: 6 + depth * 12 }}
          >
            {isFolder ? (
              <button onClick={() => toggle(child.path)} className="flex items-center gap-1 flex-1 min-w-0">
                {isOpen ? (
                  <ChevronDown className="h-3 w-3 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 flex-shrink-0" />
                )}
                <FolderNodeIcon open={isOpen} />
                <span className="truncate">{child.name}</span>
              </button>
            ) : (
              <button
                onClick={() => child.file && onOpen(child.file.id)}
                className="flex items-center gap-1 flex-1 min-w-0"
              >
                <span className="w-3" />
                <FileNodeIcon name={child.name} />
                <span className="truncate">{child.name}</span>
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-background"
                  onClick={(e) => e.stopPropagation()}
                  title="More"
                >
                  <MoreVertical className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {isFolder && (
                  <>
                    <DropdownMenuItem onClick={() => newFileAt(child.path)}>🆕 New File</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => newFolderAt(child.path)}>📁 New Folder</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    const np = prompt("Rename to", child.path);
                    if (np && np !== child.path) renameMut.mutate({ from: child.path, to: np });
                  }}
                >
                  ✏️ Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const np = prompt("Move to (new path)", child.path);
                    if (np && np !== child.path) renameMut.mutate({ from: child.path, to: np });
                  }}
                >
                  📦 Move
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() =>
                    setPendingDelete({ path: child.path, isFolder: !!isFolder, count: descendantCount })
                  }
                >
                  🗑️ Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {isFolder && isOpen && renderNode(child, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => newFolderAt("")}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="New folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => newFileAt("")}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="New file"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto py-1">{renderNode(tree, 0)}</div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDelete?.isFolder ? "folder" : "file"} "{pendingDelete?.path}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.isFolder
                ? `This will permanently delete ${pendingDelete.count} item${pendingDelete.count === 1 ? "" : "s"} inside this folder. This cannot be undone from the file tree.`
                : "This file will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && delMut.mutate(pendingDelete.path)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NewItemDialog
        open={!!createDialog}
        parent={createDialog?.parent ?? ""}
        kind={createDialog?.kind ?? "file"}
        existing={new Set(files.map((f) => f.path))}
        onClose={() => setCreateDialog(null)}
        onCreate={(path, isFolder) => {
          createMut.mutate({ path, isFolder });
          setCreateDialog(null);
        }}
      />
    </div>
  );
}

function NewItemDialog({
  open,
  parent,
  kind,
  existing,
  onClose,
  onCreate,
}: {
  open: boolean;
  parent: string;
  kind: "file" | "folder";
  existing: Set<string>;
  onClose: () => void;
  onCreate: (path: string, isFolder: boolean) => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName(kind === "file" ? "newfile.ts" : "new-folder");
  }, [open, kind]);

  const fullPath = parent ? `${parent}/${name}` : name;
  const trimmed = name.trim();
  const invalidChars = /[\\:*?"<>|]/.test(trimmed) || trimmed.includes("//");
  const collides = existing.has(fullPath);
  const error = !trimmed
    ? "Name is required"
    : invalidChars
      ? "Invalid characters in name"
      : collides
        ? "A file or folder with this path already exists"
        : null;

  const submit = () => {
    if (error) return;
    onCreate(fullPath, kind === "folder");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New {kind === "file" ? "file" : "folder"}</DialogTitle>
          <DialogDescription>
            {parent ? (
              <>
                Inside <span className="font-mono text-foreground">{parent}/</span>
              </>
            ) : (
              "At project root"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
          {kind === "file" ? (
            <FileNodeIcon name={trimmed || "file"} className="h-5 w-5" />
          ) : (
            <FolderNodeIcon className="h-5 w-5" />
          )}
          <span className="truncate font-mono text-sm">{fullPath || "—"}</span>
        </div>

        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={kind === "file" ? "e.g. components/Button.tsx" : "e.g. utils"}
          className="font-mono"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!!error}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
