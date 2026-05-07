-- Allow super admins to update other users' profiles (e.g. school_id when assigning principal/admin).
-- Complements profiles_update_self via OR-combined policies.

CREATE POLICY "profiles_update_super" ON public.profiles FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
