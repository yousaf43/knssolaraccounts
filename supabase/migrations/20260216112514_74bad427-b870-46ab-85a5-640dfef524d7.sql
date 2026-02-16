
-- Create backups table to store user data backups
CREATE TABLE public.backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  backup_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  label TEXT DEFAULT 'auto'
);

-- Enable RLS
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

-- Users can only access their own backups
CREATE POLICY "Users can view own backups" ON public.backups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own backups" ON public.backups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own backups" ON public.backups
  FOR DELETE USING (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX idx_backups_user_created ON public.backups (user_id, created_at DESC);
