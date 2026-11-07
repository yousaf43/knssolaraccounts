CREATE TABLE public.proposal_delivery_settings (
 company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 phone_number_id text NOT NULL DEFAULT '',
 business_account_id text NOT NULL DEFAULT '',
 token_ciphertext text,
 template_name text NOT NULL DEFAULT '',
 template_language text NOT NULL DEFAULT 'en_US',
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.proposal_delivery_settings TO service_role;
ALTER TABLE public.proposal_delivery_settings ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.proposal_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE UNIQUE,
 recipient text NOT NULL,
 status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','accepted','failed','unknown')),
 message_id text,
 error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.proposal_deliveries TO authenticated;
GRANT ALL ON public.proposal_deliveries TO service_role;
ALTER TABLE public.proposal_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members read proposal deliveries" ON public.proposal_deliveries FOR SELECT TO authenticated USING (company_id = public.current_company_id());