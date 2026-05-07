-- LMS: modules/chapters, LMS enrollment, lesson progress, quiz assignments, tightened RLS, RPCs.

-- ─── ASSIGNMENTS: quiz fields + optional due date ───────────────────────────
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS assignment_type TEXT NOT NULL DEFAULT 'file'
    CHECK (assignment_type IN ('file', 'quiz', 'mixed')),
  ADD COLUMN IF NOT EXISTS quiz_spec JSONB;

COMMENT ON COLUMN public.assignments.assignment_type IS 'file | quiz | mixed';
COMMENT ON COLUMN public.assignments.quiz_spec IS 'Quiz definition JSON (mcq questions); see app types QuizSpec';

ALTER TABLE public.assignments ALTER COLUMN due_date DROP NOT NULL;

-- ─── COURSE MODULES (chapters) ────────────────────────────────────────────────
CREATE TABLE public.course_modules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  course_id    UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  order_no     INT NOT NULL DEFAULT 0,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_course_modules_school_id ON public.course_modules(school_id);
CREATE INDEX idx_course_modules_course_id ON public.course_modules(course_id);

ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.course_modules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_course_lessons_module_id ON public.course_lessons(module_id);

-- Backfill one default module per course (existing lessons attach to it).
INSERT INTO public.course_modules (school_id, course_id, title, description, order_no)
SELECT c.school_id, c.id, 'General', NULL, 0
FROM public.courses c
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.course_modules cm WHERE cm.course_id = c.id AND cm.deleted_at IS NULL);

UPDATE public.course_lessons cl
SET module_id = cm.id
FROM public.course_modules cm
WHERE cm.course_id = cl.course_id
  AND cm.title = 'General'
  AND cm.deleted_at IS NULL
  AND cl.module_id IS NULL;

-- ─── LMS ENROLLMENTS & LESSON PROGRESS ─────────────────────────────────────
CREATE TABLE public.lms_course_enrollments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id    UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'completed', 'dropped')),
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, course_id)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.lms_course_enrollments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_lms_course_enrollments_school_id ON public.lms_course_enrollments(school_id);
CREATE INDEX idx_lms_course_enrollments_course_id ON public.lms_course_enrollments(course_id);
CREATE INDEX idx_lms_course_enrollments_student_id ON public.lms_course_enrollments(student_id);

CREATE TABLE public.lesson_progress (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  lesson_id    UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, lesson_id)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_lesson_progress_school_id ON public.lesson_progress(school_id);
CREATE INDEX idx_lesson_progress_student_id ON public.lesson_progress(student_id);
CREATE INDEX idx_lesson_progress_lesson_id ON public.lesson_progress(lesson_id);

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- ─── Helper: LMS staff roles (read/write structured content) ─────────────────
-- Policies inline below using OR chains.

-- ─── course_modules RLS ─────────────────────────────────────────────────────
CREATE POLICY "course_modules_select_staff" ON public.course_modules FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      is_platform_admin()
      OR (
        school_id = get_my_school_id()
        AND (
          has_school_role('principal')
          OR has_school_role('vice_principal')
          OR has_school_role('school_admin')
          OR has_school_role('teacher')
          OR has_school_role('class_teacher')
          OR has_school_role('librarian')
        )
      )
    )
  );

CREATE POLICY "course_modules_select_student" ON public.course_modules FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_modules.course_id
        AND c.deleted_at IS NULL
        AND c.is_published = true
        AND c.school_id = get_my_school_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.lms_course_enrollments e
      JOIN public.students st ON st.id = e.student_id AND st.profile_id = auth.uid()
      WHERE e.course_id = course_modules.course_id
        AND e.status IN ('active', 'completed')
    )
  );

CREATE POLICY "course_modules_write" ON public.course_modules FOR ALL
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  );

-- ─── Replace lesson policies ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "lessons_select" ON public.course_lessons;

CREATE POLICY "lessons_select_staff" ON public.course_lessons FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      is_platform_admin()
      OR (
        school_id = get_my_school_id()
        AND (
          has_school_role('principal')
          OR has_school_role('vice_principal')
          OR has_school_role('school_admin')
          OR has_school_role('teacher')
          OR has_school_role('class_teacher')
          OR has_school_role('librarian')
        )
      )
    )
  );

