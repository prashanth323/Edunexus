-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 04: Student System
-- ============================================================

-- ─── PARENTS ──────────────────────────────────────────────────
CREATE TABLE public.parents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  profile_id   UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  email        TEXT,
  phone        TEXT NOT NULL,
  alt_phone    TEXT,
  gender       gender_type,
  occupation   TEXT,
  annual_income NUMERIC(14,2),
  address      JSONB,
  id_proof_type  TEXT,            -- aadhaar, pan, passport
  id_proof_no    TEXT,
  documents    JSONB DEFAULT '[]',
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.parents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_parents_school_id  ON public.parents(school_id);
CREATE INDEX idx_parents_profile_id ON public.parents(profile_id);
CREATE INDEX idx_parents_phone      ON public.parents(phone);
CREATE INDEX idx_parents_email      ON public.parents(email) WHERE email IS NOT NULL;

-- ─── STUDENTS ─────────────────────────────────────────────────
CREATE TABLE public.students (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  profile_id        UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  admission_no      TEXT NOT NULL,          -- school-assigned admission number
  roll_no           TEXT,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  gender            gender_type,
  date_of_birth     DATE,
  blood_group       TEXT,
  nationality       TEXT DEFAULT 'Indian',
  religion          TEXT,
  category          TEXT,                   -- general, OBC, SC, ST etc.
  phone             TEXT,
  email             TEXT,
  address           JSONB,
  permanent_address JSONB,
  emergency_contact JSONB,                  -- { name, phone, relation }
  medical_info      JSONB DEFAULT '{}',     -- allergies, conditions
  documents         JSONB DEFAULT '[]',
  photo_url         TEXT,
  admission_date    DATE,
  leaving_date      DATE,
  leaving_reason    TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, admission_no)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_students_school_id    ON public.students(school_id);
CREATE INDEX idx_students_profile_id   ON public.students(profile_id);
CREATE INDEX idx_students_admission_no ON public.students(school_id, admission_no);
CREATE INDEX idx_students_is_active    ON public.students(school_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_name_trgm    ON public.students USING GIN ((first_name || ' ' || last_name) gin_trgm_ops);

-- ─── STUDENT_PARENTS ──────────────────────────────────────────
CREATE TABLE public.student_parents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id   UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  relation    TEXT NOT NULL,       -- father, mother, guardian
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, parent_id)
);
CREATE INDEX idx_student_parents_student_id ON public.student_parents(student_id);
CREATE INDEX idx_student_parents_parent_id  ON public.student_parents(parent_id);
CREATE INDEX idx_student_parents_school_id  ON public.student_parents(school_id);

-- ─── ENROLLMENTS ──────────────────────────────────────────────
-- Maps student → section for an academic year
CREATE TABLE public.enrollments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  roll_no          TEXT,
  enrolled_at      DATE NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','transferred','dropped','passed')),
  transferred_from UUID REFERENCES public.schools(id),
  remarks          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_id, academic_year_id)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_enrollments_school_id        ON public.enrollments(school_id);
CREATE INDEX idx_enrollments_student_id       ON public.enrollments(student_id);
CREATE INDEX idx_enrollments_section_id       ON public.enrollments(section_id);
CREATE INDEX idx_enrollments_academic_year_id ON public.enrollments(academic_year_id);

-- ─── ATTENDANCE ───────────────────────────────────────────────
CREATE TABLE public.attendance (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id),
  date             DATE NOT NULL,
  status           attendance_status NOT NULL DEFAULT 'present',
  marked_by        UUID REFERENCES public.profiles(id),
  subject_id       UUID REFERENCES public.subjects(id),  -- NULL = daily attendance
  remarks          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_attendance_student_date_subject_unique
  ON public.attendance (school_id, student_id, date, COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::UUID));
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_attendance_school_id  ON public.attendance(school_id);
CREATE INDEX idx_attendance_student_id ON public.attendance(student_id, date DESC);
CREATE INDEX idx_attendance_section_id ON public.attendance(section_id, date DESC);
CREATE INDEX idx_attendance_date       ON public.attendance(school_id, date);

-- ─── LEAVE REQUESTS ───────────────────────────────────────────
CREATE TABLE public.leave_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  requested_by  UUID REFERENCES public.profiles(id),     -- parent or student
  leave_type    leave_type NOT NULL,
  from_date     DATE NOT NULL,
  to_date       DATE NOT NULL,
  reason        TEXT NOT NULL,
  status        leave_status NOT NULL DEFAULT 'pending',
  reviewed_by   UUID REFERENCES public.profiles(id),
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT,
  documents     JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_leave_dates CHECK (to_date >= from_date)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_leave_requests_school_id  ON public.leave_requests(school_id);
CREATE INDEX idx_leave_requests_student_id ON public.leave_requests(student_id);
CREATE INDEX idx_leave_requests_status     ON public.leave_requests(school_id, status);
