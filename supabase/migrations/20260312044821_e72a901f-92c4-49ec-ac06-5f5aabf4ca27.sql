ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS model text DEFAULT ''::text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS unique_code text DEFAULT ''::text;