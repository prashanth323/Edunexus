-- Operations roles: head_accountant, hostel_manager, class fee plans, hostel status, notifications.

INSERT INTO public.roles (name, label, scope, description, is_system)
VALUES
  ('head_accountant', 'Head Accountant', 'school', 'Drafts term-wise class fee plans for VP approval', true),
  ('hostel_manager', 'Hostel Manager', 'school', 'Hostel residents, room assignments, and status updates', true)
ON CONFLICT (name) DO NOTHING;

-- ─── Route code ───────────────────────────────────────────────
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS route_code TEXT;

CREATE INDEX IF NOT EXISTS idx_routes_route_code ON public.routes(school_id, route_code)
  WHERE route_code IS NOT NULL;

-- ─── Fee structures: term + plan link ─────────────────────────
ALTER TABLE public.fee_structures
  ADD COLUMN IF NOT EXISTS term_order INT,
  ADD COLUMN IF NOT EXISTS term_label TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'legacy'
    CHECK (approval_status IN ('legacy', 'draft', 'pending_vp', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS class_fee_plan_id UUID;

-- ─── Class fee plans ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_fee_plans (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'pending_vp', 'approved', 'rejected')),
  rejection_notes  TEXT,
  submitted_by     UUID REFERENCES public.profiles(id),
  submitted_at     TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES public.profiles(id),
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow one approved plan per class/year; drafts unlimited via partial unique
DROP INDEX IF EXISTS idx_class_fee_plans_one_approved;
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_fee_plans_one_approved
  ON public.class_fee_plans(school_id, academic_year_id, class_id)
  WHERE status = 'approved';

DROP TRIGGER IF EXISTS set_updated_at ON public.class_fee_plans;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.class_fee_plans
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS public.class_fee_plan_terms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id     UUID NOT NULL REFERENCES public.class_fee_plans(id) ON DELETE CASCADE,
  term_order  INT NOT NULL,
  term_label  TEXT NOT NULL,
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, term_order)
);

CREATE TABLE IF NOT EXISTS public.class_fee_plan_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  term_id     UUID NOT NULL REFERENCES public.class_fee_plan_terms(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fee_structures
  DROP CONSTRAINT IF EXISTS fee_structures_class_fee_plan_id_fkey;
ALTER TABLE public.fee_structures
  ADD CONSTRAINT fee_structures_class_fee_plan_id_fkey
  FOREIGN KEY (class_fee_plan_id) REFERENCES public.class_fee_plans(id) ON DELETE SET NULL;

-- ─── Hostel resident status ───────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.hostel_resident_status AS ENUM (
    'in_hostel',
    'checked_out',
    'joined',
    'away_home',
    'in_hostel_no_class'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.hostel_allocations
  ADD COLUMN IF NOT EXISTS resident_status public.hostel_resident_status NOT NULL DEFAULT 'in_hostel';

CREATE TABLE IF NOT EXISTS public.hostel_status_events (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  allocation_id  UUID REFERENCES public.hostel_allocations(id) ON DELETE SET NULL,
  status         public.hostel_resident_status NOT NULL,
  notes          TEXT,
  recorded_by    UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hostel_status_events_student ON public.hostel_status_events(student_id, created_at DESC);

-- ─── Operational notifications audit ────────────────────────
CREATE TABLE IF NOT EXISTS public.school_notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  student_id    UUID REFERENCES public.students(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  notice_id     UUID REFERENCES public.notices(id) ON DELETE SET NULL,
  email_sent_at TIMESTAMPTZ,
  parent_email  TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_notifications_school ON public.school_notifications(school_id, created_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.class_fee_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_fee_plan_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_fee_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_fee_plans_select" ON public.class_fee_plans;
CREATE POLICY "class_fee_plans_select" ON public.class_fee_plans FOR SELECT
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('school_admin') OR has_school_role('head_accountant')
      OR has_school_role('accountant') OR has_school_role('admission_manager')
      OR has_school_role('counselor') OR has_school_role('receptionist')
    ))
  );

DROP POLICY IF EXISTS "class_fee_plans_write" ON public.class_fee_plans;
CREATE POLICY "class_fee_plans_write" ON public.class_fee_plans FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('school_admin') OR has_school_role('head_accountant')
    ))
  );

