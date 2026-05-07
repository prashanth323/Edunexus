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

-- RLS helper functions (get_my_school_id, is_platform_admin, is_super_admin, has_school_role)
-- are defined in migration 02 after public.profiles and public.user_roles exist.
