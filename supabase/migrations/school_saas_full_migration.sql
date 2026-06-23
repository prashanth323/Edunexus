-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 01: Extensions, Enums, Helper Functions
-- ============================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";       -- composite GIN indexes

-- ─── ENUMS ──────────────────────────────────────────────────

-- Platform-level roles
CREATE TYPE platform_role AS ENUM (
  'super_admin',
  'operations_admin',
  'finance_admin',
  'support_admin',
  'analyst'
);

-- School-level roles
CREATE TYPE school_role AS ENUM (
  'principal',
  'vice_principal',
  'school_admin',
  'admission_manager',
  'counselor',
  'accountant',
  'hr_manager',
  'teacher',
  'class_teacher',
  'librarian',
  'transport_manager',
  'student',
  'parent'
);

-- Gender
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- Attendance status
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'half_day', 'holiday', 'excused');

-- Lead / CRM status
CREATE TYPE lead_status AS ENUM (
  'new',
  'contacted',
  'interested',
  'followup_scheduled',
  'visit_scheduled',
  'visited',
  'applied',
  'admitted',
  'not_interested',
  'lost'
);

-- Application status
CREATE TYPE application_status AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'documents_pending',
  'approved',
  'rejected',
  'waitlisted',
  'withdrawn'
);

-- Fee status
CREATE TYPE fee_status AS ENUM ('pending', 'partial', 'paid', 'overdue', 'waived', 'refunded');

-- Payment method
CREATE TYPE payment_method AS ENUM (
  'cash',
  'cheque',
  'bank_transfer',
  'upi',
  'card',
  'online_portal',
  'dd'
);

-- Leave type
CREATE TYPE leave_type AS ENUM ('sick', 'casual', 'emergency', 'planned', 'medical');

-- Leave status
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- Assignment submission status
CREATE TYPE submission_status AS ENUM ('not_submitted', 'submitted', 'late', 'graded', 'returned');

-- Exam type
CREATE TYPE exam_type AS ENUM ('unit_test', 'mid_term', 'final', 'practical', 'online', 'mock');

-- Course / material type
CREATE TYPE material_type AS ENUM ('pdf', 'video', 'doc', 'ppt', 'link', 'image', 'audio');

-- Bus route stop type
CREATE TYPE stop_type AS ENUM ('pickup', 'dropoff', 'both');

-- Expense category
CREATE TYPE expense_category AS ENUM (
  'salaries',
  'infrastructure',
  'utilities',
  'supplies',
  'marketing',
  'maintenance',
  'transport',
  'events',
  'miscellaneous'
);

-- Notice audience
CREATE TYPE notice_audience AS ENUM ('all', 'teachers', 'students', 'parents', 'staff');

-- Payroll status
CREATE TYPE payroll_status AS ENUM ('draft', 'processed', 'paid', 'cancelled');

-- ─── UPDATED_AT TRIGGER FUNCTION ──────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── HELPER: APPLY updated_at TRIGGER TO ANY TABLE ────────────
CREATE OR REPLACE FUNCTION create_updated_at_trigger(tbl TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER set_updated_at
     BEFORE UPDATE ON %I
     FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
    tbl
  );
END;
$$ LANGUAGE plpgsql;

-- ─── HELPER: CURRENT USER'S SCHOOL_ID ─────────────────────────
-- Used inside RLS policies to avoid repeated subqueries
CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── HELPER: IS PLATFORM ADMIN? ───────────────────────────────
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND platform_role IN ('super_admin','operations_admin','finance_admin','support_admin','analyst')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── HELPER: IS SUPER ADMIN? ──────────────────────────────────
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND platform_role = 'super_admin'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── HELPER: HAS SCHOOL ROLE? ─────────────────────────────────
CREATE OR REPLACE FUNCTION has_school_role(required_role school_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.school_id = get_my_school_id()
      AND ur.role = required_role
      AND ur.is_active = true
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;
-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 02: Platform Core Tables
-- ============================================================

-- ─── ORGANIZATIONS ────────────────────────────────────────────
-- Optional grouping: a trust or company that owns multiple schools
CREATE TABLE public.organizations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  logo_url       TEXT,
  website        TEXT,
  address        JSONB,          -- { street, city, state, pincode, country }
  contact_email  TEXT,
  contact_phone  TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_organizations_slug ON public.organizations(slug);

-- ─── SCHOOLS ──────────────────────────────────────────────────
CREATE TABLE public.schools (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  code             TEXT UNIQUE,                 -- short internal code e.g. "DPS-HYD"
  logo_url         TEXT,
  cover_url        TEXT,
  address          JSONB,
  contact_email    TEXT,
  contact_phone    TEXT,
  board            TEXT,                        -- CBSE / ICSE / State
  established_year INT,
  affiliation_no   TEXT,
  timezone         TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  currency         TEXT NOT NULL DEFAULT 'INR',
  academic_start_month INT NOT NULL DEFAULT 6, -- 6 = June
  is_active        BOOLEAN NOT NULL DEFAULT true,
  settings         JSONB DEFAULT '{}',          -- school-specific config
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_schools_organization_id ON public.schools(organization_id);
CREATE INDEX idx_schools_slug ON public.schools(slug);
CREATE INDEX idx_schools_is_active ON public.schools(is_active) WHERE deleted_at IS NULL;

-- ─── PROFILES ─────────────────────────────────────────────────
-- Linked 1:1 to auth.users via id
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id       UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  platform_role   platform_role,               -- NULL for school-only users
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  gender          gender_type,
  date_of_birth   DATE,
  address         JSONB,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_platform_role ON public.profiles(platform_role) WHERE platform_role IS NOT NULL;

-- ─── ROLES ────────────────────────────────────────────────────
CREATE TABLE public.roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT UNIQUE NOT NULL,      -- matches enum value
  label       TEXT NOT NULL,             -- human-readable
  scope       TEXT NOT NULL CHECK (scope IN ('platform','school')),
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,  -- cannot be deleted
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── PERMISSIONS ──────────────────────────────────────────────
CREATE TABLE public.permissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource    TEXT NOT NULL,   -- e.g. 'students', 'leads', 'fees'
  action      TEXT NOT NULL,   -- e.g. 'read', 'create', 'update', 'delete'
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(resource, action)
);

-- ─── ROLE_PERMISSIONS ─────────────────────────────────────────
CREATE TABLE public.role_permissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id       UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);
CREATE INDEX idx_role_permissions_role_id ON public.role_permissions(role_id);

