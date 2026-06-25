-- VP teaching role management: subject teacher / class teacher / both.
-- Sync assign_class_teacher to deactivate class_teacher role when unassigned from all sections.

CREATE OR REPLACE FUNCTION public.set_staff_teaching_roles(
  p_staff_id UUID,
  p_subject_teacher BOOLEAN,
  p_class_teacher BOOLEAN
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
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized to set teaching roles';
  END IF;

  SELECT * INTO _staff FROM public.staff WHERE id = p_staff_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff not found';
  END IF;

  IF _staff.school_id IS DISTINCT FROM get_my_school_id() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Staff does not belong to your school';
  END IF;

  _profile_id := _staff.profile_id;
  IF _profile_id IS NULL THEN
    RAISE EXCEPTION 'Staff member has no login profile; invite them first';
  END IF;

  IF p_subject_teacher THEN
    INSERT INTO public.user_roles (user_id, school_id, role, is_active, granted_by)
    VALUES (_profile_id, _staff.school_id, 'teacher', true, auth.uid())
    ON CONFLICT (user_id, school_id, role) DO UPDATE
      SET is_active = true, granted_at = NOW(), updated_at = NOW();
  ELSE
    UPDATE public.user_roles
    SET is_active = false, updated_at = NOW()
    WHERE user_id = _profile_id
      AND school_id = _staff.school_id
      AND role = 'teacher';
  END IF;

  IF p_class_teacher THEN
    INSERT INTO public.user_roles (user_id, school_id, role, is_active, granted_by)
    VALUES (_profile_id, _staff.school_id, 'class_teacher', true, auth.uid())
    ON CONFLICT (user_id, school_id, role) DO UPDATE
      SET is_active = true, granted_at = NOW(), updated_at = NOW();
  ELSE
    UPDATE public.user_roles
    SET is_active = false, updated_at = NOW()
    WHERE user_id = _profile_id
      AND school_id = _staff.school_id
      AND role = 'class_teacher';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_staff_teaching_roles(UUID, BOOLEAN, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_staff_teaching_roles(p_staff_id UUID)
RETURNS TABLE (
  subject_teacher BOOLEAN,
  class_teacher BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff public.staff%ROWTYPE;
  _profile_id UUID;
BEGIN
  SELECT * INTO _staff FROM public.staff WHERE id = p_staff_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff not found';
  END IF;

  IF _staff.school_id IS DISTINCT FROM get_my_school_id() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Staff does not belong to your school';
  END IF;

  _profile_id := _staff.profile_id;

  RETURN QUERY
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _profile_id
        AND ur.school_id = _staff.school_id
        AND ur.role = 'teacher'
        AND ur.is_active = true
    ),
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _profile_id
        AND ur.school_id = _staff.school_id
        AND ur.role = 'class_teacher'
        AND ur.is_active = true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_teaching_roles(UUID) TO authenticated;

-- Deactivate class_teacher role when staff is removed from their last homeroom section.
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
  _prev_staff_id UUID;
  _prev_profile_id UUID;
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

  _prev_staff_id := _sec.class_teacher_id;

  UPDATE public.sections
  SET class_teacher_id = p_staff_id, updated_at = NOW()
  WHERE id = p_section_id;

  IF p_staff_id IS NOT NULL THEN
    SELECT profile_id INTO _profile_id FROM public.staff WHERE id = p_staff_id;
    IF _profile_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, school_id, role, is_active, granted_by)
      VALUES (_profile_id, _sec.school_id, 'class_teacher', true, auth.uid())
      ON CONFLICT (user_id, school_id, role) DO UPDATE
        SET is_active = true, granted_at = NOW(), updated_at = NOW();
    END IF;
  END IF;

  IF _prev_staff_id IS NOT NULL AND _prev_staff_id IS DISTINCT FROM p_staff_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sections s
      WHERE s.class_teacher_id = _prev_staff_id
        AND s.school_id = _sec.school_id
    ) THEN
      SELECT profile_id INTO _prev_profile_id FROM public.staff WHERE id = _prev_staff_id;
      IF _prev_profile_id IS NOT NULL THEN
        UPDATE public.user_roles
        SET is_active = false, updated_at = NOW()
        WHERE user_id = _prev_profile_id
          AND school_id = _sec.school_id
          AND role = 'class_teacher';
      END IF;
    END IF;
  END IF;
END;
$$;
