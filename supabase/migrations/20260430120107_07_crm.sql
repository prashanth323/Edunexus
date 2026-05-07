-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 07: CRM Module (Per-School, Strictly Isolated)
-- ============================================================

-- ─── LEAD SOURCES ─────────────────────────────────────────────
CREATE TABLE public.lead_sources (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,          -- Walk-in, Website, Facebook, Referral, etc.
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.lead_sources
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_lead_sources_school_id ON public.lead_sources(school_id);

-- ─── COUNSELORS (CRM-specific view of staff) ──────────────────
CREATE TABLE public.counselors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_id    UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  target_leads INT DEFAULT 50,     -- monthly target
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, staff_id)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.counselors
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_counselors_school_id ON public.counselors(school_id);
CREATE INDEX idx_counselors_staff_id  ON public.counselors(staff_id);

-- ─── LEADS ────────────────────────────────────────────────────
CREATE TABLE public.leads (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  lead_source_id    UUID REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  student_name      TEXT NOT NULL,
  student_dob       DATE,
  gender            gender_type,
  class_interested  TEXT,
  parent_name       TEXT NOT NULL,
  parent_phone      TEXT NOT NULL,
  parent_email      TEXT,
  alt_phone         TEXT,
  address           JSONB,
  current_school    TEXT,
  status            lead_status NOT NULL DEFAULT 'new',
  priority          TEXT NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low','medium','high')),
  notes             TEXT,
  tags              TEXT[],
  utm_source        TEXT,
  utm_medium        TEXT,
  utm_campaign      TEXT,
  referral_id       UUID REFERENCES public.leads(id) ON DELETE SET NULL,   -- referred by another lead
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_leads_school_id       ON public.leads(school_id);
CREATE INDEX idx_leads_status          ON public.leads(school_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_source          ON public.leads(school_id, lead_source_id);
CREATE INDEX idx_leads_parent_phone    ON public.leads(school_id, parent_phone);
CREATE INDEX idx_leads_created_at      ON public.leads(school_id, created_at DESC);
CREATE INDEX idx_leads_name_trgm       ON public.leads USING GIN (student_name gin_trgm_ops);

-- ─── LEAD ASSIGNMENTS ─────────────────────────────────────────
CREATE TABLE public.lead_assignments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  counselor_id  UUID NOT NULL REFERENCES public.counselors(id) ON DELETE CASCADE,
  assigned_by   UUID REFERENCES public.profiles(id),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lead_assignments_school_id    ON public.lead_assignments(school_id);
CREATE INDEX idx_lead_assignments_lead_id      ON public.lead_assignments(lead_id);
CREATE INDEX idx_lead_assignments_counselor_id ON public.lead_assignments(counselor_id);

-- ─── FOLLOWUPS ────────────────────────────────────────────────
CREATE TABLE public.followups (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  lead_id        UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  counselor_id   UUID NOT NULL REFERENCES public.counselors(id),
  type           TEXT NOT NULL CHECK (type IN ('call','email','whatsapp','sms','in_person','video_call')),
  scheduled_at   TIMESTAMPTZ NOT NULL,
  completed_at   TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','missed','rescheduled')),
  outcome        TEXT,                    -- what happened
  next_followup  TIMESTAMPTZ,            -- auto-schedule next
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.followups
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_followups_school_id    ON public.followups(school_id);
CREATE INDEX idx_followups_lead_id      ON public.followups(lead_id);
CREATE INDEX idx_followups_counselor_id ON public.followups(counselor_id);
CREATE INDEX idx_followups_scheduled_at ON public.followups(school_id, scheduled_at);
CREATE INDEX idx_followups_status       ON public.followups(school_id, status);

-- ─── CAMPUS VISITS ────────────────────────────────────────────
CREATE TABLE public.campus_visits (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  lead_id        UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  counselor_id   UUID REFERENCES public.counselors(id),
  scheduled_at   TIMESTAMPTZ NOT NULL,
  visited_at     TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  feedback       TEXT,
  rating         INT CHECK (rating BETWEEN 1 AND 5),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.campus_visits
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_campus_visits_school_id    ON public.campus_visits(school_id);
CREATE INDEX idx_campus_visits_lead_id      ON public.campus_visits(lead_id);
CREATE INDEX idx_campus_visits_scheduled_at ON public.campus_visits(school_id, scheduled_at);

-- ─── APPLICATIONS ─────────────────────────────────────────────
CREATE TABLE public.applications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  lead_id          UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  class_applying   TEXT NOT NULL,
  application_no   TEXT NOT NULL,
  status           application_status NOT NULL DEFAULT 'draft',
  form_data        JSONB DEFAULT '{}',    -- structured application form
  documents        JSONB DEFAULT '[]',
  test_date        DATE,
  test_score       NUMERIC(6,2),
  interview_date   DATE,
  interview_notes  TEXT,
  reviewed_by      UUID REFERENCES public.profiles(id),
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, application_no)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_applications_school_id  ON public.applications(school_id);
CREATE INDEX idx_applications_lead_id    ON public.applications(lead_id);
CREATE INDEX idx_applications_status     ON public.applications(school_id, status) WHERE deleted_at IS NULL;

-- ─── ADMISSIONS ───────────────────────────────────────────────
CREATE TABLE public.admissions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  application_id   UUID NOT NULL UNIQUE REFERENCES public.applications(id),
  lead_id          UUID NOT NULL REFERENCES public.leads(id),
  student_id       UUID REFERENCES public.students(id) ON DELETE SET NULL,   -- set after student record is created
  academic_year_id UUID REFERENCES public.academic_years(id),
  section_id       UUID REFERENCES public.sections(id),
  admission_date   DATE NOT NULL,
  admission_fee    NUMERIC(12,2),
  fee_paid         BOOLEAN NOT NULL DEFAULT false,
  remarks          TEXT,
  admitted_by      UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.admissions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_admissions_school_id    ON public.admissions(school_id);
CREATE INDEX idx_admissions_lead_id      ON public.admissions(lead_id);
CREATE INDEX idx_admissions_student_id   ON public.admissions(student_id);
CREATE INDEX idx_admissions_admission_date ON public.admissions(school_id, admission_date DESC);

-- ─── CRM PIPELINE: AUTO-UPDATE LEAD STATUS ────────────────────
-- When a followup is completed → update lead status
CREATE OR REPLACE FUNCTION update_lead_on_followup()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND NEW.completed_at IS NOT NULL THEN
    UPDATE public.leads
    SET status = CASE
      WHEN status = 'new' THEN 'contacted'
      ELSE status
    END,
    updated_at = NOW()
    WHERE id = NEW.lead_id AND status = 'new';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_lead_on_followup
AFTER UPDATE ON public.followups
FOR EACH ROW EXECUTE FUNCTION update_lead_on_followup();

-- When a campus visit is completed → update lead status
CREATE OR REPLACE FUNCTION update_lead_on_visit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE public.leads
    SET status = 'visited', updated_at = NOW()
    WHERE id = NEW.lead_id AND status NOT IN ('applied','admitted','lost');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_lead_on_visit
AFTER UPDATE ON public.campus_visits
FOR EACH ROW EXECUTE FUNCTION update_lead_on_visit();

-- When application is submitted → update lead status
CREATE OR REPLACE FUNCTION update_lead_on_application()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'submitted' THEN
    UPDATE public.leads SET status = 'applied', updated_at = NOW() WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_lead_on_application
AFTER INSERT OR UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION update_lead_on_application();

-- When admission is created → update lead status + auto-create student profile placeholder
CREATE OR REPLACE FUNCTION finalize_admission()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark lead as admitted
  UPDATE public.leads SET status = 'admitted', updated_at = NOW() WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finalize_admission
AFTER INSERT ON public.admissions
FOR EACH ROW EXECUTE FUNCTION finalize_admission();
