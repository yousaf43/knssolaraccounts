CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  user_id uuid,
  proposal_no text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  system_type text NOT NULL DEFAULT 'on-grid',
  system_kw numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposals_company_idx ON public.proposals (company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members access proposals" ON public.proposals
  FOR ALL TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "Super admins manage all proposals" ON public.proposals
  FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));