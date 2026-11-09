CREATE TABLE public.warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid DEFAULT private.current_company_id() REFERENCES public.companies(id),
  user_id uuid,
  certificate_no text NOT NULL,
  customer_name text NOT NULL,
  father_name text,
  cnic text,
  phone text,
  address text,
  invoice_no text,
  product_description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  start_date text NOT NULL,
  issue_date text NOT NULL,
  workmanship_years numeric NOT NULL DEFAULT 12,
  output_warranty text,
  serial_numbers text[] NOT NULL DEFAULT '{}',
  attachment_path text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warranties TO authenticated;
GRANT ALL ON public.warranties TO service_role;
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members access warranties" ON public.warranties FOR ALL TO authenticated
  USING (company_id = private.current_company_id()) WITH CHECK (company_id = private.current_company_id());
CREATE TRIGGER update_warranties_updated_at BEFORE UPDATE ON public.warranties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Company read warranty files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'warranty-attachments' AND (storage.foldername(name))[1] = private.current_company_id()::text);
CREATE POLICY "Company upload warranty files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'warranty-attachments' AND (storage.foldername(name))[1] = private.current_company_id()::text);
CREATE POLICY "Company delete warranty files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'warranty-attachments' AND (storage.foldername(name))[1] = private.current_company_id()::text);