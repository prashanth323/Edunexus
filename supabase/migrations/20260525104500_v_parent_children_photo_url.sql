-- Expose student portrait on parent dashboard datasource (signed URLs resolved in the app).
-- PG: adding a column to a view requires drop + create (CREATE OR REPLACE cannot extend column list).
DROP VIEW IF EXISTS public.v_parent_children;
CREATE VIEW public.v_parent_children AS
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
    (SELECT COUNT(*) FILTER (WHERE a.status = 'present') * 100.0 / NULLIF(COUNT(*), 0)
     FROM public.attendance a
     WHERE a.student_id = st.id
       AND a.date >= DATE_TRUNC('month', NOW())),
    2
  )             AS attendance_pct_this_month,
  -- Pending fees
  (SELECT COALESCE(SUM(due_amount), 0) FROM public.student_invoices
   WHERE student_id = st.id AND status IN ('pending', 'partial', 'overdue') AND deleted_at IS NULL)
                AS pending_fees,
  st.photo_url
FROM public.parents p
JOIN public.student_parents sp ON sp.parent_id = p.id
JOIN public.students st ON st.id = sp.student_id AND st.is_active = true
LEFT JOIN public.enrollments e ON e.student_id = st.id
LEFT JOIN public.sections sec ON sec.id = e.section_id
LEFT JOIN public.classes cl ON cl.id = sec.class_id
LEFT JOIN public.academic_years ay ON ay.id = e.academic_year_id AND ay.is_current = true;
