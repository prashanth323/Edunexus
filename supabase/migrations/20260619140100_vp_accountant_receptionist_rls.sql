-- ============================================================
-- Migration: RLS Policy Updates for VP, Accountant, Receptionist
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- VICE PRINCIPAL — Add write access to timetable, transport,
-- hostel, CRM, classes, sections, academic years
-- ═══════════════════════════════════════════════════════════════

-- ── TIMETABLES ────────────────────────────────────────────────
DROP POLICY IF EXISTS "timetables_write" ON public.timetables;
CREATE POLICY "timetables_write" ON public.timetables FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    ))
  );

-- ── ACADEMIC YEARS ────────────────────────────────────────────
DROP POLICY IF EXISTS "ay_write" ON public.academic_years;
CREATE POLICY "ay_write" ON public.academic_years FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    ))
  );

-- ── CLASSES ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "classes_write" ON public.classes;
CREATE POLICY "classes_write" ON public.classes FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    ))
  );

-- ── SECTIONS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "sections_write" ON public.sections;
CREATE POLICY "sections_write" ON public.sections FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    ))
  );

-- ═══════════════════════════════════════════════════════════════
-- TRANSPORT — VP write access
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "buses_write" ON public.buses;
CREATE POLICY "buses_write" ON public.buses FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('transport_manager')
    ))
  );

DROP POLICY IF EXISTS "routes_write" ON public.routes;
CREATE POLICY "routes_write" ON public.routes FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('transport_manager')
    ))
  );

DROP POLICY IF EXISTS "route_stops_write" ON public.route_stops;
CREATE POLICY "route_stops_write" ON public.route_stops FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('transport_manager')
    ))
  );

DROP POLICY IF EXISTS "route_students_write" ON public.route_students;
CREATE POLICY "route_students_write" ON public.route_students FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('transport_manager')
    ))
  );

-- ═══════════════════════════════════════════════════════════════
-- HOSTEL — VP write access
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hostel_rooms_write" ON public.hostel_rooms;
CREATE POLICY "hostel_rooms_write" ON public.hostel_rooms FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    ))
  );

DROP POLICY IF EXISTS "hostel_allocations_write" ON public.hostel_allocations;
CREATE POLICY "hostel_allocations_write" ON public.hostel_allocations FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    ))
  );

-- ═══════════════════════════════════════════════════════════════
-- CRM — VP write access to entire CRM pipeline
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "lead_sources_write" ON public.lead_sources;
CREATE POLICY "lead_sources_write" ON public.lead_sources FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('admission_manager')
    ))
  );

DROP POLICY IF EXISTS "counselors_write" ON public.counselors;
CREATE POLICY "counselors_write" ON public.counselors FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('admission_manager')
    ))
  );

-- Leads SELECT — add VP
DROP POLICY IF EXISTS "leads_select" ON public.leads;
CREATE POLICY "leads_select" ON public.leads FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('admission_manager')
      OR has_school_role('school_admin')
    ))
    OR (school_id = get_my_school_id() AND id IN (
      SELECT la.lead_id FROM public.lead_assignments la
      JOIN public.counselors c ON la.counselor_id = c.id
      JOIN public.staff s ON c.staff_id = s.id
      WHERE s.profile_id = auth.uid() AND la.is_active = true
    ))
  );

DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT
  WITH CHECK (
    school_id = get_my_school_id() AND (
      has_school_role('counselor')
      OR has_school_role('admission_manager')
      OR has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    )
  );

DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads FOR UPDATE
  USING (
    school_id = get_my_school_id()
    AND (
      has_school_role('admission_manager')
      OR has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR id IN (
        SELECT la.lead_id FROM public.lead_assignments la
        JOIN public.counselors c ON la.counselor_id = c.id
        JOIN public.staff s ON c.staff_id = s.id
        WHERE s.profile_id = auth.uid() AND la.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "lead_assignments_write" ON public.lead_assignments;
CREATE POLICY "lead_assignments_write" ON public.lead_assignments FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('admission_manager')
    ))
  );

DROP POLICY IF EXISTS "followups_write" ON public.followups;
CREATE POLICY "followups_write" ON public.followups FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('admission_manager')
      OR has_school_role('principal')
      OR has_school_role('vice_principal')
    ))
    OR (school_id = get_my_school_id() AND counselor_id IN (
      SELECT c.id FROM public.counselors c
      JOIN public.staff s ON c.staff_id = s.id
      WHERE s.profile_id = auth.uid()
    ))
  );

-- Followups SELECT — add VP
DROP POLICY IF EXISTS "followups_select" ON public.followups;
CREATE POLICY "followups_select" ON public.followups FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('admission_manager')
      OR has_school_role('school_admin')
    ))
    OR counselor_id IN (
      SELECT c.id FROM public.counselors c
      JOIN public.staff s ON c.staff_id = s.id
      WHERE s.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "campus_visits_write" ON public.campus_visits;
CREATE POLICY "campus_visits_write" ON public.campus_visits FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('counselor')
      OR has_school_role('admission_manager')
      OR has_school_role('principal')
      OR has_school_role('vice_principal')
    ))
  );

