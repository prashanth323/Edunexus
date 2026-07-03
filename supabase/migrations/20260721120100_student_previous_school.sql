-- Structured previous-school details on students + copy from admission on approval.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS previous_school_name TEXT,
  ADD COLUMN IF NOT EXISTS previous_school_board TEXT,
  ADD COLUMN IF NOT EXISTS previous_class_or_year TEXT,
  ADD COLUMN IF NOT EXISTS previous_school_city TEXT;

-- Copy previous-school fields from application form_data to student record.
CREATE OR REPLACE FUNCTION public.copy_application_previous_school_to_student(
  p_application_id UUID,
  p_student_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _app public.applications%ROWTYPE;
  _student_id UUID;
  _fd JSONB;
  _name TEXT;
  _board TEXT;
  _class_year TEXT;
  _city TEXT;
BEGIN
  SELECT * INTO _app
  FROM public.applications
  WHERE id = p_application_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  _student_id := p_student_id;
  IF _student_id IS NULL THEN
    SELECT a.student_id INTO _student_id
    FROM public.admissions a
    WHERE a.application_id = p_application_id;
  END IF;

  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'Student not linked to application';
  END IF;

  IF NOT is_super_admin() AND _app.school_id IS DISTINCT FROM get_my_school_id() THEN
    RAISE EXCEPTION 'Application does not belong to your school';
  END IF;

  _fd := COALESCE(_app.form_data, '{}'::JSONB);

  _name := NULLIF(trim(COALESCE(
    _fd->>'previous_school_name',
    _fd->>'previous_school',
    ''
  )), '');

  _board := NULLIF(trim(COALESCE(_fd->>'previous_school_board', '')), '');
  _class_year := NULLIF(trim(COALESCE(_fd->>'previous_class_or_year', '')), '');
  _city := NULLIF(trim(COALESCE(_fd->>'previous_school_city', '')), '');

  UPDATE public.students SET
    previous_school_name = _name,
    previous_school_board = _board,
    previous_class_or_year = _class_year,
    previous_school_city = _city,
    updated_at = NOW()
  WHERE id = _student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.copy_application_previous_school_to_student(UUID, UUID) TO authenticated;

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
  ELSIF _st.school_id = get_my_school_id() AND (
    has_school_role('vice_principal')
    OR has_school_role('principal')
    OR has_school_role('school_admin')
    OR has_school_role('receptionist')
  ) THEN
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
    previous_school_name = CASE
      WHEN p_updates ? 'previous_school_name' THEN NULLIF(trim(p_updates->>'previous_school_name'), '')
      ELSE previous_school_name
    END,
    previous_school_board = CASE
      WHEN p_updates ? 'previous_school_board' THEN NULLIF(trim(p_updates->>'previous_school_board'), '')
      ELSE previous_school_board
    END,
    previous_class_or_year = CASE
      WHEN p_updates ? 'previous_class_or_year' THEN NULLIF(trim(p_updates->>'previous_class_or_year'), '')
      ELSE previous_class_or_year
    END,
    previous_school_city = CASE
      WHEN p_updates ? 'previous_school_city' THEN NULLIF(trim(p_updates->>'previous_school_city'), '')
      ELSE previous_school_city
    END,
    updated_at = NOW()
  WHERE id = p_student_id
  RETURNING * INTO _st;

  RETURN jsonb_build_object(
    'student_id', _st.id,
    'first_name', _st.first_name,
    'last_name', _st.last_name,
    'phone', _st.phone,
    'email', _st.email,
    'previous_school_name', _st.previous_school_name,
    'previous_school_board', _st.previous_school_board,
    'previous_class_or_year', _st.previous_class_or_year,
    'previous_school_city', _st.previous_school_city
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_linked_student_details(UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
