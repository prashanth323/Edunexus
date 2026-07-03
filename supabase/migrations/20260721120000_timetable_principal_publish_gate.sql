-- Timetable: principal must publish before teachers/students see schedules.

-- Remote may have timetable_batches without the per-section unique key.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'timetable_batches'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) LIKE '%school_id%'
      AND pg_get_constraintdef(c.oid) LIKE '%section_id%'
      AND pg_get_constraintdef(c.oid) LIKE '%academic_year_id%'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'timetable_batches'
      AND indexdef LIKE '%UNIQUE%'
      AND indexdef LIKE '%school_id%'
      AND indexdef LIKE '%section_id%'
      AND indexdef LIKE '%academic_year_id%'
  ) THEN
    ALTER TABLE public.timetable_batches
      ADD CONSTRAINT timetable_batches_school_section_year_key
      UNIQUE (school_id, section_id, academic_year_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN NULL;
END $$;

-- ─── Backfill batches for existing timetable rows ─────────────
INSERT INTO public.timetable_batches (school_id, section_id, academic_year_id, status, approved_at)
SELECT DISTINCT
  tt.school_id,
  tt.section_id,
  sec.academic_year_id,
  'published',
  NOW()
FROM public.timetables tt
JOIN public.sections sec ON sec.id = tt.section_id
WHERE tt.batch_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.timetable_batches tb
    WHERE tb.school_id = tt.school_id
      AND tb.section_id = tt.section_id
      AND tb.academic_year_id = sec.academic_year_id
  );

-- Drop duplicate slot rows before linking batch_id (remote may have legacy duplicates).
DELETE FROM public.timetables t
USING (
  SELECT id
  FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY school_id, section_id, day_of_week, period_no
        ORDER BY (batch_id IS NOT NULL) DESC, id
      ) AS rn
    FROM public.timetables
  ) ranked
  WHERE rn > 1
) dupes
WHERE t.id = dupes.id;

UPDATE public.timetables tt
SET batch_id = tb.id
FROM public.timetable_batches tb
JOIN public.sections sec ON sec.id = tb.section_id
WHERE tt.section_id = tb.section_id
  AND tt.school_id = tb.school_id
  AND sec.academic_year_id = tb.academic_year_id
  AND tt.batch_id IS NULL;

-- Revert published batch to draft when slots change
CREATE OR REPLACE FUNCTION public.timetable_slot_touch_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _batch_id UUID;
BEGIN
  _batch_id := COALESCE(NEW.batch_id, OLD.batch_id);
  IF _batch_id IS NOT NULL THEN
    UPDATE public.timetable_batches
    SET status = 'draft',
        approved_by = NULL,
        approved_at = NULL,
        updated_at = NOW()
    WHERE id = _batch_id
      AND status = 'published';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS timetable_slot_touch_batch ON public.timetables;
CREATE TRIGGER timetable_slot_touch_batch
  AFTER INSERT OR UPDATE OR DELETE ON public.timetables
  FOR EACH ROW
  EXECUTE FUNCTION public.timetable_slot_touch_batch();

-- ─── Views ────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_teacher_sections CASCADE;
DROP VIEW IF EXISTS public.v_student_timetable CASCADE;
DROP VIEW IF EXISTS public.v_section_timetable_published CASCADE;
DROP VIEW IF EXISTS public.v_section_timetable CASCADE;

CREATE VIEW public.v_teacher_sections AS
SELECT
  sf.profile_id,
  sf.school_id,
  tt.id             AS timetable_id,
  tt.section_id,
  cl.name           AS class_name,
  sec.name          AS section_name,
  sub.name          AS subject_name,
  tt.subject_id,
  sub.code          AS subject_code,
  tt.staff_id,
  tt.day_of_week,
  tt.period_no,
  tt.start_time,
  tt.end_time,
  tt.room_no,
  p.first_name || ' ' || p.last_name AS teacher_name,
  (SELECT COUNT(*) FROM public.enrollments
   WHERE section_id = tt.section_id AND status = 'active') AS student_count,
  EXISTS(
    SELECT 1 FROM public.attendance a
    WHERE a.section_id = tt.section_id AND a.date = CURRENT_DATE
      AND (a.subject_id = tt.subject_id OR a.subject_id IS NULL)
  ) AS attendance_marked_today
