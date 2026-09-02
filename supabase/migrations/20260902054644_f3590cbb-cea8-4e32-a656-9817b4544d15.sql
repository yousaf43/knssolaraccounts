-- 1. Companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_email text,
  phone text,
  address text,
  plan text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'active',
  starts_at date NOT NULL DEFAULT CURRENT_DATE,
  expires_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Super admins
CREATE TABLE public.super_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.super_admins TO authenticated;
GRANT ALL ON public.super_admins TO service_role;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _user_id)
$$;

CREATE POLICY "Super admins view super_admins" ON public.super_admins
FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());

-- 3. Company link on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 4. Seed default company + assign everything to it
INSERT INTO public.companies (id, name, contact_email, plan, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'K&S Solar Energy', 'knssolarenergy@gmail.com', 'owner', 'active');

UPDATE public.profiles SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;

INSERT INTO public.super_admins (user_id) VALUES ('9984ed57-6c1c-45cf-9f76-15759fcf87d8')
ON CONFLICT DO NOTHING;

-- companies policies (after function exists)
CREATE POLICY "Super admins manage companies" ON public.companies
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Members view own company" ON public.companies
FOR SELECT TO authenticated USING (id = public.current_company_id());

-- 5. Add company_id to every tenant table, backfill, default, index, RLS
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY['accounts','activity_logs','backups','bills','customers','expenses','inventory','invoices','ledger_entries','other_payments','other_receipts','purchase_orders','purchase_payments','quotations','receipts','reconcile_entries','sales_orders','solar_washing','stock_adjustments','suppliers','transfers','trash','user_settings'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', t, '11111111-1111-1111-1111-111111111111');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET DEFAULT public.current_company_id()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id)', 'idx_'||t||'_company_id', t);
  END LOOP;
END $$;

-- 6. Replace shared-team policies with company-scoped ones
DO $$
DECLARE t text;
DECLARE p record;
DECLARE tables text[] := ARRAY['accounts','activity_logs','bills','customers','expenses','inventory','invoices','ledger_entries','other_payments','other_receipts','purchase_orders','purchase_payments','quotations','receipts','reconcile_entries','sales_orders','solar_washing','stock_adjustments','suppliers','transfers','trash'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "Company members access %s" ON public.%I FOR ALL TO authenticated USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id())', t, t);
  END LOOP;
END $$;

-- user_settings: shared within company
DROP POLICY IF EXISTS "Team members can view all user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users insert own user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users update own user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users delete own user_settings" ON public.user_settings;
CREATE POLICY "Company members view user_settings" ON public.user_settings
FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "Users insert own user_settings" ON public.user_settings
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND company_id = public.current_company_id());
CREATE POLICY "Users update own user_settings" ON public.user_settings
FOR UPDATE TO authenticated USING (auth.uid() = user_id AND company_id = public.current_company_id())
WITH CHECK (auth.uid() = user_id AND company_id = public.current_company_id());
CREATE POLICY "Users delete own user_settings" ON public.user_settings
FOR DELETE TO authenticated USING (auth.uid() = user_id AND company_id = public.current_company_id());

-- backups stay per-user but company scoped
DROP POLICY IF EXISTS "Users can view own backups" ON public.backups;
DROP POLICY IF EXISTS "Users can create own backups" ON public.backups;
DROP POLICY IF EXISTS "Users can delete own backups" ON public.backups;
CREATE POLICY "Users view own backups" ON public.backups
FOR SELECT TO authenticated USING (auth.uid() = user_id AND company_id = public.current_company_id());
CREATE POLICY "Users create own backups" ON public.backups
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND company_id = public.current_company_id());
CREATE POLICY "Users delete own backups" ON public.backups
FOR DELETE TO authenticated USING (auth.uid() = user_id AND company_id = public.current_company_id());

-- profiles / roles scoped to company as well (admins of same company)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins view company profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND company_id = public.current_company_id());

-- 7. New users inherit company from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _company uuid;
BEGIN
  BEGIN
    _company := NULLIF(NEW.raw_user_meta_data ->> 'company_id', '')::uuid;
  EXCEPTION WHEN others THEN
    _company := NULL;
  END;

  INSERT INTO public.profiles (user_id, full_name, company_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), _company);

  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'app_role',''), 'sales')::app_role);
  END IF;

  RETURN NEW;
END;
$function$;
