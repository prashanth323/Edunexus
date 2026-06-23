-- Allow students and linked parents to set student.photo_url safely (narrow path vs full students UPDATE).
-- Add storage.object policies so they can upload to student-documents under their school's paths.

CREATE OR REPLACE FUNCTION public.set_student_profile_photo(p_student_id uuid, p_photo_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_allow boolean := false;
BEGIN
  SELECT s.school_id INTO v_school_id
  FROM public.students s
  WHERE s.id = p_student_id AND s.deleted_at IS NULL;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'student not found';
  END IF;

  IF public.is_super_admin() THEN
    v_allow := true;
  ELSIF v_school_id = public.get_my_school_id()
    AND (
      public.has_school_role('principal')
      OR public.has_school_role('school_admin')
      OR public.has_school_role('admission_manager')
    )
  THEN
    v_allow := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = p_student_id AND s.profile_id = auth.uid()
  ) THEN
    v_allow := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.student_parents sp
    INNER JOIN public.parents p ON p.id = sp.parent_id AND p.profile_id = auth.uid() AND p.deleted_at IS NULL
    WHERE sp.student_id = p_student_id AND sp.school_id = v_school_id
  ) THEN
    v_allow := true;
  END IF;

  IF NOT v_allow THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.students
  SET photo_url = NULLIF(btrim(COALESCE(p_photo_url, '')), ''),
      updated_at = now()
  WHERE id = p_student_id AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.set_student_profile_photo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_student_profile_photo(uuid, text) TO authenticated;


-- ─── STORAGE: pupil photos (path school_id/student_id/...) ─────────────────
DROP POLICY IF EXISTS "student_docs_insert_self_parent" ON storage.objects;
CREATE POLICY "student_docs_insert_self_parent" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] IS NOT NULL
    -- Pupil/doc paths only: second segment must be student id (portal avatars use .../profiles/{id}/...).
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND (storage.foldername(name))[1]::uuid = public.get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = (storage.foldername(name))[2]::uuid
        AND s.school_id = public.get_my_school_id()
        AND s.deleted_at IS NULL
        AND (
          s.profile_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.student_parents sp
            INNER JOIN public.parents p ON p.id = sp.parent_id AND p.profile_id = auth.uid() AND p.deleted_at IS NULL
            WHERE sp.student_id = s.id AND sp.school_id = s.school_id
          )
        )
    )
  );

DROP POLICY IF EXISTS "student_docs_update_self_parent" ON storage.objects;
CREATE POLICY "student_docs_update_self_parent" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] IS NOT NULL
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND (storage.foldername(name))[1]::uuid = public.get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = (storage.foldername(name))[2]::uuid
        AND s.school_id = public.get_my_school_id()
        AND s.deleted_at IS NULL
        AND (
          s.profile_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.student_parents sp
            INNER JOIN public.parents p ON p.id = sp.parent_id AND p.profile_id = auth.uid() AND p.deleted_at IS NULL
            WHERE sp.student_id = s.id AND sp.school_id = s.school_id
          )
        )
    )
  )
  WITH CHECK (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] IS NOT NULL
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND (storage.foldername(name))[1]::uuid = public.get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = (storage.foldername(name))[2]::uuid
        AND s.school_id = public.get_my_school_id()
        AND s.deleted_at IS NULL
        AND (
          s.profile_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.student_parents sp
            INNER JOIN public.parents p ON p.id = sp.parent_id AND p.profile_id = auth.uid() AND p.deleted_at IS NULL
            WHERE sp.student_id = s.id AND sp.school_id = s.school_id
          )
        )
    )
  );

-- ─── STORAGE: portal profile avatar (path school_id/profiles/profile_id/...) ─
DROP POLICY IF EXISTS "student_docs_avatar_profile_insert" ON storage.objects;
CREATE POLICY "student_docs_avatar_profile_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] IS NOT NULL
    AND (storage.foldername(name))[3] IS NOT NULL
    AND (storage.foldername(name))[1]::uuid = public.get_my_school_id()
    AND (storage.foldername(name))[2] = 'profiles'
    AND (storage.foldername(name))[3]::uuid = auth.uid()
  );

DROP POLICY IF EXISTS "student_docs_avatar_profile_update" ON storage.objects;
CREATE POLICY "student_docs_avatar_profile_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] IS NOT NULL
    AND (storage.foldername(name))[3] IS NOT NULL
    AND (storage.foldername(name))[1]::uuid = public.get_my_school_id()
    AND (storage.foldername(name))[2] = 'profiles'
    AND (storage.foldername(name))[3]::uuid = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] IS NOT NULL
    AND (storage.foldername(name))[3] IS NOT NULL
    AND (storage.foldername(name))[1]::uuid = public.get_my_school_id()
    AND (storage.foldername(name))[2] = 'profiles'
    AND (storage.foldername(name))[3]::uuid = auth.uid()
  );
