-- Fee due notifications: school_notifications only (no notice board); manual accountant notify.

CREATE OR REPLACE FUNCTION public.notify_student_fee_due(
  p_student_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _st public.students%ROWTYPE;
  _parent_email TEXT;
  _parent_notif_id UUID;
  _student_name TEXT;
BEGIN
  IF NOT is_super_admin()
    AND NOT (
      has_school_role('accountant')
      OR has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized to send fee due notifications';
  END IF;

  SELECT * INTO _st FROM public.students WHERE id = p_student_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;

  IF NOT is_super_admin() AND _st.school_id IS DISTINCT FROM get_my_school_id() THEN
    RAISE EXCEPTION 'Student does not belong to your school';
  END IF;

  _student_name := TRIM(COALESCE(_st.first_name, '') || ' ' || COALESCE(_st.last_name, ''));

  SELECT p.email INTO _parent_email
  FROM public.student_parents sp
  JOIN public.parents par ON par.id = sp.parent_id
  JOIN public.profiles p ON p.id = par.profile_id
  WHERE sp.student_id = p_student_id AND sp.is_primary = true
  LIMIT 1;

  IF _parent_email IS NULL THEN
    SELECT l.parent_email INTO _parent_email
    FROM public.admissions a
    JOIN public.leads l ON l.id = a.lead_id
    WHERE a.student_id = p_student_id
    LIMIT 1;
  END IF;

  INSERT INTO public.school_notifications (
    school_id, type, student_id, title, body, parent_email, created_by, metadata
  )
  VALUES (
    _st.school_id,
    'fee_due_parent',
    p_student_id,
    p_title,
    p_body,
    _parent_email,
    auth.uid(),
    jsonb_build_object(
      'admission_no', _st.admission_no,
      'student_name', _student_name,
      'amount', p_amount,
      'notified_at', NOW()
    )
  )
  RETURNING id INTO _parent_notif_id;

  INSERT INTO public.school_notifications (
    school_id, type, student_id, title, body, created_by, metadata
  )
  VALUES (
    _st.school_id,
    'fee_due_vp',
    p_student_id,
    'Fee due — ' || _student_name,
  'Adm. no. ' || COALESCE(_st.admission_no, '—') || ': ' || p_body,
    auth.uid(),
    jsonb_build_object(
      'admission_no', _st.admission_no,
      'student_name', _student_name,
      'amount', p_amount,
      'parent_notification_id', _parent_notif_id,
      'notified_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'notification_id', _parent_notif_id,
    'parent_email', _parent_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_student_fee_due(UUID, TEXT, TEXT, NUMERIC) TO authenticated;

DROP POLICY IF EXISTS "school_notifications_select" ON public.school_notifications;
CREATE POLICY "school_notifications_select" ON public.school_notifications FOR SELECT
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND type LIKE 'vp_approval_%'
      AND has_school_role('vice_principal')
    )
    OR (
      school_id = get_my_school_id()
      AND type = 'fee_due_vp'
      AND (
        has_school_role('vice_principal')
        OR has_school_role('principal')
      )
    )
    OR (
      school_id = get_my_school_id()
      AND type = 'fee_due_parent'
      AND (
        is_parent_of_student(student_id)
        OR has_school_role('accountant')
        OR has_school_role('vice_principal')
        OR has_school_role('principal')
        OR has_school_role('school_admin')
      )
    )
    OR (
      school_id = get_my_school_id()
      AND type = 'hostel_status_parent'
      AND (
        is_parent_of_student(student_id)
        OR has_school_role('vice_principal')
        OR has_school_role('principal')
        OR has_school_role('hostel_manager')
      )
    )
    OR (
      school_id = get_my_school_id()
      AND type NOT LIKE 'vp_approval_%'
      AND type NOT IN ('fee_due_vp', 'fee_due_parent', 'hostel_status_parent')
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('accountant')
        OR has_school_role('head_accountant')
        OR has_school_role('hostel_manager')
      )
    )
  );

-- Fee due must use notify_student_fee_due (not school notices).
CREATE OR REPLACE FUNCTION public.dispatch_operational_notification(
  p_type TEXT,
  p_student_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_notify_parent BOOLEAN DEFAULT true,
  p_notify_vp BOOLEAN DEFAULT true,
  p_notify_class_teacher BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _school UUID;
  _section UUID;
  _parent_email TEXT;
  _parent_notice_id UUID;
  _notif_id UUID;
BEGIN
  IF p_type = 'hostel_status' THEN
    RAISE EXCEPTION 'Use update_hostel_resident_status for hostel status updates';
  END IF;
  IF p_type = 'fee_due' THEN
    RAISE EXCEPTION 'Use notify_student_fee_due for fee due notifications';
  END IF;

  SELECT s.school_id INTO _school FROM public.students s WHERE s.id = p_student_id;
  IF _school IS NULL THEN RAISE EXCEPTION 'Student not found'; END IF;

  SELECT e.section_id INTO _section
  FROM public.enrollments e
  JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true
  WHERE e.student_id = p_student_id AND e.status = 'active'
  LIMIT 1;

  SELECT p.email INTO _parent_email
  FROM public.student_parents sp
  JOIN public.parents par ON par.id = sp.parent_id
  JOIN public.profiles p ON p.id = par.profile_id
  WHERE sp.student_id = p_student_id AND sp.is_primary = true
  LIMIT 1;

  IF _parent_email IS NULL THEN
    SELECT l.parent_email INTO _parent_email
    FROM public.admissions a
    JOIN public.leads l ON l.id = a.lead_id
    WHERE a.student_id = p_student_id
    LIMIT 1;
  END IF;

  IF p_notify_parent THEN
    INSERT INTO public.notices (school_id, author_id, title, body, audience, section_ids, is_published, published_at)
    VALUES (_school, auth.uid(), p_title, p_body, 'parents',
      CASE WHEN _section IS NOT NULL THEN ARRAY[_section] ELSE NULL END,
      true, NOW())
    RETURNING id INTO _parent_notice_id;
  END IF;

  IF p_notify_vp THEN
    INSERT INTO public.notices (school_id, author_id, title, body, audience, is_published, published_at)
    VALUES (_school, auth.uid(), p_title, p_body, 'staff', true, NOW());
  END IF;

  IF p_notify_class_teacher AND _section IS NOT NULL THEN
    INSERT INTO public.notices (school_id, author_id, title, body, audience, section_ids, is_published, published_at)
    VALUES (_school, auth.uid(), p_title, p_body, 'teachers', ARRAY[_section], true, NOW());
  END IF;

  INSERT INTO public.school_notifications (
    school_id, type, student_id, title, body, notice_id, parent_email, created_by, metadata
  )
  VALUES (
    _school, p_type, p_student_id, p_title, p_body, _parent_notice_id, _parent_email, auth.uid(),
    jsonb_build_object('section_id', _section)
  )
  RETURNING id INTO _notif_id;

  RETURN jsonb_build_object(
    'notification_id', _notif_id,
    'parent_email', _parent_email,
    'parent_notice_id', _parent_notice_id
  );
END;
$$;
