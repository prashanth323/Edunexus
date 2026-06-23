-- student-documents bucket was referenced in commented seed snippets only ("Execute via Dashboard").
-- Apps upload to this bucket — create it plus school-scoped SELECT + staff INSERT/UPDATE so uploads work locally and in prod.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-documents',
  'student-documents',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Readable by authenticated users whose active school matches the first path segment (RLS complements DB visibility).
DROP POLICY IF EXISTS "student_documents_prefix_select" ON storage.objects;
CREATE POLICY "student_documents_prefix_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (
      public.is_platform_admin()
      OR (storage.foldername(name))[1]::uuid = public.get_my_school_id()
    )
  );

DROP POLICY IF EXISTS "student_documents_staff_insert" ON storage.objects;
CREATE POLICY "student_documents_staff_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[1]::uuid = public.get_my_school_id()
    AND (
      public.is_super_admin()
      OR (
        public.has_school_role('principal')
        OR public.has_school_role('vice_principal')
        OR public.has_school_role('school_admin')
        OR public.has_school_role('admission_manager')
      )
    )
  );

DROP POLICY IF EXISTS "student_documents_staff_update" ON storage.objects;
CREATE POLICY "student_documents_staff_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[1]::uuid = public.get_my_school_id()
    AND (
      public.is_super_admin()
      OR (
        public.has_school_role('principal')
        OR public.has_school_role('vice_principal')
        OR public.has_school_role('school_admin')
        OR public.has_school_role('admission_manager')
      )
    )
  )
  WITH CHECK (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[1]::uuid = public.get_my_school_id()
    AND (
      public.is_super_admin()
      OR (
        public.has_school_role('principal')
        OR public.has_school_role('vice_principal')
        OR public.has_school_role('school_admin')
        OR public.has_school_role('admission_manager')
      )
    )
  );

DROP POLICY IF EXISTS "student_documents_staff_delete" ON storage.objects;
CREATE POLICY "student_documents_staff_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[1]::uuid = public.get_my_school_id()
    AND (
      public.is_super_admin()
      OR (
        public.has_school_role('principal')
        OR public.has_school_role('vice_principal')
        OR public.has_school_role('school_admin')
        OR public.has_school_role('admission_manager')
      )
    )
  );
