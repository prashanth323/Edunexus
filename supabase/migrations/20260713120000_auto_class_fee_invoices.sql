-- Auto-generate student invoices when VP approves a class fee plan.
-- Open fee dues RPC for accountant to notify parents (not only overdue).

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

  IF NOT is_super_admin()
    AND _plan.school_id IS DISTINCT FROM get_my_school_id()
    AND NOT (
      has_school_role('accountant')
      OR has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('head_accountant')
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
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
    WHERE fs.class_fee_plan_id = p_plan_id
      AND fs.is_active = true
    ORDER BY fs.term_order NULLS LAST, fs.name
  LOOP
    SELECT t.due_date INTO _due_date
    FROM public.class_fee_plan_terms t
    WHERE t.plan_id = p_plan_id
      AND t.term_order = _fs.term_order;

    IF _due_date IS NULL THEN
      RAISE EXCEPTION 'Set a due date for term % before approval', COALESCE(_fs.term_label, 'fee term');
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
        SELECT e.student_id
        FROM public.enrollments e
        WHERE e.section_id = _section.section_id
          AND e.academic_year_id = _plan.academic_year_id
          AND e.status = 'active'
      LOOP
        IF EXISTS (
          SELECT 1
          FROM public.student_invoices si
          WHERE si.student_id = _student_id
            AND si.fee_structure_id = _fs.id
            AND si.deleted_at IS NULL
        ) THEN
          CONTINUE;
        END IF;

        _base_num := _base_num + 1;
        _invoice_no := 'INV-' || _year || '-' || lpad(_base_num::TEXT, 5, '0');

        INSERT INTO public.student_invoices (
          school_id,
          student_id,
          academic_year_id,
          fee_structure_id,
          invoice_no,
          description,
          amount,
          due_date,
          status
        ) VALUES (
          _plan.school_id,
          _student_id,
          _plan.academic_year_id,
          _fs.id,
          _invoice_no,
          _fs.name,
          _fs.amount,
          _due_date,
          CASE
            WHEN _due_date < CURRENT_DATE THEN 'overdue'::public.fee_status
            ELSE 'pending'::public.fee_status
          END
        );
        _count := _count + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_invoices_for_class_fee_plan(UUID) TO authenticated;

-- Open fee balances (for accountant notify — includes not-yet-due fees).
CREATE OR REPLACE FUNCTION public.get_open_fee_dues(p_school_id UUID)
RETURNS TABLE (
  student_id UUID,
  admission_no TEXT,
  student_name TEXT,
  class_name TEXT,
  section_name TEXT,
  parent_email TEXT,
  total_due NUMERIC,
  last_due_date DATE,
  is_overdue BOOLEAN,
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
      OR has_school_role('head_accountant')
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH open_invoices AS (
    SELECT
      si.id AS invoice_id,
      si.student_id,
      si.due_amount,
      si.due_date,
      si.description,
      si.invoice_no,
      fs.name AS fee_name,
      fs.fee_category,
      fs.term_label,
      (si.due_date < CURRENT_DATE) AS line_overdue
    FROM public.student_invoices si
    LEFT JOIN public.fee_structures fs ON fs.id = si.fee_structure_id
    WHERE si.school_id = p_school_id
      AND si.deleted_at IS NULL
      AND si.due_amount > 0
      AND si.status IN ('pending', 'partial', 'overdue')
  ),
  student_agg AS (
    SELECT
      oi.student_id,
      SUM(oi.due_amount) AS total_due,
      MAX(oi.due_date) AS last_due_date,
      BOOL_OR(oi.line_overdue) AS is_overdue,
      jsonb_agg(
        jsonb_build_object(
          'invoice_id', oi.invoice_id,
          'invoice_no', oi.invoice_no,
          'name', COALESCE(oi.description, oi.fee_name, 'Fee'),
          'amount', oi.due_amount,
          'due_date', oi.due_date,
          'category', COALESCE(oi.fee_category, 'tuition'),
          'term_label', oi.term_label,
          'is_overdue', oi.line_overdue
        )
        ORDER BY oi.due_date
      ) AS lines
    FROM open_invoices oi
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
    sa.is_overdue,
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
  ORDER BY sa.is_overdue DESC, sa.total_due DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_open_fee_dues(UUID) TO authenticated;

-- VP approve: materialize structures then publish invoices to all class sections.
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

  _invoice_count := public.generate_invoices_for_class_fee_plan(p_plan_id);
  IF _invoice_count = 0 THEN
    RAISE NOTICE 'No student invoices created — ensure the class has active sections and enrolled students.';
  END IF;
END;
$$;

-- Backfill helper: approved plans that have structures but no invoices yet.
CREATE OR REPLACE FUNCTION public.get_class_fee_plans_pending_invoices(p_school_id UUID)
RETURNS TABLE (
  plan_id UUID,
  class_name TEXT,
  structure_count BIGINT,
  invoice_count BIGINT
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
      OR has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('head_accountant')
    )
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS plan_id,
    c.name AS class_name,
    COUNT(DISTINCT fs.id) AS structure_count,
    COUNT(DISTINCT si.id) AS invoice_count
  FROM public.class_fee_plans p
  JOIN public.classes c ON c.id = p.class_id
  JOIN public.fee_structures fs ON fs.class_fee_plan_id = p.id AND fs.is_active = true
  LEFT JOIN public.student_invoices si ON si.fee_structure_id = fs.id AND si.deleted_at IS NULL
  WHERE p.school_id = p_school_id
    AND p.status = 'approved'
  GROUP BY p.id, c.name
  HAVING COUNT(DISTINCT si.id) = 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_fee_plans_pending_invoices(UUID) TO authenticated;
