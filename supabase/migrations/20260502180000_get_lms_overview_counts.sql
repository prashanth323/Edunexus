-- One round-trip LMS metrics for principal dashboard (RLS applies via SECURITY INVOKER).
CREATE OR REPLACE FUNCTION public.get_lms_overview_counts(p_school_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'courses_total', (SELECT count(*)::int FROM public.courses c WHERE c.school_id = p_school_id AND c.deleted_at IS NULL),
    'courses_published', (SELECT count(*)::int FROM public.courses c WHERE c.school_id = p_school_id AND c.deleted_at IS NULL AND c.is_published = true),
    'lessons_total', (SELECT count(*)::int FROM public.course_lessons l WHERE l.school_id = p_school_id AND l.deleted_at IS NULL),
    'assignments_total', (SELECT count(*)::int FROM public.assignments a WHERE a.school_id = p_school_id AND a.deleted_at IS NULL),
    'assignments_published', (SELECT count(*)::int FROM public.assignments a WHERE a.school_id = p_school_id AND a.deleted_at IS NULL AND a.is_published = true),
    'study_materials_total', (SELECT count(*)::int FROM public.study_materials m WHERE m.school_id = p_school_id AND m.deleted_at IS NULL),
    'submissions_rows', (SELECT count(*)::int FROM public.assignment_submissions s WHERE s.school_id = p_school_id),
    'submissions_filed', (SELECT count(*)::int FROM public.assignment_submissions s WHERE s.school_id = p_school_id AND s.status <> 'not_submitted'::submission_status),
    'subjects_total', (SELECT count(*)::int FROM public.subjects s WHERE s.school_id = p_school_id),
    'active_enrollments', (SELECT count(*)::int FROM public.enrollments e WHERE e.school_id = p_school_id AND e.status = 'active'),
    'exams_total', (SELECT count(*)::int FROM public.exams x WHERE x.school_id = p_school_id AND x.deleted_at IS NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.get_lms_overview_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lms_overview_counts(uuid) TO authenticated;
