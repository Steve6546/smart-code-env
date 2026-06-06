
CREATE TABLE public.file_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  thread_id uuid,
  message_id text,
  path text NOT NULL,
  prior_content text,
  prior_existed boolean NOT NULL DEFAULT true,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX file_snapshots_project_idx ON public.file_snapshots (project_id, created_at DESC);
CREATE INDEX file_snapshots_message_idx ON public.file_snapshots (message_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_snapshots TO authenticated;
GRANT ALL ON public.file_snapshots TO service_role;
ALTER TABLE public.file_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage snapshots" ON public.file_snapshots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
