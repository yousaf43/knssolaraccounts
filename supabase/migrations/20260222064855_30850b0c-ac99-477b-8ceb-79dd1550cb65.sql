
-- Trash table for recoverable deletions
CREATE TABLE public.trash (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  item_type text NOT NULL DEFAULT '', -- 'invoice', 'sales_order', 'stock_adjustment', etc.
  item_id text NOT NULL DEFAULT '',
  item_data jsonb NOT NULL DEFAULT '{}',
  deleted_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.trash ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own trash" ON public.trash FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Activity logs table
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL DEFAULT '', -- 'create', 'edit', 'delete', 'print', 'restore'
  item_type text NOT NULL DEFAULT '', -- 'invoice', 'sales_order', etc.
  item_id text NOT NULL DEFAULT '',
  item_label text NOT NULL DEFAULT '', -- e.g. "INV-001", "SO-005"
  details text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own activity logs" ON public.activity_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