FROM public.staff sf
JOIN public.timetables tt ON tt.staff_id = sf.id
JOIN public.timetable_batches tb ON tb.id = tt.batch_id AND tb.status = 'published'
JOIN public.sections sec ON sec.id = tt.section_id
JOIN public.classes cl ON cl.id = sec.class_id
JOIN public.subjects sub ON sub.id = tt.subject_id
LEFT JOIN public.profiles p ON p.id = sf.profile_id
WHERE sf.is_active = true;

CREATE VIEW public.v_student_timetable AS
SELECT
  e.student_id,
  st.profile_id     AS student_profile_id,
  tt.id             AS timetable_id,
  tt.school_id,
  tt.section_id,
  sec.name          AS section_name,
  cl.name           AS class_name,
  ay.name           AS academic_year_name,
  sub.id            AS subject_id,
  sub.name          AS subject_name,
  sub.code          AS subject_code,
  tt.staff_id,
  p.first_name || ' ' || p.last_name AS teacher_name,
  tt.day_of_week,
  tt.period_no,
  tt.start_time,
  tt.end_time,
  tt.room_no
FROM public.enrollments e
JOIN public.students st ON st.id = e.student_id
JOIN public.sections sec ON sec.id = e.section_id
JOIN public.classes cl ON cl.id = sec.class_id
JOIN public.academic_years ay ON ay.id = e.academic_year_id
JOIN public.timetables tt ON tt.section_id = e.section_id AND tt.school_id = e.school_id
JOIN public.timetable_batches tb ON tb.id = tt.batch_id AND tb.status = 'published'
JOIN public.subjects sub ON sub.id = tt.subject_id
LEFT JOIN public.staff sf ON sf.id = tt.staff_id
LEFT JOIN public.profiles p ON p.id = sf.profile_id
WHERE e.status = 'active'
  AND sec.is_active = true;

CREATE VIEW public.v_section_timetable AS
SELECT
  tt.id             AS timetable_id,
  tt.school_id,
  tt.section_id,
  tt.batch_id,
  tb.status         AS batch_status,
  sec.name          AS section_name,
  cl.id             AS class_id,
  cl.name           AS class_name,
  cl.numeric_level,
  ay.id             AS academic_year_id,
  ay.name           AS academic_year_name,
  ay.is_current     AS academic_year_is_current,
  sub.id            AS subject_id,
  sub.name          AS subject_name,
  sub.code          AS subject_code,
  tt.staff_id,
  sf.profile_id     AS staff_profile_id,
  p.first_name || ' ' || p.last_name AS teacher_name,
  tt.day_of_week,
  tt.period_no,
  tt.start_time,
  tt.end_time,
  tt.room_no,
  sec.class_teacher_id,
  ct_p.first_name || ' ' || ct_p.last_name AS class_teacher_name
FROM public.timetables tt
JOIN public.sections sec ON sec.id = tt.section_id
JOIN public.classes cl ON cl.id = sec.class_id
JOIN public.academic_years ay ON ay.id = sec.academic_year_id
LEFT JOIN public.timetable_batches tb ON tb.id = tt.batch_id
JOIN public.subjects sub ON sub.id = tt.subject_id
LEFT JOIN public.staff sf ON sf.id = tt.staff_id
LEFT JOIN public.profiles p ON p.id = sf.profile_id
LEFT JOIN public.staff ct_sf ON ct_sf.id = sec.class_teacher_id
LEFT JOIN public.profiles ct_p ON ct_p.id = ct_sf.profile_id
WHERE sec.is_active = true;

