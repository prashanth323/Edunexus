-- Hostel and transport manager updates: staff alerts go to Vice Principal only (not all staff / class teachers).

CREATE OR REPLACE FUNCTION public.update_hostel_resident_status(
  p_allocation_id UUID,
  p_status public.hostel_resident_status,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _alloc public.hostel_allocations%ROWTYPE;
  _st public.students%ROWTYPE;
  _room public.hostel_rooms%ROWTYPE;
  _event_id UUID;
  _parent_notif_id UUID;
  _vp_notif_id UUID;
  _parent_email TEXT;
  _room_label TEXT;
  _student_name TEXT;
  _section_id UUID;
  _class_label TEXT;
  _parent_body TEXT;
  _staff_body TEXT;
  _meta JSONB;
BEGIN
  IF NOT is_super_admin()
    AND NOT (
      has_school_role('hostel_manager')
      OR has_school_role('vice_principal')
      OR has_school_role('principal')
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _alloc FROM public.hostel_allocations WHERE id = p_allocation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Allocation not found'; END IF;

  SELECT * INTO _st FROM public.students WHERE id = _alloc.student_id;
  IF _alloc.room_id IS NOT NULL THEN
    SELECT * INTO _room FROM public.hostel_rooms WHERE id = _alloc.room_id;
  END IF;

  _student_name := TRIM(COALESCE(_st.first_name, '') || ' ' || COALESCE(_st.last_name, ''));

  SELECT e.section_id,
    TRIM(COALESCE(c.name, 'Class') || CASE WHEN sec.name IS NOT NULL THEN ' – ' || sec.name ELSE '' END)
  INTO _section_id, _class_label
  FROM public.enrollments e
  JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true
  JOIN public.sections sec ON sec.id = e.section_id
  JOIN public.classes c ON c.id = sec.class_id
  WHERE e.student_id = _alloc.student_id AND e.status = 'active'
  LIMIT 1;

  _room_label := CASE
    WHEN _room.id IS NULL THEN NULL
    ELSE TRIM(BOTH ' /' FROM COALESCE(_room.block || ' / ', '') || _room.room_no)
  END;

  UPDATE public.hostel_allocations
  SET resident_status = p_status,
      is_active = (p_status NOT IN ('checked_out')),
      check_out_date = CASE WHEN p_status = 'checked_out' THEN CURRENT_DATE ELSE check_out_date END,
      notes = COALESCE(p_notes, notes),
      updated_at = NOW()
  WHERE id = p_allocation_id;

  INSERT INTO public.hostel_status_events (school_id, student_id, allocation_id, status, notes, recorded_by)
  VALUES (_alloc.school_id, _alloc.student_id, p_allocation_id, p_status, p_notes, auth.uid())
  RETURNING id INTO _event_id;

  SELECT p.email INTO _parent_email
  FROM public.student_parents sp
  JOIN public.parents par ON par.id = sp.parent_id
  JOIN public.profiles p ON p.id = par.profile_id
  WHERE sp.student_id = _alloc.student_id AND sp.is_primary = true
  LIMIT 1;

  IF _parent_email IS NULL THEN
    SELECT l.parent_email INTO _parent_email
    FROM public.admissions a
    JOIN public.leads l ON l.id = a.lead_id
    WHERE a.student_id = _alloc.student_id
    LIMIT 1;
  END IF;

  _parent_body := 'Your ward '
    || _student_name
    || ' (Adm. no. ' || COALESCE(_st.admission_no, '—') || ') '
    || 'hostel status: ' || public.hostel_status_label(p_status)
    || ' on ' || TO_CHAR(NOW() AT TIME ZONE 'UTC', 'DD Mon YYYY')
    || CASE WHEN _room_label IS NOT NULL THEN '. Room: ' || _room_label ELSE '' END
    || CASE WHEN p_notes IS NOT NULL AND TRIM(p_notes) <> '' THEN '. Note: ' || p_notes ELSE '' END
    || '.';

  _staff_body := 'Student '
    || _student_name
    || ' (Adm. no. ' || COALESCE(_st.admission_no, '—') || ') '
    || 'hostel status: ' || public.hostel_status_label(p_status)
    || ' on ' || TO_CHAR(NOW() AT TIME ZONE 'UTC', 'DD Mon YYYY')
    || CASE WHEN _class_label IS NOT NULL THEN '. Class: ' || _class_label ELSE '' END
    || CASE WHEN _room_label IS NOT NULL THEN '. Room: ' || _room_label ELSE '' END
    || CASE WHEN p_notes IS NOT NULL AND TRIM(p_notes) <> '' THEN '. Note: ' || p_notes ELSE '' END
    || '.';

  _meta := jsonb_build_object(
    'event_id', _event_id,
    'admission_no', _st.admission_no,
    'student_name', _student_name,
    'status', p_status::TEXT,
    'recorded_at', NOW(),
    'section_id', _section_id,
    'class_label', _class_label
  );

  INSERT INTO public.school_notifications (
    school_id, type, student_id, title, body, parent_email, created_by, metadata
  )
  VALUES (
    _alloc.school_id,
    'hostel_status_parent',
    _alloc.student_id,
    'Your ward — hostel update',
    _parent_body,
    _parent_email,
    auth.uid(),
    _meta
  )
  RETURNING id INTO _parent_notif_id;

  INSERT INTO public.school_notifications (
    school_id, type, student_id, title, body, created_by, metadata
  )
  VALUES (
    _alloc.school_id,
    'hostel_status_vp',
    _alloc.student_id,
    'Hostel status — ' || _student_name,
    _staff_body,
    auth.uid(),
    _meta
  )
  RETURNING id INTO _vp_notif_id;

  RETURN jsonb_build_object(
    'event_id', _event_id,
    'notification_id', _parent_notif_id,
    'parent_email', _parent_email,
    'vp_notification_id', _vp_notif_id
  );
END;
$$;

-- Operational alerts: parent portal optional; VP portal only (no staff notice board).
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
  _parent_notif_id UUID;
  _vp_notif_id UUID;
  _meta JSONB;
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

  _meta := jsonb_build_object('section_id', _section, 'ops_type', p_type);

  IF p_notify_parent THEN
    INSERT INTO public.notices (school_id, author_id, title, body, audience, section_ids, is_published, published_at)
    VALUES (_school, auth.uid(), p_title, p_body, 'parents',
      CASE WHEN _section IS NOT NULL THEN ARRAY[_section] ELSE NULL END,
      true, NOW())
    RETURNING id INTO _parent_notice_id;

    INSERT INTO public.school_notifications (
      school_id, type, student_id, title, body, notice_id, parent_email, created_by, metadata
    )
    VALUES (
      _school, 'ops_parent_' || p_type, p_student_id, p_title, p_body,
      _parent_notice_id, _parent_email, auth.uid(), _meta
    )
    RETURNING id INTO _parent_notif_id;
  END IF;

  IF p_notify_vp THEN
    INSERT INTO public.school_notifications (
      school_id, type, student_id, title, body, created_by, metadata
    )
    VALUES (
      _school, 'ops_vp_' || p_type, p_student_id, p_title, p_body, auth.uid(), _meta
    )
    RETURNING id INTO _vp_notif_id;
  END IF;

  RETURN jsonb_build_object(
    'notification_id', COALESCE(_parent_notif_id, _vp_notif_id),
    'parent_email', _parent_email,
    'parent_notice_id', _parent_notice_id,
    'vp_notification_id', _vp_notif_id
  );
END;
$$;

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
      AND type LIKE 'ops_vp_%'
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
        OR has_school_role('hostel_manager')
      )
    )
    OR (
      school_id = get_my_school_id()
      AND type = 'hostel_status_vp'
      AND has_school_role('vice_principal')
    )
    OR (
      school_id = get_my_school_id()
      AND type LIKE 'ops_parent_%'
      AND (
        is_parent_of_student(student_id)
        OR has_school_role('vice_principal')
      )
    )
    OR (
      school_id = get_my_school_id()
      AND type NOT LIKE 'vp_approval_%'
      AND type NOT LIKE 'ops_vp_%'
      AND type NOT LIKE 'ops_parent_%'
      AND type NOT IN (
        'fee_due_vp',
        'fee_due_parent',
        'hostel_status_parent',
        'hostel_status_vp',
        'hostel_status_class_teacher'
      )
      AND (
        has_school_role('principal')
        OR has_school_role('vice_principal')
        OR has_school_role('school_admin')
        OR has_school_role('accountant')
        OR has_school_role('head_accountant')
      )
    )
  );
