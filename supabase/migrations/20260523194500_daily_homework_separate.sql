-- Daily homework vs LMS learning-path assignments:
-- coursework `assignments` stay tied to `courses`; new tables serve teacher daily homework.

CREATE TABLE public.homework_assignments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id  UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  section_id        UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  class_id          UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  subject_id        UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id        UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_by        UUID REFERENCES public.profiles(id),
  title             TEXT NOT NULL,
  description       TEXT,
  max_marks         NUMERIC(6,2) NOT NULL DEFAULT 100,
  due_date          TIMESTAMPTZ,
  is_published      BOOLEAN NOT NULL DEFAULT false,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.homework_assignments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE INDEX idx_homework_assignments_school_id ON public.homework_assignments(school_id);
CREATE INDEX idx_homework_assignments_section ON public.homework_assignments(section_id);
CREATE INDEX idx_homework_assignments_subject ON public.homework_assignments(subject_id);

CREATE TABLE public.homework_submissions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id               UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  homework_assignment_id  UUID NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
  student_id              UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submitted_at            TIMESTAMPTZ,
  content                 TEXT,
  attachments             JSONB NOT NULL DEFAULT '[]',
  status                  public.submission_status NOT NULL DEFAULT 'not_submitted'::public.submission_status,
  marks_obtained           NUMERIC(6,2),
  feedback                TEXT,
  graded_by               UUID REFERENCES public.profiles(id),
  graded_at               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (homework_assignment_id, student_id)
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE INDEX idx_homework_submissions_school ON public.homework_submissions(school_id);
CREATE INDEX idx_homework_submissions_hw ON public.homework_submissions(homework_assignment_id);
CREATE INDEX idx_homework_submissions_student ON public.homework_submissions(student_id);

ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homework_assignments_select_staff" ON public.homework_assignments FOR SELECT
  USING (
    public.is_platform_admin()
    OR (
      school_id = public.get_my_school_id()
      AND deleted_at IS NULL
      AND (
        public.has_school_role('principal')
        OR public.has_school_role('vice_principal')
        OR public.has_school_role('school_admin')
        OR public.has_school_role('teacher')
        OR public.has_school_role('class_teacher')
        OR public.has_school_role('librarian')
      )
    )
  );

CREATE POLICY "homework_assignments_select_student" ON public.homework_assignments FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_published IS TRUE
    AND school_id = public.get_my_school_id()
    AND EXISTS (
      SELECT 1
      FROM public.enrollments e
      INNER JOIN public.students st ON st.id = e.student_id AND st.profile_id = auth.uid()
      WHERE e.school_id = homework_assignments.school_id
        AND e.section_id = homework_assignments.section_id
        AND e.academic_year_id = homework_assignments.academic_year_id
        AND e.status = 'active'
    )
  );

CREATE POLICY "homework_assignments_select_parent" ON public.homework_assignments FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_published IS TRUE
    AND school_id = public.get_my_school_id()
    AND EXISTS (
      SELECT 1
      FROM public.enrollments e
      INNER JOIN public.student_parents sp ON sp.student_id = e.student_id
      INNER JOIN public.parents pa ON pa.id = sp.parent_id AND pa.profile_id = auth.uid() AND pa.deleted_at IS NULL
      WHERE e.school_id = homework_assignments.school_id
        AND e.section_id = homework_assignments.section_id
        AND e.academic_year_id = homework_assignments.academic_year_id
        AND e.status = 'active'
    )
  );

CREATE POLICY "homework_assignments_write_staff" ON public.homework_assignments FOR ALL
  USING (
    public.is_super_admin()
    OR (
      school_id = public.get_my_school_id()
      AND (
        public.has_school_role('teacher')
        OR public.has_school_role('class_teacher')
      )
    )
  );

CREATE POLICY "homework_submissions_select" ON public.homework_submissions FOR SELECT
  USING (
    public.is_platform_admin()
    OR (school_id = public.get_my_school_id() AND (
      public.has_school_role('teacher')
      OR public.has_school_role('class_teacher')
      OR public.has_school_role('principal')
      OR public.has_school_role('vice_principal')
      OR public.has_school_role('school_admin')
    ))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (
      SELECT sp.student_id FROM public.student_parents sp
      INNER JOIN public.parents pa ON pa.id = sp.parent_id AND pa.profile_id = auth.uid()
      WHERE pa.deleted_at IS NULL
    )
  );

