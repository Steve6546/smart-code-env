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

function makeTools(supabase: SupabaseClient, userId: string, projectId: string) {
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
      description: "Delete a file from the current project by path.",
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
    rename_file: tool({
      description: "Rename or move a file to a new path.",
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

        const system = `You are CodeMind, an autonomous AI coding agent embedded in a code editor.
You have direct access to the user's project files via tools — DO NOT just print code and ask the user to copy it. ACT on the project.

Available tools:
- list_files: list everything in the project
- read_file: read a file you don't have open yet
- write_file: create a new file OR fully replace an existing one
- delete_file: remove a file
- rename_file: rename/move a file

Project file tree:
${allFilePaths.length ? allFilePaths.map((p) => `  - ${p}`).join("\n") : "  (empty)"}

Currently OPEN files (full source):
${fileContext}

Operating rules:
- When the user asks for a change, USE THE TOOLS to apply it directly. Do not output a "here's the code, paste it" answer for changes you can perform yourself.
- Before editing a file you have not seen, call read_file first.
- write_file replaces the WHOLE file — always include the complete final contents.
- After tool calls, give a brief summary of what changed (file paths + 1-line per change). Keep prose short. The user can see the diff in their editor.
- Only show code blocks when explaining or when the user explicitly asks to see code without applying it. Prefix code blocks with the file path as a comment on line 1.`;

        const result = streamText({
          model,
          system,
          messages: convertToModelMessages(messages),
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
            } catch (e) {
              console.error("persist assistant failed", e);
            }
          },
        });
      },
    },
  },
});