DROP POLICY IF EXISTS "class_fee_plan_terms_all" ON public.class_fee_plan_terms;
CREATE POLICY "class_fee_plan_terms_all" ON public.class_fee_plan_terms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.class_fee_plans p
      WHERE p.id = plan_id AND p.school_id = get_my_school_id()
      AND (
        is_super_admin()
        OR has_school_role('principal') OR has_school_role('vice_principal')
        OR has_school_role('school_admin') OR has_school_role('head_accountant')
        OR has_school_role('accountant') OR has_school_role('admission_manager')
        OR has_school_role('counselor') OR has_school_role('receptionist')
      )
    )
  );

DROP POLICY IF EXISTS "class_fee_plan_items_all" ON public.class_fee_plan_items;
CREATE POLICY "class_fee_plan_items_all" ON public.class_fee_plan_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.class_fee_plan_terms t
      JOIN public.class_fee_plans p ON p.id = t.plan_id
      WHERE t.id = term_id AND p.school_id = get_my_school_id()
      AND (
        is_super_admin()
        OR has_school_role('principal') OR has_school_role('vice_principal')
        OR has_school_role('school_admin') OR has_school_role('head_accountant')
        OR has_school_role('accountant') OR has_school_role('admission_manager')
        OR has_school_role('counselor') OR has_school_role('receptionist')
      )
    )
  );

DROP POLICY IF EXISTS "hostel_rooms_write" ON public.hostel_rooms;
CREATE POLICY "hostel_rooms_write" ON public.hostel_rooms FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('school_admin') OR has_school_role('hostel_manager')
    ))
  );

DROP POLICY IF EXISTS "hostel_allocations_write" ON public.hostel_allocations;
CREATE POLICY "hostel_allocations_write" ON public.hostel_allocations FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('school_admin') OR has_school_role('hostel_manager')
    ))
  );

DROP POLICY IF EXISTS "hostel_status_events_select" ON public.hostel_status_events;
CREATE POLICY "hostel_status_events_select" ON public.hostel_status_events FOR SELECT
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('school_admin') OR has_school_role('hostel_manager')
      OR has_school_role('class_teacher')
    ))
  );

DROP POLICY IF EXISTS "hostel_status_events_write" ON public.hostel_status_events;
CREATE POLICY "hostel_status_events_write" ON public.hostel_status_events FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('school_admin') OR has_school_role('hostel_manager')
    ))
  );

DROP POLICY IF EXISTS "school_notifications_select" ON public.school_notifications;
CREATE POLICY "school_notifications_select" ON public.school_notifications FOR SELECT
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('school_admin') OR has_school_role('accountant')
      OR has_school_role('head_accountant') OR has_school_role('hostel_manager')
    ))
  );

DROP POLICY IF EXISTS "fee_structures_write" ON public.fee_structures;
CREATE POLICY "fee_structures_write" ON public.fee_structures FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('head_accountant')
    ))
  );