-- ─── USER_ROLES ───────────────────────────────────────────────
-- A user can have different roles in different schools
CREATE TABLE public.user_roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id   UUID REFERENCES public.schools(id) ON DELETE CASCADE,  -- NULL for platform roles
  role        school_role NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  granted_by  UUID REFERENCES public.profiles(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, school_id, role)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_school_id ON public.user_roles(school_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- ─── AUDIT LOGS ───────────────────────────────────────────────
CREATE TABLE public.audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id    UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,    -- CREATE, UPDATE, DELETE, LOGIN, etc.
  resource     TEXT NOT NULL,    -- table name
  resource_id  UUID,
  old_data     JSONB,
  new_data     JSONB,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_school_id   ON public.audit_logs(school_id);
CREATE INDEX idx_audit_logs_actor_id    ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_resource    ON public.audit_logs(resource, resource_id);
CREATE INDEX idx_audit_logs_created_at  ON public.audit_logs(created_at DESC);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  _school_id UUID;
BEGIN
  -- Try to extract school_id from the row
  BEGIN
    IF TG_OP = 'DELETE' THEN
      _school_id := (row_to_json(OLD)->>'school_id')::UUID;
    ELSE
      _school_id := (row_to_json(NEW)->>'school_id')::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    _school_id := NULL;
  END;

  INSERT INTO public.audit_logs(school_id, actor_id, action, resource, resource_id, old_data, new_data)
  VALUES (
    _school_id,
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE TG_OP
      WHEN 'DELETE' THEN (row_to_json(OLD)->>'id')::UUID
      ELSE (row_to_json(NEW)->>'id')::UUID
    END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE row_to_json(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE row_to_json(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
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
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_id, date, COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::UUID))
);
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
-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 05: Finance Module
-- ============================================================

-- ─── FEE STRUCTURES ───────────────────────────────────────────
CREATE TABLE public.fee_structures (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  class_id         UUID REFERENCES public.classes(id) ON DELETE SET NULL,  -- NULL = all classes
  name             TEXT NOT NULL,      -- "Tuition Fee", "Transport Fee"
  amount           NUMERIC(12,2) NOT NULL,
  frequency        TEXT NOT NULL DEFAULT 'annual'
                     CHECK (frequency IN ('one_time','monthly','quarterly','semi_annual','annual')),
  due_day          INT,                -- day of month due
  late_fine_per_day NUMERIC(8,2) DEFAULT 0,
  is_optional      BOOLEAN NOT NULL DEFAULT false,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.fee_structures
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_fee_structures_school_id        ON public.fee_structures(school_id);
CREATE INDEX idx_fee_structures_academic_year_id ON public.fee_structures(academic_year_id);

-- ─── STUDENT INVOICES ─────────────────────────────────────────
CREATE TABLE public.student_invoices (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id),
  fee_structure_id UUID REFERENCES public.fee_structures(id) ON DELETE SET NULL,
  invoice_no       TEXT NOT NULL,
  description      TEXT,
  amount           NUMERIC(12,2) NOT NULL,
  discount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  fine             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(12,2) GENERATED ALWAYS AS (amount - discount + fine) STORED,
  paid_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_amount       NUMERIC(12,2) GENERATED ALWAYS AS (amount - discount + fine - paid_amount) STORED,
  status           fee_status NOT NULL DEFAULT 'pending',
  due_date         DATE NOT NULL,
  notes            TEXT,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, invoice_no)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.student_invoices
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_student_invoices_school_id   ON public.student_invoices(school_id);
CREATE INDEX idx_student_invoices_student_id  ON public.student_invoices(student_id);
CREATE INDEX idx_student_invoices_status      ON public.student_invoices(school_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_student_invoices_due_date    ON public.student_invoices(school_id, due_date) WHERE deleted_at IS NULL;

-- ─── PAYMENTS ─────────────────────────────────────────────────
CREATE TABLE public.payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invoice_id      UUID NOT NULL REFERENCES public.student_invoices(id) ON DELETE RESTRICT,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  receipt_no      TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  method          payment_method NOT NULL,
  transaction_ref TEXT,               -- cheque no / UTR / card last4
  gateway_ref     TEXT,               -- payment gateway reference
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_by    UUID REFERENCES public.profiles(id),
  bank_name       TEXT,
  notes           TEXT,
  receipt_url     TEXT,
  is_refunded     BOOLEAN NOT NULL DEFAULT false,
  refunded_at     TIMESTAMPTZ,
  refund_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, receipt_no)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_payments_school_id   ON public.payments(school_id);
CREATE INDEX idx_payments_invoice_id  ON public.payments(invoice_id);
CREATE INDEX idx_payments_student_id  ON public.payments(student_id);
CREATE INDEX idx_payments_paid_at     ON public.payments(school_id, paid_at DESC);
CREATE INDEX idx_payments_method      ON public.payments(school_id, method);

-- Update invoice paid_amount on payment insert/update
CREATE OR REPLACE FUNCTION update_invoice_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.student_invoices
  SET paid_amount = (
    SELECT COALESCE(SUM(amount),0)
    FROM public.payments
    WHERE invoice_id = NEW.invoice_id AND is_refunded = false
  ),
  status = CASE
    WHEN (SELECT COALESCE(SUM(amount),0) FROM public.payments WHERE invoice_id = NEW.invoice_id AND is_refunded = false) <= 0
      THEN 'pending'
    WHEN (SELECT COALESCE(SUM(amount),0) FROM public.payments WHERE invoice_id = NEW.invoice_id AND is_refunded = false) >= amount - discount + fine
      THEN 'paid'
    ELSE 'partial'
  END
  WHERE id = NEW.invoice_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_invoice_on_payment
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION update_invoice_paid_amount();

-- ─── EXPENSES ─────────────────────────────────────────────────
CREATE TABLE public.expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category     expense_category NOT NULL,
  description  TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  date         DATE NOT NULL,
  paid_to      TEXT,
  method       payment_method,
  approved_by  UUID REFERENCES public.profiles(id),
  receipt_url  TEXT,
  notes        TEXT,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_expenses_school_id ON public.expenses(school_id);
CREATE INDEX idx_expenses_date      ON public.expenses(school_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_category  ON public.expenses(school_id, category);

-- ─── PAYROLL ──────────────────────────────────────────────────
CREATE TABLE public.payroll (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  month           INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            INT NOT NULL,
  basic_salary    NUMERIC(12,2) NOT NULL,
  allowances      JSONB DEFAULT '{}',   -- { hra: 0, ta: 0, da: 0 }
  deductions      JSONB DEFAULT '{}',   -- { pf: 0, tds: 0, loan: 0 }
  gross_salary    NUMERIC(12,2) GENERATED ALWAYS AS (
                    basic_salary
                    + COALESCE((SELECT SUM(v::numeric) FROM jsonb_each_text(allowances) AS t(k,v) WHERE v ~ '^\d'), 0)
                  ) STORED,
  net_salary      NUMERIC(12,2) NOT NULL,
  status          payroll_status NOT NULL DEFAULT 'draft',
  paid_at         TIMESTAMPTZ,
  payment_method  payment_method,
  transaction_ref TEXT,
  processed_by    UUID REFERENCES public.profiles(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, staff_id, month, year)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payroll
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_payroll_school_id ON public.payroll(school_id);
CREATE INDEX idx_payroll_staff_id  ON public.payroll(staff_id);
CREATE INDEX idx_payroll_month_year ON public.payroll(school_id, year, month);
-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 06: Learning Management System (LMS)
-- ============================================================

-- ─── COURSES ──────────────────────────────────────────────────
CREATE TABLE public.courses (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id       UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  class_id         UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  section_id       UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  teacher_id       UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  cover_url        TEXT,
  is_published     BOOLEAN NOT NULL DEFAULT false,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_courses_school_id        ON public.courses(school_id);
CREATE INDEX idx_courses_subject_id       ON public.courses(subject_id);
CREATE INDEX idx_courses_academic_year_id ON public.courses(academic_year_id);
CREATE INDEX idx_courses_teacher_id       ON public.courses(teacher_id);

-- ─── COURSE LESSONS ───────────────────────────────────────────
CREATE TABLE public.course_lessons (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  course_id    UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  content      TEXT,            -- rich text / markdown
  order_no     INT NOT NULL DEFAULT 0,
  duration_min INT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.course_lessons
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_course_lessons_school_id ON public.course_lessons(school_id);
CREATE INDEX idx_course_lessons_course_id ON public.course_lessons(course_id);

-- ─── STUDY MATERIALS ──────────────────────────────────────────
CREATE TABLE public.study_materials (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  lesson_id   UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  course_id   UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  type        material_type NOT NULL,
  url         TEXT NOT NULL,         -- storage URL or external link
  file_size   BIGINT,
  duration    INT,                   -- seconds for video/audio
  uploaded_by UUID REFERENCES public.profiles(id),
  is_public   BOOLEAN NOT NULL DEFAULT false,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.study_materials
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_study_materials_school_id ON public.study_materials(school_id);
CREATE INDEX idx_study_materials_course_id ON public.study_materials(course_id);
CREATE INDEX idx_study_materials_lesson_id ON public.study_materials(lesson_id);

-- ─── ASSIGNMENTS ──────────────────────────────────────────────
CREATE TABLE public.assignments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  course_id        UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES public.profiles(id),
  title            TEXT NOT NULL,
  description      TEXT,
  instructions     TEXT,
  max_marks        NUMERIC(6,2) NOT NULL DEFAULT 100,
  passing_marks    NUMERIC(6,2),
  due_date         TIMESTAMPTZ NOT NULL,
  allow_late       BOOLEAN NOT NULL DEFAULT false,
  attachments      JSONB DEFAULT '[]',
  is_published     BOOLEAN NOT NULL DEFAULT false,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_assignments_school_id ON public.assignments(school_id);
CREATE INDEX idx_assignments_course_id ON public.assignments(course_id);
CREATE INDEX idx_assignments_due_date  ON public.assignments(school_id, due_date);

-- ─── ASSIGNMENT SUBMISSIONS ───────────────────────────────────
CREATE TABLE public.assignment_submissions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  assignment_id  UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submitted_at   TIMESTAMPTZ,
  content        TEXT,
  attachments    JSONB DEFAULT '[]',
  status         submission_status NOT NULL DEFAULT 'not_submitted',
  marks_obtained NUMERIC(6,2),
  feedback       TEXT,
  graded_by      UUID REFERENCES public.profiles(id),
  graded_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_assignment_submissions_school_id     ON public.assignment_submissions(school_id);
CREATE INDEX idx_assignment_submissions_assignment_id ON public.assignment_submissions(assignment_id);
CREATE INDEX idx_assignment_submissions_student_id    ON public.assignment_submissions(student_id);

-- ─── EXAMS ────────────────────────────────────────────────────
CREATE TABLE public.exams (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  class_id         UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  subject_id       UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  type             exam_type NOT NULL,
  date             DATE,
  start_time       TIME,
  end_time         TIME,
  max_marks        NUMERIC(6,2) NOT NULL DEFAULT 100,
  passing_marks    NUMERIC(6,2),
  venue            TEXT,
  instructions     TEXT,
  is_published     BOOLEAN NOT NULL DEFAULT false,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_exams_school_id        ON public.exams(school_id);
CREATE INDEX idx_exams_academic_year_id ON public.exams(academic_year_id);
CREATE INDEX idx_exams_class_id         ON public.exams(class_id);

-- ─── EXAM RESULTS ─────────────────────────────────────────────
CREATE TABLE public.exam_results (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  exam_id        UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  marks_obtained NUMERIC(6,2),
  grade          TEXT,
  is_absent      BOOLEAN NOT NULL DEFAULT false,
  remarks        TEXT,
  entered_by     UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exam_id, student_id)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.exam_results
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_exam_results_school_id  ON public.exam_results(school_id);
CREATE INDEX idx_exam_results_exam_id    ON public.exam_results(exam_id);
CREATE INDEX idx_exam_results_student_id ON public.exam_results(student_id);
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
-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 08: Transport & Hostel
-- ============================================================

-- ─── BUSES ────────────────────────────────────────────────────
CREATE TABLE public.buses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  registration_no TEXT NOT NULL,
  make_model      TEXT,
  capacity        INT NOT NULL DEFAULT 40,
  driver_id       UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  attendant_id    UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  gps_device_id   TEXT,
  insurance_expiry DATE,
  fitness_expiry   DATE,
  permit_expiry    DATE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, registration_no)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.buses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_buses_school_id ON public.buses(school_id);

-- ─── ROUTES ───────────────────────────────────────────────────
CREATE TABLE public.routes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  bus_id      UUID REFERENCES public.buses(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  description TEXT,
  fare        NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_routes_school_id ON public.routes(school_id);
CREATE INDEX idx_routes_bus_id    ON public.routes(bus_id);

-- Route stops (ordered)
CREATE TABLE public.route_stops (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  route_id    UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  lat         NUMERIC(10,7),
  lng         NUMERIC(10,7),
  stop_order  INT NOT NULL,
  stop_type   stop_type NOT NULL DEFAULT 'both',
  eta_minutes INT,                 -- minutes from previous stop
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(route_id, stop_order)
);
CREATE INDEX idx_route_stops_route_id ON public.route_stops(route_id);

-- ─── ROUTE STUDENTS ───────────────────────────────────────────
CREATE TABLE public.route_students (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  route_id        UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  stop_id         UUID REFERENCES public.route_stops(id) ON DELETE SET NULL,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id),
  pickup_address  TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_id, academic_year_id)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.route_students
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_route_students_school_id  ON public.route_students(school_id);
CREATE INDEX idx_route_students_route_id   ON public.route_students(route_id);
CREATE INDEX idx_route_students_student_id ON public.route_students(student_id);

-- ─── HOSTEL ROOMS ─────────────────────────────────────────────
CREATE TABLE public.hostel_rooms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  room_no     TEXT NOT NULL,
  block       TEXT,              -- Hostel block / building
  floor       INT,
  type        TEXT NOT NULL DEFAULT 'dormitory'
                CHECK (type IN ('single','double','triple','dormitory')),
  capacity    INT NOT NULL DEFAULT 4,
  monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  amenities   TEXT[],
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, room_no)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.hostel_rooms
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_hostel_rooms_school_id ON public.hostel_rooms(school_id);

-- ─── HOSTEL ALLOCATIONS ───────────────────────────────────────
CREATE TABLE public.hostel_allocations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  room_id          UUID NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id),
  check_in_date    DATE NOT NULL,
  check_out_date   DATE,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_id, academic_year_id)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.hostel_allocations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_hostel_allocations_school_id  ON public.hostel_allocations(school_id);
CREATE INDEX idx_hostel_allocations_room_id    ON public.hostel_allocations(room_id);
CREATE INDEX idx_hostel_allocations_student_id ON public.hostel_allocations(student_id);

-- Guard: room capacity not exceeded
CREATE OR REPLACE FUNCTION check_room_capacity()
RETURNS TRIGGER AS $$
DECLARE
  _capacity INT;
  _current  INT;
BEGIN
  SELECT capacity INTO _capacity FROM public.hostel_rooms WHERE id = NEW.room_id;
  SELECT COUNT(*) INTO _current FROM public.hostel_allocations
  WHERE room_id = NEW.room_id AND is_active = true AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');
  IF _current >= _capacity THEN
    RAISE EXCEPTION 'Room % is at full capacity (%)', NEW.room_id, _capacity;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_room_capacity
BEFORE INSERT OR UPDATE ON public.hostel_allocations
FOR EACH ROW WHEN (NEW.is_active = true)
EXECUTE FUNCTION check_room_capacity();
-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 09: Row Level Security (RLS) Policies
-- ============================================================

-- ─── ENABLE RLS ON ALL TABLES ─────────────────────────────────
ALTER TABLE public.organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetables          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_parents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_invoices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_materials     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counselors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_visits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_students      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_allocations  ENABLE ROW LEVEL SECURITY;

-- ─── REUSABLE POLICY EXPRESSIONS ──────────────────────────────
-- Pattern A: Super admin sees all / school users see own school only
-- Pattern B: Super admin + principal/admin can write / others read only
-- Pattern C: Role-specific restricted access

-- ===== ORGANIZATIONS =====
CREATE POLICY "org_select" ON public.organizations FOR SELECT
  USING (is_platform_admin());

CREATE POLICY "org_all" ON public.organizations FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ===== SCHOOLS =====
CREATE POLICY "schools_select_admin" ON public.schools FOR SELECT
  USING (is_platform_admin() OR id = get_my_school_id());

CREATE POLICY "schools_write_super" ON public.schools FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ===== PROFILES =====
-- Users can read profiles in their own school; platform admins read all
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR is_platform_admin()
    OR school_id = get_my_school_id()
  );

CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT
  WITH CHECK (is_super_admin() OR has_school_role('school_admin') OR has_school_role('principal'));

-- ===== ROLES / PERMISSIONS (read-only for all authenticated) =====
CREATE POLICY "roles_select_all" ON public.roles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "roles_write_super" ON public.roles FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "permissions_select_all" ON public.permissions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "permissions_write_super" ON public.permissions FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "role_permissions_select_all" ON public.role_permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- ===== USER_ROLES =====
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT
  USING (
    is_platform_admin()
    OR user_id = auth.uid()
    OR school_id = get_my_school_id()
  );

CREATE POLICY "user_roles_write" ON public.user_roles FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin')))
  );

-- ===== AUDIT LOGS =====
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin')))
  );

