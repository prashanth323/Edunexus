-- ERP Roadmap: CRM view, half-day requests, fee commitments, principal-mediated messaging,
-- timetable approval, book distribution, receptionist/counselor RLS extensions

-- ─── CRM MANAGER DASHBOARD VIEW ───────────────────────────────
CREATE OR REPLACE VIEW public.v_crm_manager_dashboard AS
SELECT
  s.id AS school_id,
  s.name AS school_name,
  COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL) AS total_leads,
  COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'new') AS leads_new,
  COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status IN ('contacted','interested','followup_scheduled')) AS leads_engaged,
  COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status IN ('visit_scheduled','visited')) AS leads_visit,
  COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'applied') AS leads_applied,
  COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'admitted') AS leads_admitted,
  COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status IN ('not_interested','lost')) AS leads_lost,
  COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.created_at >= date_trunc('month', NOW())) AS leads_this_month,
  COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'admitted' AND l.updated_at >= date_trunc('month', NOW())) AS admissions_this_month,
  CASE WHEN COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL) > 0
    THEN ROUND(100.0 * COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'admitted')
      / COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL), 1)::TEXT
    ELSE '0'
  END AS conversion_rate,
  COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.priority = 'high'
    AND l.status NOT IN ('admitted','not_interested','lost')) AS high_priority_open
FROM public.schools s
LEFT JOIN public.leads l ON l.school_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.name;

-- ─── HALF-DAY REQUESTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.half_day_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  request_date  DATE NOT NULL,
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by  UUID NOT NULL REFERENCES public.profiles(id),
  reviewed_by   UUID REFERENCES public.profiles(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, student_id, request_date)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.half_day_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_half_day_requests_school ON public.half_day_requests(school_id, status);

ALTER TABLE public.half_day_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "half_day_requests_select" ON public.half_day_requests FOR SELECT
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('school_admin') OR has_school_role('receptionist')
      OR has_school_role('parent') OR has_school_role('student')
    ))
  );

CREATE POLICY "half_day_requests_insert" ON public.half_day_requests FOR INSERT
  WITH CHECK (
    school_id = get_my_school_id()
    AND has_school_role('receptionist')
    AND requested_by = auth.uid()
  );

CREATE POLICY "half_day_requests_update_vp" ON public.half_day_requests FOR UPDATE
  USING (
    school_id = get_my_school_id()
    AND (has_school_role('vice_principal') OR has_school_role('principal'))
  );

-- ─── FEE COMMITMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fee_commitments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id        UUID REFERENCES public.students(id) ON DELETE CASCADE,
  application_id    UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  academic_year_id  UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  total_fee         NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_amount    NUMERIC(12,2) GENERATED ALWAYS AS (GREATEST(0, total_fee - paid_amount)) STORED,
  commitment_date   DATE,
  schedule          JSONB NOT NULL DEFAULT '[]',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.fee_commitments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_fee_commitments_student ON public.fee_commitments(school_id, student_id);

ALTER TABLE public.fee_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fee_commitments_select" ON public.fee_commitments FOR SELECT
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('school_admin') OR has_school_role('accountant')
      OR has_school_role('receptionist') OR has_school_role('parent')
    ))
  );

CREATE POLICY "fee_commitments_write" ON public.fee_commitments FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('accountant')
      OR has_school_role('receptionist')
    ))
  );

-- ─── APPLICATIONS: hostel flag ────────────────────────────────
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS needs_hostel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_transport BOOLEAN NOT NULL DEFAULT false;

-- ─── RECEPTIONIST WRITE ON APPLICATIONS ─────────────────────
DROP POLICY IF EXISTS "applications_write" ON public.applications;
CREATE POLICY "applications_write" ON public.applications FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('admission_manager') OR has_school_role('receptionist')
    ))
  );

DROP POLICY IF EXISTS "applications_select" ON public.applications;
CREATE POLICY "applications_select" ON public.applications FOR SELECT
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
  );

-- ─── COUNSELOR LEAD/FOLLOWUP WRITE ────────────────────────────
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('admission_manager') OR has_school_role('counselor')
    ))
  );

DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads FOR UPDATE
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('admission_manager') OR has_school_role('counselor')
    ))
  );

