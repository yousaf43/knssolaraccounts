ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS extra_items jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS public.warranty_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid DEFAULT private.current_company_id() REFERENCES public.companies(id),
  user_id uuid DEFAULT auth.uid(),
  serial text NOT NULL,
  serial_key text NOT NULL,
  category text NOT NULL DEFAULT 'panel',
  watt numeric,
  brand_model text,
  batch_label text,
  status text NOT NULL DEFAULT 'available',
  warranty_id uuid,
  source_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, serial_key)
);
CREATE INDEX IF NOT EXISTS warranty_serials_warranty_idx ON public.warranty_serials(warranty_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warranty_serials TO authenticated;
GRANT ALL ON public.warranty_serials TO service_role;
ALTER TABLE public.warranty_serials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company members access warranty serials" ON public.warranty_serials;
CREATE POLICY "Company members access warranty serials" ON public.warranty_serials FOR ALL TO authenticated
  USING (company_id = private.current_company_id()) WITH CHECK (company_id = private.current_company_id());
DROP TRIGGER IF EXISTS update_warranty_serials_updated_at ON public.warranty_serials;
CREATE TRIGGER update_warranty_serials_updated_at BEFORE UPDATE ON public.warranty_serials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.warranty_serial_items(w public.warranties)
RETURNS TABLE(serial text, serial_key text, category text)
LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT DISTINCT ON (k) s, k, c FROM (
    SELECT trim(s) s, upper(regexp_replace(s, '\s', '', 'g')) k, 'panel'::text c FROM unnest(coalesce($1.serial_numbers, '{}')) s
    UNION ALL
    SELECT trim(s.value), upper(regexp_replace(s.value, '\s', '', 'g')), coalesce(i.value->>'kind', 'other')
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof($1.extra_items) = 'array' THEN $1.extra_items ELSE '[]'::jsonb END) i,
         jsonb_array_elements_text(CASE WHEN jsonb_typeof(i.value->'serials') = 'array' THEN i.value->'serials' ELSE '[]'::jsonb END) s
  ) x WHERE k <> '' ORDER BY k
$$;

CREATE OR REPLACE FUNCTION public.sync_warranty_serials()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE conflict text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.warranty_serials SET status = 'available', warranty_id = NULL WHERE warranty_id = OLD.id;
    RETURN OLD;
  END IF;
  SELECT string_agg(ws.serial || ' (' || coalesce(w.certificate_no, 'another warranty') || ')', ', ') INTO conflict
  FROM public.warranty_serial_items(NEW) i
  JOIN public.warranty_serials ws ON ws.company_id IS NOT DISTINCT FROM NEW.company_id AND ws.serial_key = i.serial_key
  LEFT JOIN public.warranties w ON w.id = ws.warranty_id
  WHERE ws.warranty_id IS NOT NULL AND ws.warranty_id <> NEW.id;
  IF conflict IS NOT NULL THEN
    RAISE EXCEPTION 'Serial already used in another warranty: %', conflict USING ERRCODE = '23505';
  END IF;
  UPDATE public.warranty_serials SET status = 'available', warranty_id = NULL
   WHERE warranty_id = NEW.id AND serial_key NOT IN (SELECT i.serial_key FROM public.warranty_serial_items(NEW) i);
  INSERT INTO public.warranty_serials (company_id, user_id, serial, serial_key, category, status, warranty_id)
  SELECT NEW.company_id, NEW.user_id, i.serial, i.serial_key, i.category, 'used', NEW.id FROM public.warranty_serial_items(NEW) i
  ON CONFLICT (company_id, serial_key) DO UPDATE SET status = 'used', warranty_id = NEW.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS warranties_sync_serials ON public.warranties;
CREATE TRIGGER warranties_sync_serials AFTER INSERT OR UPDATE OR DELETE ON public.warranties
  FOR EACH ROW EXECUTE FUNCTION public.sync_warranty_serials();

INSERT INTO public.warranty_serials (company_id, user_id, serial, serial_key, category, status, warranty_id)
SELECT w.company_id, w.user_id, i.serial, i.serial_key, i.category, 'used', w.id
FROM public.warranties w, public.warranty_serial_items(w) i
ON CONFLICT (company_id, serial_key) DO NOTHING;