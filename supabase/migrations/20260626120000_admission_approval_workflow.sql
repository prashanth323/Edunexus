-- Admissions approval workflow: application class/section FKs, fee breakdown.
-- NOTE: approve_admission_application RPC already exists on remote with a richer signature
-- (concession_overrides, route_id, hostel_room_id, transport_mode). Do not redefine here.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS identity_type TEXT,
  ADD COLUMN IF NOT EXISTS identity_number TEXT;

CREATE INDEX IF NOT EXISTS idx_applications_section_id
  ON public.applications(section_id) WHERE deleted_at IS NULL;

ALTER TABLE public.fee_commitments
  ADD COLUMN IF NOT EXISTS fee_breakdown JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS concession_notes TEXT;

-- Receptionist walk-in admissions: allow lead creation from intake form.
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('admission_manager') OR has_school_role('counselor')
      OR has_school_role('receptionist')
    ))
  );