CREATE POLICY "lessons_select_student_enrolled" ON public.course_lessons FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_published = true
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_lessons.course_id
        AND c.deleted_at IS NULL
        AND c.is_published = true
        AND c.school_id = get_my_school_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.lms_course_enrollments e
      JOIN public.students st ON st.id = e.student_id AND st.profile_id = auth.uid()
      WHERE e.course_id = course_lessons.course_id
        AND e.status IN ('active', 'completed')
    )
  );

DROP POLICY IF EXISTS "lessons_write" ON public.course_lessons;

CREATE POLICY "lessons_write" ON public.course_lessons FOR ALL
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  );

-- ─── study_materials: tighten student visibility ───────────────────────────────
DROP POLICY IF EXISTS "study_materials_select" ON public.study_materials;

CREATE POLICY "study_materials_select_staff" ON public.study_materials FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      is_platform_admin()
      OR (
        school_id = get_my_school_id()
        AND (
          has_school_role('principal')
          OR has_school_role('vice_principal')
          OR has_school_role('school_admin')
          OR has_school_role('teacher')
          OR has_school_role('class_teacher')
          OR has_school_role('librarian')
        )
      )
    )
  );

CREATE POLICY "study_materials_select_student" ON public.study_materials FOR SELECT
  USING (
    deleted_at IS NULL
    AND school_id = get_my_school_id()
    AND (
      (
        lesson_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.course_lessons cl
          JOIN public.courses c ON c.id = cl.course_id
          JOIN public.lms_course_enrollments e ON e.course_id = c.id AND e.status IN ('active', 'completed')
          JOIN public.students st ON st.id = e.student_id AND st.profile_id = auth.uid()
          WHERE cl.id = study_materials.lesson_id
            AND cl.deleted_at IS NULL
            AND cl.is_published = true
            AND c.deleted_at IS NULL
            AND c.is_published = true
        )
      )
      OR (
        lesson_id IS NULL
        AND course_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.courses c
          JOIN public.lms_course_enrollments e ON e.course_id = c.id AND e.status IN ('active', 'completed')
          JOIN public.students st ON st.id = e.student_id AND st.profile_id = auth.uid()
          WHERE c.id = study_materials.course_id
            AND c.deleted_at IS NULL
            AND c.is_published = true
        )
      )
    )
  );

DROP POLICY IF EXISTS "study_materials_write" ON public.study_materials;

CREATE POLICY "study_materials_write" ON public.study_materials FOR ALL
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  );

-- ─── assignments_write include principal-level ────────────────────────────────
DROP POLICY IF EXISTS "assignments_write" ON public.assignments;

CREATE POLICY "assignments_write" ON public.assignments FOR ALL
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  );

-- ─── lms_course_enrollments RLS ─────────────────────────────────────────────
CREATE POLICY "lms_enrollments_select_staff" ON public.lms_course_enrollments FOR SELECT
  USING (
    is_platform_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
        OR has_school_role('librarian')
      )
    )
  );

CREATE POLICY "lms_enrollments_select_own_student" ON public.lms_course_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = lms_course_enrollments.student_id
        AND st.profile_id = auth.uid()
    )
  );

CREATE POLICY "lms_enrollments_write_staff" ON public.lms_course_enrollments FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  );

CREATE POLICY "lms_enrollments_update_staff" ON public.lms_course_enrollments FOR UPDATE
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  );

CREATE POLICY "lms_enrollments_delete_staff" ON public.lms_course_enrollments FOR DELETE
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
      )
    )
  );

-- ─── lesson_progress RLS ─────────────────────────────────────────────────────
CREATE POLICY "lesson_progress_select_staff" ON public.lesson_progress FOR SELECT
  USING (
    is_platform_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('teacher')
        OR has_school_role('class_teacher')
      )
    )
  );

CREATE POLICY "lesson_progress_select_own_student" ON public.lesson_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = lesson_progress.student_id
        AND st.profile_id = auth.uid()
    )
  );

CREATE POLICY "lesson_progress_delete_staff" ON public.lesson_progress FOR DELETE
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND (
        has_school_role('principal')
        OR has_school_role('school_admin')
      )
    )
  );