-- ─── Submit fee plan to VP ─────────────────────────────────────
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
      has_school_role('head_accountant') OR has_school_role('vice_principal')
      OR has_school_role('principal') OR has_school_role('school_admin')
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

  INSERT INTO public.notices (school_id, author_id, title, body, audience, is_published, published_at)
  VALUES (
    _plan.school_id, auth.uid(),
    'Fee plan pending approval',
    'A class fee plan is awaiting VP approval.',
    'staff', true, NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_class_fee_plan(UUID) TO authenticated;

-- ─── VP approve/reject + materialize fee_structures ───────────
CREATE OR REPLACE FUNCTION public.review_class_fee_plan(
  p_plan_id UUID,
  p_approve BOOLEAN,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.class_fee_plans%ROWTYPE;
  _term RECORD;
  _item RECORD;
BEGIN
  IF NOT is_super_admin()
    AND NOT (has_school_role('vice_principal') OR has_school_role('principal'))
  THEN
    RAISE EXCEPTION 'Not authorized to review fee plans';
  END IF;

  SELECT * INTO _plan FROM public.class_fee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;
  IF _plan.status <> 'pending_vp' THEN RAISE EXCEPTION 'Plan is not pending review'; END IF;

  IF NOT p_approve THEN
    UPDATE public.class_fee_plans
    SET status = 'rejected', rejection_notes = p_notes, reviewed_by = auth.uid(),
        reviewed_at = NOW(), updated_at = NOW()
    WHERE id = p_plan_id;
    RETURN;
  END IF;

  -- Deactivate prior approved plan rows for this class/year
  UPDATE public.fee_structures
  SET is_active = false, updated_at = NOW()
  WHERE school_id = _plan.school_id
    AND academic_year_id = _plan.academic_year_id
    AND class_id = _plan.class_id
    AND class_fee_plan_id IS NOT NULL;

  UPDATE public.class_fee_plans
  SET status = 'approved', rejection_notes = NULL, reviewed_by = auth.uid(),
      reviewed_at = NOW(), updated_at = NOW()
  WHERE id = p_plan_id;

  FOR _term IN
    SELECT * FROM public.class_fee_plan_terms WHERE plan_id = p_plan_id ORDER BY term_order
  LOOP
    FOR _item IN
      SELECT * FROM public.class_fee_plan_items WHERE term_id = _term.id
    LOOP
      INSERT INTO public.fee_structures (
        school_id, academic_year_id, class_id, name, amount, frequency,
        due_day, is_active, term_order, term_label, approval_status, class_fee_plan_id
      )
      VALUES (
        _plan.school_id, _plan.academic_year_id, _plan.class_id,
        _item.name || ' (' || _term.term_label || ')',
        _item.amount, 'one_time',
        EXTRACT(DAY FROM _term.due_date)::INT,
        true, _term.term_order, _term.term_label, 'approved', p_plan_id
      );
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_class_fee_plan(UUID, BOOLEAN, TEXT) TO authenticated;

-- ─── Approved fee catalog for admission staff ─────────────────
CREATE OR REPLACE FUNCTION public.get_approved_fee_catalog(p_school_id UUID)
RETURNS TABLE (
  plan_id UUID,
  class_id UUID,
  class_name TEXT,
  term_order INT,
  term_label TEXT,
  due_date DATE,
  item_name TEXT,
  amount NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS plan_id,
    p.class_id,
    c.name AS class_name,
    t.term_order,
    t.term_label,
    t.due_date,
    i.name AS item_name,
    i.amount
  FROM public.class_fee_plans p
  JOIN public.classes c ON c.id = p.class_id
  JOIN public.class_fee_plan_terms t ON t.plan_id = p.id
  JOIN public.class_fee_plan_items i ON i.term_id = t.id
  WHERE p.school_id = p_school_id
    AND p.status = 'approved'
    AND (
      is_super_admin()
      OR p_school_id = get_my_school_id()
    )
  ORDER BY c.name, t.term_order, i.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_approved_fee_catalog(UUID) TO authenticated;

-- ─── Hostel status update ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_hostel_resident_status(
  p_allocation_id UUID,
  p_status public.hostel_resident_status,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _alloc public.hostel_allocations%ROWTYPE;
  _event_id UUID;
BEGIN
  IF NOT is_super_admin()
    AND NOT (
      has_school_role('hostel_manager') OR has_school_role('vice_principal')
      OR has_school_role('principal') OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _alloc FROM public.hostel_allocations WHERE id = p_allocation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Allocation not found'; END IF;

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

  RETURN _event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_hostel_resident_status(UUID, public.hostel_resident_status, TEXT) TO authenticated;

-- ─── Operational notification dispatch ────────────────────────
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

GRANT EXECUTE ON FUNCTION public.dispatch_operational_notification(TEXT, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