-- Audit logs are insert-only via trigger (no user-level write)
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- ===== SCHOOL-SCOPED GENERIC POLICY HELPER =====
-- For most school tables we repeat this pattern: super_admin sees all, school users see own
-- Academic Years
CREATE POLICY "ay_select" ON public.academic_years FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "ay_write" ON public.academic_years FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin'))));

-- Departments
CREATE POLICY "dept_select" ON public.departments FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "dept_write" ON public.departments FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin') OR has_school_role('hr_manager'))));

-- Staff
CREATE POLICY "staff_select" ON public.staff FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "staff_write" ON public.staff FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('hr_manager') OR has_school_role('school_admin'))));

-- Classes, Sections, Subjects
CREATE POLICY "classes_select" ON public.classes FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "classes_write" ON public.classes FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin'))));

CREATE POLICY "sections_select" ON public.sections FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "sections_write" ON public.sections FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin'))));

CREATE POLICY "subjects_select" ON public.subjects FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "subjects_write" ON public.subjects FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin'))));

-- Timetables (teachers can view their own)
CREATE POLICY "timetables_select" ON public.timetables FOR SELECT
  USING (
    is_platform_admin()
    OR school_id = get_my_school_id()
  );
CREATE POLICY "timetables_write" ON public.timetables FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin'))));