CREATE POLICY "homework_submissions_insert_own" ON public.homework_submissions FOR INSERT
  WITH CHECK (
    school_id = public.get_my_school_id()
    AND student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.homework_assignments ha
      INNER JOIN public.enrollments e
        ON e.section_id = ha.section_id
        AND e.academic_year_id = ha.academic_year_id
        AND e.school_id = ha.school_id
      WHERE ha.id = homework_assignment_id
        AND e.student_id = student_id
        AND e.status = 'active'
    )
  );

CREATE POLICY "homework_submissions_update_grade" ON public.homework_submissions FOR UPDATE
  USING (
    public.is_super_admin()
    OR (
      school_id = public.get_my_school_id()
      AND (
        public.has_school_role('teacher')
        OR public.has_school_role('class_teacher')
        OR public.has_school_role('school_admin')
      )
    )
  );

-- Students upsert/update their row on resubmit (ON CONFLICT DO UPDATE).
CREATE POLICY "homework_submissions_update_own_student" ON public.homework_submissions FOR UPDATE
  USING (
    school_id = public.get_my_school_id()
    AND student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.homework_assignments ha
      INNER JOIN public.enrollments e
        ON e.section_id = ha.section_id
        AND e.academic_year_id = ha.academic_year_id
        AND e.school_id = ha.school_id
      WHERE ha.id = homework_submissions.homework_assignment_id
        AND e.student_id = homework_submissions.student_id
        AND e.status = 'active'
    )
  )
  WITH CHECK (
    school_id = public.get_my_school_id()
    AND student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.homework_assignments ha
      INNER JOIN public.enrollments e
        ON e.section_id = ha.section_id
        AND e.academic_year_id = ha.academic_year_id
        AND e.school_id = ha.school_id
      WHERE ha.id = homework_submissions.homework_assignment_id
        AND e.student_id = homework_submissions.student_id
        AND e.status = 'active'
    )
  );

CREATE OR REPLACE FUNCTION public.get_lms_overview_counts(p_school_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'courses_total', (SELECT count(*)::int FROM public.courses c WHERE c.school_id = p_school_id AND c.deleted_at IS NULL),
    'courses_published', (SELECT count(*)::int FROM public.courses c WHERE c.school_id = p_school_id AND c.deleted_at IS NULL AND c.is_published IS TRUE),
    'lessons_total', (SELECT count(*)::int FROM public.course_lessons l WHERE l.school_id = p_school_id AND l.deleted_at IS NULL),
    'assignments_total', (SELECT count(*)::int FROM public.assignments a WHERE a.school_id = p_school_id AND a.deleted_at IS NULL),
    'assignments_published', (SELECT count(*)::int FROM public.assignments a WHERE a.school_id = p_school_id AND a.deleted_at IS NULL AND a.is_published IS TRUE),
    'study_materials_total', (SELECT count(*)::int FROM public.study_materials m WHERE m.school_id = p_school_id AND m.deleted_at IS NULL),
    'submissions_rows', (SELECT count(*)::int FROM public.assignment_submissions s WHERE s.school_id = p_school_id),
    'submissions_filed', (SELECT count(*)::int FROM public.assignment_submissions s WHERE s.school_id = p_school_id AND s.status <> 'not_submitted'::public.submission_status),
    'subjects_total', (SELECT count(*)::int FROM public.subjects s WHERE s.school_id = p_school_id),
    'active_enrollments', (SELECT count(*)::int FROM public.enrollments e WHERE e.school_id = p_school_id AND e.status = 'active'),
    'exams_total', (SELECT count(*)::int FROM public.exams x WHERE x.school_id = p_school_id AND x.deleted_at IS NULL),
    'lms_catalog_enrollments_active', (SELECT count(*)::int FROM public.lms_course_enrollments ce WHERE ce.school_id = p_school_id AND ce.status IN ('active', 'completed')),
    'lesson_progress_rows', (SELECT count(*)::int FROM public.lesson_progress lp WHERE lp.school_id = p_school_id),
    'homework_total', (SELECT count(*)::int FROM public.homework_assignments h WHERE h.school_id = p_school_id AND h.deleted_at IS NULL),
    'homework_published', (SELECT count(*)::int FROM public.homework_assignments h WHERE h.school_id = p_school_id AND h.deleted_at IS NULL AND h.is_published IS TRUE),
    'homework_submissions_rows', (SELECT count(*)::int FROM public.homework_submissions hs WHERE hs.school_id = p_school_id),
    'homework_submissions_filed', (SELECT count(*)::int FROM public.homework_submissions hs WHERE hs.school_id = p_school_id AND hs.status <> 'not_submitted'::public.submission_status)
  );
$$;

REVOKE ALL ON FUNCTION public.get_lms_overview_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lms_overview_counts(uuid) TO authenticated;
