import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// --- Security helpers ---
const MAX_FILE_BYTES = 1_000_000; // 1 MB per file
const PATH_RE = /^[\w.\-/ ]+$/;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

const PG_MSG: Record<string, string> = {
  "23505": "This item already exists.",
  "23503": "Related record not found.",
  "23502": "A required field is missing.",
  "23514": "Value violates a validation rule.",
  "42501": "You don't have permission to perform this action.",
};
function safeDbError(error: { code?: string; message: string }, fallback = "Operation failed"): Error {
  console.error("[workspace] DB error:", error.code, error.message);
  return new Error(PG_MSG[error.code ?? ""] ?? fallback);
}


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
      .select("id, name, updated_at, created_at")
      .order("updated_at", { ascending: false });
    if (error) throw safeDbError(error);
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
    if (error) throw safeDbError(error);

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
    if (error) throw safeDbError(error);
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
    if (error) throw safeDbError(error);
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
    if (error) throw safeDbError(error);
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
    if (error) throw safeDbError(error);
    return f;
  });

export const updateFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), content: z.string().max(MAX_FILE_BYTES) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("files")
      .update({ content: data.content })
      .eq("id", data.id);
    if (error) throw safeDbError(error);

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
    if (error) throw safeDbError(error);
    return { ok: true };
  });

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("files").delete().eq("id", data.id);
    if (error) throw safeDbError(error);
    return { ok: true };
  });

// Recursive delete a path (file OR folder + everything beneath it)
export const deletePath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        path: z.string().min(1).max(500).regex(PATH_RE),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const prefix = data.path.replace(/\/+$/, "");
    // Two parameterised deletes instead of a free-form .or() string
    const del1 = await context.supabase
      .from("files")
      .delete()
      .eq("project_id", data.projectId)
      .eq("path", prefix);
    if (del1.error) throw safeDbError(del1.error);
    const del2 = await context.supabase
      .from("files")
      .delete()
      .eq("project_id", data.projectId)
      .like("path", `${escapeLike(prefix)}/%`);
    if (del2.error) throw safeDbError(del2.error);
    return { ok: true };
  });

// Move / rename a file OR folder (rewrites prefix on all descendants)
export const movePath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        from: z.string().min(1).max(500).regex(PATH_RE),
        to: z.string().min(1).max(500).regex(PATH_RE),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const from = data.from.replace(/\/+$/, "");
    const to = data.to.replace(/\/+$/, "");
    const exact = await context.supabase
      .from("files")
      .select("id, path, is_folder")
      .eq("project_id", data.projectId)
      .eq("path", from);
    if (exact.error) throw safeDbError(exact.error);
    const nested = await context.supabase
      .from("files")
      .select("id, path, is_folder")
      .eq("project_id", data.projectId)
      .like("path", `${escapeLike(from)}/%`);
    if (nested.error) throw safeDbError(nested.error);
    const rows = [...(exact.data ?? []), ...(nested.data ?? [])];
    for (const r of rows) {
      const newPath = r.path === from ? to : to + r.path.slice(from.length);
      await context.supabase
        .from("files")
        .update({ path: newPath, language: r.is_folder ? null : langFromPath(newPath) })
        .eq("id", r.id);
    }
    return { ok: true, moved: rows.length };
  });


export const listThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        includeArchived: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("chat_threads")
      .select("id, title, updated_at, created_at, pinned, auto_titled, archived")
      .eq("project_id", data.projectId);
    if (!data.includeArchived) q = q.eq("archived", false);
    const { data: t, error } = await q
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw safeDbError(error);
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
      .select("id, title, updated_at, created_at, pinned, auto_titled, archived")
      .single();
    if (error) throw safeDbError(error);
    return t;
  });

