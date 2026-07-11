ALTER TABLE public.project_memory
  ADD COLUMN IF NOT EXISTS key text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS project_memory_project_key_unique
  ON public.project_memory (project_id, key)
  WHERE key IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_memory_project_kind_idx
  ON public.project_memory (project_id, kind, created_at DESC);

DROP TRIGGER IF EXISTS project_memory_touch_updated_at ON public.project_memory;
CREATE TRIGGER project_memory_touch_updated_at
  BEFORE UPDATE ON public.project_memory
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();