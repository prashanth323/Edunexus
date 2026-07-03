-- Parent portal fee status: due_timing (on_time vs overdue), late fine accrual display.

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
  _has_overdue BOOLEAN;
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
      OR has_school_role('head_accountant')
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
        'fine', si.fine,
        'status', si.status,
        'due_date', si.due_date,
        'fee_name', fs.name,
        'fee_category', fs.fee_category,
        'term_label', fs.term_label,
        'late_fine_per_day', COALESCE(fs.late_fine_per_day, 0),
        'days_overdue', CASE
          WHEN si.due_amount > 0 AND si.due_date < CURRENT_DATE
          THEN (CURRENT_DATE - si.due_date)
          ELSE 0
        END,
        'accrued_late_fine', CASE
          WHEN si.due_amount > 0 AND si.due_date < CURRENT_DATE
          THEN (CURRENT_DATE - si.due_date) * COALESCE(fs.late_fine_per_day, 0)
          ELSE 0
        END,
        'due_timing', CASE
          WHEN si.due_amount <= 0 THEN 'paid'
          WHEN si.due_date < CURRENT_DATE THEN 'overdue'
          ELSE 'on_time'
        END
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

  SELECT EXISTS (
    SELECT 1
    FROM public.student_invoices si
    WHERE si.student_id = p_student_id
      AND si.deleted_at IS NULL
      AND si.due_amount > 0
      AND si.due_date < CURRENT_DATE
  ) INTO _has_overdue;

  IF _total_due <= 0 THEN
    _overall := 'clear';
  ELSIF _has_overdue THEN
    _overall := 'overdue';
  ELSIF _total_paid > 0 THEN
    _overall := 'partial';
  ELSE
    _overall := 'on_time';
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
