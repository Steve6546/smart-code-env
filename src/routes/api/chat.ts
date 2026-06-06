import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type OpenFile = { path: string; language?: string | null; content: string };
type Body = {
  messages: UIMessage[];
  threadId: string;
  projectId: string;
  openFiles?: OpenFile[];
  allFilePaths?: string[];
};

const langFromPath = (p: string): string => {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  return (
    { py: "python", js: "javascript", ts: "typescript", tsx: "typescript", jsx: "javascript", html: "html", css: "css", json: "json", md: "markdown" }[ext] ?? "plaintext"
  );
};

type SnapshotRow = {
  path: string;
  prior_content: string | null;
  prior_existed: boolean;
  action: string;
};

function makeTools(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  threadId: string,
  snapshots: SnapshotRow[],
) {
  const snap = async (path: string, action: string) => {
    const { data: existing } = await supabase
      .from("files")
      .select("content")
      .eq("project_id", projectId)
      .eq("path", path)
      .eq("is_folder", false)
      .maybeSingle();
    snapshots.push({
      path,
      prior_content: existing?.content ?? null,
      prior_existed: !!existing,
      action,
    });
  };

  return {
    read_file: tool({
      description: "Read the full contents of a file in the current project by path.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        const { data, error } = await supabase
          .from("files")
          .select("path, content, language")
          .eq("project_id", projectId)
          .eq("path", path)
          .eq("is_folder", false)
          .maybeSingle();
        if (error) return { ok: false, error: error.message };
        if (!data) return { ok: false, error: "File not found" };
        return { ok: true, ...data };
      },
    }),
    write_file: tool({
      description:
        "Create a new file or fully overwrite an existing file's contents. Use the full file path including folders.",
      inputSchema: z.object({
        path: z.string().min(1).max(500),
        content: z.string(),
      }),
      execute: async ({ path, content }) => {
        const { data: existing } = await supabase
          .from("files")
          .select("id")
          .eq("project_id", projectId)
          .eq("path", path)
          .maybeSingle();
        if (existing) {
          const { error } = await supabase
            .from("files")
            .update({ content, language: langFromPath(path) })
            .eq("id", existing.id);
          if (error) return { ok: false, error: error.message };
          return { ok: true, action: "updated", path };
        }
        const { error } = await supabase.from("files").insert({
          project_id: projectId,
          user_id: userId,
          path,
          content,
          language: langFromPath(path),
          is_folder: false,
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, action: "created", path };
      },
    }),
    delete_file: tool({
      description: "Delete a single file from the current project by path.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        const { error } = await supabase
          .from("files")
          .delete()
          .eq("project_id", projectId)
          .eq("path", path);
        if (error) return { ok: false, error: error.message };
        return { ok: true, action: "deleted", path };
      },
    }),
    delete_path: tool({
      description:
        "Recursively delete a file OR folder and EVERYTHING inside it. Use for folders or bulk cleanup.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        const prefix = path.replace(/\/+$/, "");
        const { error } = await supabase
          .from("files")
          .delete()
          .eq("project_id", projectId)
          .or(`path.eq.${prefix},path.like.${prefix}/%`);
        if (error) return { ok: false, error: error.message };
        return { ok: true, action: "deleted", path };
      },
    }),
    create_folder: tool({
      description: "Create an empty folder at the given path.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        const clean = path.replace(/\/+$/, "");
        const { error } = await supabase.from("files").insert({
          project_id: projectId,
          user_id: userId,
          path: clean,
          content: "",
          language: null,
          is_folder: true,
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, action: "created", path: clean };
      },
    }),
    rename_file: tool({
      description: "Rename or move a single file to a new path.",
      inputSchema: z.object({ from: z.string(), to: z.string() }),
      execute: async ({ from, to }) => {
        const { error } = await supabase
          .from("files")
          .update({ path: to, language: langFromPath(to) })
          .eq("project_id", projectId)
          .eq("path", from);
        if (error) return { ok: false, error: error.message };
        return { ok: true, action: "renamed", from, to };
      },
    }),
    move_path: tool({
      description:
        "Move or rename a file OR an entire folder (with all descendants). Rewrites the path prefix on every nested file.",
      inputSchema: z.object({ from: z.string(), to: z.string() }),
      execute: async ({ from, to }) => {
        const f = from.replace(/\/+$/, "");
        const t = to.replace(/\/+$/, "");
        const { data: rows, error: ferr } = await supabase
          .from("files")
          .select("id, path, is_folder")
          .eq("project_id", projectId)
          .or(`path.eq.${f},path.like.${f}/%`);
        if (ferr) return { ok: false, error: ferr.message };
        for (const r of rows ?? []) {
          const np = r.path === f ? t : t + r.path.slice(f.length);
          await supabase
            .from("files")
            .update({ path: np, language: r.is_folder ? null : langFromPath(np) })
            .eq("id", r.id);
        }
        return { ok: true, action: "renamed", from: f, to: t, moved: rows?.length ?? 0 };
      },
    }),
    edit_file: tool({
      description:
        "Apply a precise string replacement to an existing file. Use this for SMALL/TARGETED edits instead of rewriting the whole file. `find` must occur exactly once in the file — include enough surrounding context to be unique. For larger rewrites, use write_file instead.",
      inputSchema: z.object({
        path: z.string(),
        find: z.string().min(1),
        replace: z.string(),
      }),
      execute: async ({ path, find, replace }) => {
        const { data: file, error: ferr } = await supabase
          .from("files")
          .select("id, content")
          .eq("project_id", projectId)
          .eq("path", path)
          .eq("is_folder", false)
          .maybeSingle();
        if (ferr) return { ok: false, error: ferr.message };
        if (!file) return { ok: false, error: "File not found" };
        const idx = file.content.indexOf(find);
        if (idx === -1) return { ok: false, error: "`find` string not found in file" };
        if (file.content.indexOf(find, idx + find.length) !== -1)
          return { ok: false, error: "`find` matches multiple times — add more surrounding context" };
        const next = file.content.slice(0, idx) + replace + file.content.slice(idx + find.length);
        const { error: uerr } = await supabase
          .from("files")
          .update({ content: next })
          .eq("id", file.id);
        if (uerr) return { ok: false, error: uerr.message };
        return { ok: true, action: "updated", path };
      },
    }),
    list_files: tool({
      description: "List all files and folders in the current project.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await supabase
          .from("files")
          .select("path, is_folder")
          .eq("project_id", projectId)
          .order("path");
        if (error) return { ok: false, error: error.message };
        return { ok: true, files: data };
      },
    }),
    grep: tool({
      description: "Search for a string pattern in all files in the project.",
      inputSchema: z.object({ pattern: z.string() }),
      execute: async ({ pattern }) => {
        const { data, error } = await supabase
          .from("files")
          .select("path, content")
          .eq("project_id", projectId)
          .eq("is_folder", false)
          .ilike("content", `%${pattern}%`);
        if (error) return { ok: false, error: error.message };
        if (!data || data.length === 0) return { ok: true, results: [] };
        const results = data.map((file) => {
          const lines = file.content.split("\n");
          const matches = lines
            .map((line: string, index: number) => ({ line, lineNumber: index + 1 }))
            .filter(({ line }: { line: string }) => line.toLowerCase().includes(pattern.toLowerCase()));
          return { path: file.path, matches };
        });
        return { ok: true, results };
      },
    }),
  };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient(SUPABASE_URL, KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: uerr } = await supabase.auth.getUser(token);
        if (uerr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const body = (await request.json()) as Body;
        const { messages, threadId, projectId, openFiles = [], allFilePaths = [] } = body;

        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("id", threadId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

        const last = messages[messages.length - 1];
        if (last && last.role === "user") {
          await supabase.from("chat_messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            parts: last.parts as never,
          });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3.5-flash");

        const fileContext = openFiles.length
          ? openFiles
              .map(
                (f) =>
                  `--- FILE: ${f.path} (${f.language ?? "text"}) ---\n${f.content}\n--- END ${f.path} ---`,
              )
              .join("\n\n")
          : "(no files currently open)";

        // Load durable project memory (past agent actions / goals)
        const { data: memoryRows } = await supabase
          .from("project_memory")
          .select("kind, content, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(25);
        const memoryBlock = memoryRows && memoryRows.length
          ? memoryRows
              .slice()
              .reverse()
              .map((r) => `- [${r.kind}] ${r.content}`)
              .join("\n")
          : "(no prior memory yet)";

        const system = `You are CodeMind, an autonomous AI coding agent embedded in a code editor.
You have direct access to the user's project files via tools — DO NOT just print code and ask the user to copy it. ACT on the project.

# Operating loop (MANDATORY)
1. THINK FIRST. Briefly state your plan in 1-3 short sentences BEFORE any tool call.
2. READ before you write. If you are about to edit a file you haven't seen in this turn, call read_file first.
3. PATCH, don't rewrite. For files >100 lines, use edit_file (surgical find/replace). NEVER delete a file just to recreate it with edits — that destroys history.
4. SELF-REVIEW. After your edits, re-read the changed region (read_file) and confirm it looks correct. If it's wrong, fix it.
5. SUMMARIZE. End with a short bullet list of what changed (file paths + 1 line each).

# Tools (skills) — call these EXACT names
- list_files: list everything in the project
- read_file: read a file's full contents
- write_file: create OR fully replace a file (use only for new files or full rewrites)
- edit_file: SURGICAL find/replace inside an existing file — STRONGLY PREFERRED for any change in a file that already has content (think of it as patch_file)
- create_folder: create an empty folder
- delete_file: delete one file (never as a step toward editing)
- delete_path: RECURSIVELY delete a file OR folder + everything inside it
- rename_file: rename or move a single file
- move_path: move/rename a file OR an entire folder (with descendants)
- grep: search for a pattern across all files

# Project memory (durable, across chat sessions)
${memoryBlock}

# Project file tree
${allFilePaths.length ? allFilePaths.map((p) => `  - ${p}`).join("\n") : "  (empty)"}

# Currently OPEN files (full source)
${fileContext}

# Output rules
- Keep prose short. Show your plan, then act, then summarize.
- Only show code blocks when the user explicitly asks to SEE code instead of applying it. Prefix such blocks with the file path as a comment on line 1.
- If the user gives an instruction that is destructive, confirm it inline before running delete_path on a folder with many files.`;

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages),
          tools: makeTools(supabase, userId, projectId),
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            try {
              await supabase.from("chat_messages").insert({
                thread_id: threadId,
                user_id: userId,
                role: "assistant",
                parts: responseMessage.parts as never,
              });
              await supabase
                .from("chat_threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", threadId);

              // Snapshot what the agent did into project memory so future
              // sessions can resume context.
              const touched: string[] = [];
              for (const p of responseMessage.parts as Array<{
                type: string;
                toolName?: string;
                input?: { path?: string; from?: string; to?: string };
                output?: { ok?: boolean; action?: string };
              }>) {
                if (!p.type.startsWith("tool-")) continue;
                if (!p.output?.ok) continue;
                const tool = p.toolName ?? p.type.replace(/^tool-/, "");
                const path = p.input?.path ?? (p.input?.to ? `${p.input.from} → ${p.input.to}` : "");
                if (path) touched.push(`${tool}: ${path}`);
              }
              if (touched.length) {
                await supabase.from("project_memory").insert({
                  project_id: projectId,
                  user_id: userId,
                  thread_id: threadId,
                  kind: "actions",
                  content: touched.slice(0, 20).join("; "),
                });
              }
            } catch (e) {
              console.error("persist assistant failed", e);
            }
          },
        });
      },
    },
  },
});
