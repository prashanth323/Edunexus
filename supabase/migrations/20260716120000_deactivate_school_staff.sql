-- VP/admin staff deactivation with principal guard.

CREATE OR REPLACE FUNCTION public.deactivate_school_staff(p_staff_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff public.staff%ROWTYPE;
BEGIN
  IF NOT is_super_admin()
    AND NOT (
      has_school_role('vice_principal')
      OR has_school_role('principal')
      OR has_school_role('hr_manager')
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized to deactivate staff';
  END IF;

  SELECT * INTO _staff FROM public.staff WHERE id = p_staff_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff not found'; END IF;

  IF _staff.school_id IS DISTINCT FROM get_my_school_id() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Staff does not belong to your school';
  END IF;

  IF _staff.profile_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot deactivate your own account';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _staff.profile_id
      AND ur.school_id = _staff.school_id
      AND ur.role = 'principal'
      AND ur.is_active = true
  ) THEN
    RAISE EXCEPTION 'Cannot deactivate the principal';
  END IF;

  UPDATE public.staff
  SET is_active = false, updated_at = NOW()
  WHERE id = p_staff_id;

  UPDATE public.user_roles
  SET is_active = false
  WHERE user_id = _staff.profile_id
    AND school_id = _staff.school_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deactivate_school_staff(UUID) TO authenticated;
