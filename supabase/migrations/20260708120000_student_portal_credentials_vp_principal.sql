-- Principal / VP: read-only portal login credentials for students and linked parents.

CREATE OR REPLACE FUNCTION public.can_view_student_portal_credentials(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.students st
        WHERE st.id = p_student_id
          AND st.deleted_at IS NULL
          AND st.school_id = get_my_school_id()
      )
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_student_portal_credentials(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_student_portal_credentials(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _st public.students%ROWTYPE;
  _student_profile public.profiles%ROWTYPE;
  _parents JSONB;
BEGIN
  IF NOT public.can_view_student_portal_credentials(p_student_id) THEN
    RAISE EXCEPTION 'Not authorized to view portal credentials';
  END IF;

  SELECT * INTO _st FROM public.students WHERE id = p_student_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;

  IF _st.profile_id IS NOT NULL THEN
    SELECT * INTO _student_profile FROM public.profiles WHERE id = _st.profile_id;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'parent_id', par.id,
        'first_name', par.first_name,
        'last_name', par.last_name,
        'relation', sp.relation,
        'is_primary', sp.is_primary,
        'login_email', COALESCE(pp.email, par.email),
        'has_portal_login', (par.profile_id IS NOT NULL),
        'phone', par.phone
      )
      ORDER BY sp.is_primary DESC, par.first_name
    ),
    '[]'::JSONB
  ) INTO _parents
  FROM public.student_parents sp
  JOIN public.parents par ON par.id = sp.parent_id
  LEFT JOIN public.profiles pp ON pp.id = par.profile_id
  WHERE sp.student_id = p_student_id;

  RETURN jsonb_build_object(
    'student_id', _st.id,
    'admission_no', _st.admission_no,
    'student_name', TRIM(COALESCE(_st.first_name, '') || ' ' || COALESCE(_st.last_name, '')),
    'student_login_email', COALESCE(_student_profile.email, _st.email),
    'student_has_portal_login', (_st.profile_id IS NOT NULL),
    'parents', _parents
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_portal_credentials(UUID) TO authenticated;

-- Lookup by admission number (principal / VP only).
CREATE OR REPLACE FUNCTION public.get_student_portal_credentials_by_admission(
  p_school_id UUID,
  p_admission_no TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id UUID;
BEGIN
  IF NOT is_super_admin()
    AND NOT (
      p_school_id = get_my_school_id()
      AND (has_school_role('principal') OR has_school_role('vice_principal'))
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO _student_id
  FROM public.students
  WHERE school_id = p_school_id
    AND admission_no = TRIM(p_admission_no)
    AND is_active = true
    AND deleted_at IS NULL
  LIMIT 1;

  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'No student found with this admission number';
  END IF;

  RETURN public.get_student_portal_credentials(_student_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_portal_credentials_by_admission(UUID, TEXT) TO authenticated;
