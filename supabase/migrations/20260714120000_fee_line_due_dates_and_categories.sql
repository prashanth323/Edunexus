-- Per-line due dates, expanded fee categories, yearly plan RPCs, publish + auto reminders.

-- ─── Category constraint expansion ─────────────────────────────
ALTER TABLE public.class_fee_plan_items
  ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE public.fee_structures
  ADD COLUMN IF NOT EXISTS due_date DATE;

UPDATE public.class_fee_plan_items i
SET due_date = t.due_date
FROM public.class_fee_plan_terms t
WHERE i.term_id = t.id AND i.due_date IS NULL AND t.due_date IS NOT NULL;

ALTER TABLE public.class_fee_plan_items DROP CONSTRAINT IF EXISTS class_fee_plan_items_fee_category_check;
ALTER TABLE public.class_fee_plan_items ADD CONSTRAINT class_fee_plan_items_fee_category_check
  CHECK (fee_category IN (
    'tuition', 'hostel', 'admission', 'transport', 'books', 'uniform',
    'sports', 'library', 'lab', 'miscellaneous', 'other'
  ));

ALTER TABLE public.fee_structures DROP CONSTRAINT IF EXISTS fee_structures_fee_category_check;
ALTER TABLE public.fee_structures ADD CONSTRAINT fee_structures_fee_category_check
  CHECK (fee_category IS NULL OR fee_category IN (
    'tuition', 'hostel', 'admission', 'transport', 'books', 'uniform',
    'sports', 'library', 'lab', 'miscellaneous', 'other'
  ));

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
    WHEN p_category = 'admission' THEN 'Admission'
    WHEN p_category = 'transport' THEN 'Transport'
    WHEN p_category = 'books' THEN 'Books'
    WHEN p_category = 'uniform' THEN 'Uniform'
    WHEN p_category = 'sports' THEN 'Sports'
    WHEN p_category = 'library' THEN 'Library'
    WHEN p_category = 'lab' THEN 'Lab'
    WHEN p_category = 'miscellaneous' THEN 'Miscellaneous'
    ELSE COALESCE(p_legacy_name, INITCAP(REPLACE(p_category, '_', ' ')))
  END;
$$;

-- ─── Reminder log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fee_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.student_invoices(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('due_date', 'manual', 'publish')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_reminder_log_invoice_due_date
  ON public.fee_reminder_log(invoice_id, reminder_type)
  WHERE reminder_type = 'due_date';

CREATE INDEX IF NOT EXISTS idx_fee_reminder_log_invoice ON public.fee_reminder_log(invoice_id);

ALTER TABLE public.fee_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fee_reminder_log_select" ON public.fee_reminder_log;
CREATE POLICY "fee_reminder_log_select" ON public.fee_reminder_log FOR SELECT
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.student_invoices si
      WHERE si.id = invoice_id AND si.school_id = get_my_school_id()
    )
  );