-- Notices
CREATE POLICY "notices_select" ON public.notices FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND is_published = true AND deleted_at IS NULL)
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin')))
  );
CREATE POLICY "notices_write" ON public.notices FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin') OR has_school_role('vice_principal'))));

-- ===== STUDENTS =====
CREATE POLICY "students_select" ON public.students FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('school_admin') OR
      has_school_role('teacher') OR has_school_role('class_teacher') OR
      has_school_role('accountant') OR has_school_role('admission_manager')
    ))
    OR id IN (
      SELECT student_id FROM public.enrollments
      WHERE school_id = get_my_school_id()
        AND section_id IN (
          SELECT id FROM public.timetables
          WHERE school_id = get_my_school_id()
            AND staff_id IN (SELECT id FROM public.staff WHERE profile_id = auth.uid())
        )
    )
    -- Student sees own record
    OR profile_id = auth.uid()
    -- Parent sees linked children
    OR id IN (
      SELECT sp.student_id FROM public.student_parents sp
      JOIN public.parents p ON sp.parent_id = p.id
      WHERE p.profile_id = auth.uid()
    )
  );
CREATE POLICY "students_write" ON public.students FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin') OR has_school_role('admission_manager'))));

-- ===== PARENTS =====
CREATE POLICY "parents_select" ON public.parents FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin') OR has_school_role('class_teacher') OR has_school_role('admission_manager')))
    OR profile_id = auth.uid()
  );
CREATE POLICY "parents_write" ON public.parents FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin') OR has_school_role('admission_manager'))));

-- ===== STUDENT_PARENTS =====
CREATE POLICY "student_parents_select" ON public.student_parents FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "student_parents_write" ON public.student_parents FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin') OR has_school_role('admission_manager'))));

-- ===== ENROLLMENTS =====
CREATE POLICY "enrollments_select" ON public.enrollments FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND NOT has_school_role('student') AND NOT has_school_role('parent'))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (SELECT sp.student_id FROM public.student_parents sp JOIN public.parents p ON sp.parent_id = p.id WHERE p.profile_id = auth.uid())
  );
CREATE POLICY "enrollments_write" ON public.enrollments FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin'))));

-- ===== ATTENDANCE =====
CREATE POLICY "attendance_select" ON public.attendance FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin') OR has_school_role('teacher') OR has_school_role('class_teacher')))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (SELECT sp.student_id FROM public.student_parents sp JOIN public.parents p ON sp.parent_id = p.id WHERE p.profile_id = auth.uid())
  );
CREATE POLICY "attendance_write" ON public.attendance FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('teacher') OR has_school_role('class_teacher') OR has_school_role('school_admin'))));

-- ===== LEAVE REQUESTS =====
CREATE POLICY "leave_requests_select" ON public.leave_requests FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin') OR has_school_role('class_teacher')))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (SELECT sp.student_id FROM public.student_parents sp JOIN public.parents p ON sp.parent_id = p.id WHERE p.profile_id = auth.uid())
  );
CREATE POLICY "leave_requests_insert" ON public.leave_requests FOR INSERT
  WITH CHECK (
    school_id = get_my_school_id()
    AND (
      student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
      OR student_id IN (SELECT sp.student_id FROM public.student_parents sp JOIN public.parents p ON sp.parent_id = p.id WHERE p.profile_id = auth.uid())
      OR has_school_role('school_admin') OR has_school_role('principal')
    )
  );
CREATE POLICY "leave_requests_update" ON public.leave_requests FOR UPDATE
  USING (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin') OR has_school_role('class_teacher')));

-- ===== FINANCE =====
CREATE POLICY "fee_structures_select" ON public.fee_structures FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "fee_structures_write" ON public.fee_structures FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('accountant'))));

CREATE POLICY "invoices_select" ON public.student_invoices FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('accountant') OR has_school_role('school_admin')))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (SELECT sp.student_id FROM public.student_parents sp JOIN public.parents p ON sp.parent_id = p.id WHERE p.profile_id = auth.uid())
  );
CREATE POLICY "invoices_write" ON public.student_invoices FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('accountant'))));

CREATE POLICY "payments_select" ON public.payments FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('accountant') OR has_school_role('school_admin')))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (SELECT sp.student_id FROM public.student_parents sp JOIN public.parents p ON sp.parent_id = p.id WHERE p.profile_id = auth.uid())
  );
CREATE POLICY "payments_write" ON public.payments FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('accountant') OR has_school_role('principal'))));

CREATE POLICY "expenses_select" ON public.expenses FOR SELECT
  USING (is_platform_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('accountant'))));
CREATE POLICY "expenses_write" ON public.expenses FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('accountant'))));

CREATE POLICY "payroll_select" ON public.payroll FOR SELECT
  USING (is_platform_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('accountant') OR has_school_role('hr_manager'))));
CREATE POLICY "payroll_write" ON public.payroll FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('accountant'))));

-- ===== LMS =====
CREATE POLICY "courses_select" ON public.courses FOR SELECT
  USING (is_platform_admin() OR (school_id = get_my_school_id() AND is_published = true) OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('teacher') OR has_school_role('class_teacher') OR has_school_role('school_admin'))));
CREATE POLICY "courses_write" ON public.courses FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('teacher') OR has_school_role('class_teacher') OR has_school_role('principal') OR has_school_role('school_admin'))));

CREATE POLICY "lessons_select" ON public.course_lessons FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "lessons_write" ON public.course_lessons FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('teacher') OR has_school_role('class_teacher') OR has_school_role('school_admin'))));

CREATE POLICY "study_materials_select" ON public.study_materials FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "study_materials_write" ON public.study_materials FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('teacher') OR has_school_role('class_teacher') OR has_school_role('school_admin'))));

CREATE POLICY "assignments_select" ON public.assignments FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "assignments_write" ON public.assignments FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('teacher') OR has_school_role('class_teacher'))));

CREATE POLICY "submissions_select" ON public.assignment_submissions FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('teacher') OR has_school_role('class_teacher') OR has_school_role('principal')))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
  );
CREATE POLICY "submissions_insert" ON public.assignment_submissions FOR INSERT
  WITH CHECK (school_id = get_my_school_id() AND student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid()));
CREATE POLICY "submissions_update_grade" ON public.assignment_submissions FOR UPDATE
  USING (school_id = get_my_school_id() AND (has_school_role('teacher') OR has_school_role('class_teacher') OR has_school_role('school_admin')));

