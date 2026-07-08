import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace/Workspace";

export const Route = createFileRoute("/_authenticated/p/$projectId/$threadId")({
  component: WorkspacePage,
  head: () => ({
    meta: [
      { title: "Workspace — CodeMind" },
      {
        name: "description",
        content:
          "CodeMind workspace: edit files, chat with the AI agent, and preview your project in real time.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Workspace — CodeMind" },
      {
        property: "og:description",
        content: "Edit files, chat with the AI agent, and preview your project in real time.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
});

function WorkspacePage() {
  const { projectId, threadId } = Route.useParams();
  return <Workspace key={projectId + threadId} projectId={projectId} threadId={threadId} />;
}
