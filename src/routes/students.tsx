import { createFileRoute, Link } from "@tanstack/react-router";
import { Code2, Sparkles, Shield, Zap, GraduationCap, BookOpen } from "lucide-react";

export const Route = createFileRoute("/students")({
  component: StudentsPage,
  head: () => ({
    meta: [
      { title: "AI code editor for students — CodeMind" },
      {
        name: "description",
        content:
          "CodeMind is a free-to-try AI code editor built for students — learn by building, get an AI pair-programmer, and roll back any change with one click.",
      },
      { property: "og:title", content: "AI code editor for students — CodeMind" },
      {
        property: "og:description",
        content:
          "Learn to code faster with an AI that reads your files, explains changes, and safely patches your project. Every edit is snapshotted.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://smart-code-env.lovable.app/students" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AI code editor for students — CodeMind" },
      {
        name: "twitter:description",
        content:
          "An AI pair-programmer built for learning: reads your code, patches surgically, and lets you undo anything.",
      },
    ],
    links: [{ rel: "canonical", href: "https://smart-code-env.lovable.app/students" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "AI code editor for students",
          description:
            "How students can use CodeMind — an AI pair-programmer that reads, patches, and refactors code — to learn faster and ship real projects.",
          author: { "@type": "Organization", name: "CodeMind" },
        }),
      },
    ],
  }),
});

function StudentsPage() {
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
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5 text-primary" />
          Built for learners
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          The AI code editor for students
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          CodeMind pairs you with an AI that actually reads your project before it types. Ask a
          question, request a feature, or fix a bug — and watch it patch your files surgically,
          one change at a time.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Feature
            icon={<Sparkles className="h-4 w-4 text-primary" />}
            title="Learn by building"
            body="Start from an empty project. Describe what you want, and CodeMind writes, explains, and iterates on the code with you."
          />
          <Feature
            icon={<BookOpen className="h-4 w-4 text-primary" />}
            title="Explains as it edits"
            body="Every change comes with a one-line summary so you learn the why, not just the what."
          />
          <Feature
            icon={<Shield className="h-4 w-4 text-primary" />}
            title="Undo anything"
            body="Every file the agent touches is snapshotted. Roll back an entire turn with one click — nothing is ever lost."
          />
          <Feature
            icon={<Zap className="h-4 w-4 text-primary" />}
            title="Runs in your browser"
            body="No install, no setup. Open your workspace on a laptop, tablet, or phone and keep working."
          />
        </div>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight">Why students love CodeMind</h2>
          <p className="mt-3 text-muted-foreground">
            Traditional AI assistants generate walls of code and hope for the best. CodeMind
            follows a strict <em>read → plan → patch → verify</em> workflow, so the change fits
            your project instead of rewriting it. That means fewer broken builds, more
            understanding, and real progress on assignments and side projects.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">Good for coursework and side projects</h2>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>• Web apps for capstone projects and hackathons</li>
            <li>• Learning a new language or framework by shipping something real</li>
            <li>• Refactoring a messy codebase before submitting it</li>
            <li>• Debugging errors with an assistant that reads the actual file first</li>
          </ul>
        </section>

        <div className="mt-14 rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Ready to start?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with Google and open your first AI-powered workspace.
          </p>
          <Link
            to="/auth"
            className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open CodeMind
          </Link>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
