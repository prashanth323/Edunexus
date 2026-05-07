-- Allow principal/vice-principal/school_admin to manage subjects for any school where they have that role,
-- not only profiles.school_id (matches app "active school" / user_roles).
DROP POLICY IF EXISTS "subjects_write" ON public.subjects;
CREATE POLICY "subjects_write" ON public.subjects FOR ALL
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = subjects.school_id
        AND ur.is_active = true
        AND ur.role IN (
          'principal'::public.school_role,
          'vice_principal'::public.school_role,
          'school_admin'::public.school_role
        )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = subjects.school_id
        AND ur.is_active = true
        AND ur.role IN (
          'principal'::public.school_role,
          'vice_principal'::public.school_role,
          'school_admin'::public.school_role
        )
    )
  );