-- ─── RPC: enroll_in_course ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enroll_in_course(p_course_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course public.courses%ROWTYPE;
  v_student_id uuid;
  v_enrollment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_course FROM public.courses c
  WHERE c.id = p_course_id AND c.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  IF NOT v_course.is_published THEN
    RAISE EXCEPTION 'Course is not published';
  END IF;

  SELECT s.id INTO v_student_id
  FROM public.students s
  WHERE s.profile_id = auth.uid()
    AND s.school_id = v_course.school_id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Only enrolled students can join LMS courses';
  END IF;

  IF v_course.section_id IS NULL THEN
    NULL;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.student_id = v_student_id
        AND e.section_id = v_course.section_id
        AND e.academic_year_id = v_course.academic_year_id
        AND e.status = 'active'
        AND e.school_id = v_course.school_id
    ) THEN
      RAISE EXCEPTION 'You are not assigned to this course section';
    END IF;
  END IF;

  INSERT INTO public.lms_course_enrollments (school_id, student_id, course_id, status)
  VALUES (v_course.school_id, v_student_id, v_course.id, 'active')
  ON CONFLICT (student_id, course_id)
  DO UPDATE SET
    status = CASE WHEN lms_course_enrollments.status = 'dropped' THEN 'active' ELSE lms_course_enrollments.status END,
    updated_at = NOW();

  SELECT id INTO v_enrollment_id FROM public.lms_course_enrollments
  WHERE student_id = v_student_id AND course_id = v_course.id;

  RETURN v_enrollment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_in_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_in_course(uuid) TO authenticated;