-- ─── TIMETABLE APPROVAL BATCHES ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.timetable_batches (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','pending_approval','published')),
  created_by       UUID REFERENCES public.profiles(id),
  approved_by      UUID REFERENCES public.profiles(id),
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, section_id, academic_year_id)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.timetable_batches
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE public.timetables
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.timetable_batches(id) ON DELETE SET NULL;

ALTER TABLE public.timetable_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timetable_batches_select" ON public.timetable_batches FOR SELECT
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "timetable_batches_write" ON public.timetable_batches FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    ))
  );

-- Multi-teacher per slot
CREATE TABLE IF NOT EXISTS public.timetable_slot_teachers (
  timetable_id UUID NOT NULL REFERENCES public.timetables(id) ON DELETE CASCADE,
  staff_id     UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  PRIMARY KEY (timetable_id, staff_id)
);
ALTER TABLE public.timetable_slot_teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timetable_slot_teachers_all" ON public.timetable_slot_teachers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.timetables t
      WHERE t.id = timetable_id
        AND (is_super_admin() OR t.school_id = get_my_school_id())
    )
  );

-- ─── BOOK DISTRIBUTION ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.textbooks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  subject_id  UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  class_name  TEXT,
  isbn        TEXT,
  publisher   TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.textbooks
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS public.book_distributions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  textbook_id  UUID NOT NULL REFERENCES public.textbooks(id) ON DELETE CASCADE,
  issued_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  returned_at  DATE,
  issued_by    UUID REFERENCES public.profiles(id),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.book_distributions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE public.textbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "textbooks_school" ON public.textbooks FOR ALL
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "book_distributions_school" ON public.book_distributions FOR ALL
  USING (is_super_admin() OR school_id = get_my_school_id());

