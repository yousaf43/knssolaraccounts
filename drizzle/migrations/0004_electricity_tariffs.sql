CREATE TABLE public.electricity_tariffs (
  id text PRIMARY KEY,
  rates jsonb NOT NULL,
  source text,
  effective_label text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.electricity_tariffs TO authenticated;
GRANT ALL ON public.electricity_tariffs TO service_role;
ALTER TABLE public.electricity_tariffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read tariffs" ON public.electricity_tariffs
  FOR SELECT TO authenticated USING (true);
