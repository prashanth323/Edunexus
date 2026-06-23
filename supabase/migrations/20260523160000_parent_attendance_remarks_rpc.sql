-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration: Parent Attendance Remarks RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.parent_update_attendance_remarks(
  p_attendance_id UUID,
  p_remarks TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _student_id UUID;
  _is_linked BOOLEAN;
BEGIN
  -- Get the student ID of the attendance row
  SELECT student_id INTO _student_id
  FROM public.attendance
  WHERE id = p_attendance_id;

  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'Attendance record not found';
  END IF;

  -- Verify parent linking to student
  SELECT EXISTS (
    SELECT 1
    FROM public.student_parents sp
    JOIN public.parents p ON sp.parent_id = p.id
    WHERE p.profile_id = auth.uid() AND sp.student_id = _student_id
  ) INTO _is_linked;

  IF NOT _is_linked THEN
    RAISE EXCEPTION 'Unauthorized: You are not linked to this student';
  END IF;

  -- Update attendance remarks
  UPDATE public.attendance
  SET remarks = p_remarks
  WHERE id = p_attendance_id;

  RETURN TRUE;
END;
$$;