CREATE POLICY "exams_select" ON public.exams FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "exams_write" ON public.exams FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin') OR has_school_role('teacher') OR has_school_role('class_teacher'))));

CREATE POLICY "exam_results_select" ON public.exam_results FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin') OR has_school_role('teacher') OR has_school_role('class_teacher')))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (SELECT sp.student_id FROM public.student_parents sp JOIN public.parents p ON sp.parent_id = p.id WHERE p.profile_id = auth.uid())
  );
CREATE POLICY "exam_results_write" ON public.exam_results FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('teacher') OR has_school_role('class_teacher') OR has_school_role('school_admin') OR has_school_role('principal'))));

-- ===== CRM (STRICTLY SCHOOL-SCOPED) =====
-- Lead Sources
CREATE POLICY "lead_sources_select" ON public.lead_sources FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "lead_sources_write" ON public.lead_sources FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('admission_manager'))));

-- Counselors
CREATE POLICY "counselors_select" ON public.counselors FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "counselors_write" ON public.counselors FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('admission_manager'))));

-- Leads: counselors see only assigned leads; managers see all in school
CREATE POLICY "leads_select" ON public.leads FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('admission_manager') OR has_school_role('school_admin')))
    OR (school_id = get_my_school_id() AND id IN (
      SELECT la.lead_id FROM public.lead_assignments la
      JOIN public.counselors c ON la.counselor_id = c.id
      JOIN public.staff s ON c.staff_id = s.id
      WHERE s.profile_id = auth.uid() AND la.is_active = true
    ))
  );
CREATE POLICY "leads_insert" ON public.leads FOR INSERT
  WITH CHECK (school_id = get_my_school_id() AND (has_school_role('counselor') OR has_school_role('admission_manager') OR has_school_role('principal') OR has_school_role('school_admin')));
CREATE POLICY "leads_update" ON public.leads FOR UPDATE
  USING (
    school_id = get_my_school_id()
    AND (
      has_school_role('admission_manager') OR has_school_role('principal') OR has_school_role('school_admin')
      OR id IN (
        SELECT la.lead_id FROM public.lead_assignments la
        JOIN public.counselors c ON la.counselor_id = c.id
        JOIN public.staff s ON c.staff_id = s.id
        WHERE s.profile_id = auth.uid() AND la.is_active = true
      )
    )
  );

-- Lead Assignments
CREATE POLICY "lead_assignments_select" ON public.lead_assignments FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "lead_assignments_write" ON public.lead_assignments FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('admission_manager'))));

-- Followups: counselors manage own
CREATE POLICY "followups_select" ON public.followups FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('admission_manager') OR has_school_role('school_admin')))
    OR counselor_id IN (SELECT c.id FROM public.counselors c JOIN public.staff s ON c.staff_id = s.id WHERE s.profile_id = auth.uid())
  );
CREATE POLICY "followups_write" ON public.followups FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('admission_manager') OR has_school_role('principal')))
    OR (school_id = get_my_school_id() AND counselor_id IN (SELECT c.id FROM public.counselors c JOIN public.staff s ON c.staff_id = s.id WHERE s.profile_id = auth.uid()))
  );

-- Campus Visits
CREATE POLICY "campus_visits_select" ON public.campus_visits FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "campus_visits_write" ON public.campus_visits FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('counselor') OR has_school_role('admission_manager') OR has_school_role('principal'))));

-- Applications
CREATE POLICY "applications_select" ON public.applications FOR SELECT
  USING (is_platform_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('admission_manager') OR has_school_role('school_admin') OR has_school_role('counselor'))));
CREATE POLICY "applications_write" ON public.applications FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('admission_manager'))));

-- Admissions
CREATE POLICY "admissions_select" ON public.admissions FOR SELECT
  USING (is_platform_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('admission_manager') OR has_school_role('school_admin'))));
CREATE POLICY "admissions_write" ON public.admissions FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('admission_manager'))));

-- ===== TRANSPORT =====
CREATE POLICY "buses_select" ON public.buses FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "buses_write" ON public.buses FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('transport_manager'))));

CREATE POLICY "routes_select" ON public.routes FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "routes_write" ON public.routes FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('transport_manager'))));

CREATE POLICY "route_stops_select" ON public.route_stops FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "route_stops_write" ON public.route_stops FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('transport_manager'))));

CREATE POLICY "route_students_select" ON public.route_students FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('transport_manager') OR has_school_role('school_admin')))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (SELECT sp.student_id FROM public.student_parents sp JOIN public.parents p ON sp.parent_id = p.id WHERE p.profile_id = auth.uid())
  );
CREATE POLICY "route_students_write" ON public.route_students FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('transport_manager'))));

-- ===== HOSTEL =====
CREATE POLICY "hostel_rooms_select" ON public.hostel_rooms FOR SELECT
  USING (is_platform_admin() OR school_id = get_my_school_id());
CREATE POLICY "hostel_rooms_write" ON public.hostel_rooms FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin'))));

CREATE POLICY "hostel_allocations_select" ON public.hostel_allocations FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin')))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (SELECT sp.student_id FROM public.student_parents sp JOIN public.parents p ON sp.parent_id = p.id WHERE p.profile_id = auth.uid())
  );
CREATE POLICY "hostel_allocations_write" ON public.hostel_allocations FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin'))));
-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 10: Dashboard Views
-- ============================================================

-- ─── SUPER ADMIN DASHBOARD ────────────────────────────────────

-- Overall platform summary
CREATE OR REPLACE VIEW public.v_super_admin_summary AS
SELECT
  (SELECT COUNT(*) FROM public.schools WHERE deleted_at IS NULL AND is_active = true)         AS active_schools,
  (SELECT COUNT(*) FROM public.students WHERE deleted_at IS NULL AND is_active = true)         AS total_students,
  (SELECT COUNT(*) FROM public.leads   WHERE deleted_at IS NULL)                               AS total_leads,
  (SELECT COUNT(*) FROM public.leads   WHERE status = 'admitted' AND deleted_at IS NULL)       AS total_admissions,
  (SELECT COALESCE(SUM(paid_amount),0) FROM public.student_invoices WHERE deleted_at IS NULL)  AS total_collections,
  (SELECT COUNT(*) FROM public.staff   WHERE deleted_at IS NULL AND is_active = true)          AS total_staff,
  NOW() AS refreshed_at;

-- Per-school student counts
CREATE OR REPLACE VIEW public.v_school_student_counts AS
SELECT
  s.id          AS school_id,
  s.name        AS school_name,
  s.code        AS school_code,
  COUNT(st.id)  AS student_count
FROM public.schools s
LEFT JOIN public.students st ON st.school_id = s.id AND st.is_active = true AND st.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.name, s.code
ORDER BY student_count DESC;

-- Per-school lead and admission counts
CREATE OR REPLACE VIEW public.v_school_crm_summary AS
SELECT
  s.id                                                                      AS school_id,
  s.name                                                                    AS school_name,
  COUNT(l.id)                                                               AS total_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'new')                              AS new_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'admitted')                         AS admissions,
  COUNT(l.id) FILTER (WHERE l.created_at >= DATE_TRUNC('month', NOW()))    AS leads_this_month,
  COUNT(l.id) FILTER (WHERE l.status = 'admitted' AND l.updated_at >= DATE_TRUNC('month', NOW())) AS admissions_this_month,
  ROUND(
    CASE WHEN COUNT(l.id) > 0
      THEN COUNT(l.id) FILTER (WHERE l.status = 'admitted') * 100.0 / COUNT(l.id)
      ELSE 0
    END, 2
  )                                                                         AS conversion_rate
FROM public.schools s
LEFT JOIN public.leads l ON l.school_id = s.id AND l.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.name;

