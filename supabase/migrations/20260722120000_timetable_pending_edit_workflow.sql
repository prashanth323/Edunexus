-- Allow withdrawing pending timetables back to draft for further editing / re-submit.

CREATE OR REPLACE FUNCTION public.revert_timetable_batch_to_draft(p_batch_id UUID)
RETURNS VOID
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
    RAISE EXCEPTION 'Not authorized to edit this timetable batch';
  END IF;

  SELECT * INTO _batch FROM public.timetable_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch not found'; END IF;

  IF NOT is_super_admin() AND _batch.school_id IS DISTINCT FROM get_my_school_id() THEN
    RAISE EXCEPTION 'Batch does not belong to your school';
  END IF;

  IF _batch.status NOT IN ('pending_approval', 'published') THEN
    RAISE EXCEPTION 'Only pending or published timetables can be returned to draft for editing';
  END IF;

  UPDATE public.timetable_batches
  SET status = 'draft',
      approved_by = NULL,
      approved_at = NULL,
      updated_at = NOW()
  WHERE id = p_batch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_timetable_batch_to_draft(UUID) TO authenticated;

-- Re-submit after VP edits a withdrawn draft (idempotent if already pending).
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
      OR has_school_role('principal')
    )
  THEN
    RAISE EXCEPTION 'Not authorized to submit timetable for approval';
  END IF;

  SELECT * INTO _batch FROM public.timetable_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch not found'; END IF;
  IF _batch.status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'Only draft or pending timetables can be submitted for approval';
  END IF;

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
