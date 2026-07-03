-- Fix duplicate fee lines when loading class yearly plan without a student filter.
-- Class-level view: one row per fee item + aggregated payment_status across class invoices.

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
              WHEN p_student_id IS NOT NULL THEN
                CASE
                  WHEN si.id IS NULL THEN 'not_invoiced'
                  WHEN si.due_amount <= 0 THEN 'paid'
                  WHEN si.due_date < CURRENT_DATE THEN 'overdue'
                  ELSE 'on_time'
                END
              ELSE COALESCE((
                SELECT CASE
                  WHEN COUNT(si2.id) = 0 THEN 'not_invoiced'
                  WHEN COUNT(*) FILTER (WHERE si2.due_amount > 0 AND si2.due_date < CURRENT_DATE) > 0 THEN 'overdue'
                  WHEN COUNT(*) FILTER (WHERE si2.due_amount > 0) > 0 THEN 'on_time'
                  ELSE 'paid'
                END
                FROM public.fee_structures fs2
                LEFT JOIN public.student_invoices si2
                  ON si2.fee_structure_id = fs2.id AND si2.deleted_at IS NULL
                WHERE fs2.class_fee_plan_id = p_plan_id
                  AND fs2.term_order = t.term_order
                  AND fs2.amount = i.amount
                  AND COALESCE(fs2.fee_category, 'tuition') = COALESCE(i.fee_category, 'tuition')
                  AND fs2.is_active = true
              ), 'not_invoiced')
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
        ) fs_match ON p_student_id IS NOT NULL
        LEFT JOIN public.student_invoices si ON p_student_id IS NOT NULL
          AND si.fee_structure_id = fs_match.structure_id
          AND si.deleted_at IS NULL
          AND si.student_id = p_student_id
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

-- Extend auth for reception / admissions fee catalog
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
      OR has_school_role('receptionist')
      OR has_school_role('admission_manager')
      OR has_school_role('counselor')
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  _result := public._build_yearly_fee_plan_json(p_plan_id, NULL);
  RETURN _result;
END;
$$;

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
      OR has_school_role('receptionist')
      OR has_school_role('admission_manager')
      OR has_school_role('counselor')
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