-- Per-school finance summary
CREATE OR REPLACE VIEW public.v_school_finance_summary AS
SELECT
  s.id                                                                        AS school_id,
  s.name                                                                      AS school_name,
  COALESCE(SUM(i.total_amount),0)                                             AS total_invoiced,
  COALESCE(SUM(i.paid_amount),0)                                              AS total_collected,
  COALESCE(SUM(i.due_amount),0)                                               AS total_outstanding,
  COALESCE(SUM(i.due_amount) FILTER (WHERE i.due_date < CURRENT_DATE AND i.status != 'paid'),0) AS overdue_amount,
  COUNT(i.id) FILTER (WHERE i.status = 'overdue')                             AS overdue_invoices
FROM public.schools s
LEFT JOIN public.student_invoices i ON i.school_id = s.id AND i.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.name;

-- ─── PRINCIPAL DASHBOARD ──────────────────────────────────────

-- School-level overview for principal
CREATE OR REPLACE VIEW public.v_principal_dashboard AS
SELECT
  s.id                                                                     AS school_id,
  s.name                                                                   AS school_name,
  -- Students
  (SELECT COUNT(*) FROM public.students WHERE school_id = s.id AND is_active = true AND deleted_at IS NULL)
                                                                           AS total_students,
  -- Teachers
  (SELECT COUNT(DISTINCT ur.user_id) FROM public.user_roles ur
   WHERE ur.school_id = s.id AND ur.role IN ('teacher','class_teacher') AND ur.is_active = true)
                                                                           AS teacher_count,
  -- Attendance today
  ROUND(
    (SELECT COUNT(*) FILTER (WHERE status = 'present') * 100.0 / NULLIF(COUNT(*),0)
     FROM public.attendance
     WHERE school_id = s.id AND date = CURRENT_DATE)
  , 2)                                                                     AS attendance_pct_today,
  -- Finance
  (SELECT COALESCE(SUM(due_amount),0) FROM public.student_invoices
   WHERE school_id = s.id AND status IN ('pending','partial','overdue') AND deleted_at IS NULL)
                                                                           AS total_pending_fees,
  (SELECT COALESCE(SUM(paid_amount),0) FROM public.student_invoices
   WHERE school_id = s.id AND deleted_at IS NULL AND due_date >= DATE_TRUNC('month', NOW()))
                                                                           AS collections_this_month,
  -- CRM
  (SELECT COUNT(*) FROM public.leads WHERE school_id = s.id AND status NOT IN ('admitted','lost') AND deleted_at IS NULL)
                                                                           AS active_leads,
  (SELECT COUNT(*) FROM public.leads WHERE school_id = s.id AND status = 'admitted'
   AND updated_at >= DATE_TRUNC('month', NOW()))                           AS admissions_this_month
FROM public.schools s
WHERE s.deleted_at IS NULL;

-- ─── COUNSELOR DASHBOARD ──────────────────────────────────────

CREATE OR REPLACE VIEW public.v_counselor_leads AS
SELECT
  c.id                                                   AS counselor_id,
  c.school_id,
  s.profile_id                                           AS profile_id,
  l.id                                                   AS lead_id,
  l.student_name,
  l.parent_name,
  l.parent_phone,
  l.status                                               AS lead_status,
  l.priority,
  l.class_interested,
  la.assigned_at,
  -- Next scheduled followup
  (SELECT MIN(f.scheduled_at) FROM public.followups f
   WHERE f.lead_id = l.id AND f.status = 'pending')     AS next_followup_at,
  -- Followup due today
  EXISTS(SELECT 1 FROM public.followups f
         WHERE f.lead_id = l.id AND f.status = 'pending'
           AND DATE(f.scheduled_at) = CURRENT_DATE)      AS has_followup_today,
  l.created_at
FROM public.counselors c
JOIN public.staff s ON c.staff_id = s.id
JOIN public.lead_assignments la ON la.counselor_id = c.id AND la.is_active = true
JOIN public.leads l ON l.id = la.lead_id AND l.deleted_at IS NULL
WHERE c.is_active = true;

-- Counselor performance
CREATE OR REPLACE VIEW public.v_counselor_performance AS
SELECT
  c.id                          AS counselor_id,
  c.school_id,
  s.profile_id,
  COUNT(la.lead_id)             AS total_assigned,
  COUNT(la.lead_id) FILTER (WHERE l.status = 'admitted')  AS conversions,
  COUNT(f.id) FILTER (WHERE f.status = 'done' AND DATE_TRUNC('month',f.completed_at) = DATE_TRUNC('month',NOW()))
                                AS followups_this_month,
  COUNT(cv.id) FILTER (WHERE cv.status = 'completed')     AS visits_arranged,
  c.target_leads,
  ROUND(
    CASE WHEN COUNT(la.lead_id) > 0
      THEN COUNT(la.lead_id) FILTER (WHERE l.status = 'admitted') * 100.0 / COUNT(la.lead_id)
      ELSE 0
    END, 2
  )                             AS conversion_rate
FROM public.counselors c
JOIN public.staff s ON c.staff_id = s.id
LEFT JOIN public.lead_assignments la ON la.counselor_id = c.id
LEFT JOIN public.leads l ON l.id = la.lead_id AND l.deleted_at IS NULL
LEFT JOIN public.followups f ON f.counselor_id = c.id
LEFT JOIN public.campus_visits cv ON cv.counselor_id = c.id
GROUP BY c.id, c.school_id, s.profile_id, c.target_leads;

-- ─── PARENT DASHBOARD ─────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_parent_children AS
SELECT
  p.id          AS parent_id,
  p.profile_id,
  p.school_id,
  sp.relation,
  st.id         AS student_id,
  st.first_name || ' ' || st.last_name AS student_name,
  st.admission_no,
  -- Current enrollment
  e.section_id,
  cl.name       AS class_name,
  sec.name      AS section_name,
  ay.name       AS academic_year,
  -- Attendance this month
  ROUND(
    (SELECT COUNT(*) FILTER (WHERE a.status = 'present') * 100.0 / NULLIF(COUNT(*),0)
     FROM public.attendance a
     WHERE a.student_id = st.id
       AND a.date >= DATE_TRUNC('month', NOW()))
  , 2)          AS attendance_pct_this_month,
  -- Pending fees
  (SELECT COALESCE(SUM(due_amount),0) FROM public.student_invoices
   WHERE student_id = st.id AND status IN ('pending','partial','overdue') AND deleted_at IS NULL)
                AS pending_fees
FROM public.parents p
JOIN public.student_parents sp ON sp.parent_id = p.id
JOIN public.students st ON st.id = sp.student_id AND st.is_active = true
LEFT JOIN public.enrollments e ON e.student_id = st.id
LEFT JOIN public.sections sec ON sec.id = e.section_id
LEFT JOIN public.classes cl ON cl.id = sec.class_id
LEFT JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true;

-- ─── TEACHER DASHBOARD ────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_teacher_sections AS
SELECT DISTINCT
  sf.profile_id,
  sf.school_id,
  tt.section_id,
  cl.name       AS class_name,
  sec.name      AS section_name,
  sub.name      AS subject_name,
  tt.subject_id,
  tt.day_of_week,
  tt.start_time,
  tt.end_time,
  -- Students in section
  (SELECT COUNT(*) FROM public.enrollments
   WHERE section_id = tt.section_id AND status = 'active') AS student_count,
  -- Attendance marked today
  EXISTS(
    SELECT 1 FROM public.attendance a
    WHERE a.section_id = tt.section_id AND a.date = CURRENT_DATE
      AND (a.subject_id = tt.subject_id OR a.subject_id IS NULL)
  )             AS attendance_marked_today
FROM public.staff sf
JOIN public.timetables tt ON tt.staff_id = sf.id
JOIN public.sections sec ON sec.id = tt.section_id
JOIN public.classes cl ON cl.id = sec.class_id
JOIN public.subjects sub ON sub.id = tt.subject_id
WHERE sf.is_active = true;

-- ─── FINANCE COLLECTION TREND ─────────────────────────────────

CREATE OR REPLACE VIEW public.v_monthly_collections AS
SELECT
  school_id,
  DATE_TRUNC('month', paid_at)::DATE AS month,
  COUNT(*)                            AS payment_count,
  SUM(amount)                         AS total_collected,
  method
