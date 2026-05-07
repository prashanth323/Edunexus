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
