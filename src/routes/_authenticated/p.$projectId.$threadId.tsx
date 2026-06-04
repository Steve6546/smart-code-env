import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace/Workspace";

export const Route = createFileRoute("/_authenticated/p/$projectId/$threadId")({
  component: WorkspacePage,
});

function WorkspacePage() {
  const { projectId, threadId } = Route.useParams();
  return <Workspace key={projectId + threadId} projectId={projectId} threadId={threadId} />;
}
