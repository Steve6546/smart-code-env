import { createFileRoute, redirect } from "@tanstack/react-router";
import { listThreads, createThread } from "@/lib/workspace.functions";

export const Route = createFileRoute("/_authenticated/p/$projectId/")({
  loader: async ({ params }) => {
    const threads = await listThreads({ data: { projectId: params.projectId } });
    let tid = threads[0]?.id;
    if (!tid) {
      const t = await createThread({ data: { projectId: params.projectId } });
      tid = t.id;
    }
    throw redirect({
      to: "/p/$projectId/$threadId",
      params: { projectId: params.projectId, threadId: tid },
    });
  },
});