-- ─── RPC: mark_lesson_complete ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_lesson_complete(p_lesson_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson public.course_lessons%ROWTYPE;
  v_student_id uuid;
  v_course_id uuid;
  v_total int;
  v_done int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_lesson FROM public.course_lessons cl
  WHERE cl.id = p_lesson_id AND cl.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;

  v_course_id := v_lesson.course_id;

  SELECT s.id INTO v_student_id
  FROM public.students s
  WHERE s.profile_id = auth.uid()
    AND s.school_id = v_lesson.school_id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Only students can complete lessons';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lms_course_enrollments e
    WHERE e.student_id = v_student_id
      AND e.course_id = v_course_id
      AND e.status IN ('active', 'completed')
  ) THEN
    RAISE EXCEPTION 'Not enrolled in this course';
  END IF;

  IF NOT v_lesson.is_published THEN
    RAISE EXCEPTION 'Lesson not available';
  END IF;

  INSERT INTO public.lesson_progress (school_id, student_id, lesson_id)
  VALUES (v_lesson.school_id, v_student_id, v_lesson.id)
  ON CONFLICT (student_id, lesson_id) DO UPDATE SET completed_at = NOW(), updated_at = NOW();

  SELECT count(*)::int INTO v_total
  FROM public.course_lessons cl
  WHERE cl.course_id = v_course_id
    AND cl.deleted_at IS NULL
    AND cl.is_published = true;

  SELECT count(*)::int INTO v_done
  FROM public.course_lessons cl
  INNER JOIN public.lesson_progress lp ON lp.lesson_id = cl.id AND lp.student_id = v_student_id
  WHERE cl.course_id = v_course_id
    AND cl.deleted_at IS NULL
    AND cl.is_published = true;

  IF v_total > 0 AND v_done >= v_total THEN
    UPDATE public.lms_course_enrollments
    SET status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
    WHERE student_id = v_student_id
      AND course_id = v_course_id
      AND status = 'active';
  END IF;

  RETURN jsonb_build_object('completed', true, 'lessons_done', v_done, 'lessons_total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_lesson_complete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_lesson_complete(uuid) TO authenticated;

-- ─── RPC: submit_assignment_quiz ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_assignment_quiz(p_assignment_id uuid, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a public.assignments%ROWTYPE;
  v_student_id uuid;
  v_spec jsonb;
  v_questions jsonb;
  q jsonb;
  v_earned numeric := 0;
  v_pts_sum numeric := 0;
  v_qid text;
  v_student_answer int;
  v_correct int;
  v_pts numeric;
  v_late boolean := false;
  v_status submission_status := 'graded';
  v_final_marks numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_a FROM public.assignments a
  WHERE a.id = p_assignment_id AND a.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found';
  END IF;

  IF v_a.assignment_type NOT IN ('quiz', 'mixed') OR v_a.quiz_spec IS NULL THEN
    RAISE EXCEPTION 'Not a quiz assignment';
  END IF;

  IF NOT v_a.is_published THEN
    RAISE EXCEPTION 'Assignment not published';
  END IF;

  SELECT s.id INTO v_student_id
  FROM public.students s
  WHERE s.profile_id = auth.uid()
    AND s.school_id = v_a.school_id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Only students can submit';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lms_course_enrollments e
    WHERE e.student_id = v_student_id
      AND e.course_id = v_a.course_id
      AND e.status IN ('active', 'completed')
  ) THEN
    RAISE EXCEPTION 'Not enrolled in course';
  END IF;

  IF v_a.due_date IS NOT NULL AND NOW() > v_a.due_date THEN
    IF NOT v_a.allow_late THEN
      RAISE EXCEPTION 'Past due date';
    END IF;
    v_late := true;
    v_status := 'late'::submission_status;
  END IF;

  v_spec := v_a.quiz_spec;
  v_questions := v_spec->'questions';
  IF v_questions IS NULL OR jsonb_typeof(v_questions) <> 'array' THEN
    RAISE EXCEPTION 'Invalid quiz_spec';
  END IF;

  FOR q IN SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_qid := q->>'id';
    IF v_qid IS NULL THEN CONTINUE; END IF;
    IF COALESCE(q->>'type', 'mcq') <> 'mcq' THEN CONTINUE; END IF;

    v_pts := COALESCE((q->>'points')::numeric, 1);
    IF v_pts < 0 THEN v_pts := 0; END IF;
    v_pts_sum := v_pts_sum + v_pts;

    v_correct := COALESCE((q->>'correctIndex')::int, -1);
    IF p_answers ? v_qid THEN
      v_student_answer := (p_answers->>v_qid)::int;
    ELSE
      v_student_answer := -999999;
    END IF;

    IF v_student_answer = v_correct THEN
      v_earned := v_earned + v_pts;
    END IF;
  END LOOP;

  IF v_pts_sum <= 0 THEN
    v_final_marks := 0;
  ELSE
    v_final_marks := ROUND(v_earned / v_pts_sum * COALESCE(v_a.max_marks, 100), 2);
  END IF;

  IF v_final_marks > COALESCE(v_a.max_marks, v_final_marks) THEN
    v_final_marks := COALESCE(v_a.max_marks, v_final_marks);
  END IF;

  INSERT INTO public.assignment_submissions (
    school_id,
    assignment_id,
    student_id,
    submitted_at,
    content,
    status,
    marks_obtained
  )
  VALUES (
    v_a.school_id,
    v_a.id,
    v_student_id,
    NOW(),
    p_answers::text,
    v_status,
    v_final_marks
  )
  ON CONFLICT (assignment_id, student_id)
  DO UPDATE SET
    submitted_at = NOW(),
    content = EXCLUDED.content,
    status = EXCLUDED.status,
    marks_obtained = EXCLUDED.marks_obtained,
    feedback = NULL,
    graded_by = NULL,
    graded_at = NOW(),
    updated_at = NOW();

  RETURN jsonb_build_object(
    'marks_obtained', v_final_marks,
    'max_marks', COALESCE(v_a.max_marks, 100),
    'status', v_status::text,
    'late', v_late
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_assignment_quiz(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_assignment_quiz(uuid, jsonb) TO authenticated;

-- ─── Assignments: students only see published work on enrolled courses ─────
DROP POLICY IF EXISTS "assignments_select" ON public.assignments;

CREATE POLICY "assignments_select_staff" ON public.assignments FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      is_platform_admin()
      OR (
        school_id = get_my_school_id()
        AND (
          has_school_role('principal')
          OR has_school_role('vice_principal')
          OR has_school_role('school_admin')
          OR has_school_role('teacher')
          OR has_school_role('class_teacher')
          OR has_school_role('librarian')
        )
      )
    )
  );

CREATE POLICY "assignments_select_student" ON public.assignments FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_published = true
    AND school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM public.lms_course_enrollments e
      JOIN public.students st ON st.id = e.student_id AND st.profile_id = auth.uid()
      WHERE e.course_id = assignments.course_id
        AND e.status IN ('active', 'completed')
    )
  );
