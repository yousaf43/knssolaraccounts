
-- Allow admins to view all profiles (so Users list shows newly created users)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Shared business data: any authenticated user can read/write
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'accounts','customers','suppliers','invoices','quotations','sales_orders','receipts',
    'purchase_orders','bills','purchase_payments','expenses','inventory','ledger_entries',
    'other_payments','other_receipts','transfers','reconcile_entries','stock_adjustments',
    'solar_washing','activity_logs','trash'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "Team members access %1$s" ON public.%1$I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
