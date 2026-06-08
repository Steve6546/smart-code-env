import Editor from "@monaco-editor/react";
import { X, Circle, Loader2, SplitSquareHorizontal, Eye, Code2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { OpenTab } from "./Workspace";

type ViewMode = "code" | "preview";

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
  const [splitId, setSplitId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("code");

  // Drop split target if it closes
  useEffect(() => {
    if (splitId && !tabs.find((t) => t.id === splitId)) setSplitId(null);
  }, [tabs, splitId]);

  // Ctrl/Cmd + \ — toggle split with the second-most-recent tab
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        if (splitId) {
          setSplitId(null);
          return;
        }
        const other = tabs.find((t) => t.id !== activeId);
        if (other) setSplitId(other.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs, activeId, splitId]);

  const split = splitId ? tabs.find((t) => t.id === splitId) ?? null : null;
  const canPreview =
    !!active &&
    (active.path.endsWith(".html") ||
      active.path.endsWith(".css") ||
      active.path.endsWith(".js"));

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
            className={`group flex h-full items-center gap-2 border-r border-border px-3 text-xs transition-colors ${
              t.id === activeId
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-accent/40"
            }`}
          >
            <span className="truncate max-w-[180px] font-mono">{t.path.split("/").pop()}</span>
            {t.dirty ? (
              <Circle className="h-2 w-2 fill-current text-primary" />
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
        <div className="ml-auto flex items-center gap-1 pr-2">
          {canPreview && (
            <button
              onClick={() => setViewMode((m) => (m === "code" ? "preview" : "code"))}
              title="Toggle preview"
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors ${
                viewMode === "preview"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {viewMode === "preview" ? <Code2 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {viewMode === "preview" ? "Code" : "Preview"}
            </button>
          )}
          {tabs.length >= 2 && (
            <button
              onClick={() => {
                if (splitId) setSplitId(null);
                else {
                  const other = tabs.find((t) => t.id !== activeId);
                  if (other) setSplitId(other.id);
                }
              }}
              title="Split editor (Ctrl+\\)"
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors ${
                splitId
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <SplitSquareHorizontal className="h-3 w-3" />
              Split
            </button>
          )}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-background">
        {!active ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a file from the Explorer to start editing.
          </div>
        ) : viewMode === "preview" && canPreview ? (
          <PreviewPane tabs={tabs} active={active} />
        ) : (
          <div className="flex h-full">
            <div className={split ? "flex-1 min-w-0 border-r border-border" : "flex-1 min-w-0"}>
              <ActiveEditor tab={active} onChange={onChange} />
            </div>
            {split && (
              <div className="flex-1 min-w-0 relative">
                <button
                  onClick={() => setSplitId(null)}
                  title="Close split"
                  className="absolute right-2 top-2 z-20 rounded bg-card/80 p-1 text-muted-foreground backdrop-blur hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
                <ActiveEditor tab={split} onChange={onChange} />
              </div>
            )}
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
  const isHuge = lineCount > 3000;

  return (
    <>
      <div className="absolute right-3 top-2 z-10 flex items-center gap-2 rounded bg-card/80 px-2 py-0.5 text-[10px] font-mono text-muted-foreground backdrop-blur">
        <span>{lineCount.toLocaleString()} lines</span>
        {isHuge ? (
          <span className="text-red-400">huge — perf mode</span>
        ) : isLarge ? (
          <span className="text-amber-400">large file</span>
        ) : null}
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
          minimap: { enabled: !isLarge, side: "right", renderCharacters: false },
          fontSize: 14,
          fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
          fontLigatures: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: isLarge ? "off" : "on",
          smoothScrolling: true,
          mouseWheelScrollSensitivity: 1.5,
          fastScrollSensitivity: 7,
          renderWhitespace: "selection",
          // Large/huge-file perf
          renderValidationDecorations: isLarge ? "off" : "on",
          folding: !isHuge,
          occurrencesHighlight: isLarge ? "off" : "singleFile",
          renderLineHighlight: isLarge ? "none" : "line",
          stickyScroll: { enabled: !isLarge },
          bracketPairColorization: { enabled: !isHuge },
          guides: { indentation: !isHuge },
        }}
      />
    </>
  );
}

function PreviewPane({ tabs, active }: { tabs: OpenTab[]; active: OpenTab }) {
  // Build a sandboxed HTML doc from the open tabs.
  const srcDoc = useMemo(() => {
    const htmlTab = active.path.endsWith(".html")
      ? active
      : tabs.find((t) => t.path.endsWith(".html"));
    const cssTabs = tabs.filter((t) => t.path.endsWith(".css"));
    const jsTabs = tabs.filter((t) => t.path.endsWith(".js"));

    const html =
      htmlTab?.content ??
      `<!doctype html><html><body><h1 style="font-family:Inter;color:#58a6ff;text-align:center;margin-top:2rem">${active.path}</h1></body></html>`;
    const style = cssTabs.map((t) => `<style>\n${t.content}\n</style>`).join("\n");
    const script = jsTabs
      .map((t) => `<script>try{\n${t.content}\n}catch(e){document.body.insertAdjacentText('beforeend','Preview error: '+e.message)}</script>`)
      .join("\n");

    if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${style}</head>`).replace(/<\/body>/i, `${script}</body>`);
    return `<!doctype html><html><head>${style}</head><body>${html}${script}</body></html>`;
  }, [tabs, active]);

  return (
    <iframe
      title="Live preview"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="h-full w-full bg-white"
    />
  );
}
