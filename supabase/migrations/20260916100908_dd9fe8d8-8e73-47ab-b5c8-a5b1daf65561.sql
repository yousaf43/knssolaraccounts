ALTER TABLE public.solar_washing
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'washing',
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS issue text,
  ADD COLUMN IF NOT EXISTS panels numeric NOT NULL DEFAULT 0;