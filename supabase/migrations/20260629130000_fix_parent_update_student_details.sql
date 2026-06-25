-- Fix parent/student profile updates: use is_parent_of_student, safer date parsing, reload API schema.

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
BEGIN
  IF p_updates IS NULL OR p_updates = '{}'::JSONB THEN
    RAISE EXCEPTION 'No updates provided';
  END IF;

  SELECT * INTO _st FROM public.students WHERE id = p_student_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF is_super_admin() THEN
    _allow := true;
  ELSIF _st.school_id = get_my_school_id()
    AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('admission_manager')
      OR has_school_role('accountant')
      OR has_school_role('receptionist')
    )
  THEN
    _allow := true;
  ELSIF _st.profile_id = auth.uid() THEN
    _allow := true;
  ELSIF is_parent_of_student(p_student_id) THEN
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
