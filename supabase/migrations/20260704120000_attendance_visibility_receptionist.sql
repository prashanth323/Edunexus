-- Attendance visibility snapshot + receptionist late/half-day marking.

-- ─── Receptionist SELECT on attendance ──────────────────────
DROP POLICY IF EXISTS "attendance_select" ON public.attendance;
CREATE POLICY "attendance_select" ON public.attendance FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('teacher')
      OR has_school_role('class_teacher')
      OR has_school_role('receptionist')
    ))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (
      SELECT sp.student_id FROM public.student_parents sp
      JOIN public.parents p ON sp.parent_id = p.id
      WHERE p.profile_id = auth.uid()
    )
  );

-- ─── Class teacher / leadership write (daily attendance) ────
DROP POLICY IF EXISTS "attendance_write" ON public.attendance;
CREATE POLICY "attendance_write" ON public.attendance FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('class_teacher')
      OR has_school_role('school_admin')
      OR has_school_role('principal')
      OR has_school_role('vice_principal')
    ))
  )
  WITH CHECK (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('class_teacher')
      OR has_school_role('school_admin')
      OR has_school_role('principal')
      OR has_school_role('vice_principal')
    ))
    AND subject_id IS NULL
  );

-- ─── Receptionist: late / half_day only ───────────────────────
DROP POLICY IF EXISTS "attendance_write_receptionist" ON public.attendance;
CREATE POLICY "attendance_write_receptionist" ON public.attendance FOR ALL
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND has_school_role('receptionist')
      AND subject_id IS NULL
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND has_school_role('receptionist')
      AND status IN ('late', 'half_day')
      AND subject_id IS NULL
    )
  );

-- ─── Section attendance snapshot ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_section_attendance_snapshot(
  p_school_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  section_id UUID,
  class_name TEXT,
  section_name TEXT,
  student_id UUID,
  roll_no TEXT,
  student_name TEXT,
  status TEXT,
  remarks TEXT,
  marked_by_role TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff_id UUID;
BEGIN
  IF NOT is_super_admin() THEN
    IF p_school_id IS DISTINCT FROM get_my_school_id() THEN
      RAISE EXCEPTION 'School mismatch';
    END IF;
    IF NOT (
      has_school_role('vice_principal')
      OR has_school_role('principal')
      OR has_school_role('class_teacher')
      OR has_school_role('receptionist')
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  END IF;

  SELECT s.id INTO _staff_id
  FROM public.staff s
  WHERE s.profile_id = auth.uid() AND s.school_id = p_school_id
  LIMIT 1;

  RETURN QUERY
  SELECT
    sec.id,
    c.name::TEXT,
    sec.name::TEXT,
    st.id,
    e.roll_no::TEXT,
    TRIM(COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, ''))::TEXT,
    a.status::TEXT,
    a.remarks,
    (
      SELECT ur.role::TEXT
      FROM public.user_roles ur
      WHERE ur.user_id = a.marked_by
        AND ur.school_id = p_school_id
        AND ur.is_active = true
      ORDER BY ur.role::TEXT
      LIMIT 1
    ) AS marked_by_role
  FROM public.enrollments e
  JOIN public.sections sec ON sec.id = e.section_id
  JOIN public.classes c ON c.id = sec.class_id
  JOIN public.students st ON st.id = e.student_id
  JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true
  LEFT JOIN public.attendance a
    ON a.student_id = e.student_id
    AND a.date = p_date
    AND a.subject_id IS NULL
    AND a.school_id = p_school_id
  WHERE e.school_id = p_school_id
    AND e.status = 'active'
    AND (
      is_super_admin()
      OR has_school_role('vice_principal')
      OR has_school_role('principal')
      OR has_school_role('receptionist')
      OR (
        has_school_role('class_teacher')
        AND _staff_id IS NOT NULL
        AND sec.class_teacher_id = _staff_id
      )
    )
  ORDER BY c.name, sec.name, e.roll_no NULLS LAST, st.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_section_attendance_snapshot(UUID, DATE) TO authenticated;