DROP POLICY IF EXISTS "applications_write" ON public.applications;
CREATE POLICY "applications_write" ON public.applications FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('admission_manager')
    ))
  );

-- Applications SELECT — add VP
DROP POLICY IF EXISTS "applications_select" ON public.applications;
CREATE POLICY "applications_select" ON public.applications FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('admission_manager')
      OR has_school_role('school_admin')
      OR has_school_role('counselor')
    ))
  );

DROP POLICY IF EXISTS "admissions_write" ON public.admissions;
CREATE POLICY "admissions_write" ON public.admissions FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('admission_manager')
    ))
  );

-- Admissions SELECT — add VP
DROP POLICY IF EXISTS "admissions_select" ON public.admissions;
CREATE POLICY "admissions_select" ON public.admissions FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('admission_manager')
      OR has_school_role('school_admin')
    ))
  );

-- ═══════════════════════════════════════════════════════════════
-- STUDENTS — Accountant + VP write access
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "students_write" ON public.students;
CREATE POLICY "students_write" ON public.students FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('admission_manager')
      OR has_school_role('accountant')
    ))
  );

-- Students SELECT — add receptionist
DROP POLICY IF EXISTS "students_select" ON public.students;
CREATE POLICY "students_select" ON public.students FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('teacher') OR has_school_role('class_teacher')
      OR has_school_role('accountant') OR has_school_role('admission_manager')
      OR has_school_role('receptionist')
    ))
    OR profile_id = auth.uid()
    OR id IN (
      SELECT sp.student_id FROM public.student_parents sp
      JOIN public.parents p ON sp.parent_id = p.id
      WHERE p.profile_id = auth.uid()
    )
  );

-- Parents WRITE — add accountant
DROP POLICY IF EXISTS "parents_write" ON public.parents;
CREATE POLICY "parents_write" ON public.parents FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('admission_manager')
      OR has_school_role('accountant')
    ))
  );

-- Parents SELECT — add receptionist
DROP POLICY IF EXISTS "parents_select" ON public.parents;
CREATE POLICY "parents_select" ON public.parents FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal') OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('class_teacher') OR has_school_role('admission_manager')
      OR has_school_role('receptionist')
    ))
    OR profile_id = auth.uid()
  );

-- Student_parents WRITE — add accountant
DROP POLICY IF EXISTS "student_parents_write" ON public.student_parents;
CREATE POLICY "student_parents_write" ON public.student_parents FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('admission_manager')
      OR has_school_role('accountant')
    ))
  );

-- Enrollments WRITE — add accountant + VP
DROP POLICY IF EXISTS "enrollments_write" ON public.enrollments;
CREATE POLICY "enrollments_write" ON public.enrollments FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('accountant')
    ))
  );

-- ═══════════════════════════════════════════════════════════════
-- ATTENDANCE — restrict write to class_teacher (not teacher)
-- for daily student attendance; add VP
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "attendance_write" ON public.attendance;
CREATE POLICY "attendance_write" ON public.attendance FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('class_teacher')
      OR has_school_role('school_admin')
      OR has_school_role('principal')
      OR has_school_role('vice_principal')
    ))
  );

-- Attendance SELECT — add VP
DROP POLICY IF EXISTS "attendance_select" ON public.attendance;
CREATE POLICY "attendance_select" ON public.attendance FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
      OR has_school_role('teacher')
      OR has_school_role('class_teacher')
    ))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (
      SELECT sp.student_id FROM public.student_parents sp
      JOIN public.parents p ON sp.parent_id = p.id
      WHERE p.profile_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- STAFF — receptionist read + VP in staff read
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "staff_select" ON public.staff;
CREATE POLICY "staff_select" ON public.staff FOR SELECT
  USING (
    is_platform_admin()
    OR school_id = get_my_school_id()
  );

-- ═══════════════════════════════════════════════════════════════
-- HOSTEL ALLOCATIONS SELECT — add VP
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hostel_allocations_select" ON public.hostel_allocations;
CREATE POLICY "hostel_allocations_select" ON public.hostel_allocations FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    ))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (
      SELECT sp.student_id FROM public.student_parents sp
      JOIN public.parents p ON sp.parent_id = p.id
      WHERE p.profile_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- PROFILES INSERT — add VP and accountant
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR has_school_role('school_admin')
    OR has_school_role('principal')
    OR has_school_role('vice_principal')
    OR has_school_role('accountant')
  );

-- ═══════════════════════════════════════════════════════════════
-- USER_ROLES WRITE — add VP
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "user_roles_write" ON public.user_roles;
CREATE POLICY "user_roles_write" ON public.user_roles FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND (
      has_school_role('principal')
      OR has_school_role('vice_principal')
      OR has_school_role('school_admin')
    ))
  );
