import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { createThread, deleteThread, listThreads } from "@/lib/workspace.functions";

export function ThreadList({
  projectId,
  activeThreadId,
}: {
  projectId: string;
  activeThreadId: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { projectId } }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads", projectId] });
      navigate({
        to: "/p/$projectId/$threadId",
        params: { projectId, threadId: t.id },
      });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => {
      const res = await qc.fetchQuery({
        queryKey: ["threads", projectId],
        queryFn: () => listFn({ data: { projectId } }),
      });
      qc.invalidateQueries({ queryKey: ["threads", projectId] });
      if (res[0]) {
        navigate({
          to: "/p/$projectId/$threadId",
          params: { projectId, threadId: res[0].id },
        });
      } else {
        createMut.mutate();
      }
    },
  });

  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Chats
        </span>
        <button
          onClick={() => createMut.mutate()}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="New chat"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-32 overflow-auto pb-2">
        {threads.map((t) => {
          const active = t.id === activeThreadId;
          return (
            <div
              key={t.id}
              className={`group mx-2 flex items-center gap-2 rounded px-2 py-1 text-xs ${
                active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              }`}
            >
              <button
                onClick={() =>
                  navigate({
                    to: "/p/$projectId/$threadId",
                    params: { projectId, threadId: t.id },
                  })
                }
                className="flex-1 truncate text-left"
              >
                {t.title}
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete chat?")) delMut.mutate(t.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