-- ─── PRINCIPAL-MEDIATED COMMUNICATION ─────────────────────────
CREATE TABLE IF NOT EXISTS public.principal_communication_threads (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id           UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_profile_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_staff_id    UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','forwarded','closed')),
  subject             TEXT,
  last_message_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parent_last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.principal_communication_threads
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS public.principal_communication_messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  thread_id         UUID NOT NULL REFERENCES public.principal_communication_threads(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role       TEXT NOT NULL CHECK (sender_role IN ('parent','principal','teacher')),
  visibility        TEXT NOT NULL DEFAULT 'all'
                      CHECK (visibility IN ('parent','teacher','principal','all')),
  body              TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pct_school ON public.principal_communication_threads(school_id, last_message_at DESC);
CREATE INDEX idx_pcm_thread ON public.principal_communication_messages(thread_id, created_at);

ALTER TABLE public.principal_communication_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.principal_communication_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_principal_thread(p_thread_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.principal_communication_threads t
    WHERE t.id = p_thread_id
      AND (
        is_super_admin()
        OR t.parent_profile_id = auth.uid()
        OR (t.teacher_staff_id = public.my_staff_id())
        OR (t.school_id = get_my_school_id() AND has_school_role('principal'))
      )
  );
$$;

CREATE POLICY "pct_select" ON public.principal_communication_threads FOR SELECT
  USING (can_access_principal_thread(id) OR (school_id = get_my_school_id() AND has_school_role('vice_principal')));

CREATE POLICY "pct_insert_parent" ON public.principal_communication_threads FOR INSERT
  WITH CHECK (
    school_id = get_my_school_id()
    AND parent_profile_id = auth.uid()
    AND is_parent_of_student(student_id)
  );

CREATE POLICY "pct_update_principal" ON public.principal_communication_threads FOR UPDATE
  USING (school_id = get_my_school_id() AND has_school_role('principal'));

CREATE POLICY "pcm_select" ON public.principal_communication_messages FOR SELECT
  USING (can_access_principal_thread(thread_id));

CREATE POLICY "pcm_insert" ON public.principal_communication_messages FOR INSERT
  WITH CHECK (can_access_principal_thread(thread_id) OR (
    school_id = get_my_school_id() AND has_school_role('principal')
  ));

-- RPC: parent messages principal
CREATE OR REPLACE FUNCTION public.parent_message_to_principal(
  p_school_id UUID,
  p_student_id UUID,
  p_body TEXT,
  p_subject TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _thread_id UUID;
  _body TEXT := trim(p_body);
BEGIN
  IF _body IS NULL OR _body = '' THEN RAISE EXCEPTION 'Message required'; END IF;
  IF NOT is_parent_of_student(p_student_id) THEN RAISE EXCEPTION 'Not linked to student'; END IF;
  IF p_school_id <> get_my_school_id() THEN RAISE EXCEPTION 'School mismatch'; END IF;

  INSERT INTO public.principal_communication_threads (
    school_id, student_id, parent_profile_id, subject
  ) VALUES (p_school_id, p_student_id, auth.uid(), p_subject)
  RETURNING id INTO _thread_id;

  INSERT INTO public.principal_communication_messages (
    school_id, thread_id, sender_profile_id, sender_role, visibility, body
  ) VALUES (p_school_id, _thread_id, auth.uid(), 'parent', 'principal', _body);

  RETURN _thread_id;
END;
$$;

-- RPC: principal forwards to teacher
CREATE OR REPLACE FUNCTION public.principal_forward_to_teacher(
  p_thread_id UUID,
  p_teacher_staff_id UUID,
  p_body TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _body TEXT := trim(p_body);
  _school UUID;
  _student UUID;
BEGIN
  IF NOT has_school_role('principal') AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only principal can forward';
  END IF;
  SELECT school_id, student_id INTO _school, _student
  FROM public.principal_communication_threads WHERE id = p_thread_id;
  IF NOT is_teacher_of_student(p_teacher_staff_id, _student) THEN
    RAISE EXCEPTION 'Teacher not assigned to student';
  END IF;
  UPDATE public.principal_communication_threads
  SET teacher_staff_id = p_teacher_staff_id, status = 'forwarded', last_message_at = NOW()
  WHERE id = p_thread_id;
  INSERT INTO public.principal_communication_messages (
    school_id, thread_id, sender_profile_id, sender_role, visibility, body
  ) VALUES (_school, p_thread_id, auth.uid(), 'principal', 'teacher', _body);
END;
$$;

-- RPC: teacher remark to principal
CREATE OR REPLACE FUNCTION public.teacher_remark_to_principal(
  p_thread_id UUID,
  p_body TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _school UUID;
BEGIN
  SELECT school_id INTO _school FROM public.principal_communication_threads
  WHERE id = p_thread_id AND teacher_staff_id = public.my_staff_id();
  IF _school IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.principal_communication_messages (
    school_id, thread_id, sender_profile_id, sender_role, visibility, body
  ) VALUES (_school, p_thread_id, auth.uid(), 'teacher', 'principal', trim(p_body));
  UPDATE public.principal_communication_threads SET last_message_at = NOW() WHERE id = p_thread_id;
END;
$$;

-- RPC: principal replies to parent
CREATE OR REPLACE FUNCTION public.principal_reply_to_parent(
  p_thread_id UUID,
  p_body TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _school UUID;
BEGIN
  IF NOT has_school_role('principal') AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only principal can reply to parents';
  END IF;
  SELECT school_id INTO _school FROM public.principal_communication_threads WHERE id = p_thread_id;
  INSERT INTO public.principal_communication_messages (
    school_id, thread_id, sender_profile_id, sender_role, visibility, body
  ) VALUES (_school, p_thread_id, auth.uid(), 'principal', 'parent', trim(p_body));
  UPDATE public.principal_communication_threads SET last_message_at = NOW() WHERE id = p_thread_id;
END;
$$;

-- RPC: approve half-day → write attendance
CREATE OR REPLACE FUNCTION public.approve_half_day_request(p_request_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.half_day_requests%ROWTYPE;
  _section UUID;
BEGIN
  IF NOT has_school_role('vice_principal') AND NOT has_school_role('principal') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT * INTO r FROM public.half_day_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  SELECT e.section_id INTO _section FROM public.enrollments e
  WHERE e.student_id = r.student_id AND e.status = 'active' LIMIT 1;

  UPDATE public.half_day_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO public.attendance (school_id, student_id, section_id, date, status, marked_by)
  VALUES (r.school_id, r.student_id, _section, r.request_date, 'half_day', auth.uid())
  ON CONFLICT (student_id, date) DO UPDATE SET status = 'half_day', marked_by = auth.uid();
END;
$$;

-- Seed default lead sources helper (per school on first CRM use via app)
