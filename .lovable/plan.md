# CodeMind Major Upgrade — Phased Plan

The request spans 10 sections and dozens of features. Shipping it all in one turn would be unstable and would risk breaking the working agent/editor/chat we already have. I'll deliver it in **4 focused phases** and ask you which to start with (or do them in order).

I will follow your hard rules throughout:
- Read every file before editing
- Patch, never overwrite or delete-to-edit
- Agent replies in the user's language (Arabic ↔ English)
- No auto-delete; destructive actions require confirmation
- Keep last 10 snapshots per session for undo

---

## Phase 1 — Agent Intelligence + Thinking Box + Safety
*(Sections 1, 2, 10 — highest leverage, touches `chat.ts` + `ChatPanel.tsx`)*

- Rename/expand agent tools: `read_file`, `patch_file` (alias of edit_file), `write_file`, `create_file`, `move_file`, `search_project` (grep+symbol), `list_files`, `preview_diff`, `self_review`.
- `delete_file` → marked `needsApproval: true`, blocked until user confirms in UI.
- System prompt enforces: **Read → Plan → Patch → Self-Review → Snapshot**, mirror user language, concise replies, no rewrites for existing files.
- **Thinking Box**: live collapsible card per turn with animated step rows (Framer Motion) — 🧠 thinking, 📖 reading, 🔍 searching, ✏️ patching, ✅ done, ❌ error+retry.
- **Snapshots**: before every `patch_file`/`write_file`, save prior content to a new `file_snapshots` table (keep last 10 per session). Undo button on every assistant message rolls back its snapshot batch.
- Persist memory snapshot per task (goal + files changed + errors) into existing `project_memory`.

## Phase 2 — Chat & File Tree UX
*(Sections 3, 4)*

- Chat: resizable textarea (2–8 rows, drag handle), bidirectional scroll, avatar + timestamp polish.
- Slash commands: `/search`, `/create`, `/refactor`, `/explain`, `/diff`, `/rollback` (parsed client-side → injected as agent instructions).
- `@filename` mention picker (autocomplete from project file list, pins file to context).
- File tree: ⋮ context menu per node (New File, New Folder, Rename, Move, Delete-with-confirm-count), language-aware icons, modified/new/deleted dot indicators (tracked via local dirty state), auto-expand ancestors of active file.

## Phase 3 — Editor Upgrades
*(Sections 5, 6)*

- Split editor (open 2 files side-by-side via resizable inner panel).
- Diff view mode (Monaco `DiffEditor`) to compare current vs. last snapshot.
- Preview tab for `.html/.css/.js` — sandboxed iframe with bundled HTML.
- Auto-save every 30s (in addition to existing debounce).
- Command Palette (Ctrl/⌘+P), Ctrl+S save, Ctrl+Z agent-undo, Ctrl+\ split, `?` shortcuts modal.
- Monaco already lazy-loads via `@monaco-editor/react`; add explicit Suspense fallback.

## Phase 4 — Power Features
*(Sections 7, 8, 9)*

- Export project as ZIP (`jszip` + `file-saver`).
- Public share link (read-only route + `projects.public_slug` column).
- Starter templates picker (Python / Node / React / HTML+CSS) on new-project.
- Theme switcher (Dark / Light / High Contrast) via CSS variables in `styles.css`.
- Integrated terminal (`xterm.js`) — **client-side sandbox only** (no real shell on the worker runtime); runs JS via Web Worker eval and prints output. I'll flag this limitation honestly rather than fake a server shell.
- Install missing libs: `framer-motion`, `diff`, `jszip`, `file-saver`, `xterm`, `xterm-addon-fit`. (`zustand`, `@tanstack/react-query`, `@monaco-editor/react`, `lucide-react`, radix dialog/context-menu/tooltip already present.)
- Introduce a small Zustand store for tabs + thinking-box state to eliminate prop drilling.

---

## Technical notes

- **`patch_file`** is implemented as the existing `edit_file` tool renamed/aliased — same surgical find/replace semantics. `delete_file` keeps its name but gains `needsApproval`.
- **`search_project`** = `grep` tool extended with line numbers + symbol regex mode.
- **Snapshots table** (new migration):
  ```text
  file_snapshots(id, project_id, user_id, thread_id, message_id, path, prior_content, created_at)
  ```
  with RLS `auth.uid() = user_id` and the standard public-schema GRANTs.
- **Thinking Box** reads from AI SDK `message.parts` (tool-call parts already stream) — no new transport needed.
- **No edge functions added** — everything stays in the TanStack `/api/chat` route + `createServerFn`.
- **Terminal honesty**: a real shell can't run on Cloudflare Workers; the xterm panel will be a JS sandbox runner. If you need a real Python/Node shell, that requires a separate container backend — I'll call it out, not silently fake it.

---

## Which phase first?

Reply with **1**, **2**, **3**, **4**, or **all in order** and I'll start implementing immediately. Default if you just say "go" → **Phase 1**, since it unlocks the safety + thinking-box foundation everything else builds on.