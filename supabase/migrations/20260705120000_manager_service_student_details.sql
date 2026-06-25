-- Hostel managers: read service-assigned student details (adm no, name, class).

-- Hostel residents snapshot for managers (bypasses students RLS on nested embeds)
CREATE OR REPLACE FUNCTION public.get_hostel_residents(p_school_id UUID)
RETURNS TABLE (
  allocation_id UUID,
  student_id UUID,
  admission_no TEXT,
  student_name TEXT,
  class_name TEXT,
  section_name TEXT,
  room_no TEXT,
  block TEXT,
  resident_status TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ha.id,
    s.id,
    s.admission_no,
    TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')),
    c.name,
    sec.name,
    hr.room_no,
    hr.block,
    ha.resident_status,
    ha.updated_at
  FROM public.hostel_allocations ha
  JOIN public.students s ON s.id = ha.student_id
  LEFT JOIN public.hostel_rooms hr ON hr.id = ha.room_id
  LEFT JOIN LATERAL (
    SELECT e.section_id
    FROM public.enrollments e
    JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true
    WHERE e.student_id = s.id AND e.status = 'active'
    ORDER BY e.created_at DESC
    LIMIT 1
  ) enr ON true
  LEFT JOIN public.sections sec ON sec.id = enr.section_id
  LEFT JOIN public.classes c ON c.id = sec.class_id
  WHERE ha.school_id = p_school_id
    AND ha.is_active = true
    AND (
      is_super_admin()
      OR (
        p_school_id = get_my_school_id()
        AND (
          has_school_role('hostel_manager')
          OR has_school_role('vice_principal')
          OR has_school_role('principal')
          OR has_school_role('school_admin')
        )
      )
    )
  ORDER BY ha.updated_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_hostel_residents(UUID) TO authenticated;

-- Allow managers to read student rows for their school (directory lookups)
DROP POLICY IF EXISTS "students_select" ON public.students;
CREATE POLICY "students_select" ON public.students FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('teacher') OR has_school_role('class_teacher')
      OR has_school_role('accountant') OR has_school_role('head_accountant')
      OR has_school_role('admission_manager')
      OR has_school_role('receptionist')
      OR has_school_role('transport_manager')
      OR has_school_role('hostel_manager')
    ))
    OR profile_id = auth.uid()
    OR id IN (
      SELECT sp.student_id FROM public.student_parents sp
      JOIN public.parents p ON sp.parent_id = p.id
      WHERE p.profile_id = auth.uid()
    )
  );
