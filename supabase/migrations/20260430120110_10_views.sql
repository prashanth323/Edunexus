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
