-- Transport & hostel: manager submits inventory, VP approves and assigns students.

-- ─── Approval columns ─────────────────────────────────────────
ALTER TABLE public.buses
  ADD COLUMN IF NOT EXISTS bus_number TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'legacy'
    CHECK (approval_status IN ('legacy', 'draft', 'pending_vp', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_notes TEXT;

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'legacy'
    CHECK (approval_status IN ('legacy', 'draft', 'pending_vp', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_notes TEXT;

ALTER TABLE public.hostel_rooms
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'legacy'
    CHECK (approval_status IN ('legacy', 'draft', 'pending_vp', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_notes TEXT;

UPDATE public.buses SET approval_status = 'legacy' WHERE approval_status IS NULL;
UPDATE public.routes SET approval_status = 'legacy' WHERE approval_status IS NULL;
UPDATE public.hostel_rooms SET approval_status = 'legacy' WHERE approval_status IS NULL;

-- ─── Bus submit / review ──────────────────────────────────────
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

  INSERT INTO public.notices (school_id, author_id, title, body, audience, is_published, published_at)
  VALUES (
    _bus.school_id, auth.uid(),
    'Bus pending VP approval',
    'A new bus (' || COALESCE(_bus.registration_no, '') || ') awaits approval.',
    'staff', true, NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_bus(p_bus_id UUID, p_approve BOOLEAN, p_notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bus public.buses%ROWTYPE;
BEGIN
  IF NOT is_super_admin() AND NOT has_school_role('vice_principal') THEN
    RAISE EXCEPTION 'Not authorized to review buses';
  END IF;

  SELECT * INTO _bus FROM public.buses WHERE id = p_bus_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bus not found'; END IF;
  IF _bus.approval_status <> 'pending_vp' THEN RAISE EXCEPTION 'Bus is not pending review'; END IF;

  IF NOT p_approve THEN
    UPDATE public.buses
    SET approval_status = 'rejected', rejection_notes = p_notes, reviewed_by = auth.uid(),
        reviewed_at = NOW(), updated_at = NOW()
    WHERE id = p_bus_id;
    RETURN;
  END IF;

  UPDATE public.buses
  SET approval_status = 'approved', is_active = true, rejection_notes = NULL,
      reviewed_by = auth.uid(), reviewed_at = NOW(), updated_at = NOW()
  WHERE id = p_bus_id;
END;
$$;

-- ─── Route submit / review ────────────────────────────────────
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

  INSERT INTO public.notices (school_id, author_id, title, body, audience, is_published, published_at)
  VALUES (
    _route.school_id, auth.uid(),
    'Route pending VP approval',
    'Route "' || _route.name || '" awaits VP approval.',
    'staff', true, NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_route(p_route_id UUID, p_approve BOOLEAN, p_notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _route public.routes%ROWTYPE;
BEGIN
  IF NOT is_super_admin() AND NOT has_school_role('vice_principal') THEN
    RAISE EXCEPTION 'Not authorized to review routes';
  END IF;

  SELECT * INTO _route FROM public.routes WHERE id = p_route_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Route not found'; END IF;
  IF _route.approval_status <> 'pending_vp' THEN RAISE EXCEPTION 'Route is not pending review'; END IF;

  IF NOT p_approve THEN
    UPDATE public.routes
    SET approval_status = 'rejected', rejection_notes = p_notes, reviewed_by = auth.uid(),
        reviewed_at = NOW(), updated_at = NOW()
    WHERE id = p_route_id;
    RETURN;
  END IF;

  UPDATE public.routes
  SET approval_status = 'approved', is_active = true, rejection_notes = NULL,
      reviewed_by = auth.uid(), reviewed_at = NOW(), updated_at = NOW()
  WHERE id = p_route_id;
END;
$$;

-- ─── Hostel room submit / review ──────────────────────────────
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

  INSERT INTO public.notices (school_id, author_id, title, body, audience, is_published, published_at)
  VALUES (
    _room.school_id, auth.uid(),
    'Hostel room pending VP approval',
    'Room ' || _room.room_no || ' awaits VP approval.',
    'staff', true, NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_hostel_room(p_room_id UUID, p_approve BOOLEAN, p_notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _room public.hostel_rooms%ROWTYPE;
BEGIN
  IF NOT is_super_admin() AND NOT has_school_role('vice_principal') THEN
    RAISE EXCEPTION 'Not authorized to review hostel rooms';
  END IF;

  SELECT * INTO _room FROM public.hostel_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF _room.approval_status <> 'pending_vp' THEN RAISE EXCEPTION 'Room is not pending review'; END IF;

  IF NOT p_approve THEN
    UPDATE public.hostel_rooms
    SET approval_status = 'rejected', rejection_notes = p_notes, reviewed_by = auth.uid(),
        reviewed_at = NOW(), updated_at = NOW()
    WHERE id = p_room_id;
    RETURN;
  END IF;

  UPDATE public.hostel_rooms
  SET approval_status = 'approved', is_active = true, rejection_notes = NULL,
      reviewed_by = auth.uid(), reviewed_at = NOW(), updated_at = NOW()
  WHERE id = p_room_id;
END;
$$;

-- ─── Transport manager: assigned students list ────────────────
DROP FUNCTION IF EXISTS public.get_transport_assigned_students(UUID);

CREATE OR REPLACE FUNCTION public.get_transport_assigned_students(p_school_id UUID)
RETURNS TABLE (
  route_student_id UUID,
  student_id UUID,
  admission_no TEXT,
  student_name TEXT,
  class_name TEXT,
  section_name TEXT,
  route_id UUID,
  route_code TEXT,
  route_name TEXT,
  bus_registration TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rs.id,
    s.id,
    s.admission_no,
    TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')),
    c.name,
    sec.name,
    r.id,
    r.route_code,
    r.name,
    b.registration_no
  FROM public.route_students rs
  JOIN public.students s ON s.id = rs.student_id
  JOIN public.routes r ON r.id = rs.route_id
  LEFT JOIN public.buses b ON b.id = r.bus_id
  LEFT JOIN LATERAL (
    SELECT e.section_id
    FROM public.enrollments e
    JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true
    WHERE e.student_id = s.id AND e.status = 'active'
    ORDER BY e.created_at DESC
    LIMIT 1
  ) enr ON true
  LEFT JOIN public.sections sec ON sec.id = enr.section_id
  LEFT JOIN public.classes c ON c.id = sec.class_id
  WHERE rs.school_id = p_school_id
    AND rs.is_active = true
    AND (
      is_super_admin()
      OR (
        p_school_id = get_my_school_id()
        AND (has_school_role('transport_manager') OR has_school_role('vice_principal') OR has_school_role('principal'))
      )
    )
  ORDER BY s.admission_no;
$$;

GRANT EXECUTE ON FUNCTION public.submit_bus_for_approval(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_bus(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_route_for_approval(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_route(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_hostel_room_for_approval(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_hostel_room(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_transport_assigned_students(UUID) TO authenticated;

-- ─── RLS: fleet inventory (manager drafts, no principal create) ─
DROP POLICY IF EXISTS "buses_write" ON public.buses;
CREATE POLICY "buses_write" ON public.buses FOR ALL
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND has_school_role('transport_manager')
      AND approval_status IN ('draft', 'rejected')
    )
    OR (
      school_id = get_my_school_id()
      AND has_school_role('vice_principal')
      AND approval_status IN ('legacy', 'approved', 'pending_vp')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND has_school_role('transport_manager')
      AND approval_status IN ('draft', 'rejected')
      AND is_active = false
    )
    OR (
      school_id = get_my_school_id()
      AND has_school_role('vice_principal')
    )
  );

DROP POLICY IF EXISTS "routes_write" ON public.routes;
CREATE POLICY "routes_write" ON public.routes FOR ALL
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND has_school_role('transport_manager')
      AND approval_status IN ('draft', 'rejected')
    )
    OR (
      school_id = get_my_school_id()
      AND has_school_role('vice_principal')
      AND approval_status IN ('legacy', 'approved', 'pending_vp')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND has_school_role('transport_manager')
      AND approval_status IN ('draft', 'rejected')
      AND is_active = false
    )
    OR (
      school_id = get_my_school_id()
      AND has_school_role('vice_principal')
    )
  );

DROP POLICY IF EXISTS "route_stops_write" ON public.route_stops;
CREATE POLICY "route_stops_write" ON public.route_stops FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND has_school_role('transport_manager'))
  );

-- VP-only student route assignment
DROP POLICY IF EXISTS "route_students_write" ON public.route_students;
CREATE POLICY "route_students_write" ON public.route_students FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND has_school_role('vice_principal'))
  );

DROP POLICY IF EXISTS "route_students_select" ON public.route_students;
CREATE POLICY "route_students_select" ON public.route_students FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('vice_principal')
      OR has_school_role('transport_manager')
      OR has_school_role('principal')
      OR has_school_role('school_admin')
    ))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (
      SELECT sp.student_id FROM public.student_parents sp
      JOIN public.parents p ON sp.parent_id = p.id
      WHERE p.profile_id = auth.uid()
    )
  );

-- Hostel rooms: hostel_manager drafts only (no principal/VP create)
DROP POLICY IF EXISTS "hostel_rooms_write" ON public.hostel_rooms;
CREATE POLICY "hostel_rooms_write" ON public.hostel_rooms FOR ALL
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND has_school_role('hostel_manager')
      AND approval_status IN ('draft', 'rejected')
    )
    OR (
      school_id = get_my_school_id()
      AND has_school_role('vice_principal')
      AND approval_status IN ('legacy', 'approved', 'pending_vp')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND has_school_role('hostel_manager')
      AND approval_status IN ('draft', 'rejected')
      AND is_active = false
    )
    OR (
      school_id = get_my_school_id()
      AND has_school_role('vice_principal')
    )
  );

-- VP-only hostel allocation
DROP POLICY IF EXISTS "hostel_allocations_write" ON public.hostel_allocations;
CREATE POLICY "hostel_allocations_write" ON public.hostel_allocations FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND has_school_role('vice_principal'))
  );

DROP POLICY IF EXISTS "hostel_allocations_select" ON public.hostel_allocations;
CREATE POLICY "hostel_allocations_select" ON public.hostel_allocations FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('vice_principal')
      OR has_school_role('hostel_manager')
      OR has_school_role('principal')
      OR has_school_role('school_admin')
    ))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (
      SELECT sp.student_id FROM public.student_parents sp
      JOIN public.parents p ON sp.parent_id = p.id
      WHERE p.profile_id = auth.uid()
    )
  );
