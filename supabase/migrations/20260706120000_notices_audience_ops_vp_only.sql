-- Scope notice visibility by audience for ops roles; VP-only approval alerts (not staff notices).

CREATE OR REPLACE FUNCTION public.notice_audiences_for_viewer()
RETURNS notice_audience[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN is_super_admin() OR is_platform_admin() THEN NULL::notice_audience[]
    WHEN has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    THEN NULL::notice_audience[]
    WHEN has_school_role('parent') THEN ARRAY['parents', 'all']::notice_audience[]
    WHEN has_school_role('student') THEN ARRAY['students', 'all']::notice_audience[]
    WHEN has_school_role('teacher') OR has_school_role('class_teacher')
    THEN ARRAY['teachers', 'all']::notice_audience[]
    WHEN has_school_role('counselor')
    THEN ARRAY['parents', 'teachers', 'all']::notice_audience[]
    WHEN has_school_role('hostel_manager')
      OR has_school_role('transport_manager')
      OR has_school_role('head_accountant')
      OR has_school_role('accountant')
      OR has_school_role('librarian')
      OR has_school_role('receptionist')
      OR has_school_role('hr_manager')
      OR has_school_role('admission_manager')
    THEN ARRAY['staff', 'all']::notice_audience[]
    ELSE ARRAY['all']::notice_audience[]
  END;
$$;

-- VP-only operational alerts (not published on the school notice board).
CREATE OR REPLACE FUNCTION public.notify_vp_approval_request(
  p_school_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.school_notifications (
    school_id, type, title, body, metadata, created_by
  ) VALUES (
    p_school_id, p_type, p_title, p_body, p_metadata, auth.uid()
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_vp_approval_request(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

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
      AND type NOT LIKE 'vp_approval_%'
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

-- ─── Bus submit ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_bus_for_approval(p_bus_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bus public.buses%ROWTYPE;
BEGIN
  IF NOT is_super_admin() AND NOT has_school_role('transport_manager') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _bus FROM public.buses WHERE id = p_bus_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bus not found'; END IF;
  IF _bus.school_id IS DISTINCT FROM get_my_school_id() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Bus does not belong to your school';
  END IF;
  IF _bus.approval_status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'Bus cannot be submitted in current status';
  END IF;

  UPDATE public.buses
  SET approval_status = 'pending_vp', submitted_by = auth.uid(), submitted_at = NOW(), updated_at = NOW()
  WHERE id = p_bus_id;

  PERFORM public.notify_vp_approval_request(
    _bus.school_id,
    'vp_approval_bus',
    'Bus pending VP approval',
    'A new bus (' || COALESCE(_bus.registration_no, '') || ') awaits approval.',
    jsonb_build_object('bus_id', p_bus_id)
  );
END;
$$;

-- ─── Route submit ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_route_for_approval(p_route_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _route public.routes%ROWTYPE;
BEGIN
  IF NOT is_super_admin() AND NOT has_school_role('transport_manager') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _route FROM public.routes WHERE id = p_route_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Route not found'; END IF;
  IF _route.school_id IS DISTINCT FROM get_my_school_id() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Route does not belong to your school';
  END IF;
  IF _route.approval_status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'Route cannot be submitted in current status';
  END IF;

  UPDATE public.routes
  SET approval_status = 'pending_vp', submitted_by = auth.uid(), submitted_at = NOW(), updated_at = NOW()
  WHERE id = p_route_id;

  PERFORM public.notify_vp_approval_request(
    _route.school_id,
    'vp_approval_route',
    'Route pending VP approval',
    'Route "' || _route.name || '" awaits VP approval.',
    jsonb_build_object('route_id', p_route_id)
  );
END;
$$;

-- ─── Hostel room submit ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_hostel_room_for_approval(p_room_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _room public.hostel_rooms%ROWTYPE;
BEGIN
  IF NOT is_super_admin() AND NOT has_school_role('hostel_manager') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _room FROM public.hostel_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF _room.school_id IS DISTINCT FROM get_my_school_id() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Room does not belong to your school';
  END IF;
  IF _room.approval_status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'Room cannot be submitted in current status';
  END IF;

  UPDATE public.hostel_rooms
  SET approval_status = 'pending_vp', submitted_by = auth.uid(), submitted_at = NOW(), updated_at = NOW()
  WHERE id = p_room_id;

  PERFORM public.notify_vp_approval_request(
    _room.school_id,
    'vp_approval_hostel_room',
    'Hostel room pending VP approval',
    'Room ' || _room.room_no || ' awaits VP approval.',
    jsonb_build_object('room_id', p_room_id)
  );
END;
$$;

-- ─── Fee plan submit ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_class_fee_plan(p_plan_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.class_fee_plans%ROWTYPE;
BEGIN
  IF NOT is_super_admin()
    AND NOT (
      has_school_role('head_accountant')
      OR has_school_role('vice_principal')
      OR has_school_role('principal')
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _plan FROM public.class_fee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;
  IF _plan.school_id IS DISTINCT FROM get_my_school_id() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Plan does not belong to your school';
  END IF;

  UPDATE public.class_fee_plans
  SET status = 'pending_vp', submitted_by = auth.uid(), submitted_at = NOW(), updated_at = NOW()
  WHERE id = p_plan_id;

  PERFORM public.notify_vp_approval_request(
    _plan.school_id,
    'vp_approval_fee_plan',
    'Fee plan pending approval',
    'A class fee plan is awaiting VP approval.',
    jsonb_build_object('plan_id', p_plan_id)
  );
END;
$$;
