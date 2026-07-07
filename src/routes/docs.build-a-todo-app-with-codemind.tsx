import { createFileRoute, Link } from "@tanstack/react-router";
import { Code2, CheckCircle2, ArrowRight } from "lucide-react";

const CANONICAL = "https://smart-code-env.lovable.app/docs/build-a-todo-app-with-codemind";

export const Route = createFileRoute("/docs/build-a-todo-app-with-codemind")({
  component: TutorialPage,
  head: () => ({
    meta: [
      { title: "Build a full-stack todo app with CodeMind — tutorial" },
      {
        name: "description",
        content:
          "Step-by-step tutorial: build a full-stack React + database todo app using CodeMind's patch-based AI workflow. Learn read → plan → patch → verify.",
      },
      { property: "og:title", content: "Build a full-stack todo app with CodeMind" },
      {
        property: "og:description",
        content:
          "A hands-on guide to building your first full-stack app with an AI code editor that reads before it edits.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Build a full-stack todo app with CodeMind" },
      {
        name: "twitter:description",
        content:
          "Step-by-step tutorial for the CodeMind AI code editor: build, patch, and ship a real app.",
      },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "Build a full-stack todo app with CodeMind",
          description:
            "How to build a full-stack todo app using CodeMind's patch-based AI code editor workflow.",
          totalTime: "PT30M",
          step: [
            { "@type": "HowToStep", position: 1, name: "Create a new project" },
            { "@type": "HowToStep", position: 2, name: "Describe the app to the AI" },
            { "@type": "HowToStep", position: 3, name: "Add the database schema" },
            { "@type": "HowToStep", position: 4, name: "Build the UI with patches" },
            { "@type": "HowToStep", position: 5, name: "Test, roll back, and ship" },
          ],
        }),
      },
    ],
  }),
});

const steps: { title: string; body: string; prompt?: string }[] = [
  {
    title: "1. Create a new project",
    body: "Open CodeMind and click New project. Pick the blank React starter — CodeMind will scaffold the workspace, editor, and chat panel in seconds. Everything runs in your browser, no local install needed.",
  },
  {
    title: "2. Describe what you want to build",
    body: "In the chat panel, describe the app in plain English. Be specific about the user flow — the AI will use this to plan its edits.",
    prompt:
      "Build a todo app with a title input, a list of todos, and a checkbox to mark each one done. Persist everything to the database.",
  },
  {
    title: "3. Let the agent add the database schema",
    body: "CodeMind will propose a migration that creates a todos table with proper row-level security. Review the plan in the Thinking box, then approve. The agent runs the migration and wires up the client.",
  },
  {
    title: "4. Build the UI with surgical patches",
    body: "Ask for the todo list component. CodeMind reads your existing files first, then patches only the lines that need to change. Every edit shows a one-line summary so you learn what changed and why.",
    prompt: "Add a TodoList component to the home route with add, toggle, and delete actions.",
  },
  {
    title: "5. Preview, roll back, ship",
    body: "Every file the agent touches is snapshotted. If a change breaks something, click Undo on the assistant's message to roll the whole turn back. When you are happy, hit Publish to deploy.",
  },
];

function TutorialPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/auth" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Code2 className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">CodeMind</span>
          </Link>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open CodeMind
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Tutorial</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          Build a full-stack todo app with CodeMind
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          A 30-minute walkthrough of the CodeMind AI code editor. You'll ship a real full-stack
          React app with database persistence — using an agent that reads your files before it
          edits them.
        </p>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">What you'll learn</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {[
              "How the read → plan → patch → verify workflow works",
              "Writing prompts that produce surgical edits, not rewrites",
              "Adding a database schema and hooking it into the UI",
              "Rolling back any agent turn with one click",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <ol className="mt-10 space-y-8">
          {steps.map((s) => (
            <li key={s.title} className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-xl font-semibold tracking-tight">{s.title}</h2>
              <p className="mt-3 text-muted-foreground">{s.body}</p>
              {s.prompt ? (
                <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-muted/40 p-4 text-sm">
                  <code>{s.prompt}</code>
                </pre>
              ) : null}
            </li>
          ))}
        </ol>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight">Tips for great prompts</h2>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>• Describe the user flow, not the implementation. Let the agent choose the stack.</li>
            <li>• Ask for one feature per turn — smaller patches are easier to review and undo.</li>
            <li>• Say "read the file first" when you want a surgical edit, not a rewrite.</li>
            <li>• Use the Undo button liberally — it's cheaper than debugging a bad turn.</li>
          </ul>
        </section>

        <div className="mt-14 flex items-center justify-between rounded-2xl border border-border bg-card p-8">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Ready to build?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open CodeMind and start your first project.
            </p>
          </div>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
