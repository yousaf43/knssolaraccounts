-- Keep tenant and super-admin checks internal to row policies; do not expose them through the public API.
REVOKE EXECUTE ON FUNCTION public.current_company_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;

-- This helper is intentionally used by row policies, but must not be callable by anonymous visitors.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- Restore only the minimum internal policy execution privileges through the policy owner context.
ALTER FUNCTION public.current_company_id() SET search_path = public;
ALTER FUNCTION public.is_super_admin(uuid) SET search_path = public;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;