CREATE TABLE public.solar_washing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date text DEFAULT '',
  customer text DEFAULT '',
  amount numeric DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.solar_washing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage solar washing"
  ON public.solar_washing FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_solar_washing_updated_at
  BEFORE UPDATE ON public.solar_washing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();