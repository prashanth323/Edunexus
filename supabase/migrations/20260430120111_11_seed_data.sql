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
