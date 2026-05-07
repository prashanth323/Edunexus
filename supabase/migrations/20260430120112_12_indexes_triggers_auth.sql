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
