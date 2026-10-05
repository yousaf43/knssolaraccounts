CREATE TABLE public.user_menu_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid,
  menus text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_menu_access TO authenticated;
GRANT ALL ON public.user_menu_access TO service_role;
ALTER TABLE public.user_menu_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or company admin can read" ON public.user_menu_access FOR SELECT TO authenticated
USING (user_id = auth.uid() OR (public.has_role(auth.uid(),'admin') AND company_id = public.current_company_id()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Company admin can insert" ON public.user_menu_access FOR INSERT TO authenticated
WITH CHECK ((public.has_role(auth.uid(),'admin') AND company_id = public.current_company_id()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = user_menu_access.user_id AND p.company_id = public.current_company_id()))
  OR public.is_super_admin(auth.uid()));
CREATE POLICY "Company admin can update" ON public.user_menu_access FOR UPDATE TO authenticated
USING ((public.has_role(auth.uid(),'admin') AND company_id = public.current_company_id()) OR public.is_super_admin(auth.uid()))
WITH CHECK ((public.has_role(auth.uid(),'admin') AND company_id = public.current_company_id()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Company admin can delete" ON public.user_menu_access FOR DELETE TO authenticated
USING ((public.has_role(auth.uid(),'admin') AND company_id = public.current_company_id()) OR public.is_super_admin(auth.uid()));