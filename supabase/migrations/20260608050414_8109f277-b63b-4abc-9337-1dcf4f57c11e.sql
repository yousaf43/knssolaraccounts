
-- Lock all tenant tables to owner: auth.uid() = user_id
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'accounts','activity_logs','bills','customers','expenses','inventory',
    'invoices','ledger_entries','other_payments','other_receipts',
    'purchase_orders','purchase_payments','quotations','receipts',
    'reconcile_entries','sales_orders','solar_washing','stock_adjustments',
    'suppliers','transfers','trash','user_settings'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop all existing policies on the table
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    -- Create owner-only policy
    EXECUTE format($f$CREATE POLICY "Users manage own %1$s" ON public.%1$I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)$f$, t);
  END LOOP;
END $$;

-- Profiles: restrict SELECT to own profile
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Backups: change role from public to authenticated
DROP POLICY IF EXISTS "Users can create own backups" ON public.backups;
DROP POLICY IF EXISTS "Users can delete own backups" ON public.backups;
DROP POLICY IF EXISTS "Users can view own backups" ON public.backups;
CREATE POLICY "Users can create own backups" ON public.backups
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own backups" ON public.backups
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own backups" ON public.backups
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage: logos bucket ownership check via user-id folder prefix
DROP POLICY IF EXISTS "Authenticated users can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;

CREATE POLICY "Users can view own logos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload own logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
