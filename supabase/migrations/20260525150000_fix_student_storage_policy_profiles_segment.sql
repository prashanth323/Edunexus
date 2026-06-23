-- Portal avatar path is {school_uuid}/profiles/{profile_uuid}/avatar.ext.
-- student_docs_*_self_parent assumed segment 2 was always a student UUID, so Postgres evaluated
-- (foldername(name))[2]::uuid and errored on 'profiles'. Only match pupil paths (UUID second segment).

DROP POLICY IF EXISTS "student_docs_insert_self_parent" ON storage.objects;
CREATE POLICY "student_docs_insert_self_parent" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] IS NOT NULL
    -- Pupil/doc paths only: second segment must be student id (portal uses .../profiles/...).
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