export const updateThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        pinned: z.boolean().optional(),
        archived: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const patch: {
      title?: string;
      auto_titled?: boolean;
      pinned?: boolean;
      archived?: boolean;
    } = {};
    if (data.title !== undefined) {
      patch.title = data.title;
      patch.auto_titled = true;
    }
    if (data.pinned !== undefined) patch.pinned = data.pinned;
    if (data.archived !== undefined) patch.archived = data.archived;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("chat_threads")
      .update(patch)
      .eq("id", data.id);
    if (error) throw safeDbError(error);
    return { ok: true };
  });


export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("chat_threads").delete().eq("id", data.id);
    if (error) throw safeDbError(error);
    return { ok: true };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("chat_messages").delete().eq("id", data.id);
    if (error) throw safeDbError(error);
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
    if (error) throw safeDbError(error);
    return { ok: true };
  });

export const listMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("project_memory")
      .select("id, kind, key, content, created_at, updated_at")
      .eq("project_id", data.projectId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw safeDbError(error);
    return rows ?? [];
  });

const MEMORY_KEY_RE = /^[a-zA-Z0-9_.\-]+$/;

export const upsertMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        key: z.string().min(1).max(80).regex(MEMORY_KEY_RE),
        content: z.string().min(1).max(20000),
        kind: z.string().min(1).max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: existing } = await context.supabase
      .from("project_memory")
      .select("id")
      .eq("project_id", data.projectId)
      .eq("key", data.key)
      .maybeSingle();
    if (existing) {
      const { error } = await context.supabase
        .from("project_memory")
        .update({ content: data.content, kind: data.kind ?? "kv" })
        .eq("id", existing.id);
      if (error) throw safeDbError(error);
      return { id: existing.id, updated: true };
    }
    const { data: inserted, error } = await context.supabase
      .from("project_memory")
      .insert({
        project_id: data.projectId,
        user_id: context.userId,
        key: data.key,
        kind: data.kind ?? "kv",
        content: data.content,
      })
      .select("id")
      .single();
    if (error) throw safeDbError(error);
    return { id: inserted.id, updated: false };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("project_memory")
      .delete()
      .eq("id", data.id);
    if (error) throw safeDbError(error);
    return { ok: true };
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
    if (error) throw safeDbError(error);
    return m ?? [];
  });

// Rollback every file snapshot recorded for a given assistant message.
// Restores prior content or deletes files that didn't exist before.
export const rollbackMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), messageId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: snaps, error } = await context.supabase
      .from("file_snapshots")
      .select("id, path, prior_content, prior_existed")
      .eq("project_id", data.projectId)
      .eq("message_id", data.messageId)
      .order("created_at", { ascending: false });
    if (error) throw safeDbError(error);
    let restored = 0;
    for (const s of snaps ?? []) {
      if (!s.prior_existed) {
        await context.supabase
          .from("files")
          .delete()
          .eq("project_id", data.projectId)
          .eq("path", s.path);
      } else {
        const { data: existing } = await context.supabase
          .from("files")
          .select("id")
          .eq("project_id", data.projectId)
          .eq("path", s.path)
          .maybeSingle();
        if (existing) {
          await context.supabase
            .from("files")
            .update({ content: s.prior_content ?? "" })
            .eq("id", existing.id);
        } else {
          await context.supabase.from("files").insert({
            project_id: data.projectId,
            user_id: context.userId,
            path: s.path,
            content: s.prior_content ?? "",
            language: langFromPath(s.path),
            is_folder: false,
          });
        }
      }
      restored++;
    }
    await context.supabase
      .from("file_snapshots")
      .delete()
      .eq("project_id", data.projectId)
      .eq("message_id", data.messageId);
    return { ok: true, restored };
  });

export const countSnapshotsForMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ projectId: z.string().uuid(), messageIds: z.array(z.string().min(1)) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    if (data.messageIds.length === 0) return {};
    const { data: rows, error } = await context.supabase
      .from("file_snapshots")
      .select("message_id")
      .eq("project_id", data.projectId)
      .in("message_id", data.messageIds);
    if (error) throw safeDbError(error);
    const counts: Record<string, number> = {};
    for (const r of rows ?? []) {
      const id = r.message_id as string | null;
      if (!id) continue;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  });