FROM public.payments
WHERE is_refunded = false
GROUP BY school_id, DATE_TRUNC('month', paid_at)::DATE, method
ORDER BY school_id, month DESC;

-- ─── CRM PIPELINE FUNNEL ──────────────────────────────────────

CREATE OR REPLACE VIEW public.v_crm_pipeline AS
SELECT
  school_id,
  DATE_TRUNC('month', created_at)::DATE AS month,
  COUNT(*) FILTER (WHERE status = 'new')                 AS stage_new,
  COUNT(*) FILTER (WHERE status = 'contacted')           AS stage_contacted,
  COUNT(*) FILTER (WHERE status IN ('interested','followup_scheduled')) AS stage_followup,
  COUNT(*) FILTER (WHERE status IN ('visit_scheduled','visited'))       AS stage_visit,
  COUNT(*) FILTER (WHERE status = 'applied')             AS stage_applied,
  COUNT(*) FILTER (WHERE status = 'admitted')            AS stage_admitted,
  COUNT(*) FILTER (WHERE status IN ('not_interested','lost')) AS stage_lost,
  COUNT(*)                                               AS total
FROM public.leads
WHERE deleted_at IS NULL
GROUP BY school_id, DATE_TRUNC('month', created_at)::DATE
ORDER BY school_id, month DESC;
-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 11: Seed Data – Roles, Permissions, Storage Buckets
-- ============================================================

-- ─── SEED: ROLES ──────────────────────────────────────────────
INSERT INTO public.roles (name, label, scope, description, is_system) VALUES
-- Platform roles
('super_admin',       'Super Admin',        'platform', 'Full platform access, cross-school visibility',     true),
('operations_admin',  'Operations Admin',   'platform', 'Platform operations management',                    true),
('finance_admin',     'Finance Admin',      'platform', 'Cross-school finance analytics (read-only)',         true),
('support_admin',     'Support Admin',      'platform', 'Customer support access',                           true),
('analyst',           'Analyst',            'platform', 'Read-only analytics across schools',                true),
-- School roles
('principal',         'Principal',          'school',   'Full access to own school',                         true),
('vice_principal',    'Vice Principal',     'school',   'School management except finance & HR',             true),
('school_admin',      'School Admin',       'school',   'Day-to-day administrative tasks',                   true),
('admission_manager', 'Admission Manager',  'school',   'CRM, leads, admissions pipeline',                   true),
('counselor',         'Counselor',          'school',   'Assigned leads and followups only',                 true),
('accountant',        'Accountant',         'school',   'Finance module access',                             true),
('hr_manager',        'HR Manager',         'school',   'Staff management and payroll',                      true),
('teacher',           'Teacher',            'school',   'Assigned classes, LMS, attendance',                 true),
('class_teacher',     'Class Teacher',      'school',   'Teacher + class admin privileges',                  true),
('librarian',         'Librarian',          'school',   'Library management access',                         true),
('transport_manager', 'Transport Manager',  'school',   'Transport and route management',                    true),
('student',           'Student',            'school',   'Own records, LMS, attendance view',                 true),
('parent',            'Parent',             'school',   'Linked children records, fees, notices',            true)
ON CONFLICT (name) DO NOTHING;

-- ─── SEED: PERMISSIONS ────────────────────────────────────────
INSERT INTO public.permissions (resource, action, description) VALUES
-- Schools
('schools',          'read',   'View school list and details'),
('schools',          'create', 'Create new schools'),
('schools',          'update', 'Edit school settings'),
('schools',          'delete', 'Soft-delete a school'),
-- Students
('students',         'read',   'View student records'),
('students',         'create', 'Add new students'),
('students',         'update', 'Edit student records'),
('students',         'delete', 'Remove students'),
-- Staff
('staff',            'read',   'View staff records'),
('staff',            'create', 'Add new staff'),
('staff',            'update', 'Edit staff records'),
('staff',            'delete', 'Remove staff'),
-- Attendance
('attendance',       'read',   'View attendance records'),
('attendance',       'mark',   'Mark attendance'),
('attendance',       'update', 'Correct attendance records'),
-- Fees / Finance
('fees',             'read',   'View fee records and invoices'),
('fees',             'create', 'Create fee structures / invoices'),
('fees',             'update', 'Edit fee records'),
('fees',             'collect','Record payments'),
('expenses',         'read',   'View school expenses'),
('expenses',         'create', 'Add expenses'),
('payroll',          'read',   'View payroll'),
('payroll',          'process','Run payroll'),
-- CRM
('leads',            'read',   'View leads'),
('leads',            'create', 'Create leads'),
('leads',            'update', 'Update lead info'),
('leads',            'delete', 'Remove leads'),
('followups',        'read',   'View followups'),
('followups',        'manage', 'Create and complete followups'),
('applications',     'read',   'View applications'),
('applications',     'review', 'Review and approve applications'),
('admissions',       'read',   'View admissions'),
('admissions',       'create', 'Convert to admission'),
-- LMS
('courses',          'read',   'View courses'),
('courses',          'manage', 'Create and manage courses'),
('assignments',      'read',   'View assignments'),
('assignments',      'grade',  'Grade assignment submissions'),
('exams',            'read',   'View exams'),
('exams',            'manage', 'Create and manage exams'),
('results',          'read',   'View exam results'),
('results',          'enter',  'Enter exam results'),
-- Transport
('transport',        'read',   'View buses and routes'),
('transport',        'manage', 'Manage transport setup'),
-- Notices
('notices',          'read',   'View notices'),
('notices',          'manage', 'Create and publish notices'),
-- Audit
('audit_logs',       'read',   'View audit logs'),
('reports',          'read',   'View dashboards and reports')
ON CONFLICT (resource, action) DO NOTHING;

-- ─── SEED: ROLE_PERMISSIONS (principal gets all school perms) ──
-- Super admin bypasses RLS entirely so no role_permissions needed for super_admin
-- Here we assign principal full access to all school-scoped permissions

DO $$
DECLARE
  _principal_id UUID;
  _perm RECORD;
