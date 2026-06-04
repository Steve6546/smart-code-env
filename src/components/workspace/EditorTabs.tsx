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
          <ActiveEditor tab={active} onChange={onChange} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a file from the Explorer to start editing.
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveEditor({
  tab,
  onChange,
}: {
  tab: OpenTab;
  onChange: (id: string, content: string) => void;
}) {
  const lineCount = useMemo(() => tab.content.split("\n").length, [tab.content]);
  const isLarge = lineCount > 1000;

  return (
    <>
      <div className="absolute right-3 top-2 z-10 flex items-center gap-2 rounded bg-card/80 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
        <span>{lineCount.toLocaleString()} lines</span>
        {isLarge && <span className="text-amber-400">large file</span>}
      </div>
      <Editor
        key={tab.id}
        height="100%"
        theme="vs-dark"
        path={tab.path}
        language={tab.language ?? "plaintext"}
        value={tab.content}
        loading={
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading editor…
          </div>
        }
        onChange={(v) => onChange(tab.id, v ?? "")}
        options={{
          minimap: { enabled: !isLarge },
          fontSize: 13,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: isLarge ? "off" : "on",
          smoothScrolling: true,
          mouseWheelScrollSensitivity: 1.5,
          fastScrollSensitivity: 7,
          renderWhitespace: "selection",
          // Large-file perf
          renderValidationDecorations: isLarge ? "off" : "on",
          folding: !isLarge,
          occurrencesHighlight: isLarge ? "off" : "singleFile",
          renderLineHighlight: isLarge ? "none" : "line",
          stickyScroll: { enabled: !isLarge },
        }}
      />
    </>
  );
}
