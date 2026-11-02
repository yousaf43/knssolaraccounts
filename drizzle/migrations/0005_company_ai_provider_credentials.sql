CREATE TABLE public.ai_provider_credentials (
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK (provider IN ('gemini','groq','openrouter')),
 key_ciphertext text,
 enabled boolean NOT NULL DEFAULT true,
 blocked_reason text CHECK (blocked_reason IN ('quota','denied','invalid_key')),
 blocked_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (company_id, provider)
);
GRANT ALL ON public.ai_provider_credentials TO service_role;
REVOKE ALL ON public.ai_provider_credentials FROM anon, authenticated;
ALTER TABLE public.ai_provider_credentials ENABLE ROW LEVEL SECURITY;