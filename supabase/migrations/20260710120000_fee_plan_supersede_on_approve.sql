-- When VP approves a revised fee plan, retire the prior approved plan for the same class/year
-- (fixes idx_class_fee_plans_one_approved duplicate key on second approval).

ALTER TABLE public.class_fee_plans DROP CONSTRAINT IF EXISTS class_fee_plans_status_check;
ALTER TABLE public.class_fee_plans ADD CONSTRAINT class_fee_plans_status_check
  CHECK (status IN ('draft', 'pending_vp', 'approved', 'rejected', 'superseded'));

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

  -- Retire any previously approved plan for this class/year (one approved plan rule).
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
      INSERT INTO public.fee_structures (
        school_id, academic_year_id, class_id, name, amount, frequency,
        due_day, is_active, term_order, term_label, approval_status, class_fee_plan_id
      )
      VALUES (
        _plan.school_id, _plan.academic_year_id, _plan.class_id,
        _item.name || ' (' || _term.term_label || ')',
        _item.amount, 'one_time',
        EXTRACT(DAY FROM _term.due_date)::INT,
        true, _term.term_order, _term.term_label, 'approved', p_plan_id
      );
    END LOOP;
  END LOOP;
END;
$$;
