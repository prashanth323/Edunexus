-- Align RPC with client "active school" (profiles.school_id is not updated when users switch schools in the UI).

DROP FUNCTION IF EXISTS public.set_my_primary_teaching_subject(uuid);

CREATE OR REPLACE FUNCTION public.set_my_primary_teaching_subject(p_school_id uuid, p_subject_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff uuid;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'School is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.school_id = p_school_id
      AND ur.is_active = true
      AND ur.role IN (
        'teacher'::public.school_role,
        'class_teacher'::public.school_role,
        'librarian'::public.school_role
      )
  ) THEN
    RAISE EXCEPTION 'Your role cannot set a primary teaching subject for this school';
  END IF;

  SELECT id INTO v_staff
  FROM public.staff
  WHERE school_id = p_school_id
    AND profile_id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_staff IS NULL THEN
    RAISE EXCEPTION 'No staff record linked to your profile for this school';
  END IF;

  IF p_subject_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = p_subject_id
        AND s.school_id = p_school_id
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

REVOKE ALL ON FUNCTION public.set_my_primary_teaching_subject(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_primary_teaching_subject(uuid, uuid) TO authenticated;
