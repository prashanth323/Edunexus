-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 03: School Operations
-- ============================================================

-- ─── ACADEMIC YEARS ───────────────────────────────────────────
CREATE TABLE public.academic_years (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,       -- e.g. "2024-25"
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_current  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_academic_years_school_id ON public.academic_years(school_id);

-- Ensure only one current academic year per school
CREATE UNIQUE INDEX idx_academic_years_current
  ON public.academic_years(school_id)
  WHERE is_current = true;

-- ─── DEPARTMENTS ──────────────────────────────────────────────
CREATE TABLE public.departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT,
  head_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_departments_school_id ON public.departments(school_id);

-- ─── STAFF ────────────────────────────────────────────────────
CREATE TABLE public.staff (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  profile_id       UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  department_id    UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  employee_code    TEXT,
  designation      TEXT NOT NULL,
  joining_date     DATE,
  leaving_date     DATE,
  employment_type  TEXT CHECK (employment_type IN ('full_time','part_time','contract','visiting')),
  salary           NUMERIC(12,2),
  bank_details     JSONB,          -- { account_no, ifsc, bank_name } — encrypted at app level
  qualifications   JSONB DEFAULT '[]',
  documents        JSONB DEFAULT '[]',  -- references to storage
  is_active        BOOLEAN NOT NULL DEFAULT true,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, employee_code)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_staff_school_id ON public.staff(school_id);
CREATE INDEX idx_staff_profile_id ON public.staff(profile_id);
CREATE INDEX idx_staff_department_id ON public.staff(department_id);
CREATE INDEX idx_staff_is_active ON public.staff(school_id, is_active) WHERE deleted_at IS NULL;

-- ─── CLASSES (GRADE LEVELS) ───────────────────────────────────
CREATE TABLE public.classes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,        -- e.g. "Grade 1", "Class X"
  numeric_level INT,                -- for ordering: 1..12
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_classes_school_id ON public.classes(school_id);

-- ─── SECTIONS ─────────────────────────────────────────────────
CREATE TABLE public.sections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,    -- A, B, C
  class_teacher_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  room_no          TEXT,
  capacity         INT DEFAULT 40,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, class_id, academic_year_id, name)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sections
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_sections_school_id ON public.sections(school_id);
CREATE INDEX idx_sections_class_id ON public.sections(class_id);
CREATE INDEX idx_sections_academic_year_id ON public.sections(academic_year_id);

-- ─── SUBJECTS ─────────────────────────────────────────────────
CREATE TABLE public.subjects (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  code          TEXT,
  is_elective   BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, code)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_subjects_school_id ON public.subjects(school_id);

-- ─── TIMETABLES ───────────────────────────────────────────────
CREATE TABLE public.timetables (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  section_id    UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  subject_id    UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  staff_id      UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Mon
  period_no     INT NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  room_no       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, section_id, day_of_week, period_no)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.timetables
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_timetables_school_id  ON public.timetables(school_id);
CREATE INDEX idx_timetables_section_id ON public.timetables(section_id);
CREATE INDEX idx_timetables_staff_id   ON public.timetables(staff_id);

-- ─── NOTICES ──────────────────────────────────────────────────
CREATE TABLE public.notices (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  audience      notice_audience NOT NULL DEFAULT 'all',
  class_ids     UUID[],           -- optionally target specific classes
  section_ids   UUID[],
  attachments   JSONB DEFAULT '[]',
  is_published  BOOLEAN NOT NULL DEFAULT false,
  published_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_notices_school_id   ON public.notices(school_id);
CREATE INDEX idx_notices_published   ON public.notices(school_id, is_published) WHERE deleted_at IS NULL;
CREATE INDEX idx_notices_audience    ON public.notices(school_id, audience);
