-- VP staff edit, class overview, class teacher visibility, hostel/transport queues.

-- ─── students.transport_mode ───────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS transport_mode TEXT NOT NULL DEFAULT 'self'
    CHECK (transport_mode IN ('self', 'school_bus', 'hostel'));

-- ─── staff_write: include VP ─────────────────────────────────
DROP POLICY IF EXISTS "staff_write" ON public.staff;
CREATE POLICY "staff_write" ON public.staff FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('hr_manager')
    ))
  );

-- ─── Admin staff profile update ──────────────────────────────
CREATE OR REPLACE FUNCTION public.update_staff_profile_by_admin(
  p_staff_id UUID,
  p_profile JSONB DEFAULT '{}',
  p_staff JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff public.staff%ROWTYPE;
  _profile_id UUID;
BEGIN
  IF NOT is_super_admin()
    AND NOT (
      has_school_role('vice_principal')
      OR has_school_role('principal')
      OR has_school_role('hr_manager')
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized to edit staff profiles';
  END IF;

  SELECT * INTO _staff FROM public.staff WHERE id = p_staff_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff not found'; END IF;

  IF _staff.school_id IS DISTINCT FROM get_my_school_id() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Staff does not belong to your school';
  END IF;

  _profile_id := _staff.profile_id;

  IF _profile_id IS NOT NULL AND p_profile <> '{}'::JSONB THEN
    UPDATE public.profiles SET
      first_name = COALESCE(NULLIF(trim(p_profile->>'first_name'), ''), first_name),
      last_name = COALESCE(NULLIF(trim(p_profile->>'last_name'), ''), last_name),
      phone = CASE WHEN p_profile ? 'phone' THEN NULLIF(trim(p_profile->>'phone'), '') ELSE phone END,
      gender = CASE WHEN p_profile ? 'gender' THEN NULLIF(p_profile->>'gender', '')::gender_type ELSE gender END,
      date_of_birth = CASE WHEN p_profile ? 'date_of_birth' THEN NULLIF(p_profile->>'date_of_birth', '')::DATE ELSE date_of_birth END,
      updated_at = NOW()
    WHERE id = _profile_id;
  END IF;

  IF p_staff <> '{}'::JSONB THEN
    UPDATE public.staff SET
      designation = COALESCE(NULLIF(trim(p_staff->>'designation'), ''), designation),
      department_id = CASE
        WHEN p_staff ? 'department_id' THEN NULLIF(p_staff->>'department_id', '')::UUID
        ELSE department_id
      END,
      joining_date = CASE
        WHEN p_staff ? 'joining_date' THEN NULLIF(p_staff->>'joining_date', '')::DATE
        ELSE joining_date
      END,
      employment_type = COALESCE(NULLIF(p_staff->>'employment_type', ''), employment_type),
      experience_years = CASE
        WHEN p_staff ? 'experience_years' THEN (p_staff->>'experience_years')::INT
        ELSE experience_years
      END,
      specialization = CASE WHEN p_staff ? 'specialization' THEN NULLIF(p_staff->>'specialization', '') ELSE specialization END,
      biography = CASE WHEN p_staff ? 'biography' THEN NULLIF(p_staff->>'biography', '') ELSE biography END,
      is_active = CASE WHEN p_staff ? 'is_active' THEN (p_staff->>'is_active')::BOOLEAN ELSE is_active END,
      updated_at = NOW()
    WHERE id = p_staff_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_staff_profile_by_admin(UUID, JSONB, JSONB) TO authenticated;

-- ─── Assign class teacher + optional role sync ─────────────────
CREATE OR REPLACE FUNCTION public.assign_class_teacher(
  p_section_id UUID,
  p_staff_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sec public.sections%ROWTYPE;
  _profile_id UUID;
BEGIN
  IF NOT is_super_admin()
    AND NOT (
      has_school_role('vice_principal')
      OR has_school_role('principal')
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized to assign class teacher';
  END IF;

  SELECT * INTO _sec FROM public.sections WHERE id = p_section_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Section not found'; END IF;

  IF _sec.school_id IS DISTINCT FROM get_my_school_id() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Section does not belong to your school';
  END IF;

  UPDATE public.sections
  SET class_teacher_id = p_staff_id, updated_at = NOW()
  WHERE id = p_section_id;

  IF p_staff_id IS NOT NULL THEN
    SELECT profile_id INTO _profile_id FROM public.staff WHERE id = p_staff_id;
    IF _profile_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, school_id, role, is_active, granted_by)
      VALUES (_profile_id, _sec.school_id, 'class_teacher', true, auth.uid())
      ON CONFLICT (user_id, school_id, role) DO UPDATE
        SET is_active = true, granted_at = NOW();
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_class_teacher(UUID, UUID) TO authenticated;

-- ─── Class section overview for VP ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_class_section_overview(p_school_id UUID)
RETURNS TABLE (
  section_id UUID,
  class_id UUID,
  class_name TEXT,
  section_name TEXT,
  class_teacher_id UUID,
  class_teacher_name TEXT,
  class_teacher_phone TEXT,
  student_count BIGINT,
  attendance_pct NUMERIC,
  avg_exam_pct NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sec.id AS section_id,
    cl.id AS class_id,
    cl.name AS class_name,
    sec.name AS section_name,
    sec.class_teacher_id,
    trim(COALESCE(ct_p.first_name, '') || ' ' || COALESCE(ct_p.last_name, '')) AS class_teacher_name,
    ct_p.phone AS class_teacher_phone,
    (
      SELECT COUNT(*)::BIGINT FROM public.enrollments e
      WHERE e.section_id = sec.id AND e.status = 'active'
    ) AS student_count,
    COALESCE((
      SELECT ROUND(
        COUNT(*) FILTER (WHERE a.status = 'present') * 100.0 / NULLIF(COUNT(*), 0),
        1
      )
      FROM public.attendance a
      WHERE a.section_id = sec.id
        AND a.date >= DATE_TRUNC('month', CURRENT_DATE)::DATE
    ), 0) AS attendance_pct,
    COALESCE((
      SELECT ROUND(AVG(
        CASE WHEN ex.max_marks > 0 AND NOT er.is_absent
          THEN er.marks_obtained * 100.0 / ex.max_marks
          ELSE NULL
        END
      ), 1)
      FROM public.enrollments e
      JOIN public.exam_results er ON er.student_id = e.student_id AND er.school_id = p_school_id
      JOIN public.exams ex ON ex.id = er.exam_id AND ex.is_published = true AND ex.deleted_at IS NULL
      WHERE e.section_id = sec.id AND e.status = 'active'
    ), 0) AS avg_exam_pct
  FROM public.sections sec
  JOIN public.classes cl ON cl.id = sec.class_id
  JOIN public.academic_years ay ON ay.id = sec.academic_year_id AND ay.is_current = true
  LEFT JOIN public.staff ct_sf ON ct_sf.id = sec.class_teacher_id
  LEFT JOIN public.profiles ct_p ON ct_p.id = ct_sf.profile_id
  WHERE sec.school_id = p_school_id AND sec.is_active = true
  ORDER BY cl.numeric_level NULLS LAST, cl.name, sec.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_section_overview(UUID) TO authenticated;

-- ─── Student class teacher (student portal) ────────────────────
CREATE OR REPLACE FUNCTION public.get_student_class_teacher(p_student_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'class_teacher_staff_id', ct_sf.id,
    'class_teacher_name', NULLIF(trim(COALESCE(ct_p.first_name, '') || ' ' || COALESCE(ct_p.last_name, '')), ''),
    'class_teacher_phone', ct_p.phone,
    'class_teacher_email', ct_p.email
  )
  FROM public.students st
  JOIN public.enrollments e ON e.student_id = st.id AND e.status = 'active'
  JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true
  JOIN public.sections sec ON sec.id = e.section_id
  LEFT JOIN public.staff ct_sf ON ct_sf.id = sec.class_teacher_id
  LEFT JOIN public.profiles ct_p ON ct_p.id = ct_sf.profile_id
  WHERE st.id = p_student_id
    AND st.deleted_at IS NULL
    AND (
      st.profile_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.student_parents sp
        JOIN public.parents par ON par.id = sp.parent_id
        WHERE sp.student_id = st.id AND par.profile_id = auth.uid()
      )
      OR is_super_admin()
      OR st.school_id = get_my_school_id()
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_class_teacher(UUID) TO authenticated;

-- ─── Update student service preference (hostel / bus / self) ───
CREATE OR REPLACE FUNCTION public.update_student_service_preference(
  p_student_id UUID,
  p_transport_mode TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _st public.students%ROWTYPE;
BEGIN
  IF p_transport_mode NOT IN ('self', 'school_bus', 'hostel') THEN
    RAISE EXCEPTION 'Invalid transport mode';
  END IF;

  SELECT * INTO _st FROM public.students WHERE id = p_student_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;

  IF NOT is_super_admin()
    AND NOT (
      has_school_role('vice_principal')
      OR has_school_role('principal')
      OR has_school_role('school_admin')
      OR has_school_role('receptionist')
    )
    AND _st.profile_id IS DISTINCT FROM auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.student_parents sp
      JOIN public.parents par ON par.id = sp.parent_id
      WHERE sp.student_id = p_student_id AND par.profile_id = auth.uid()
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.students
  SET transport_mode = p_transport_mode, updated_at = NOW()
  WHERE id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_student_service_preference(UUID, TEXT) TO authenticated;

-- ─── Pending hostel / transport views ──────────────────────────
CREATE OR REPLACE VIEW public.v_students_pending_hostel AS
SELECT
  st.id AS student_id,
  st.school_id,
  st.admission_no,
  st.first_name,
  st.last_name,
  st.transport_mode,
  cl.name AS class_name,
  sec.name AS section_name,
  par.phone AS parent_phone,
  par.email AS parent_email
FROM public.students st
LEFT JOIN public.enrollments e ON e.student_id = st.id AND e.status = 'active'
LEFT JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true
LEFT JOIN public.sections sec ON sec.id = e.section_id
LEFT JOIN public.classes cl ON cl.id = sec.class_id
LEFT JOIN public.student_parents sp ON sp.student_id = st.id AND sp.is_primary = true
LEFT JOIN public.parents par ON par.id = sp.parent_id
WHERE st.is_active = true
  AND st.deleted_at IS NULL
  AND st.transport_mode = 'hostel'
  AND NOT EXISTS (
    SELECT 1 FROM public.hostel_allocations ha
    JOIN public.academic_years ay2 ON ay2.id = ha.academic_year_id AND ay2.is_current = true
    WHERE ha.student_id = st.id AND ha.is_active = true
  );

CREATE OR REPLACE VIEW public.v_students_pending_transport AS
SELECT
  st.id AS student_id,
  st.school_id,
  st.admission_no,
  st.first_name,
  st.last_name,
  st.transport_mode,
  cl.name AS class_name,
  sec.name AS section_name,
  par.phone AS parent_phone,
  par.email AS parent_email
FROM public.students st
LEFT JOIN public.enrollments e ON e.student_id = st.id AND e.status = 'active'
LEFT JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true
LEFT JOIN public.sections sec ON sec.id = e.section_id
LEFT JOIN public.classes cl ON cl.id = sec.class_id
LEFT JOIN public.student_parents sp ON sp.student_id = st.id AND sp.is_primary = true
LEFT JOIN public.parents par ON par.id = sp.parent_id
WHERE st.is_active = true
  AND st.deleted_at IS NULL
  AND st.transport_mode = 'school_bus'
  AND NOT EXISTS (
    SELECT 1 FROM public.route_students rs
    JOIN public.academic_years ay2 ON ay2.id = rs.academic_year_id AND ay2.is_current = true
    WHERE rs.student_id = st.id AND rs.is_active = true
  );

-- ─── Extend v_parent_children with class teacher ───────────────
DROP VIEW IF EXISTS public.v_parent_children;
CREATE VIEW public.v_parent_children AS
SELECT
  p.id          AS parent_id,
  p.profile_id,
  p.school_id,
  sp.relation,
  st.id         AS student_id,
  st.first_name,
  st.last_name,
  st.first_name || ' ' || st.last_name AS student_name,
  st.admission_no,
  st.gender,
  st.date_of_birth,
  st.blood_group,
  st.nationality,
  st.religion,
  st.category,
  st.phone,
  st.email,
  st.address,
  st.medical_info,
  st.transport_mode,
  e.section_id,
  cl.name       AS class_name,
  sec.name      AS section_name,
  ay.name       AS academic_year,
  ct_sf.id      AS class_teacher_staff_id,
  NULLIF(trim(COALESCE(ct_p.first_name, '') || ' ' || COALESCE(ct_p.last_name, '')), '') AS class_teacher_name,
  ct_p.phone    AS class_teacher_phone,
  ct_p.email    AS class_teacher_email,
  ROUND(
    (SELECT COUNT(*) FILTER (WHERE a.status = 'present') * 100.0 / NULLIF(COUNT(*), 0)
     FROM public.attendance a
     WHERE a.student_id = st.id
       AND a.date >= DATE_TRUNC('month', NOW())),
    2
  )             AS attendance_pct_this_month,
  (SELECT COALESCE(SUM(due_amount), 0) FROM public.student_invoices
   WHERE student_id = st.id AND status IN ('pending', 'partial', 'overdue') AND deleted_at IS NULL)
                AS pending_fees,
  st.photo_url
FROM public.parents p
JOIN public.student_parents sp ON sp.parent_id = p.id
JOIN public.students st ON st.id = sp.student_id AND st.is_active = true
LEFT JOIN public.enrollments e ON e.student_id = st.id AND e.status = 'active'
LEFT JOIN public.sections sec ON sec.id = e.section_id
LEFT JOIN public.classes cl ON cl.id = sec.class_id
LEFT JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true
LEFT JOIN public.staff ct_sf ON ct_sf.id = sec.class_teacher_id
LEFT JOIN public.profiles ct_p ON ct_p.id = ct_sf.profile_id;
