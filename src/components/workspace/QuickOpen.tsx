import { useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FileNodeIcon } from "./file-icons";

type FileRow = { id: string; path: string; is_folder: boolean };

export function QuickOpen({
  open,
  onOpenChange,
  files,
  onOpen,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  files: FileRow[];
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const items = useMemo(() => {
    const list = files.filter((f) => !f.is_folder);
    if (!query.trim()) return list.slice(0, 50);
    const q = query.toLowerCase();
    return list
      .map((f) => {
        const p = f.path.toLowerCase();
        let score = 0;
        if (p === q) score = 1000;
        else if (p.endsWith("/" + q) || p.split("/").pop() === q) score = 900;
        else if (p.includes(q)) score = 500 - p.indexOf(q);
        else {
          // fuzzy subsequence match
          let i = 0;
          for (const c of p) {
            if (c === q[i]) i++;
            if (i === q.length) break;
          }
          score = i === q.length ? 100 : -1;
        }
        return { f, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((x) => x.f);
  }, [files, query]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search files by name or path…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matching files.</CommandEmpty>
        <CommandGroup heading="Files">
          {items.map((f) => {
            const name = f.path.split("/").pop() ?? f.path;
            const dir = f.path.slice(0, f.path.length - name.length).replace(/\/$/, "");
            return (
              <CommandItem
                key={f.id}
                value={f.path}
                onSelect={() => {
                  onOpen(f.id);
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                <FileNodeIcon name={name} />
                <span className="font-mono text-sm">{name}</span>
                {dir && (
                  <span className="ml-auto truncate text-[11px] text-muted-foreground">
                    {dir}
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
