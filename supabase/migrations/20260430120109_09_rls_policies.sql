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
CREATE POLICY "role_permissions_write_super" ON public.role_permissions FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

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
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin') OR has_school_role('teacher'))));

CREATE POLICY "exam_results_select" ON public.exam_results FOR SELECT
  USING (
    is_platform_admin()
    OR (school_id = get_my_school_id() AND (has_school_role('principal') OR has_school_role('school_admin') OR has_school_role('teacher')))
    OR student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR student_id IN (SELECT sp.student_id FROM public.student_parents sp JOIN public.parents p ON sp.parent_id = p.id WHERE p.profile_id = auth.uid())
  );
CREATE POLICY "exam_results_write" ON public.exam_results FOR ALL
  USING (is_super_admin() OR (school_id = get_my_school_id() AND (has_school_role('teacher') OR has_school_role('school_admin') OR has_school_role('principal'))));

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
