-- Parent–teacher direct messaging: threads + messages with RLS and helper RPCs.

-- ─── TABLES ───────────────────────────────────────────────────

CREATE TABLE public.message_threads (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id           UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_profile_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_staff_id    UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  subject_id          UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  title               TEXT,
  last_message_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_preview TEXT,
  parent_last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  teacher_last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  UNIQUE (school_id, student_id, parent_profile_id, teacher_staff_id)
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_message_threads_school_id ON public.message_threads(school_id);
CREATE INDEX idx_message_threads_parent ON public.message_threads(parent_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_message_threads_teacher ON public.message_threads(teacher_staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_message_threads_last_message ON public.message_threads(school_id, last_message_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE public.messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  thread_id         UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body              TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_messages_thread_id ON public.messages(thread_id, created_at);
CREATE INDEX idx_messages_school_id ON public.messages(school_id);

-- ─── HELPERS ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_parent_of_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_parents sp
    JOIN public.parents p ON p.id = sp.parent_id
    WHERE p.profile_id = auth.uid()
      AND sp.student_id = p_student_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(p_staff_id UUID, p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.sections sec ON sec.id = e.section_id
    WHERE e.student_id = p_student_id
      AND e.status = 'active'
      AND (
        sec.class_teacher_id = p_staff_id
        OR EXISTS (
          SELECT 1 FROM public.timetables t
          WHERE t.section_id = e.section_id
            AND t.staff_id = p_staff_id
        )
        OR EXISTS (
          SELECT 1 FROM public.homework_assignments ha
          WHERE ha.section_id = e.section_id
            AND ha.teacher_id = p_staff_id
            AND ha.deleted_at IS NULL
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.my_staff_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.staff WHERE profile_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_access_message_thread(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id = p_thread_id
      AND t.deleted_at IS NULL
      AND (
        t.parent_profile_id = auth.uid()
        OR t.teacher_staff_id = public.my_staff_id()
        OR is_platform_admin()
        OR (
          t.school_id = get_my_school_id()
          AND (
            has_school_role('principal')
            OR has_school_role('vice_principal')
            OR has_school_role('school_admin')
          )
        )
      )
  );
$$;

-- ─── RPC: CREATE OR REUSE THREAD + SEND FIRST MESSAGE ─────────

CREATE OR REPLACE FUNCTION public.create_parent_teacher_thread(
  p_school_id UUID,
  p_student_id UUID,
  p_teacher_staff_id UUID,
  p_initial_message TEXT,
  p_subject_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_parent_profile_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _thread_id UUID;
  _caller_staff UUID;
  _is_parent BOOLEAN;
  _is_teacher BOOLEAN;
  _parent_profile UUID;
  _msg TEXT;
BEGIN
  _msg := trim(p_initial_message);
  IF _msg IS NULL OR _msg = '' THEN
    RAISE EXCEPTION 'Message body is required';
  END IF;

  _is_parent := is_parent_of_student(p_student_id);
  _caller_staff := my_staff_id();
  _is_teacher := (_caller_staff IS NOT NULL AND _caller_staff = p_teacher_staff_id);

  IF NOT _is_parent AND NOT _is_teacher THEN
    RAISE EXCEPTION 'Unauthorized: only linked parents or the assigned teacher can start this conversation';
  END IF;

  IF NOT is_teacher_of_student(p_teacher_staff_id, p_student_id) THEN
    RAISE EXCEPTION 'This teacher is not assigned to the student''s class or subjects';
  END IF;

  IF p_school_id <> get_my_school_id() AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'School context mismatch';
  END IF;

  IF _is_parent THEN
    _parent_profile := auth.uid();
  ELSIF p_parent_profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.student_parents sp
      JOIN public.parents p ON p.id = sp.parent_id
      WHERE sp.student_id = p_student_id
        AND p.profile_id = p_parent_profile_id
    ) THEN
      RAISE EXCEPTION 'Parent is not linked to this student';
    END IF;
    _parent_profile := p_parent_profile_id;
  ELSE
    SELECT p.profile_id INTO _parent_profile
    FROM public.student_parents sp
    JOIN public.parents p ON p.id = sp.parent_id
    WHERE sp.student_id = p_student_id
      AND p.profile_id IS NOT NULL
    ORDER BY sp.is_primary DESC NULLS LAST, sp.created_at
    LIMIT 1;

    IF _parent_profile IS NULL THEN
      RAISE EXCEPTION 'No parent profile linked to this student';
    END IF;
  END IF;

  INSERT INTO public.message_threads (
    school_id, student_id, parent_profile_id, teacher_staff_id, subject_id, title,
    last_message_at, last_message_preview
  )
  VALUES (
    p_school_id,
    p_student_id,
    _parent_profile,
    p_teacher_staff_id,
    p_subject_id,
    NULLIF(trim(p_title), ''),
    NOW(),
    left(_msg, 200)
  )
  ON CONFLICT (school_id, student_id, parent_profile_id, teacher_staff_id)
  DO UPDATE SET
    last_message_at = EXCLUDED.last_message_at,
    last_message_preview = EXCLUDED.last_message_preview,
    updated_at = NOW()
  RETURNING id INTO _thread_id;

  INSERT INTO public.messages (school_id, thread_id, sender_profile_id, body)
  VALUES (p_school_id, _thread_id, auth.uid(), _msg);

  IF _is_parent THEN
    UPDATE public.message_threads SET parent_last_read_at = NOW() WHERE id = _thread_id;
  ELSE
    UPDATE public.message_threads SET teacher_last_read_at = NOW() WHERE id = _thread_id;
  END IF;

  RETURN _thread_id;
END;
$$;

-- ─── RPC: SEND MESSAGE ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.send_thread_message(
  p_thread_id UUID,
  p_body TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _msg TEXT;
  _message_id UUID;
  _school_id UUID;
BEGIN
  _msg := trim(p_body);
  IF _msg IS NULL OR _msg = '' THEN
    RAISE EXCEPTION 'Message body is required';
  END IF;

  IF NOT can_access_message_thread(p_thread_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT school_id INTO _school_id FROM public.message_threads WHERE id = p_thread_id;

  INSERT INTO public.messages (school_id, thread_id, sender_profile_id, body)
  VALUES (_school_id, p_thread_id, auth.uid(), _msg)
  RETURNING id INTO _message_id;

  UPDATE public.message_threads
  SET
    last_message_at = NOW(),
    last_message_preview = left(_msg, 200),
    parent_last_read_at = CASE WHEN parent_profile_id = auth.uid() THEN NOW() ELSE parent_last_read_at END,
    teacher_last_read_at = CASE WHEN teacher_staff_id = my_staff_id() THEN NOW() ELSE teacher_last_read_at END,
    updated_at = NOW()
  WHERE id = p_thread_id;

  RETURN _message_id;
END;
$$;

-- ─── RPC: MARK THREAD READ ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_message_thread_read(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_access_message_thread(p_thread_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.message_threads
  SET
    parent_last_read_at = CASE WHEN parent_profile_id = auth.uid() THEN NOW() ELSE parent_last_read_at END,
    teacher_last_read_at = CASE WHEN teacher_staff_id = my_staff_id() THEN NOW() ELSE teacher_last_read_at END
  WHERE id = p_thread_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_parent_of_student(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_student(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_staff_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_message_thread(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_parent_teacher_thread(UUID, UUID, UUID, TEXT, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_thread_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_message_thread_read(UUID) TO authenticated;

-- ─── VIEW ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_message_threads
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.school_id,
  t.student_id,
  st.first_name || ' ' || st.last_name AS student_name,
  st.admission_no,
  t.parent_profile_id,
  pp.first_name || ' ' || pp.last_name AS parent_name,
  t.teacher_staff_id,
  COALESCE(tsp.first_name || ' ' || tsp.last_name, ts.designation, 'Teacher') AS teacher_name,
  tsp.id AS teacher_profile_id,
  t.subject_id,
  sub.name AS subject_name,
  t.title,
  t.last_message_at,
  t.last_message_preview,
  t.parent_last_read_at,
  t.teacher_last_read_at,
  t.created_at,
  t.updated_at
FROM public.message_threads t
JOIN public.students st ON st.id = t.student_id
JOIN public.profiles pp ON pp.id = t.parent_profile_id
JOIN public.staff ts ON ts.id = t.teacher_staff_id
LEFT JOIN public.profiles tsp ON tsp.id = ts.profile_id
LEFT JOIN public.subjects sub ON sub.id = t.subject_id
WHERE t.deleted_at IS NULL;

-- ─── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_threads_select" ON public.message_threads FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      parent_profile_id = auth.uid()
      OR teacher_staff_id = public.my_staff_id()
      OR is_platform_admin()
      OR (
        school_id = get_my_school_id()
        AND (
          has_school_role('principal')
          OR has_school_role('vice_principal')
          OR has_school_role('school_admin')
        )
      )
    )
  );

CREATE POLICY "message_threads_update_read" ON public.message_threads FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      parent_profile_id = auth.uid()
      OR teacher_staff_id = public.my_staff_id()
    )
  )
  WITH CHECK (
    parent_profile_id = auth.uid()
    OR teacher_staff_id = public.my_staff_id()
  );

CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.can_access_message_thread(thread_id)
  );
