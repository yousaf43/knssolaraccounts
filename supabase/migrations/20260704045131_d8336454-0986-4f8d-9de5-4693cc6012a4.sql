
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT 'main';
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT 'main';
UPDATE public.inventory SET location = 'main' WHERE location IS NULL OR location = '';
UPDATE public.sales_orders SET location = 'main' WHERE location IS NULL OR location = '';
