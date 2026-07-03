-- Term 1 publish on VP approve, school approved plan list, term_label in auto reminders.

-- ─── Term 1 publish (replaces full-year parent email) ─────────
CREATE OR REPLACE FUNCTION public.notify_class_yearly_fee_published(p_plan_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.class_fee_plans%ROWTYPE;
  _yearly JSONB;
  _first_term JSONB;
  _term_label TEXT;
  _term_order INT;
  _term_subtotal NUMERIC;
  _student_id UUID;
  _st RECORD;
  _parent_email TEXT;
  _body TEXT;
  _class_name TEXT;
  _count INT := 0;
BEGIN
  SELECT * INTO _plan FROM public.class_fee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  _yearly := public._build_yearly_fee_plan_json(p_plan_id, NULL);
  _class_name := COALESCE(_yearly->>'class_name', 'Class');

  SELECT elem INTO _first_term
  FROM jsonb_array_elements(COALESCE(_yearly->'terms', '[]'::jsonb)) AS elem
  ORDER BY (elem->>'term_order')::INT NULLS LAST
  LIMIT 1;

  IF _first_term IS NULL THEN
    RETURN 0;
  END IF;

  _term_label := COALESCE(_first_term->>'term_label', 'Term 1');
  _term_order := COALESCE((_first_term->>'term_order')::INT, 1);
  _term_subtotal := COALESCE(
    (
      SELECT SUM((item->>'amount')::NUMERIC)
      FROM jsonb_array_elements(COALESCE(_first_term->'items', '[]'::jsonb)) AS item
    ),
    0
  );

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

    _body := _term_label || ' fees for ' || _class_name
      || ' have been published. Subtotal: ₹' || _term_subtotal::TEXT
      || '. Please see the parent portal for each fee line and last date to pay.'
      || ' Later terms will be reminded separately when due.';

    INSERT INTO public.school_notifications (
      school_id, type, student_id, title, body, parent_email, created_by, metadata
    ) VALUES (
      _plan.school_id,
      'fee_term_published',
      _student_id,
      _term_label || ' fees — ' || _class_name,
      _body,
      _parent_email,
      auth.uid(),
      jsonb_build_object(
        'term_plan', _first_term,
        'term_label', _term_label,
        'term_order', _term_order,
        'term_subtotal', _term_subtotal,
        'class_name', _class_name,
        'admission_no', _st.admission_no,
        'student_name', _st.full_name,
        'plan_id', p_plan_id
      )
    );

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- ─── Approved fee plans for accountant browser ───────────────
CREATE OR REPLACE FUNCTION public.get_school_approved_fee_plans(p_school_id UUID)
RETURNS TABLE (
  plan_id UUID,
  class_id UUID,
  class_name TEXT,
  academic_year_id UUID,
  academic_year_name TEXT,
  term_count INT,
  grand_total NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin()
    AND p_school_id IS DISTINCT FROM get_my_school_id()
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

  RETURN QUERY
  SELECT
    p.id,
    p.class_id,
    COALESCE(c.name, 'Class'),
    p.academic_year_id,
    COALESCE(ay.name, ''),
    (
      SELECT COUNT(*)::INT
      FROM public.class_fee_plan_terms t
      WHERE t.plan_id = p.id
    ),
    COALESCE(
      (
        SELECT SUM(i.amount)
        FROM public.class_fee_plan_items i
        JOIN public.class_fee_plan_terms t ON t.id = i.term_id
        WHERE t.plan_id = p.id AND i.amount > 0
      ),
      0
    )
  FROM public.class_fee_plans p
  JOIN public.academic_years ay ON ay.id = p.academic_year_id AND ay.is_current = true
  LEFT JOIN public.classes c ON c.id = p.class_id
  WHERE p.school_id = p_school_id
    AND p.status = 'approved'
  ORDER BY c.name NULLS LAST, p.reviewed_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_approved_fee_plans(UUID) TO authenticated;

-- ─── Auto reminders: include term_label in metadata ──────────
CREATE OR REPLACE FUNCTION public.process_automatic_fee_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv RECORD;
  _count INT := 0;
  _parent_email TEXT;
  _body TEXT;
  _notif_id UUID;
  _term_label TEXT;
BEGIN
  FOR _inv IN
    SELECT si.id AS invoice_id, si.student_id, si.school_id, si.due_amount,
           si.due_date, si.description, si.invoice_no,
           fs.term_label,
           s.admission_no, TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')) AS student_name
    FROM public.student_invoices si
    JOIN public.students s ON s.id = si.student_id
    LEFT JOIN public.fee_structures fs ON fs.id = si.fee_structure_id
    WHERE si.deleted_at IS NULL
      AND si.due_amount > 0
      AND si.due_date = CURRENT_DATE
      AND si.status IN ('pending', 'partial', 'overdue')
      AND NOT EXISTS (
        SELECT 1 FROM public.fee_reminder_log frl
        WHERE frl.invoice_id = si.id AND frl.reminder_type = 'due_date'
      )
  LOOP
    _term_label := COALESCE(_inv.term_label, 'Fees');
    _body := 'Reminder: ' || _term_label || ' fee payment due today for ' || _inv.student_name
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
      _term_label || ' fee due today — ' || _inv.student_name,
      _body,
      _parent_email,
      jsonb_build_object(
        'invoice_id', _inv.invoice_id,
        'admission_no', _inv.admission_no,
        'student_name', _inv.student_name,
        'amount', _inv.due_amount,
        'last_date_to_pay', _inv.due_date,
        'term_label', _term_label,
        'fee_lines', jsonb_build_array(
          jsonb_build_object(
            'invoice_id', _inv.invoice_id,
            'name', COALESCE(_inv.description, 'Fee'),
            'amount', _inv.due_amount,
            'due_date', _inv.due_date,
            'term_label', _term_label
          )
        ),
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
      _term_label || ' fee due today — ' || _inv.student_name,
      'Adm. ' || COALESCE(_inv.admission_no, '—') || ': ' || _body,
      jsonb_build_object('parent_notification_id', _notif_id, 'auto_reminder', true, 'term_label', _term_label)
    );

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;
