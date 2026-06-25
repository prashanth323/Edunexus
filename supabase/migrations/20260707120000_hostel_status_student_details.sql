-- Hostel status updates: student-record history (not notices); parent ward alerts.

CREATE OR REPLACE FUNCTION public.can_view_student_hostel_status(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_super_admin()
    OR is_parent_of_student(p_student_id)
    OR EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = p_student_id AND st.profile_id = auth.uid()
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.students st
        WHERE st.id = p_student_id AND st.school_id = get_my_school_id()
      )
      AND (
        has_school_role('vice_principal')
        OR has_school_role('principal')
        OR has_school_role('school_admin')
        OR has_school_role('hostel_manager')
        OR is_class_teacher_of_student(p_student_id)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_student_hostel_status(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.hostel_status_label(p_status public.hostel_resident_status)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'in_hostel' THEN 'In hostel'
    WHEN 'joined' THEN 'Joined hostel'
    WHEN 'checked_out' THEN 'Vacated hostel'
    WHEN 'away_home' THEN 'Leave — went home'
    WHEN 'in_hostel_no_class' THEN 'Leave — in hostel, no class'
    ELSE p_status::TEXT
  END;
$$;

-- Full hostel status snapshot + dated history for student profile.
CREATE OR REPLACE FUNCTION public.get_student_hostel_status_info(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _st public.students%ROWTYPE;
  _alloc public.hostel_allocations%ROWTYPE;
  _room public.hostel_rooms%ROWTYPE;
  _events JSONB;
BEGIN
  IF NOT public.can_view_student_hostel_status(p_student_id) THEN
    RAISE EXCEPTION 'Not authorized to view hostel status for this student';
  END IF;

  SELECT * INTO _st FROM public.students WHERE id = p_student_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;

  SELECT ha.* INTO _alloc
  FROM public.hostel_allocations ha
  JOIN public.academic_years ay ON ay.id = ha.academic_year_id AND ay.is_current = true
  WHERE ha.student_id = p_student_id AND ha.is_active = true
  ORDER BY ha.updated_at DESC
  LIMIT 1;

  IF _alloc.id IS NOT NULL AND _alloc.room_id IS NOT NULL THEN
    SELECT * INTO _room FROM public.hostel_rooms WHERE id = _alloc.room_id;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'event_id', e.id,
        'status', e.status::TEXT,
        'status_label', public.hostel_status_label(e.status),
        'notes', e.notes,
        'recorded_at', e.created_at
      )
      ORDER BY e.created_at DESC
    ),
    '[]'::JSONB
  ) INTO _events
  FROM public.hostel_status_events e
  WHERE e.student_id = p_student_id;

  RETURN jsonb_build_object(
    'student_id', _st.id,
    'admission_no', _st.admission_no,
    'student_name', TRIM(COALESCE(_st.first_name, '') || ' ' || COALESCE(_st.last_name, '')),
    'current_status', COALESCE(_alloc.resident_status::TEXT, NULL),
    'current_status_label', CASE WHEN _alloc.id IS NULL THEN NULL ELSE public.hostel_status_label(_alloc.resident_status) END,
    'room_no', _room.room_no,
    'block', _room.block,
    'status_updated_at', _alloc.updated_at,
    'events', _events
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_hostel_status_info(UUID) TO authenticated;

-- Parent dashboard: current ward hostel / leave status per linked child.
CREATE OR REPLACE FUNCTION public.get_my_ward_hostel_status()
RETURNS TABLE (
  student_id UUID,
  admission_no TEXT,
  student_name TEXT,
  resident_status TEXT,
  status_label TEXT,
  status_updated_at TIMESTAMPTZ,
  room_label TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    st.id,
    st.admission_no,
    TRIM(COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, '')),
    ha.resident_status::TEXT,
    public.hostel_status_label(ha.resident_status),
    ha.updated_at,
    CASE
      WHEN hr.id IS NULL THEN NULL
      ELSE TRIM(BOTH ' /' FROM COALESCE(hr.block || ' / ', '') || hr.room_no)
    END
  FROM public.student_parents sp
  JOIN public.parents par ON par.id = sp.parent_id AND par.profile_id = auth.uid()
  JOIN public.students st ON st.id = sp.student_id AND st.deleted_at IS NULL
  JOIN public.hostel_allocations ha ON ha.student_id = st.id AND ha.is_active = true
  JOIN public.academic_years ay ON ay.id = ha.academic_year_id AND ay.is_current = true
  LEFT JOIN public.hostel_rooms hr ON hr.id = ha.room_id
  WHERE st.transport_mode = 'hostel'
  ORDER BY st.admission_no;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_ward_hostel_status() TO authenticated;

DROP POLICY IF EXISTS "hostel_status_events_select" ON public.hostel_status_events;
CREATE POLICY "hostel_status_events_select" ON public.hostel_status_events FOR SELECT
  USING (
    is_super_admin()
    OR public.can_view_student_hostel_status(student_id)
  );

-- Status update: persist event + optional parent email record (no school notices).
DROP FUNCTION IF EXISTS public.update_hostel_resident_status(UUID, public.hostel_resident_status, TEXT);

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
  _notif_id UUID;
  _parent_email TEXT;
  _room_label TEXT;
  _body TEXT;
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

  _body := 'Your ward '
    || TRIM(COALESCE(_st.first_name, '') || ' ' || COALESCE(_st.last_name, ''))
    || ' (Adm. no. ' || COALESCE(_st.admission_no, '—') || ') '
    || 'hostel status: ' || public.hostel_status_label(p_status)
    || ' on ' || TO_CHAR(NOW() AT TIME ZONE 'UTC', 'DD Mon YYYY')
    || CASE WHEN _room_label IS NOT NULL THEN '. Room: ' || _room_label ELSE '' END
    || CASE WHEN p_notes IS NOT NULL AND TRIM(p_notes) <> '' THEN '. Note: ' || p_notes ELSE '' END
    || '.';

  INSERT INTO public.school_notifications (
    school_id, type, student_id, title, body, parent_email, created_by, metadata
  )
  VALUES (
    _alloc.school_id,
    'hostel_status_parent',
    _alloc.student_id,
    'Your ward — hostel update',
    _body,
    _parent_email,
    auth.uid(),
    jsonb_build_object(
      'event_id', _event_id,
      'admission_no', _st.admission_no,
      'status', p_status::TEXT,
      'recorded_at', NOW()
    )
  )
  RETURNING id INTO _notif_id;

  RETURN jsonb_build_object(
    'event_id', _event_id,
    'notification_id', _notif_id,
    'parent_email', _parent_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_hostel_resident_status(UUID, public.hostel_resident_status, TEXT) TO authenticated;

-- Hostel status must not create school notices (student record + parent email only).
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
