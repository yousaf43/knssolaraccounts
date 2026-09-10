ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS biometric_id text;

CREATE TABLE IF NOT EXISTS public.attendance_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  user_id uuid,
  name text NOT NULL DEFAULT 'ZKTeco Device',
  serial text,
  api_key text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  device_id uuid REFERENCES public.attendance_devices(id) ON DELETE SET NULL,
  device_user_id text NOT NULL,
  employee_id uuid,
  employee_name text,
  punch_time timestamptz NOT NULL,
  punch_date text NOT NULL,
  punch_type text,
  source text NOT NULL DEFAULT 'device',
  raw text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_punches_unique
  ON public.attendance_punches (company_id, device_user_id, punch_time);
CREATE INDEX IF NOT EXISTS attendance_punches_date_idx
  ON public.attendance_punches (company_id, punch_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_devices TO authenticated;
GRANT ALL ON public.attendance_devices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_punches TO authenticated;
GRANT ALL ON public.attendance_punches TO service_role;

ALTER TABLE public.attendance_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_punches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members access attendance devices" ON public.attendance_devices
  FOR ALL TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "Super admins manage all attendance devices" ON public.attendance_devices
  FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

CREATE POLICY "Company members access attendance punches" ON public.attendance_punches
  FOR ALL TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "Super admins manage all attendance punches" ON public.attendance_punches
  FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

CREATE TRIGGER attendance_devices_updated_at BEFORE UPDATE ON public.attendance_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();