ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_titled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS chat_threads_project_updated_idx
  ON public.chat_threads (project_id, pinned DESC, updated_at DESC);