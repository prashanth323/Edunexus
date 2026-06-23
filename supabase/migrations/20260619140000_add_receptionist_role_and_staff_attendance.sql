-- ============================================================
-- Migration: Add receptionist role + Staff Attendance table
-- ============================================================

-- ─── ADD RECEPTIONIST TO SCHOOL_ROLE ENUM ─────────────────────
ALTER TYPE school_role ADD VALUE IF NOT EXISTS 'receptionist';

-- ─── STAFF ATTENDANCE (daily, per employee) ───────────────────
CREATE TABLE public.staff_attendance (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_id         UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id),
  date             DATE NOT NULL,
  status           attendance_status NOT NULL DEFAULT 'present',
  marked_by        UUID REFERENCES public.profiles(id),
  remarks          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, staff_id, date)
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.staff_attendance
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_staff_attendance_school_id  ON public.staff_attendance(school_id);
CREATE INDEX idx_staff_attendance_staff_id   ON public.staff_attendance(staff_id, date DESC);
CREATE INDEX idx_staff_attendance_date       ON public.staff_attendance(school_id, date);

-- Enable RLS
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

-- RLS: Read — VP, principal, school_admin can see all; staff member can see own
CREATE POLICY "staff_attendance_select" ON public.staff_attendance FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal') OR has_school_role('school_admin')
    ))
    OR (school_id = get_my_school_id() AND staff_id IN (
      SELECT id FROM public.staff WHERE profile_id = auth.uid()
    ))
  );

-- RLS: Write — VP and principal only
CREATE POLICY "staff_attendance_write" ON public.staff_attendance FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
    ))
  );

-- ─── SEED: RECEPTIONIST ROLE ──────────────────────────────────
INSERT INTO public.roles (name, label, scope, description, is_system) VALUES
  ('receptionist', 'Receptionist', 'school', 'Front desk operations, visitor management, basic directory access', true)
ON CONFLICT (name) DO NOTHING;

-- ─── SEED: RECEPTIONIST PERMISSIONS ───────────────────────────
DO $$
DECLARE
  _role_id UUID;
BEGIN
  SELECT id INTO _role_id FROM public.roles WHERE name = 'receptionist';
  IF _role_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.role_permissions(role_id, permission_id)
  SELECT _role_id, p.id FROM public.permissions p
  WHERE (p.resource = 'students' AND p.action = 'read')
     OR (p.resource = 'staff' AND p.action = 'read')
     OR (p.resource = 'notices' AND p.action = 'read')
     OR (p.resource = 'transport' AND p.action = 'read')
     OR (p.resource = 'reports' AND p.action = 'read')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ─── SEED: VICE PRINCIPAL PERMISSIONS (full school perms like principal) ──
DO $$
DECLARE
  _role_id UUID;
  _perm RECORD;
BEGIN
  SELECT id INTO _role_id FROM public.roles WHERE name = 'vice_principal';
  IF _role_id IS NULL THEN RETURN; END IF;

  FOR _perm IN SELECT id FROM public.permissions LOOP
    INSERT INTO public.role_permissions(role_id, permission_id)
    VALUES (_role_id, _perm.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ─── SEED: ACCOUNTANT — add students create/update perms ──────
DO $$
DECLARE
  _role_id UUID;
BEGIN
  SELECT id INTO _role_id FROM public.roles WHERE name = 'accountant';
  IF _role_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.role_permissions(role_id, permission_id)
  SELECT _role_id, p.id FROM public.permissions p
  WHERE (p.resource = 'students' AND p.action IN ('create', 'update'))
  ON CONFLICT DO NOTHING;
END;
$$;
