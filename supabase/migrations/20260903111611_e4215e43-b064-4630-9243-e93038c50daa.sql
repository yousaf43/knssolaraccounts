ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS operating_expense numeric NOT NULL DEFAULT 0;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;