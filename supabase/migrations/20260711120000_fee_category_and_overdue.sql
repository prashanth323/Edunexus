-- Fee categories, overdue dues RPC, draft plan delete, payment status, notify metadata.

-- ─── Fee category columns ───────────────────────────────────────
ALTER TABLE public.class_fee_plan_items
  ADD COLUMN IF NOT EXISTS fee_category TEXT NOT NULL DEFAULT 'tuition',
  ADD COLUMN IF NOT EXISTS custom_label TEXT;

ALTER TABLE public.class_fee_plan_items DROP CONSTRAINT IF EXISTS class_fee_plan_items_fee_category_check;
ALTER TABLE public.class_fee_plan_items ADD CONSTRAINT class_fee_plan_items_fee_category_check
  CHECK (fee_category IN ('tuition', 'hostel', 'books', 'miscellaneous', 'other'));

ALTER TABLE public.class_fee_plan_items DROP CONSTRAINT IF EXISTS class_fee_plan_items_other_label_check;
ALTER TABLE public.class_fee_plan_items ADD CONSTRAINT class_fee_plan_items_other_label_check
  CHECK (fee_category <> 'other' OR (custom_label IS NOT NULL AND TRIM(custom_label) <> ''));

-- Backfill name from category for legacy rows
UPDATE public.class_fee_plan_items
SET fee_category = CASE
  WHEN LOWER(name) LIKE '%hostel%' THEN 'hostel'
  WHEN LOWER(name) LIKE '%book%' THEN 'books'
  WHEN LOWER(name) LIKE '%misc%' THEN 'miscellaneous'
  WHEN LOWER(name) LIKE '%tuition%' THEN 'tuition'
  ELSE 'other'
END,
custom_label = CASE
  WHEN LOWER(name) NOT LIKE '%hostel%' AND LOWER(name) NOT LIKE '%book%'
    AND LOWER(name) NOT LIKE '%misc%' AND LOWER(name) NOT LIKE '%tuition%'
  THEN name
  ELSE NULL
END
WHERE fee_category = 'tuition' AND name IS NOT NULL AND name <> 'Tuition';

ALTER TABLE public.fee_structures
  ADD COLUMN IF NOT EXISTS fee_category TEXT,
  ADD COLUMN IF NOT EXISTS custom_label TEXT;

ALTER TABLE public.fee_structures DROP CONSTRAINT IF EXISTS fee_structures_fee_category_check;
ALTER TABLE public.fee_structures ADD CONSTRAINT fee_structures_fee_category_check
  CHECK (fee_category IS NULL OR fee_category IN ('tuition', 'hostel', 'books', 'miscellaneous', 'other'));