-- ─── Yearly plan JSON builder (internal) ─────────────────────
CREATE OR REPLACE FUNCTION public._build_yearly_fee_plan_json(p_plan_id UUID, p_student_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.class_fee_plans%ROWTYPE;
  _class_name TEXT;
  _ay_label TEXT;
  _terms JSONB;
  _grand_total NUMERIC := 0;
  _by_category JSONB;
BEGIN
  SELECT * INTO _plan FROM public.class_fee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT c.name INTO _class_name FROM public.classes c WHERE c.id = _plan.class_id;
  SELECT ay.name INTO _ay_label FROM public.academic_years ay WHERE ay.id = _plan.academic_year_id;

  SELECT COALESCE(jsonb_agg(term_row ORDER BY term_order), '[]'::jsonb) INTO _terms
  FROM (
    SELECT
      t.term_order,
      t.term_label,
      t.due_date AS term_due_date,
      (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'item_id', i.id,
            'fee_category', COALESCE(i.fee_category, 'tuition'),
            'custom_label', i.custom_label,
            'name', public.fee_item_display_label(COALESCE(i.fee_category, 'tuition'), i.custom_label, i.name),
            'amount', i.amount,
            'due_date', COALESCE(i.due_date, t.due_date),
            'invoice_id', si.id,
            'paid_amount', COALESCE(si.paid_amount, 0),
            'due_amount', COALESCE(si.due_amount, 0),
            'payment_status', CASE
              WHEN si.id IS NULL THEN 'not_invoiced'
              WHEN si.due_amount <= 0 THEN 'paid'
              WHEN si.due_date < CURRENT_DATE THEN 'overdue'
              ELSE 'on_time'
            END
          )
          ORDER BY COALESCE(i.due_date, t.due_date), i.id
        ), '[]'::jsonb)
        FROM public.class_fee_plan_items i
        LEFT JOIN LATERAL (
          SELECT fs.id AS structure_id
          FROM public.fee_structures fs
          WHERE fs.class_fee_plan_id = p_plan_id
            AND fs.term_order = t.term_order
            AND fs.amount = i.amount
            AND COALESCE(fs.fee_category, 'tuition') = COALESCE(i.fee_category, 'tuition')
            AND fs.is_active = true
          LIMIT 1
        ) fs_match ON true
        LEFT JOIN public.student_invoices si ON si.fee_structure_id = fs_match.structure_id
          AND si.deleted_at IS NULL
          AND (p_student_id IS NULL OR si.student_id = p_student_id)
        WHERE i.term_id = t.id AND i.amount > 0
      ) AS items
    FROM public.class_fee_plan_terms t
    WHERE t.plan_id = p_plan_id
  ) term_row;

  SELECT COALESCE(SUM(i.amount), 0) INTO _grand_total
  FROM public.class_fee_plan_items i
  JOIN public.class_fee_plan_terms t ON t.id = i.term_id
  WHERE t.plan_id = p_plan_id AND i.amount > 0;

  SELECT COALESCE(jsonb_object_agg(cat, amt), '{}'::jsonb) INTO _by_category
  FROM (
    SELECT COALESCE(i.fee_category, 'tuition') AS cat, SUM(i.amount) AS amt
    FROM public.class_fee_plan_items i
    JOIN public.class_fee_plan_terms t ON t.id = i.term_id
    WHERE t.plan_id = p_plan_id AND i.amount > 0
    GROUP BY COALESCE(i.fee_category, 'tuition')
  ) x;

  RETURN jsonb_build_object(
    'plan_id', _plan.id,
    'school_id', _plan.school_id,
    'class_id', _plan.class_id,
    'class_name', COALESCE(_class_name, 'Class'),
    'academic_year_id', _plan.academic_year_id,
    'academic_year_name', COALESCE(_ay_label, ''),
    'status', _plan.status,
    'terms', _terms,
    'grand_total', _grand_total,
    'total_by_category', _by_category
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_class_yearly_fee_plan(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.class_fee_plans%ROWTYPE;
  _result JSONB;
BEGIN
  SELECT * INTO _plan FROM public.class_fee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;

  IF NOT is_super_admin()
    AND _plan.school_id IS DISTINCT FROM get_my_school_id()
    AND NOT (
      has_school_role('head_accountant')
      OR has_school_role('accountant')
      OR has_school_role('vice_principal')
      OR has_school_role('principal')
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  _result := public._build_yearly_fee_plan_json(p_plan_id, NULL);
  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_yearly_fee_plan(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_student_class_yearly_fee_plan(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _st public.students%ROWTYPE;
  _plan_id UUID;
  _result JSONB;
BEGIN
  SELECT * INTO _st FROM public.students WHERE id = p_student_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;

  IF NOT is_super_admin()
    AND _st.school_id IS DISTINCT FROM get_my_school_id()
    AND NOT is_parent_of_student(p_student_id)
    AND NOT (
      has_school_role('accountant')
      OR has_school_role('head_accountant')
      OR has_school_role('vice_principal')
      OR has_school_role('principal')
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT p.id INTO _plan_id
  FROM public.class_fee_plans p
  JOIN public.enrollments e ON e.student_id = p_student_id AND e.status = 'active'
  JOIN public.sections sec ON sec.id = e.section_id AND sec.class_id = p.class_id
  JOIN public.academic_years ay ON ay.id = p.academic_year_id AND ay.is_current = true
  WHERE p.school_id = _st.school_id
    AND p.status = 'approved'
    AND p.academic_year_id = e.academic_year_id
  ORDER BY p.reviewed_at DESC NULLS LAST
  LIMIT 1;

  IF _plan_id IS NULL THEN
    RETURN jsonb_build_object('plan_id', NULL, 'terms', '[]'::jsonb, 'grand_total', 0);
  END IF;

  _result := public._build_yearly_fee_plan_json(_plan_id, p_student_id);
  RETURN _result || jsonb_build_object('student_id', p_student_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_class_yearly_fee_plan(UUID) TO authenticated;

-- ─── Generate invoices using per-line due dates on structures ─
CREATE OR REPLACE FUNCTION public.generate_invoices_for_class_fee_plan(p_plan_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.class_fee_plans%ROWTYPE;
  _fs RECORD;
  _due_date DATE;
  _section RECORD;
  _student_id UUID;
  _count INT := 0;
  _base_num INT;
  _invoice_no TEXT;
  _year TEXT := to_char(CURRENT_DATE, 'YYYY');
BEGIN
  SELECT * INTO _plan FROM public.class_fee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;
  IF _plan.status <> 'approved' THEN
    RAISE EXCEPTION 'Plan must be approved to generate invoices';
  END IF;

  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(si.invoice_no, '^INV-[0-9]+-', ''), '')::INT
  ), 0) INTO _base_num
  FROM public.student_invoices si
  WHERE si.school_id = _plan.school_id
    AND si.invoice_no LIKE 'INV-' || _year || '-%';

  FOR _fs IN
    SELECT fs.*
    FROM public.fee_structures fs
    WHERE fs.class_fee_plan_id = p_plan_id AND fs.is_active = true
    ORDER BY fs.term_order NULLS LAST, fs.name
  LOOP
    _due_date := _fs.due_date;
    IF _due_date IS NULL THEN
      SELECT COALESCE(i.due_date, t.due_date) INTO _due_date
      FROM public.class_fee_plan_terms t
      JOIN public.class_fee_plan_items i ON i.term_id = t.id
      WHERE t.plan_id = p_plan_id AND t.term_order = _fs.term_order
        AND i.amount = _fs.amount
        AND COALESCE(i.fee_category, 'tuition') = COALESCE(_fs.fee_category, 'tuition')
      LIMIT 1;
    END IF;

    IF _due_date IS NULL THEN
      RAISE EXCEPTION 'Set a due date for fee line %', COALESCE(_fs.name, 'fee');
    END IF;

    FOR _section IN
      SELECT sec.id AS section_id
      FROM public.sections sec
      WHERE sec.class_id = _plan.class_id
        AND sec.school_id = _plan.school_id
        AND sec.academic_year_id = _plan.academic_year_id
        AND sec.is_active = true
    LOOP
      FOR _student_id IN
        SELECT e.student_id FROM public.enrollments e
        WHERE e.section_id = _section.section_id
          AND e.academic_year_id = _plan.academic_year_id
          AND e.status = 'active'
      LOOP
        IF EXISTS (
          SELECT 1 FROM public.student_invoices si
          WHERE si.student_id = _student_id
            AND si.fee_structure_id = _fs.id
            AND si.deleted_at IS NULL
        ) THEN CONTINUE; END IF;

        _base_num := _base_num + 1;
        _invoice_no := 'INV-' || _year || '-' || lpad(_base_num::TEXT, 5, '0');

        INSERT INTO public.student_invoices (
          school_id, student_id, academic_year_id, fee_structure_id,
          invoice_no, description, amount, due_date, status
        ) VALUES (
          _plan.school_id, _student_id, _plan.academic_year_id, _fs.id,
          _invoice_no, _fs.name, _fs.amount, _due_date,
          CASE WHEN _due_date < CURRENT_DATE THEN 'overdue'::public.fee_status
               ELSE 'pending'::public.fee_status END
        );
        _count := _count + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN _count;
END;
$$;

-- ─── VP approve with per-line due_date on structures ─────────
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
  _line_due DATE;
  _invoice_count INT;
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
  SET status = 'superseded', rejection_notes = 'Replaced by a newer approved fee plan.',
      reviewed_by = auth.uid(), reviewed_at = NOW(), updated_at = NOW()
  WHERE school_id = _plan.school_id AND academic_year_id = _plan.academic_year_id
    AND class_id = _plan.class_id AND status = 'approved' AND id <> p_plan_id;

  UPDATE public.fee_structures SET is_active = false, updated_at = NOW()
  WHERE school_id = _plan.school_id AND academic_year_id = _plan.academic_year_id
    AND class_id = _plan.class_id AND class_fee_plan_id IS NOT NULL;

  UPDATE public.class_fee_plans
  SET status = 'approved', rejection_notes = NULL, reviewed_by = auth.uid(),
      reviewed_at = NOW(), updated_at = NOW()
  WHERE id = p_plan_id;

  FOR _term IN
    SELECT * FROM public.class_fee_plan_terms WHERE plan_id = p_plan_id ORDER BY term_order
  LOOP
    FOR _item IN
      SELECT * FROM public.class_fee_plan_items WHERE term_id = _term.id AND amount > 0
    LOOP
      _line_due := COALESCE(_item.due_date, _term.due_date);
      IF _line_due IS NULL THEN
        RAISE EXCEPTION 'Each fee line must have a due date (term: %)', _term.term_label;
      END IF;

      _label := public.fee_item_display_label(
        COALESCE(_item.fee_category, 'tuition'), _item.custom_label, _item.name
      );

      INSERT INTO public.fee_structures (
        school_id, academic_year_id, class_id, name, amount, frequency,
        due_day, due_date, is_active, term_order, term_label, approval_status,
        class_fee_plan_id, fee_category, custom_label
      ) VALUES (
        _plan.school_id, _plan.academic_year_id, _plan.class_id,
        _label || ' (' || _term.term_label || ')',
        _item.amount, 'one_time',
        EXTRACT(DAY FROM _line_due)::INT,
        _line_due,
        true, _term.term_order, _term.term_label, 'approved', p_plan_id,
        COALESCE(_item.fee_category, 'tuition'), _item.custom_label
      );
    END LOOP;
  END LOOP;

  _invoice_count := public.generate_invoices_for_class_fee_plan(p_plan_id);
  PERFORM public.notify_class_yearly_fee_published(p_plan_id);
END;
$$;

-- ─── Publish yearly structure to all parents in class ────────
CREATE OR REPLACE FUNCTION public.notify_class_yearly_fee_published(p_plan_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.class_fee_plans%ROWTYPE;
  _yearly JSONB;
  _student_id UUID;
  _st RECORD;
  _parent_email TEXT;
  _body TEXT;
  _count INT := 0;
  _notif_id UUID;
BEGIN
  SELECT * INTO _plan FROM public.class_fee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  _yearly := public._build_yearly_fee_plan_json(p_plan_id, NULL);

  FOR _student_id IN
    SELECT DISTINCT e.student_id
    FROM public.enrollments e
    JOIN public.sections sec ON sec.id = e.section_id
    WHERE sec.class_id = _plan.class_id
      AND sec.school_id = _plan.school_id
      AND e.academic_year_id = _plan.academic_year_id
      AND e.status = 'active'
  LOOP
    SELECT s.id, s.admission_no,
           TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')) AS full_name
    INTO _st
    FROM public.students s WHERE s.id = _student_id;

    SELECT p.email INTO _parent_email
    FROM public.student_parents sp
    JOIN public.parents par ON par.id = sp.parent_id
    JOIN public.profiles p ON p.id = par.profile_id
    WHERE sp.student_id = _student_id AND sp.is_primary = true
    LIMIT 1;

    _body := 'The yearly fee structure for ' || COALESCE((_yearly->>'class_name'), 'your class')
      || ' has been approved. Grand total: ₹'
      || COALESCE((_yearly->>'grand_total')::TEXT, '0')
      || '. Please see the parent portal for each fee line and last date to pay.';

    INSERT INTO public.school_notifications (
      school_id, type, student_id, title, body, parent_email, created_by, metadata
    ) VALUES (
      _plan.school_id,
      'fee_yearly_published',
      _student_id,
      'Yearly fee structure — ' || COALESCE((_yearly->>'class_name'), 'Class'),
      _body,
      _parent_email,
      auth.uid(),
      jsonb_build_object(
        'yearly_plan', _yearly,
        'admission_no', _st.admission_no,
        'student_name', _st.full_name,
        'plan_id', p_plan_id
      )
    )
    RETURNING id INTO _notif_id;

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_class_yearly_fee_published(UUID) TO authenticated;

-- ─── Automatic due-date reminders (called by edge function) ──
CREATE OR REPLACE FUNCTION public.process_automatic_fee_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv RECORD;
  _count INT := 0;
  _st RECORD;
  _parent_email TEXT;
  _body TEXT;
  _notif_id UUID;
BEGIN
  FOR _inv IN
    SELECT si.id AS invoice_id, si.student_id, si.school_id, si.due_amount,
           si.due_date, si.description, si.invoice_no,
           s.admission_no, TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')) AS student_name
    FROM public.student_invoices si
    JOIN public.students s ON s.id = si.student_id
    WHERE si.deleted_at IS NULL
      AND si.due_amount > 0
      AND si.due_date = CURRENT_DATE
      AND si.status IN ('pending', 'partial', 'overdue')
      AND NOT EXISTS (
        SELECT 1 FROM public.fee_reminder_log frl
        WHERE frl.invoice_id = si.id AND frl.reminder_type = 'due_date'
      )
  LOOP
    _body := 'Reminder: Fee payment due today for ' || _inv.student_name
      || ' (Adm. ' || COALESCE(_inv.admission_no, '—') || '). '
      || COALESCE(_inv.description, 'Fee') || ': ₹' || _inv.due_amount::TEXT
      || '. Last date to pay: ' || _inv.due_date::TEXT;

    SELECT p.email INTO _parent_email
    FROM public.student_parents sp
    JOIN public.parents par ON par.id = sp.parent_id
    JOIN public.profiles p ON p.id = par.profile_id
    WHERE sp.student_id = _inv.student_id AND sp.is_primary = true
    LIMIT 1;

    INSERT INTO public.school_notifications (
      school_id, type, student_id, title, body, parent_email, metadata
    ) VALUES (
      _inv.school_id,
      'fee_due_parent',
      _inv.student_id,
      'Fee due today — ' || _inv.student_name,
      _body,
      _parent_email,
      jsonb_build_object(
        'invoice_id', _inv.invoice_id,
        'admission_no', _inv.admission_no,
        'student_name', _inv.student_name,
        'amount', _inv.due_amount,
        'last_date_to_pay', _inv.due_date,
        'auto_reminder', true
      )
    )
    RETURNING id INTO _notif_id;

    INSERT INTO public.fee_reminder_log (invoice_id, reminder_type)
    VALUES (_inv.invoice_id, 'due_date');

    INSERT INTO public.school_notifications (
      school_id, type, student_id, title, body, metadata
    ) VALUES (
      _inv.school_id,
      'fee_due_vp',
      _inv.student_id,
      'Fee due today — ' || _inv.student_name,
      'Adm. ' || COALESCE(_inv.admission_no, '—') || ': ' || _body,
      jsonb_build_object('parent_notification_id', _notif_id, 'auto_reminder', true)
    );

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- Service role only for cron edge function
REVOKE ALL ON FUNCTION public.process_automatic_fee_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_automatic_fee_reminders() TO service_role;

CREATE OR REPLACE FUNCTION public.log_fee_manual_reminder(p_invoice_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv_id UUID;
BEGIN
  FOREACH _inv_id IN ARRAY p_invoice_ids
  LOOP
    INSERT INTO public.fee_reminder_log (invoice_id, reminder_type, created_by)
    VALUES (_inv_id, 'manual', auth.uid())
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_fee_manual_reminder(UUID[]) TO authenticated;

-- ─── Validate per-line due dates on submit ───────────────────
CREATE OR REPLACE FUNCTION public.submit_class_fee_plan(p_plan_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.class_fee_plans%ROWTYPE;
  _term RECORD;
  _item RECORD;
  _line_due DATE;
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

  FOR _term IN
    SELECT * FROM public.class_fee_plan_terms WHERE plan_id = p_plan_id
  LOOP
    FOR _item IN
      SELECT * FROM public.class_fee_plan_items WHERE term_id = _term.id AND amount > 0
    LOOP
      _line_due := COALESCE(_item.due_date, _term.due_date);
      IF _line_due IS NULL THEN
        RAISE EXCEPTION 'Each fee line with an amount must have a due date (% — %)',
          _term.term_label,
          public.fee_item_display_label(COALESCE(_item.fee_category, 'tuition'), _item.custom_label, _item.name);
      END IF;
    END LOOP;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.class_fee_plan_items i
    JOIN public.class_fee_plan_terms t ON t.id = i.term_id
    WHERE t.plan_id = p_plan_id AND i.amount > 0
  ) THEN
    RAISE EXCEPTION 'Add at least one fee line with an amount before submitting';
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