BEGIN
  SELECT id INTO _principal_id FROM public.roles WHERE name = 'principal';

  FOR _perm IN SELECT id FROM public.permissions LOOP
    INSERT INTO public.role_permissions(role_id, permission_id)
    VALUES (_principal_id, _perm.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- Accountant permissions
DO $$
DECLARE
  _role_id UUID;
BEGIN
  SELECT id INTO _role_id FROM public.roles WHERE name = 'accountant';
  INSERT INTO public.role_permissions(role_id, permission_id)
  SELECT _role_id, p.id FROM public.permissions p
  WHERE p.resource IN ('fees','expenses','payroll','reports','students')
    AND p.action IN ('read','create','update','collect','process')
  ON CONFLICT DO NOTHING;
END;
$$;

-- Counselor permissions (leads + followups + applications read)
DO $$
DECLARE
  _role_id UUID;
BEGIN
  SELECT id INTO _role_id FROM public.roles WHERE name = 'counselor';
  INSERT INTO public.role_permissions(role_id, permission_id)
  SELECT _role_id, p.id FROM public.permissions p
  WHERE (p.resource = 'leads' AND p.action IN ('read','create','update'))
    OR (p.resource = 'followups' AND p.action IN ('read','manage'))
    OR (p.resource = 'applications' AND p.action = 'read')
  ON CONFLICT DO NOTHING;
END;
$$;

-- Teacher permissions
DO $$
DECLARE
  _role_id UUID;
BEGIN
  SELECT id INTO _role_id FROM public.roles WHERE name = 'teacher';
  INSERT INTO public.role_permissions(role_id, permission_id)
  SELECT _role_id, p.id FROM public.permissions p
  WHERE (p.resource = 'attendance' AND p.action IN ('read','mark'))
    OR (p.resource = 'courses' AND p.action IN ('read','manage'))
    OR (p.resource = 'assignments' AND p.action IN ('read','grade'))
    OR (p.resource = 'exams' AND p.action IN ('read','manage'))
    OR (p.resource = 'results' AND p.action IN ('read','enter'))
    OR (p.resource = 'students' AND p.action = 'read')
    OR (p.resource = 'notices' AND p.action = 'read')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ─── STORAGE BUCKETS ──────────────────────────────────────────
-- Run via Supabase dashboard Storage tab or Supabase CLI
-- Listed here as reference SQL (executed by Supabase storage API)

/*
  Execute these via Supabase SQL editor or REST API:

  -- 1. student-documents (private, school-scoped)
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'student-documents',
    'student-documents',
    false,
    10485760,   -- 10 MB
    ARRAY['application/pdf','image/jpeg','image/png','image/webp']
  ) ON CONFLICT DO NOTHING;

  -- 2. assignments
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'assignments',
    'assignments',
    false,
    52428800,   -- 50 MB
    ARRAY['application/pdf','image/jpeg','image/png','application/zip',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'video/mp4']
  ) ON CONFLICT DO NOTHING;

  -- 3. staff-files
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'staff-files',
    'staff-files',
    false,
    10485760,
    ARRAY['application/pdf','image/jpeg','image/png','image/webp']
  ) ON CONFLICT DO NOTHING;

  -- 4. marketing-assets (public)
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'marketing-assets',
    'marketing-assets',
    true,
    5242880,    -- 5 MB
    ARRAY['image/jpeg','image/png','image/webp','image/svg+xml','video/mp4']
  ) ON CONFLICT DO NOTHING;

  -- 5. course-materials
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'course-materials',
    'course-materials',
    false,
    104857600,  -- 100 MB
    ARRAY['application/pdf','video/mp4','audio/mpeg','image/jpeg','image/png',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation']
  ) ON CONFLICT DO NOTHING;
*/

-- Storage RLS policies (applied via Supabase SQL editor):
/*
  -- student-documents: school staff can upload/read; student/parent can read own
  CREATE POLICY "student_docs_select" ON storage.objects FOR SELECT
    USING (
      bucket_id = 'student-documents'
      AND (
        is_platform_admin()
        OR (
          -- Path format: {school_id}/{student_id}/{filename}
          (storage.foldername(name))[1]::UUID = get_my_school_id()
        )
      )
    );

  CREATE POLICY "student_docs_insert" ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'student-documents'
      AND (storage.foldername(name))[1]::UUID = get_my_school_id()
      AND (has_school_role('school_admin') OR has_school_role('principal') OR has_school_role('admission_manager'))
    );
*/
-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 12: Performance Indexes, Audit Triggers, Auth Hook
-- ============================================================

-- ─── COMPOSITE PERFORMANCE INDEXES ───────────────────────────
-- Attendance analysis (school + date range)
CREATE INDEX IF NOT EXISTS idx_attendance_analysis
  ON public.attendance(school_id, section_id, date, status);

-- Overdue invoice reporting
CREATE INDEX IF NOT EXISTS idx_invoices_overdue
  ON public.student_invoices(school_id, due_date, status)
  WHERE deleted_at IS NULL AND status IN ('pending','partial');

-- CRM lead pipeline by source + status
CREATE INDEX IF NOT EXISTS idx_leads_pipeline
  ON public.leads(school_id, lead_source_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Followup scheduling queries
CREATE INDEX IF NOT EXISTS idx_followups_pending_today
  ON public.followups(school_id, counselor_id, scheduled_at)
  WHERE status = 'pending';

-- Payment reconciliation
CREATE INDEX IF NOT EXISTS idx_payments_reconcile
  ON public.payments(school_id, paid_at, method, is_refunded);

-- Exam results by class
CREATE INDEX IF NOT EXISTS idx_exam_results_exam
  ON public.exam_results(school_id, exam_id, marks_obtained);

-- Hostel availability
CREATE INDEX IF NOT EXISTS idx_hostel_active
  ON public.hostel_allocations(school_id, room_id, is_active)
  WHERE is_active = true;

-- Timetable teacher lookup (teacher seeing their own schedule)
CREATE INDEX IF NOT EXISTS idx_timetable_staff_day
  ON public.timetables(staff_id, day_of_week, start_time);

-- Full-text search on leads
CREATE INDEX IF NOT EXISTS idx_leads_parent_name_trgm
  ON public.leads USING GIN (parent_name gin_trgm_ops);

-- ─── AUDIT TRIGGERS ON KEY TABLES ───────────────────────────
-- Apply audit logging to sensitive tables
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'students','staff','parents','enrollments',
    'student_invoices','payments','payroll','expenses',
    'leads','admissions','applications',
    'user_roles','profiles','schools'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format(
      'CREATE TRIGGER audit_%I
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()',
       tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─── AUTH HOOK: Sync profile on new user signup ───────────────
-- This is a Supabase Auth Hook - register it in:
--   Dashboard > Authentication > Hooks > After user is created

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, school_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    (NEW.raw_user_meta_data->>'school_id')::UUID
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Register the trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── AUTH HOOK: Update last_login_at ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET last_login_at = NOW(), updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── UTILITY: Auto-generate admission numbers ─────────────────
CREATE OR REPLACE FUNCTION generate_admission_no(p_school_id UUID)
RETURNS TEXT AS $$
DECLARE
  _year TEXT := TO_CHAR(NOW(), 'YY');
  _count INT;
BEGIN
  SELECT COUNT(*) + 1 INTO _count
  FROM public.students
  WHERE school_id = p_school_id
    AND created_at >= DATE_TRUNC('year', NOW());
  RETURN _year || LPAD(_count::TEXT, 5, '0');  -- e.g. 2400001
END;
$$ LANGUAGE plpgsql;

-- ─── UTILITY: Soft-delete helpers ─────────────────────────────
-- Rather than hard DELETE, call this for user-facing deletions
CREATE OR REPLACE FUNCTION soft_delete(p_table TEXT, p_id UUID)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE public.%I SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1', p_table)
  USING p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── MATERIALIZED VIEW: Attendance summary (refresh daily) ───
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_monthly_attendance AS
SELECT
  school_id,
  student_id,
  section_id,
  DATE_TRUNC('month', date)::DATE   AS month,
  COUNT(*)                           AS total_days,
  COUNT(*) FILTER (WHERE status = 'present') AS present_days,
  COUNT(*) FILTER (WHERE status = 'absent')  AS absent_days,
  COUNT(*) FILTER (WHERE status = 'late')    AS late_days,
  ROUND(COUNT(*) FILTER (WHERE status = 'present') * 100.0 / NULLIF(COUNT(*),0), 2) AS attendance_pct
FROM public.attendance
GROUP BY school_id, student_id, section_id, DATE_TRUNC('month', date)::DATE;

CREATE UNIQUE INDEX mv_monthly_attendance_pk
  ON public.mv_monthly_attendance(school_id, student_id, month);

-- Refresh command (schedule daily via pg_cron or Supabase edge function):
-- SELECT cron.schedule('refresh-attendance-mv', '0 2 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_monthly_attendance');

-- ─── EXAMPLE: Cross-school safety check ──────────────────────
-- Prevent any query from accidentally mixing school_id values in joins
-- Add this as a DB-level constraint macro in your API layer:
/*
  All application queries touching multi-tenant tables must include:
    WHERE school_id = :school_id
  and the school_id must match auth.uid()'s school via get_my_school_id().
  RLS enforces this at DB level — this is the belt-and-suspenders reminder.
*/

-- ─── GRANTS ───────────────────────────────────────────────────
-- Supabase creates the 'anon' and 'authenticated' roles automatically
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Revoke dangerous defaults
REVOKE DELETE ON public.audit_logs FROM authenticated;   -- audit logs are immutable
REVOKE UPDATE ON public.audit_logs FROM authenticated;
REVOKE DELETE ON public.payments   FROM authenticated;   -- payments are immutable; use refund flag
