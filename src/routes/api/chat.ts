import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type OpenFile = { path: string; language?: string | null; content: string };
type Body = {
  messages: UIMessage[];
  threadId: string;
  projectId: string;
  openFiles?: OpenFile[];
  allFilePaths?: string[];
};

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

        // Verify thread ownership
        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("id", threadId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

        // Persist new user message (last one)
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

        const system = `You are CodeMind, an expert AI pair programmer embedded in a code editor.
You help the user write, refactor, debug, and explain code.

Current project files (full tree):
${allFilePaths.length ? allFilePaths.map((p) => `  - ${p}`).join("\n") : "  (empty project)"}

Currently OPEN files (full source the user is viewing):
${fileContext}

Guidelines:
- When the user asks to add, modify, refactor, or split code, respond with COMPLETE updated file contents inside fenced code blocks.
- Start each code block with the file path on the first line as a comment, e.g. \`\`\`ts\n// src/utils/auth.ts\n...\n\`\`\`
- Prefer full files over diffs so the user can copy-paste directly.
- Be concise in prose; let the code do the talking.
- Use markdown for explanations.`;

        const result = streamText({
          model,
          system,
          messages: convertToModelMessages(messages),
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
