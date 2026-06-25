-- Class teacher student edit: is_class_teacher_of_student + restrict update_linked_student_details.

CREATE OR REPLACE FUNCTION public.is_class_teacher_of_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true
    JOIN public.sections sec ON sec.id = e.section_id
    WHERE e.student_id = p_student_id
      AND e.status = 'active'
      AND sec.class_teacher_id = public.my_staff_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_class_teacher_of_student(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_edit_student_details(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed BOOLEAN := false;
BEGIN
  IF is_super_admin() THEN
    _allowed := true;
  ELSIF has_school_role('vice_principal')
    AND EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = p_student_id AND st.deleted_at IS NULL AND st.school_id = get_my_school_id()
    )
  THEN
    _allowed := true;
  ELSIF is_class_teacher_of_student(p_student_id) THEN
    _allowed := true;
  END IF;

  RETURN jsonb_build_object('allowed', _allowed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_edit_student_details(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.update_linked_student_details(UUID, JSONB);

CREATE OR REPLACE FUNCTION public.update_linked_student_details(
  p_student_id UUID,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _st public.students%ROWTYPE;
  _allow BOOLEAN := false;
  _dob DATE;
  _forbidden TEXT[] := ARRAY['admission_no', 'school_id', 'profile_id', 'transport_mode'];
  _key TEXT;
BEGIN
  IF p_updates IS NULL OR p_updates = '{}'::JSONB THEN
    RAISE EXCEPTION 'No updates provided';
  END IF;

  FOREACH _key IN ARRAY _forbidden LOOP
    IF p_updates ? _key THEN
      RAISE EXCEPTION 'Field % cannot be updated through this endpoint', _key;
    END IF;
  END LOOP;

  IF is_parent_of_student(p_student_id) THEN
    RAISE EXCEPTION 'Parents may only update service preferences (hostel / bus / self)';
  END IF;

  SELECT * INTO _st FROM public.students WHERE id = p_student_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF _st.profile_id = auth.uid() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Students cannot edit profile details; contact your class teacher';
  END IF;

  IF is_super_admin() THEN
    _allow := true;
  ELSIF has_school_role('vice_principal') AND _st.school_id = get_my_school_id() THEN
    _allow := true;
  ELSIF is_class_teacher_of_student(p_student_id) THEN
    _allow := true;
  END IF;

  IF NOT _allow THEN
    RAISE EXCEPTION 'Not authorized to update this student';
  END IF;

  IF p_updates ? 'date_of_birth' THEN
    BEGIN
      _dob := NULLIF(left(p_updates->>'date_of_birth', 10), '')::DATE;
    EXCEPTION WHEN OTHERS THEN
      _dob := NULL;
    END;
  END IF;

  UPDATE public.students SET
    first_name = CASE
      WHEN p_updates ? 'first_name' AND NULLIF(trim(p_updates->>'first_name'), '') IS NOT NULL
      THEN trim(p_updates->>'first_name')
      ELSE first_name
    END,
    last_name = CASE
      WHEN p_updates ? 'last_name' AND NULLIF(trim(p_updates->>'last_name'), '') IS NOT NULL
      THEN trim(p_updates->>'last_name')
      ELSE last_name
    END,
    gender = CASE
      WHEN p_updates ? 'gender' THEN NULLIF(p_updates->>'gender', '')::gender_type
      ELSE gender
    END,
    date_of_birth = CASE
      WHEN p_updates ? 'date_of_birth' THEN _dob
      ELSE date_of_birth
    END,
    blood_group = CASE
      WHEN p_updates ? 'blood_group' THEN NULLIF(p_updates->>'blood_group', '')
      ELSE blood_group
    END,
    nationality = CASE
      WHEN p_updates ? 'nationality' THEN NULLIF(p_updates->>'nationality', '')
      ELSE nationality
    END,
    religion = CASE
      WHEN p_updates ? 'religion' THEN NULLIF(p_updates->>'religion', '')
      ELSE religion
    END,
    category = CASE
      WHEN p_updates ? 'category' THEN NULLIF(p_updates->>'category', '')
      ELSE category
    END,
    phone = CASE
      WHEN p_updates ? 'phone' THEN NULLIF(p_updates->>'phone', '')
      ELSE phone
    END,
    email = CASE
      WHEN p_updates ? 'email' THEN NULLIF(p_updates->>'email', '')
      ELSE email
    END,
    address = CASE
      WHEN p_updates ? 'address' AND jsonb_typeof(p_updates->'address') = 'object'
      THEN p_updates->'address'
      ELSE address
    END,
    medical_info = CASE
      WHEN p_updates ? 'medical_info' AND jsonb_typeof(p_updates->'medical_info') = 'object'
      THEN p_updates->'medical_info'
      ELSE medical_info
    END,
    updated_at = NOW()
  WHERE id = p_student_id
  RETURNING * INTO _st;

  RETURN jsonb_build_object(
    'student_id', _st.id,
    'first_name', _st.first_name,
    'last_name', _st.last_name,
    'phone', _st.phone,
    'email', _st.email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_linked_student_details(UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
