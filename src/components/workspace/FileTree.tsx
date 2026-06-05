import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronDown,
  File as FileIcon,
  Folder,
  FolderOpen,
  Plus,
  FolderPlus,
  Trash2,
  Pencil,
} from "lucide-react";
import { createFile, deletePath, movePath } from "@/lib/workspace.functions";
import { toast } from "sonner";

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
  const createFn = useServerFn(createFile);
  const deletePathFn = useServerFn(deletePath);
  const movePathFn = useServerFn(movePath);

  const createMut = useMutation({
    mutationFn: (v: { path: string; isFolder?: boolean }) =>
      createFn({ data: { projectId, path: v.path, isFolder: v.isFolder } }),
    onSuccess: () => onChanged(),
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (path: string) => deletePathFn({ data: { projectId, path } }),
    onSuccess: () => onChanged(),
    onError: (e: Error) => toast.error(e.message),
  });
  const renameMut = useMutation({
    mutationFn: (v: { from: string; to: string }) =>
      movePathFn({ data: { projectId, from: v.from, to: v.to } }),
    onSuccess: () => onChanged(),
    onError: (e: Error) => toast.error(e.message),
  });

  const newFile = () => {
    const path = prompt("New file path (e.g. src/utils.ts)");
    if (path?.trim()) createMut.mutate({ path: path.trim() });
  };
  const newFolder = () => {
    const path = prompt("New folder path (e.g. src/components)");
    if (path?.trim()) createMut.mutate({ path: path.trim(), isFolder: true });
  };

  const toggle = (p: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

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
                {isOpen ? (
                  <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                ) : (
                  <Folder className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                )}
                <span className="truncate">{child.name}</span>
              </button>
            ) : (
              <button
                onClick={() => child.file && onOpen(child.file.id)}
                className="flex items-center gap-1 flex-1 min-w-0"
              >
                <span className="w-3" />
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <span className="truncate">{child.name}</span>
              </button>
            )}
            <div className="flex opacity-0 group-hover:opacity-100">
              <button
                className="rounded p-0.5 hover:bg-background"
                onClick={() => {
                  const np = prompt("Rename / move to", child.path);
                  if (np && np !== child.path)
                    renameMut.mutate({ from: child.path, to: np });
                }}
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                className="rounded p-0.5 hover:bg-background hover:text-destructive"
                onClick={() => {
                  const msg = isFolder
                    ? `Delete folder "${child.path}" and EVERYTHING inside it?`
                    : `Delete ${child.path}?`;
                  if (confirm(msg)) delMut.mutate(child.path);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
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
            onClick={newFolder}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="New folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={newFile}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="New file"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto py-1">{renderNode(tree, 0)}</div>
    </div>
  );
}
