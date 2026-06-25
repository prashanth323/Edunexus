-- Audience-scoped notice visibility for portal roles.

CREATE OR REPLACE FUNCTION public.notice_audiences_for_viewer()
RETURNS notice_audience[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN is_super_admin() OR is_platform_admin() THEN NULL::notice_audience[]
    WHEN has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('admission_manager')
      OR has_school_role('hr_manager')
      OR has_school_role('transport_manager')
      OR has_school_role('accountant')
      OR has_school_role('librarian')
      OR has_school_role('receptionist')
    THEN NULL::notice_audience[]
    WHEN has_school_role('parent') THEN ARRAY['parents']::notice_audience[]
    WHEN has_school_role('student') THEN ARRAY['students']::notice_audience[]
    WHEN has_school_role('teacher') OR has_school_role('class_teacher')
    THEN ARRAY['teachers']::notice_audience[]
    WHEN has_school_role('counselor') THEN ARRAY['parents', 'teachers']::notice_audience[]
    ELSE ARRAY['all']::notice_audience[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.notice_visible_to_viewer(p_audience notice_audience)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    notice_audiences_for_viewer() IS NULL
    OR p_audience = ANY(notice_audiences_for_viewer());
$$;

GRANT EXECUTE ON FUNCTION public.notice_audiences_for_viewer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notice_visible_to_viewer(notice_audience) TO authenticated;

DROP POLICY IF EXISTS "notices_select" ON public.notices;
CREATE POLICY "notices_select" ON public.notices FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      is_platform_admin()
      OR (
        school_id = get_my_school_id()
        AND (
          has_school_role('principal')
          OR has_school_role('school_admin')
          OR has_school_role('vice_principal')
        )
      )
      OR (
        school_id = get_my_school_id()
        AND is_published = true
        AND notice_visible_to_viewer(audience)
      )
    )
  );
