import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STARTER_FILES: { path: string; content: string; language: string }[] = [
  {
    path: "README.md",
    language: "markdown",
    content:
      "# New Project\n\nWelcome to CodeMind. Use the chat on the right to build, refactor, or explain code.\n",
  },
  {
    path: "src/main.py",
    language: "python",
    content: 'def main():\n    print("Hello from CodeMind!")\n\n\nif __name__ == "__main__":\n    main()\n',
  },
];

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: proj, error } = await context.supabase
      .from("projects")
      .insert({ name: data.name, user_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // seed starter files
    await context.supabase.from("files").insert(
      STARTER_FILES.map((f) => ({
        project_id: proj.id,
        user_id: context.userId,
        path: f.path,
        content: f.content,
        language: f.language,
      })),
    );
    // seed a default chat thread
    await context.supabase
      .from("chat_threads")
      .insert({ project_id: proj.id, user_id: context.userId, title: "New chat" });
    return proj;
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: files, error } = await context.supabase
      .from("files")
      .select("id, path, language, is_folder, updated_at")
      .eq("project_id", data.projectId)
      .order("path");
    if (error) throw new Error(error.message);
    return files ?? [];
  });

export const getFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: f, error } = await context.supabase
      .from("files")
      .select("id, path, language, content")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return f;
  });

const langFromPath = (p: string): string => {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  return (
    { py: "python", js: "javascript", ts: "typescript", tsx: "typescript", jsx: "javascript", html: "html", css: "css", json: "json", md: "markdown" }[ext] ?? "plaintext"
  );
};

export const createFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        path: z.string().min(1).max(500),
        isFolder: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: f, error } = await context.supabase
      .from("files")
      .insert({
        project_id: data.projectId,
        user_id: context.userId,
        path: data.path,
        content: "",
        language: data.isFolder ? null : langFromPath(data.path),
        is_folder: data.isFolder ?? false,
      })
      .select("id, path, language, is_folder")
      .single();
    if (error) throw new Error(error.message);
    return f;
  });

export const updateFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), content: z.string() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("files")
      .update({ content: data.content })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), path: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("files")
      .update({ path: data.path, language: langFromPath(data.path) })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("files").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Recursive delete a path (file OR folder + everything beneath it)
export const deletePath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), path: z.string().min(1) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const prefix = data.path.replace(/\/+$/, "");
    const { error } = await context.supabase
      .from("files")
      .delete()
      .eq("project_id", data.projectId)
      .or(`path.eq.${prefix},path.like.${prefix}/%`);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Move / rename a file OR folder (rewrites prefix on all descendants)
export const movePath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        from: z.string().min(1),
        to: z.string().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const from = data.from.replace(/\/+$/, "");
    const to = data.to.replace(/\/+$/, "");
    const { data: rows, error: ferr } = await context.supabase
      .from("files")
      .select("id, path, is_folder")
      .eq("project_id", data.projectId)
      .or(`path.eq.${from},path.like.${from}/%`);
    if (ferr) throw new Error(ferr.message);
    for (const r of rows ?? []) {
      const newPath = r.path === from ? to : to + r.path.slice(from.length);
      await context.supabase
        .from("files")
        .update({ path: newPath, language: r.is_folder ? null : langFromPath(newPath) })
        .eq("id", r.id);
    }
    return { ok: true, moved: rows?.length ?? 0 };
  });

export const listThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: t, error } = await context.supabase
      .from("chat_threads")
      .select("id, title, updated_at")
      .eq("project_id", data.projectId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return t ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), title: z.string().min(1).max(200).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: t, error } = await context.supabase
      .from("chat_threads")
      .insert({
        project_id: data.projectId,
        user_id: context.userId,
        title: data.title ?? "New chat",
      })
      .select("id, title, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return t;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("chat_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("chat_messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), text: z.string().min(1).max(20000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("chat_messages")
      .update({ parts: [{ type: "text", text: data.text }] as never })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("project_memory")
      .select("id, kind, content, created_at")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: m, error } = await context.supabase
      .from("chat_messages")
      .select("id, role, parts, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return m ?? [];
  });