CREATE VIEW public.v_section_timetable_published AS
SELECT * FROM public.v_section_timetable
WHERE batch_status = 'published';

-- ─── Batch helpers ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_or_create_timetable_batch(
  p_school_id UUID,
  p_section_id UUID,
  p_academic_year_id UUID
)
RETURNS public.timetable_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _batch public.timetable_batches%ROWTYPE;
BEGIN
  IF NOT is_super_admin()
    AND NOT (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_school_id IS DISTINCT FROM get_my_school_id() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'School mismatch';
  END IF;

  SELECT * INTO _batch
  FROM public.timetable_batches
  WHERE school_id = p_school_id
    AND section_id = p_section_id
    AND academic_year_id = p_academic_year_id;

  IF FOUND THEN
    RETURN _batch;
  END IF;

  INSERT INTO public.timetable_batches (
    school_id, section_id, academic_year_id, status, created_by
  )
  VALUES (
    p_school_id, p_section_id, p_academic_year_id, 'draft', auth.uid()
  )
  RETURNING * INTO _batch;

  RETURN _batch;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_timetable_batch(UUID, UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_timetable_for_approval(p_batch_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _batch public.timetable_batches%ROWTYPE;
  _sec public.sections%ROWTYPE;
  _class_name TEXT;
  _cls TEXT;
BEGIN
  IF NOT is_super_admin()
    AND NOT (
      has_school_role('vice_principal')
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized to submit timetable for approval';
  END IF;

  SELECT * INTO _batch FROM public.timetable_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch not found'; END IF;
  IF _batch.status <> 'draft' THEN RAISE EXCEPTION 'Only draft timetables can be submitted'; END IF;

  IF NOT is_super_admin() AND _batch.school_id IS DISTINCT FROM get_my_school_id() THEN
    RAISE EXCEPTION 'Batch does not belong to your school';
  END IF;

  UPDATE public.timetable_batches
  SET status = 'pending_approval', updated_at = NOW()
  WHERE id = p_batch_id;

  SELECT * INTO _sec FROM public.sections WHERE id = _batch.section_id;
  SELECT c.name INTO _class_name FROM public.classes c WHERE c.id = _sec.class_id;
  _cls := COALESCE(_class_name, 'Class') || ' – ' || COALESCE(_sec.name, 'Section');

  INSERT INTO public.school_notifications (
    school_id, type, title, body, metadata, created_by
  ) VALUES (
    _batch.school_id,
    'principal_approval_timetable',
    'Timetable pending principal approval',
    'Section ' || _cls || ' timetable is awaiting principal approval.',
    jsonb_build_object('batch_id', p_batch_id, 'section_id', _batch.section_id),
    auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_timetable_for_approval(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_timetable_batch(p_batch_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _batch public.timetable_batches%ROWTYPE;
BEGIN
  IF NOT is_super_admin() AND NOT has_school_role('principal') THEN
    RAISE EXCEPTION 'Only the principal can publish timetables';
  END IF;

  SELECT * INTO _batch FROM public.timetable_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch not found'; END IF;

  IF NOT is_super_admin() AND _batch.school_id IS DISTINCT FROM get_my_school_id() THEN
    RAISE EXCEPTION 'Batch does not belong to your school';
  END IF;

  IF _batch.status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'Timetable is not awaiting publication';
  END IF;

  UPDATE public.timetable_batches
  SET status = 'published',
      approved_by = auth.uid(),
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_batch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_timetable_batch(UUID) TO authenticated;

-- Principal sees timetable approval requests
DROP POLICY IF EXISTS "school_notifications_select" ON public.school_notifications;
CREATE POLICY "school_notifications_select" ON public.school_notifications FOR SELECT
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND type = 'principal_approval_timetable'
      AND has_school_role('principal')
    )
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
