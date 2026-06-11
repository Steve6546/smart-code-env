import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { Code2, ArrowLeft, LogOut, FolderTree, FileCode, MessageSquare } from "lucide-react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
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

type MobileView = "files" | "editor" | "chat";

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
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const openFile = async (id: string) => {
    if (tabs.find((t) => t.id === id)) {
      setActiveId(id);
      setMobileView("editor");
      return;
    }
    const f = await getFileFn({ data: { id } });
    setTabs((prev) => [
      ...prev,
      { id: f.id, path: f.path, language: f.language, content: f.content, dirty: false },
    ]);
    setActiveId(id);
    setMobileView("editor");
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

  const applyAgentWrite = (path: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, content, dirty: false } : t)),
    );
  };

  const refreshOpenByPath = async (path: string) => {
    const tab = tabs.find((t) => t.path === path);
    if (!tab) return;
    try {
      const f = await getFileFn({ data: { id: tab.id } });
      setTabs((prev) =>
        prev.map((t) => (t.id === f.id ? { ...t, content: f.content, path: f.path, dirty: false } : t)),
      );
    } catch {
      /* file may have been deleted */
    }
  };

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

  const filesPanel = (
    <FileTree
      projectId={projectId}
      files={filesQuery.data ?? []}
      onOpen={openFile}
      onChanged={() => qc.invalidateQueries({ queryKey: ["files", projectId] })}
      activeFileId={activeId}
    />
  );
  const editorPanel = (
    <EditorTabs
      tabs={tabs}
      activeId={activeId}
      onActivate={setActiveId}
      onClose={closeTab}
      onChange={onChangeContent}
    />
  );
  const chatPanel = (
    <>
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
        onAgentWrite={applyAgentWrite}
        onAgentTouchPath={refreshOpenByPath}
      />
    </>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border bg-card px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Code2 className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold truncate">CodeMind</span>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      {/* Desktop / tablet: 3 resizable panels */}
      <div className="hidden md:flex flex-1 min-h-0">
        <PanelGroup orientation="horizontal" className="flex flex-1">
          <Panel defaultSize={18} minSize={12} className="flex flex-col border-r border-border bg-card">
            {filesPanel}
          </Panel>
          <PanelResizeHandle className="w-px bg-border hover:bg-primary/40" />
          <Panel defaultSize={52} minSize={30} className="flex flex-col">
            {editorPanel}
          </Panel>
          <PanelResizeHandle className="w-px bg-border hover:bg-primary/40" />
          <Panel defaultSize={30} minSize={20} className="flex flex-col border-l border-border bg-card">
            {chatPanel}
          </Panel>
        </PanelGroup>
      </div>

      {/* Mobile: full-screen panel with swipe + tab switching */}
      <div className="flex md:hidden flex-1 flex-col min-h-0 overflow-hidden">
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={mobileView}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info: PanInfo) => {
                const order: MobileView[] = ["files", "editor", "chat"];
                const idx = order.indexOf(mobileView);
                if (info.offset.x < -60 && idx < order.length - 1) setMobileView(order[idx + 1]);
                else if (info.offset.x > 60 && idx > 0) setMobileView(order[idx - 1]);
              }}
              className="absolute inset-0 flex flex-col bg-card"
            >
              {mobileView === "files" && filesPanel}
              {mobileView === "editor" && editorPanel}
              {mobileView === "chat" && chatPanel}
            </motion.div>
          </AnimatePresence>
        </div>
        <nav className="grid grid-cols-3 border-t border-border bg-card text-xs">
          {([
            { id: "files", label: "Files", Icon: FolderTree },
            { id: "editor", label: "Editor", Icon: FileCode },
            { id: "chat", label: "Chat", Icon: MessageSquare },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setMobileView(id)}
              className={`flex flex-col items-center gap-0.5 py-2 ${
                mobileView === id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
