DROP POLICY IF EXISTS "Users manage own user_settings" ON public.user_settings;

CREATE POLICY "Team members can view all user_settings"
ON public.user_settings FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users insert own user_settings"
ON public.user_settings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own user_settings"
ON public.user_settings FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own user_settings"
ON public.user_settings FOR DELETE TO authenticated
USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;