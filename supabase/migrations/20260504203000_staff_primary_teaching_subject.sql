-- Primary teaching subject per staff row (school-scoped). Teachers set this in Settings;
-- LMS course creation can default the subject dropdown to this value.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS primary_subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_staff_primary_subject_id ON public.staff(primary_subject_id)
  WHERE primary_subject_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.staff.primary_subject_id IS 'Optional default subject for LMS / teaching context; staff may update via set_my_primary_teaching_subject only.';

CREATE OR REPLACE FUNCTION public.set_my_primary_teaching_subject(p_subject_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid;
  v_staff uuid;
BEGIN
  v_school := get_my_school_id();
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'No active school on profile';
  END IF;

  IF NOT (
    has_school_role('teacher')
    OR has_school_role('class_teacher')
    OR has_school_role('librarian')
  ) THEN
    RAISE EXCEPTION 'Your role cannot set a primary teaching subject';
  END IF;

  SELECT id INTO v_staff
  FROM public.staff
  WHERE school_id = v_school
    AND profile_id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_staff IS NULL THEN
    RAISE EXCEPTION 'No staff record for this school';
  END IF;

  IF p_subject_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = p_subject_id
        AND s.school_id = v_school
        AND s.is_active = true
    ) THEN
      RAISE EXCEPTION 'Subject not found or inactive for this school';
    END IF;
  END IF;

  UPDATE public.staff
  SET primary_subject_id = p_subject_id,
      updated_at = now()
  WHERE id = v_staff;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_primary_teaching_subject(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_primary_teaching_subject(uuid) TO authenticated;
