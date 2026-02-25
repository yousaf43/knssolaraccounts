
-- Create quotations table
CREATE TABLE public.quotations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  number text DEFAULT ''::text,
  project_name text DEFAULT ''::text,
  document_number text DEFAULT ''::text,
  customer text DEFAULT ''::text,
  date text DEFAULT ''::text,
  due_date text DEFAULT ''::text,
  amount numeric DEFAULT 0,
  status text DEFAULT 'draft'::text,
  items jsonb DEFAULT '[]'::jsonb,
  notes text DEFAULT ''::text,
  tax numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage quotations"
  ON public.quotations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
