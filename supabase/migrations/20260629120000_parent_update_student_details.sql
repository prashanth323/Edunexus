-- Allow linked parents (and students) to update demographic/contact fields on children.

CREATE OR REPLACE FUNCTION public.update_linked_student_details(
  p_student_id UUID,
  p_updates JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _st public.students%ROWTYPE;
  _allow BOOLEAN := false;
BEGIN
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
  ELSIF EXISTS (
    SELECT 1 FROM public.student_parents sp
    JOIN public.parents par ON par.id = sp.parent_id AND par.deleted_at IS NULL
    WHERE sp.student_id = p_student_id AND par.profile_id = auth.uid()
  ) THEN
    _allow := true;
  END IF;

  IF NOT _allow THEN
    RAISE EXCEPTION 'Not authorized to update this student';
  END IF;

  UPDATE public.students SET
    first_name = COALESCE(NULLIF(trim(p_updates->>'first_name'), ''), first_name),
    last_name = COALESCE(NULLIF(trim(p_updates->>'last_name'), ''), last_name),
    gender = CASE
      WHEN p_updates ? 'gender' THEN NULLIF(p_updates->>'gender', '')::gender_type
      ELSE gender
    END,
    date_of_birth = CASE
      WHEN p_updates ? 'date_of_birth' THEN NULLIF(p_updates->>'date_of_birth', '')::DATE
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
      WHEN p_updates ? 'address' THEN p_updates->'address'
      ELSE address
    END,
    medical_info = CASE
      WHEN p_updates ? 'medical_info' THEN p_updates->'medical_info'
      ELSE medical_info
    END,
    updated_at = NOW()
  WHERE id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_linked_student_details(UUID, JSONB) TO authenticated;