CREATE OR REPLACE FUNCTION public.fee_item_display_label(
  p_category TEXT,
  p_custom_label TEXT,
  p_legacy_name TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_category = 'other' THEN COALESCE(NULLIF(TRIM(p_custom_label), ''), p_legacy_name, 'Other')
    WHEN p_category = 'tuition' THEN 'Tuition'
    WHEN p_category = 'hostel' THEN 'Hostel'
    WHEN p_category = 'books' THEN 'Books'
    WHEN p_category = 'miscellaneous' THEN 'Miscellaneous'
    ELSE COALESCE(p_legacy_name, INITCAP(REPLACE(p_category, '_', ' ')))
  END;
$$;

-- ─── Delete draft/rejected fee plan ─────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_class_fee_plan(p_plan_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.class_fee_plans%ROWTYPE;
BEGIN
  IF NOT is_super_admin() AND NOT has_school_role('head_accountant') THEN
    RAISE EXCEPTION 'Not authorized to delete fee plans';
  END IF;

  SELECT * INTO _plan FROM public.class_fee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;

  IF NOT is_super_admin() AND _plan.school_id IS DISTINCT FROM get_my_school_id() THEN
    RAISE EXCEPTION 'Plan does not belong to your school';
  END IF;

  IF _plan.status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'Only draft or rejected plans can be deleted';
  END IF;

  DELETE FROM public.class_fee_plans WHERE id = p_plan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_class_fee_plan(UUID) TO authenticated;

-- ─── VP approve with categories ───────────────────────────────
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
  _label TEXT;
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

  UPDATE public.class_fee_plans
  SET status = 'superseded',
      rejection_notes = 'Replaced by a newer approved fee plan.',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE school_id = _plan.school_id
    AND academic_year_id = _plan.academic_year_id
    AND class_id = _plan.class_id
    AND status = 'approved'
    AND id <> p_plan_id;

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
      _label := public.fee_item_display_label(
        COALESCE(_item.fee_category, 'tuition'),
        _item.custom_label,
        _item.name
      );
      INSERT INTO public.fee_structures (
        school_id, academic_year_id, class_id, name, amount, frequency,
        due_day, is_active, term_order, term_label, approval_status, class_fee_plan_id,
        fee_category, custom_label
      )
      VALUES (
        _plan.school_id, _plan.academic_year_id, _plan.class_id,
        _label || ' (' || _term.term_label || ')',
        _item.amount, 'one_time',
        EXTRACT(DAY FROM _term.due_date)::INT,
        true, _term.term_order, _term.term_label, 'approved', p_plan_id,
        COALESCE(_item.fee_category, 'tuition'),
        _item.custom_label
      );
    END LOOP;
  END LOOP;
END;
$$;

-- ─── Overdue fee dues (due_date <= today) ─────────────────────
CREATE OR REPLACE FUNCTION public.get_overdue_fee_dues(p_school_id UUID)
RETURNS TABLE (
  student_id UUID,
  admission_no TEXT,
  student_name TEXT,
  class_name TEXT,
  section_name TEXT,
  parent_email TEXT,
  total_due NUMERIC,
  last_due_date DATE,
  lines JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin()
    AND p_school_id IS DISTINCT FROM get_my_school_id()
    AND NOT (
      has_school_role('accountant')
      OR has_school_role('vice_principal')
      OR has_school_role('principal')
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH overdue_invoices AS (
    SELECT
      si.id AS invoice_id,
      si.student_id,
      si.due_amount,
      si.due_date,
      si.description,
      si.invoice_no,
      fs.name AS fee_name,
      fs.fee_category,
      fs.term_label
    FROM public.student_invoices si
    LEFT JOIN public.fee_structures fs ON fs.id = si.fee_structure_id
    WHERE si.school_id = p_school_id
      AND si.deleted_at IS NULL
      AND si.due_amount > 0
      AND si.status IN ('pending', 'partial', 'overdue')
      AND si.due_date <= CURRENT_DATE
  ),
  student_agg AS (
    SELECT
      oi.student_id,
      SUM(oi.due_amount) AS total_due,
      MAX(oi.due_date) AS last_due_date,
      jsonb_agg(
        jsonb_build_object(
          'invoice_id', oi.invoice_id,
          'invoice_no', oi.invoice_no,
          'name', COALESCE(oi.description, oi.fee_name, 'Fee'),
          'amount', oi.due_amount,
          'due_date', oi.due_date,
          'category', COALESCE(oi.fee_category, 'tuition'),
          'term_label', oi.term_label
        )
        ORDER BY oi.due_date
      ) AS lines
    FROM overdue_invoices oi
    GROUP BY oi.student_id
  )
  SELECT
    s.id,
    s.admission_no,
    TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')),
    COALESCE(c.name, 'N/A'),
    COALESCE(sec.name, 'N/A'),
    COALESCE(
      (
        SELECT p.email
        FROM public.student_parents sp
        JOIN public.parents par ON par.id = sp.parent_id
        JOIN public.profiles p ON p.id = par.profile_id
        WHERE sp.student_id = s.id AND sp.is_primary = true
        LIMIT 1
      ),
      (
        SELECT l.parent_email
        FROM public.admissions a
        JOIN public.leads l ON l.id = a.lead_id
        WHERE a.student_id = s.id
        LIMIT 1
      )
    ),
    sa.total_due,
    sa.last_due_date,
    sa.lines
  FROM student_agg sa
  JOIN public.students s ON s.id = sa.student_id
  LEFT JOIN LATERAL (
    SELECT e.section_id
    FROM public.enrollments e
    JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true
    WHERE e.student_id = s.id AND e.status = 'active'
    LIMIT 1
  ) en ON true
  LEFT JOIN public.sections sec ON sec.id = en.section_id
  LEFT JOIN public.classes c ON c.id = sec.class_id
  ORDER BY sa.total_due DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_overdue_fee_dues(UUID) TO authenticated;

-- ─── Student fee payment status ───────────────────────────────
CREATE OR REPLACE FUNCTION public.get_student_fee_payment_status(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _st public.students%ROWTYPE;
  _parent_email TEXT;
  _class_name TEXT;
  _section_name TEXT;
  _invoices JSONB;
  _total_paid NUMERIC;
  _total_due NUMERIC;
  _overall TEXT;
BEGIN
  SELECT * INTO _st FROM public.students WHERE id = p_student_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;

  IF NOT is_super_admin()
    AND _st.school_id IS DISTINCT FROM get_my_school_id()
    AND NOT is_parent_of_student(p_student_id)
    AND NOT (
      has_school_role('accountant')
      OR has_school_role('vice_principal')
      OR has_school_role('principal')
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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

  SELECT c.name, sec.name INTO _class_name, _section_name
  FROM public.enrollments e
  JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true
  LEFT JOIN public.sections sec ON sec.id = e.section_id
  LEFT JOIN public.classes c ON c.id = sec.class_id
  WHERE e.student_id = p_student_id AND e.status = 'active'
  LIMIT 1;

  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', si.id,
        'invoice_no', si.invoice_no,
        'description', si.description,
        'amount', si.amount,
        'paid_amount', si.paid_amount,
        'due_amount', si.due_amount,
        'status', si.status,
        'due_date', si.due_date,
        'fee_name', fs.name,
        'fee_category', fs.fee_category,
        'term_label', fs.term_label
      )
      ORDER BY si.due_date DESC
    ), '[]'::jsonb),
    COALESCE(SUM(si.paid_amount), 0),
    COALESCE(SUM(si.due_amount), 0)
  INTO _invoices, _total_paid, _total_due
  FROM public.student_invoices si
  LEFT JOIN public.fee_structures fs ON fs.id = si.fee_structure_id
  WHERE si.student_id = p_student_id
    AND si.deleted_at IS NULL;

  IF _total_due <= 0 THEN
    _overall := 'clear';
  ELSIF _total_paid > 0 THEN
    _overall := 'partial';
  ELSE
    _overall := 'overdue';
  END IF;

  RETURN jsonb_build_object(
    'student_id', _st.id,
    'admission_no', _st.admission_no,
    'full_name', TRIM(COALESCE(_st.first_name, '') || ' ' || COALESCE(_st.last_name, '')),
    'class_name', COALESCE(_class_name, 'N/A'),
    'section_name', COALESCE(_section_name, 'N/A'),
    'parent_email', _parent_email,
    'invoices', _invoices,
    'total_paid', _total_paid,
    'total_due', _total_due,
    'overall_status', _overall
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_fee_payment_status(UUID) TO authenticated;

-- ─── Notify with optional metadata ────────────────────────────
DROP FUNCTION IF EXISTS public.notify_student_fee_due(UUID, TEXT, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.notify_student_fee_due(
  p_student_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_amount NUMERIC DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
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
  _meta JSONB;
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

  _meta := jsonb_build_object(
    'admission_no', _st.admission_no,
    'student_name', _student_name,
    'amount', p_amount,
    'notified_at', NOW()
  ) || COALESCE(p_metadata, '{}'::jsonb);

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
    _meta
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
    _meta || jsonb_build_object('parent_notification_id', _parent_notif_id)
  );

  RETURN jsonb_build_object(
    'notification_id', _parent_notif_id,
    'parent_email', _parent_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_student_fee_due(UUID, TEXT, TEXT, NUMERIC, JSONB) TO authenticated;
