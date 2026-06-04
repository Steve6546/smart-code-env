import Editor from "@monaco-editor/react";
import { X, Circle, Loader2 } from "lucide-react";
import { useMemo } from "react";
import type { OpenTab } from "./Workspace";

export function EditorTabs({
  tabs,
  activeId,
  onActivate,
  onClose,
  onChange,
}: {
  tabs: OpenTab[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onChange: (id: string, content: string) => void;
}) {
  const active = tabs.find((t) => t.id === activeId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 flex-shrink-0 items-center overflow-x-auto border-b border-border bg-card">
        {tabs.length === 0 && (
          <div className="px-4 text-xs text-muted-foreground">No file open</div>
        )}
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onActivate(t.id)}
            className={`group flex h-full items-center gap-2 border-r border-border px-3 text-xs ${
              t.id === activeId
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-accent/40"
            }`}
          >
            <span className="truncate max-w-[180px]">{t.path.split("/").pop()}</span>
            {t.dirty ? (
              <Circle className="h-2 w-2 fill-current" />
            ) : (
              <X
                className="h-3 w-3 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(t.id);
                }}
              />
            )}
          </button>
        ))}
      </div>
      <div className="relative flex-1 overflow-hidden bg-background">
        {active ? (
          <Editor
            key={active.id}
            height="100%"
            theme="vs-dark"
            path={active.path}
            language={active.language ?? "plaintext"}
            value={active.content}
            onChange={(v) => onChange(active.id, v ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a file from the Explorer to start editing.
          </div>
        )}
      </div>
    </div>
  );
}
