import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { Code2, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileTree } from "./FileTree";
import { EditorTabs } from "./EditorTabs";
import { ChatPanel } from "./ChatPanel";
import { ThreadList } from "./ThreadList";
import {
  getFile,
  listFiles,
  updateFile,
} from "@/lib/workspace.functions";

export type OpenTab = {
  id: string;
  path: string;
  language: string | null;
  content: string;
  dirty: boolean;
};

export function Workspace({ projectId, threadId }: { projectId: string; threadId: string }) {
  const router = useRouter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFilesFn = useServerFn(listFiles);
  const getFileFn = useServerFn(getFile);
  const updateFileFn = useServerFn(updateFile);

  const filesQuery = useQuery({
    queryKey: ["files", projectId],
    queryFn: () => listFilesFn({ data: { projectId } }),
  });

  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const openFile = async (id: string) => {
    if (tabs.find((t) => t.id === id)) {
      setActiveId(id);
      return;
    }
    const f = await getFileFn({ data: { id } });
    setTabs((prev) => [
      ...prev,
      { id: f.id, path: f.path, language: f.language, content: f.content, dirty: false },
    ]);
    setActiveId(id);
  };

  const closeTab = (id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeId === id) setActiveId(next[next.length - 1]?.id ?? null);
      return next;
    });
  };

  const saveMut = useMutation({
    mutationFn: (v: { id: string; content: string }) =>
      updateFileFn({ data: v }),
  });

  const onChangeContent = (id: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, content, dirty: true } : t)),
    );
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => {
      saveMut.mutate(
        { id, content },
        {
          onSuccess: () =>
            setTabs((prev) =>
              prev.map((t) => (t.id === id ? { ...t, dirty: false } : t)),
            ),
        },
      );
    }, 600);
  };

  // After file create/delete/rename, refresh open tabs that may have changed.
  useEffect(() => {
    if (!filesQuery.data) return;
    const ids = new Set(filesQuery.data.map((f) => f.id));
    setTabs((prev) => prev.filter((t) => ids.has(t.id)));
  }, [filesQuery.data]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth" });
  };

  const activeTab = tabs.find((t) => t.id === activeId) ?? null;
  const allPaths = (filesQuery.data ?? []).filter((f) => !f.is_folder).map((f) => f.path);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Code2 className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">CodeMind</span>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <PanelGroup orientation="horizontal" className="flex flex-1">
        <Panel defaultSize={18} minSize={12} className="flex flex-col border-r border-border bg-card">
          <FileTree
            projectId={projectId}
            files={filesQuery.data ?? []}
            onOpen={openFile}
            onChanged={() => qc.invalidateQueries({ queryKey: ["files", projectId] })}
            activeFileId={activeId}
          />
        </Panel>
        <PanelResizeHandle className="w-px bg-border hover:bg-primary/40" />
        <Panel defaultSize={54} minSize={30} className="flex flex-col">
          <EditorTabs
            tabs={tabs}
            activeId={activeId}
            onActivate={setActiveId}
            onClose={closeTab}
            onChange={onChangeContent}
          />
        </Panel>
        <PanelResizeHandle className="w-px bg-border hover:bg-primary/40" />
        <Panel defaultSize={28} minSize={20} className="flex flex-col border-l border-border bg-card">
          <ThreadList projectId={projectId} activeThreadId={threadId} />
          <ChatPanel
            projectId={projectId}
            threadId={threadId}
            openFiles={tabs.map((t) => ({
              path: t.path,
              language: t.language,
              content: t.content,
            }))}
            allFilePaths={allPaths}
            activeFilePath={activeTab?.path}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}
