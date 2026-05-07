-- ============================================================
-- EduNexus: Timetable helper views & RPC
-- Migration: 20260507120000
-- ============================================================

-- Fix v_teacher_sections: use timetable_id, remove DISTINCT, add period_no
DROP VIEW IF EXISTS public.v_teacher_sections CASCADE;

CREATE VIEW public.v_teacher_sections AS
SELECT
  sf.profile_id,
  sf.school_id,
  tt.id             AS timetable_id,
  tt.section_id,
  cl.name           AS class_name,
  sec.name          AS section_name,
  sub.name          AS subject_name,
  tt.subject_id,
  tt.day_of_week,
  tt.period_no,
  tt.start_time,
  tt.end_time,
  tt.room_no,
  (SELECT COUNT(*) FROM public.enrollments
   WHERE section_id = tt.section_id AND status = 'active') AS student_count,
  EXISTS(
    SELECT 1 FROM public.attendance a
    WHERE a.section_id = tt.section_id AND a.date = CURRENT_DATE
      AND (a.subject_id = tt.subject_id OR a.subject_id IS NULL)
  ) AS attendance_marked_today
FROM public.staff sf
JOIN public.timetables tt ON tt.staff_id = sf.id
JOIN public.sections sec ON sec.id = tt.section_id
JOIN public.classes cl ON cl.id = sec.class_id
JOIN public.subjects sub ON sub.id = tt.subject_id
WHERE sf.is_active = true
ORDER BY tt.day_of_week, tt.period_no;

-- Full section timetable view (principal editor + teacher view)
CREATE OR REPLACE VIEW public.v_section_timetable AS
SELECT
  tt.id             AS timetable_id,
  tt.school_id,
  tt.section_id,
  sec.name          AS section_name,
  cl.id             AS class_id,
  cl.name           AS class_name,
  cl.numeric_level,
  ay.id             AS academic_year_id,
  ay.name           AS academic_year_name,
  ay.is_current     AS academic_year_is_current,
  sub.id            AS subject_id,
  sub.name          AS subject_name,
  sub.code          AS subject_code,
  tt.staff_id,
  sf.profile_id     AS staff_profile_id,
  p.first_name || ' ' || p.last_name AS teacher_name,
  tt.day_of_week,
  tt.period_no,
  tt.start_time,
  tt.end_time,
  tt.room_no,
  sec.class_teacher_id,
  ct_p.first_name || ' ' || ct_p.last_name AS class_teacher_name
FROM public.timetables tt
JOIN public.sections sec ON sec.id = tt.section_id
JOIN public.classes cl ON cl.id = sec.class_id
JOIN public.academic_years ay ON ay.id = sec.academic_year_id
JOIN public.subjects sub ON sub.id = tt.subject_id
LEFT JOIN public.staff sf ON sf.id = tt.staff_id
LEFT JOIN public.profiles p ON p.id = sf.profile_id
LEFT JOIN public.staff ct_sf ON ct_sf.id = sec.class_teacher_id
LEFT JOIN public.profiles ct_p ON ct_p.id = ct_sf.profile_id
WHERE sec.is_active = true
ORDER BY tt.day_of_week, tt.period_no;

-- Student timetable view
CREATE OR REPLACE VIEW public.v_student_timetable AS
SELECT
  e.student_id,
  st.profile_id     AS student_profile_id,
  tt.id             AS timetable_id,
  tt.school_id,
  tt.section_id,
  sec.name          AS section_name,
  cl.name           AS class_name,
  ay.name           AS academic_year_name,
  sub.id            AS subject_id,
  sub.name          AS subject_name,
  sub.code          AS subject_code,
  tt.staff_id,
  p.first_name || ' ' || p.last_name AS teacher_name,
  tt.day_of_week,
  tt.period_no,
  tt.start_time,
  tt.end_time,
  tt.room_no
FROM public.enrollments e
JOIN public.students st ON st.id = e.student_id
JOIN public.sections sec ON sec.id = e.section_id
JOIN public.classes cl ON cl.id = sec.class_id
JOIN public.academic_years ay ON ay.id = e.academic_year_id
JOIN public.timetables tt ON tt.section_id = e.section_id AND tt.school_id = e.school_id
JOIN public.subjects sub ON sub.id = tt.subject_id
LEFT JOIN public.staff sf ON sf.id = tt.staff_id
LEFT JOIN public.profiles p ON p.id = sf.profile_id
WHERE e.status = 'active'
  AND sec.is_active = true
ORDER BY tt.day_of_week, tt.period_no;

-- RPC: sections with class teacher info for principal
CREATE OR REPLACE FUNCTION public.get_sections_with_class_teachers(p_school_id UUID)
RETURNS TABLE (
  section_id             UUID,
  section_name           TEXT,
  class_id               UUID,
  class_name             TEXT,
  numeric_level          INT,
  academic_year_id       UUID,
  academic_year          TEXT,
  is_current_year        BOOLEAN,
  room_no                TEXT,
  capacity               INT,
  class_teacher_id       UUID,
  class_teacher_name     TEXT,
  class_teacher_staff_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    cl.id,
    cl.name,
    cl.numeric_level,
    ay.id,
    ay.name,
    ay.is_current,
    s.room_no,
    s.capacity,
    s.class_teacher_id,
    (ct_p.first_name || ' ' || ct_p.last_name),
    ct_sf.id
  FROM public.sections s
  JOIN public.classes cl ON cl.id = s.class_id
  JOIN public.academic_years ay ON ay.id = s.academic_year_id
  LEFT JOIN public.staff ct_sf ON ct_sf.id = s.class_teacher_id
  LEFT JOIN public.profiles ct_p ON ct_p.id = ct_sf.profile_id
  WHERE s.school_id = p_school_id AND s.is_active = true
  ORDER BY ay.is_current DESC, cl.numeric_level NULLS LAST, cl.name, s.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_sections_with_class_teachers(UUID) TO authenticated;
