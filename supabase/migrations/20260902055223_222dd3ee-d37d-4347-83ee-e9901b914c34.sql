-- Platform administrator access for tenant management and usage statistics.
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY['accounts','activity_logs','backups','bills','customers','expenses','inventory','invoices','ledger_entries','other_payments','other_receipts','purchase_orders','purchase_payments','quotations','receipts','reconcile_entries','sales_orders','solar_washing','stock_adjustments','suppliers','transfers','trash','user_settings'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE POLICY "Super admins manage all %s" ON public.%I FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()))', t, t);
  END LOOP;
END $$;

CREATE POLICY "Super admins view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins view all roles" ON public.user_roles
FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));