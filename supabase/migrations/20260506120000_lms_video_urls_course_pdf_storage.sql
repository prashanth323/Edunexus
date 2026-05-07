-- Optional YouTube / embed URLs on modules and lessons
ALTER TABLE public.course_modules ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.course_lessons ADD COLUMN IF NOT EXISTS video_url TEXT;

COMMENT ON COLUMN public.course_modules.video_url IS 'Optional intro video URL (e.g. YouTube) for this module.';
COMMENT ON COLUMN public.course_lessons.video_url IS 'Optional lesson video URL (e.g. YouTube).';

-- Course PDF uploads: paths must be {school_id}/{course_id}/{filename}.pdf
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lms-course-materials',
  'lms-course-materials',
  true,
  25165824,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "lms_course_materials_insert_staff" ON storage.objects;
DROP POLICY IF EXISTS "lms_course_materials_update_staff" ON storage.objects;
DROP POLICY IF EXISTS "lms_course_materials_delete_staff" ON storage.objects;
DROP POLICY IF EXISTS "lms_course_materials_select" ON storage.objects;

-- Staff (same LMS roles as study_materials) may manage PDFs under their school prefix
CREATE POLICY "lms_course_materials_insert_staff" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'lms-course-materials'
    AND (storage.foldername(name))[1]::uuid = get_my_school_id()
    AND (
      is_super_admin()
      OR (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  );

CREATE POLICY "lms_course_materials_update_staff" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'lms-course-materials'
    AND (storage.foldername(name))[1]::uuid = get_my_school_id()
    AND (
      is_super_admin()
      OR (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  );

CREATE POLICY "lms_course_materials_delete_staff" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'lms-course-materials'
    AND (storage.foldername(name))[1]::uuid = get_my_school_id()
    AND (
      is_super_admin()
      OR (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  );

-- Enrolled students may read PDFs for published courses; staff may read their school prefix
CREATE POLICY "lms_course_materials_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'lms-course-materials'
    AND (
      (
        (storage.foldername(name))[1]::uuid = get_my_school_id()
        AND (
          is_platform_admin()
          OR has_school_role('principal')
          OR has_school_role('vice_principal')
          OR has_school_role('school_admin')
          OR has_school_role('teacher')
          OR has_school_role('class_teacher')
          OR has_school_role('librarian')
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.lms_course_enrollments e
        JOIN public.students st ON st.id = e.student_id AND st.profile_id = auth.uid()
        JOIN public.courses c ON c.id = e.course_id AND c.deleted_at IS NULL AND c.is_published = true
        WHERE e.course_id = (storage.foldername(name))[2]::uuid
          AND e.status IN ('active', 'completed')
          AND e.school_id = (storage.foldername(name))[1]::uuid
          AND c.school_id = (storage.foldername(name))[1]::uuid
      )
    )
  );
