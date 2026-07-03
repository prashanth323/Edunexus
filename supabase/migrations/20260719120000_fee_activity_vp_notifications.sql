-- Accountant fee actions: apply term fine + notify VP on payment/fine activity.

CREATE OR REPLACE FUNCTION public.apply_term_invoice_fine(
  p_invoice_ids UUID[],
  p_fine_amount NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv RECORD;
  _total_due NUMERIC := 0;
  _remaining NUMERIC;
  _allocated NUMERIC;
  _applied NUMERIC := 0;
BEGIN
  IF NOT is_super_admin() AND NOT has_school_role('accountant') THEN
    RAISE EXCEPTION 'Not authorized to apply fines';
  END IF;

  IF p_invoice_ids IS NULL OR array_length(p_invoice_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No invoices specified';
  END IF;

  IF COALESCE(p_fine_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Fine amount must be positive';
  END IF;

  FOR _inv IN
    SELECT si.id, si.due_amount, si.school_id
    FROM public.student_invoices si
    WHERE si.id = ANY(p_invoice_ids)
      AND si.deleted_at IS NULL
      AND si.due_amount > 0
  LOOP
    IF NOT is_super_admin() AND _inv.school_id IS DISTINCT FROM get_my_school_id() THEN
      RAISE EXCEPTION 'Invoice does not belong to your school';
    END IF;
    _total_due := _total_due + _inv.due_amount;
  END LOOP;

  IF _total_due <= 0 THEN
    RAISE EXCEPTION 'No open balance on selected invoices';
  END IF;

  _remaining := p_fine_amount;

  FOR _inv IN
    SELECT si.id, si.due_amount, si.fine
    FROM public.student_invoices si
    WHERE si.id = ANY(p_invoice_ids)
      AND si.deleted_at IS NULL
      AND si.due_amount > 0
    ORDER BY si.due_date, si.id
  LOOP
    IF _inv.id = (
      SELECT si2.id
      FROM public.student_invoices si2
      WHERE si2.id = ANY(p_invoice_ids)
        AND si2.deleted_at IS NULL
        AND si2.due_amount > 0
      ORDER BY si2.due_date DESC, si2.id DESC
      LIMIT 1
    ) THEN
      _allocated := _remaining;
    ELSE
      _allocated := ROUND(p_fine_amount * (_inv.due_amount / _total_due), 2);
      _remaining := _remaining - _allocated;
    END IF;

    UPDATE public.student_invoices
    SET fine = COALESCE(fine, 0) + _allocated,
        updated_at = NOW()
    WHERE id = _inv.id;

    _applied := _applied + _allocated;
  END LOOP;

  RETURN _applied;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_term_invoice_fine(UUID[], NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_fee_vp_activity(
  p_student_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_amount NUMERIC DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _st public.students%ROWTYPE;
  _student_name TEXT;
  _meta JSONB;
  _notif_id UUID;
BEGIN
  IF NOT is_super_admin()
    AND NOT (
      has_school_role('accountant')
      OR has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _st FROM public.students WHERE id = p_student_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;

  IF NOT is_super_admin() AND _st.school_id IS DISTINCT FROM get_my_school_id() THEN
    RAISE EXCEPTION 'Student does not belong to your school';
  END IF;

  _student_name := TRIM(COALESCE(_st.first_name, '') || ' ' || COALESCE(_st.last_name, ''));

  _meta := jsonb_build_object(
    'admission_no', _st.admission_no,
    'student_name', _student_name,
    'amount', p_amount,
    'notified_at', NOW()
  ) || COALESCE(p_metadata, '{}'::jsonb);

  INSERT INTO public.school_notifications (
    school_id, type, student_id, title, body, created_by, metadata
  )
  VALUES (
    _st.school_id,
    'fee_due_vp',
    p_student_id,
    p_title,
    p_body,
    auth.uid(),
    _meta
  )
  RETURNING id INTO _notif_id;

  RETURN _notif_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_fee_vp_activity(UUID, TEXT, TEXT, NUMERIC, JSONB) TO authenticated;
