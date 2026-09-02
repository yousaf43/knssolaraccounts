CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION private.current_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION private.current_company_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;

DO $$
DECLARE t text;
DECLARE p record;
DECLARE tables text[] := ARRAY['accounts','activity_logs','backups','bills','customers','expenses','inventory','invoices','ledger_entries','other_payments','other_receipts','purchase_orders','purchase_payments','quotations','receipts','reconcile_entries','sales_orders','solar_washing','stock_adjustments','suppliers','transfers','trash','user_settings'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET DEFAULT private.current_company_id()', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "Company members access %s" ON public.%I FOR ALL TO authenticated USING (company_id = private.current_company_id()) WITH CHECK (company_id = private.current_company_id())', t, t);
    EXECUTE format('CREATE POLICY "Super admins manage all %s" ON public.%I FOR ALL TO authenticated USING (private.is_super_admin(auth.uid())) WITH CHECK (private.is_super_admin(auth.uid()))', t, t);
  END LOOP;
END $$;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'companies' LOOP
    EXECUTE format('DROP POLICY %I ON public.companies', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "Members view own company" ON public.companies
FOR SELECT TO authenticated USING (id = private.current_company_id());
CREATE POLICY "Super admins manage companies" ON public.companies
FOR ALL TO authenticated USING (private.is_super_admin(auth.uid()))
WITH CHECK (private.is_super_admin(auth.uid()));

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view company profiles" ON public.profiles
FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin') AND company_id = private.current_company_id());
CREATE POLICY "Super admins view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (private.is_super_admin(auth.uid()));
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND company_id = private.current_company_id());
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND company_id = private.current_company_id());

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'super_admins' LOOP
    EXECUTE format('DROP POLICY %I ON public.super_admins', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "Super admins view super_admins" ON public.super_admins
FOR SELECT TO authenticated USING (private.is_super_admin(auth.uid()) OR user_id = auth.uid());

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' LOOP
    EXECUTE format('DROP POLICY %I ON public.user_roles', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view company roles" ON public.user_roles
FOR SELECT TO authenticated USING (
  private.is_super_admin(auth.uid()) OR (
    private.has_role(auth.uid(), 'admin') AND EXISTS (
      SELECT 1 FROM public.profiles target
      WHERE target.user_id = user_roles.user_id
        AND target.company_id = private.current_company_id()
    )
  )
);
CREATE POLICY "Admins can insert company roles" ON public.user_roles
FOR INSERT TO authenticated WITH CHECK (
  private.is_super_admin(auth.uid()) OR (
    private.has_role(auth.uid(), 'admin') AND EXISTS (
      SELECT 1 FROM public.profiles target
      WHERE target.user_id = user_roles.user_id
        AND target.company_id = private.current_company_id()
    )
  )
);
CREATE POLICY "Admins can update company roles" ON public.user_roles
FOR UPDATE TO authenticated USING (
  private.is_super_admin(auth.uid()) OR (
    private.has_role(auth.uid(), 'admin') AND EXISTS (
      SELECT 1 FROM public.profiles target
      WHERE target.user_id = user_roles.user_id
        AND target.company_id = private.current_company_id()
    )
  )
) WITH CHECK (
  private.is_super_admin(auth.uid()) OR (
    private.has_role(auth.uid(), 'admin') AND EXISTS (
      SELECT 1 FROM public.profiles target
      WHERE target.user_id = user_roles.user_id
        AND target.company_id = private.current_company_id()
    )
  )
);
CREATE POLICY "Admins can delete company roles" ON public.user_roles
FOR DELETE TO authenticated USING (
  private.is_super_admin(auth.uid()) OR (
    private.has_role(auth.uid(), 'admin') AND EXISTS (
      SELECT 1 FROM public.profiles target
      WHERE target.user_id = user_roles.user_id
        AND target.company_id = private.current_company_id()
    )
  )
);

REVOKE EXECUTE ON FUNCTION public.current_company_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;