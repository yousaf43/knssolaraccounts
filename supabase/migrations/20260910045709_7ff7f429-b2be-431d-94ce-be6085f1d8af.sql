
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  company_id UUID DEFAULT private.current_company_id(),
  code TEXT DEFAULT '',
  name TEXT NOT NULL,
  designation TEXT DEFAULT '',
  department TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  cnic TEXT DEFAULT '',
  address TEXT DEFAULT '',
  join_date TEXT DEFAULT '',
  salary NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  company_id UUID DEFAULT private.current_company_id(),
  employee_id UUID,
  employee_name TEXT DEFAULT '',
  date TEXT NOT NULL,
  check_in TEXT DEFAULT '',
  check_out TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'present',
  hours NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workplace_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  company_id UUID DEFAULT private.current_company_id(),
  title TEXT NOT NULL,
  category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  effective_date TEXT DEFAULT '',
  sort_order NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.payroll (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  company_id UUID DEFAULT private.current_company_id(),
  employee_id UUID,
  employee_name TEXT DEFAULT '',
  month TEXT NOT NULL,
  basic_salary NUMERIC NOT NULL DEFAULT 0,
  allowances NUMERIC NOT NULL DEFAULT 0,
  overtime NUMERIC NOT NULL DEFAULT 0,
  deductions NUMERIC NOT NULL DEFAULT 0,
  advance NUMERIC NOT NULL DEFAULT 0,
  net_pay NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_date TEXT DEFAULT '',
  payment_method TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workplace_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll TO authenticated;
GRANT ALL ON public.employees TO service_role;
GRANT ALL ON public.attendance TO service_role;
GRANT ALL ON public.workplace_rules TO service_role;
GRANT ALL ON public.payroll TO service_role;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workplace_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members access employees" ON public.employees FOR ALL TO authenticated USING (company_id = private.current_company_id()) WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "Super admins manage all employees" ON public.employees FOR ALL TO authenticated USING (private.is_super_admin(auth.uid())) WITH CHECK (private.is_super_admin(auth.uid()));

CREATE POLICY "Company members access attendance" ON public.attendance FOR ALL TO authenticated USING (company_id = private.current_company_id()) WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "Super admins manage all attendance" ON public.attendance FOR ALL TO authenticated USING (private.is_super_admin(auth.uid())) WITH CHECK (private.is_super_admin(auth.uid()));

CREATE POLICY "Company members access workplace_rules" ON public.workplace_rules FOR ALL TO authenticated USING (company_id = private.current_company_id()) WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "Super admins manage all workplace_rules" ON public.workplace_rules FOR ALL TO authenticated USING (private.is_super_admin(auth.uid())) WITH CHECK (private.is_super_admin(auth.uid()));

CREATE POLICY "Company members access payroll" ON public.payroll FOR ALL TO authenticated USING (company_id = private.current_company_id()) WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "Super admins manage all payroll" ON public.payroll FOR ALL TO authenticated USING (private.is_super_admin(auth.uid())) WITH CHECK (private.is_super_admin(auth.uid()));

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workplace_rules_updated_at BEFORE UPDATE ON public.workplace_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON public.payroll FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
