-- Teachers (and others) switch schools via user_roles + UI; profiles.school_id is not always updated.
-- subjects_select previously required school_id = get_my_school_id(), hiding subjects when those diverged.

DROP POLICY IF EXISTS "subjects_select" ON public.subjects;

CREATE POLICY "subjects_select" ON public.subjects FOR SELECT
  USING (
    is_platform_admin()
    OR school_id = get_my_school_id()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.school_id IS NOT NULL
        AND ur.school_id = subjects.school_id
        AND ur.is_active = true
    )
  );
