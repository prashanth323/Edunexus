import { supabase } from "@/lib/supabase"
import type { QuizSpec } from "@/features/lms/types/quiz-spec"

export type Subject = {
  id: string
  name: string
  code: string | null
  description?: string | null
  is_active?: boolean
}

/** @param opts.includeInactive When true, returns inactive subjects too (school admin UI). Default: only active. */
export async function getSubjects(schoolId: string, opts?: { includeInactive?: boolean }): Promise<Subject[]> {
  let q = supabase.from("subjects").select("*").eq("school_id", schoolId).order("name")
  if (!opts?.includeInactive) {
    q = q.eq("is_active", true)
  }

  const { data, error } = await q

  if (error) throw error
  return data as Subject[]
}

/** Legacy LMS catalog card shape (maps DB max_marks → total_marks). */
export type Assignment = {
  id: string
  title: string
  description?: string | null
  due_date: string | null
  total_marks: number
  assignment_type?: string | null
  subject?: { name: string }
  course?: { title: string }
}

export type CourseMaterial = {
  id: string
  title: string
  description?: string | null
  url: string
  material_type: string
  lesson_id?: string | null
  course_id?: string | null
  subject?: { name: string }
  created_at: string
}

export type CourseRow = {
  id: string
  school_id: string
  subject_id: string
  academic_year_id: string
  class_id: string | null
  section_id: string | null
  teacher_id: string | null
  title: string
  description: string | null
  cover_url: string | null
  is_published: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type CourseModuleRow = {
  id: string
  school_id: string
  course_id: string
  title: string
  description: string | null
  video_url?: string | null
  order_no: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type CourseLessonRow = {
  id: string
  school_id: string
  course_id: string
  module_id: string | null
  title: string
  description: string | null
  content: string | null
  video_url?: string | null
  order_no: number
  duration_min: number | null
  is_published: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type StudyMaterialRow = {
  id: string
  school_id: string
  lesson_id: string | null
  course_id: string | null
  title: string
  type: string
  url: string
  file_size: number | null
  duration: number | null
  uploaded_by: string | null
  is_public: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type AssignmentRow = {
  id: string
  school_id: string
  course_id: string
  created_by: string | null
  title: string
  description: string | null
  instructions: string | null
  max_marks: number
  passing_marks: number | null
  due_date: string | null
  allow_late: boolean
  assignment_type: string
  quiz_spec: QuizSpec | null
  attachments: unknown
  is_published: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type LmsEnrollmentRow = {
  id: string
  school_id: string
  student_id: string
  course_id: string
  status: string
  enrolled_at: string
  completed_at: string | null
}

export async function listAcademicYears(schoolId: string) {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, name, start_date, end_date, is_current")
    .eq("school_id", schoolId)
    .order("start_date", { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function listSectionsForSchool(schoolId: string) {
  const { data, error } = await supabase
    .from("sections")
    .select(
      `
      id,
      name,
      class_id,
      academic_year_id,
      classes ( id, name )
    `,
    )
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("name")

  if (error) throw error
  return data ?? []
}

export async function getStaffIdForProfile(profileId: string, schoolId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("staff")
    .select("id")
    .eq("school_id", schoolId)
    .eq("profile_id", profileId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

export async function getStudentIdForProfile(profileId: string, schoolId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .eq("profile_id", profileId)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

/** LMS course card joins for catalog / principal views (subject + class/section labels). */
export type CourseWithLabels = CourseRow & {
  subjects?: { id: string; name: string } | null
  classes?: { id: string; name: string } | null
  sections?: { id: string; name: string } | null
}

/** Published courses visible in catalog (RLS applies). */
export async function listPublishedCourses(schoolId: string): Promise<CourseWithLabels[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(`*, subjects ( id, name ), classes ( id, name ), sections ( id, name )`)
    .eq("school_id", schoolId)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("title")

  if (error) throw error
  return (data ?? []) as CourseWithLabels[]
}

/** Teacher/staff course list including drafts (RLS applies). */
export async function listStaffCourses(schoolId: string): Promise<CourseWithLabels[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(`*, subjects ( id, name ), classes ( id, name ), sections ( id, name )`)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as CourseWithLabels[]
}

export async function getCourseRow(courseId: string): Promise<CourseRow | null> {
  const { data, error } = await supabase.from("courses").select("*").eq("id", courseId).is("deleted_at", null).maybeSingle()

  if (error) throw error
  return data as CourseRow | null
}

export async function listCourseModules(courseId: string): Promise<CourseModuleRow[]> {
  const { data, error } = await supabase
    .from("course_modules")
    .select("*")
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .order("order_no", { ascending: true })

  if (error) throw error
  return data as CourseModuleRow[]
}

export async function listCourseLessons(courseId: string): Promise<CourseLessonRow[]> {
  const { data, error } = await supabase
    .from("course_lessons")
    .select("*")
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .order("order_no", { ascending: true })

  if (error) throw error
  const rows = (data ?? []) as CourseLessonRow[]
  return [...rows].sort((a, b) => {
    const ma = a.module_id ?? ""
    const mb = b.module_id ?? ""
    if (ma !== mb) return ma.localeCompare(mb)
    return a.order_no - b.order_no
  })
}

export async function listStudyMaterialsForCourse(courseId: string, lessonIds: string[]): Promise<StudyMaterialRow[]> {
  if (!lessonIds.length) {
    const { data, error } = await supabase.from("study_materials").select("*").eq("course_id", courseId).is("deleted_at", null)

    if (error) throw error
    return (data ?? []) as StudyMaterialRow[]
  }

  const idsPart = `lesson_id.in.(${lessonIds.join(",")})`
  const coursePart = `course_id.eq.${courseId}`
  const orExpr = `${coursePart},${idsPart}`

  const { data, error } = await supabase.from("study_materials").select("*").is("deleted_at", null).or(orExpr)

  if (error) throw error
  return (data ?? []) as StudyMaterialRow[]
}

export type CourseDetailBundle = {
  course: CourseRow & { subjects?: { name: string } | null }
  modules: CourseModuleRow[]
  lessons: CourseLessonRow[]
  materials: StudyMaterialRow[]
}

export async function getCourseDetail(courseId: string): Promise<CourseDetailBundle | null> {
  const { data: course, error: ce } = await supabase
    .from("courses")
    .select(`*, subjects ( name ), instructor:staff!teacher_id ( profiles!profile_id ( first_name, last_name ) )`)
    .eq("id", courseId)
    .is("deleted_at", null)
    .maybeSingle()

  if (ce) throw ce
  if (!course) return null

  const modules = await listCourseModules(courseId)
  const lessons = await listCourseLessons(courseId)
  const lessonIds = lessons.map((l) => l.id)
  const materials = await listStudyMaterialsForCourse(courseId, lessonIds)

  return {
    course: course as CourseDetailBundle["course"],
    modules,
    lessons,
    materials,
  }
}

export async function getLessonProgressSet(studentId: string, lessonIds: string[]): Promise<Set<string>> {
  if (!lessonIds.length) return new Set()
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("student_id", studentId)
    .in("lesson_id", lessonIds)

  if (error) throw error
  return new Set((data ?? []).map((r: { lesson_id: string }) => r.lesson_id))
}

export async function getLmsEnrollment(studentId: string, courseId: string): Promise<LmsEnrollmentRow | null> {
  const { data, error } = await supabase
    .from("lms_course_enrollments")
    .select("*")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .maybeSingle()

  if (error) throw error
  return data as LmsEnrollmentRow | null
}

export async function listStudentCourseEnrollments(studentId: string): Promise<{ course_id: string; status: string }[]> {
  const { data, error } = await supabase
    .from("lms_course_enrollments")
    .select("course_id, status")
    .eq("student_id", studentId)

  if (error) throw error
  return (data ?? []) as { course_id: string; status: string }[]
}

export async function enrollInCourse(courseId: string): Promise<string> {
  const { data, error } = await supabase.rpc("enroll_in_course", { p_course_id: courseId })
  if (error) throw error
  return data as string
}

export async function markLessonCompleteRpc(lessonId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("mark_lesson_complete", { p_lesson_id: lessonId })
  if (error) throw error
  return (data ?? {}) as Record<string, unknown>
}

export async function submitAssignmentQuizRpc(assignmentId: string, answers: Record<string, number>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("submit_assignment_quiz", {
    p_assignment_id: assignmentId,
    p_answers: answers as unknown as Record<string, unknown>,
  })
  if (error) throw error
  return (data ?? {}) as Record<string, unknown>
}

export async function createCourse(input: {
  school_id: string
  subject_id: string
  academic_year_id: string
  class_id?: string | null
  section_id?: string | null
  teacher_id?: string | null
  title: string
  description?: string | null
  cover_url?: string | null
  is_published?: boolean
}) {
  const { data, error } = await supabase
    .from("courses")
    .insert({
      school_id: input.school_id,
      subject_id: input.subject_id,
      academic_year_id: input.academic_year_id,
      class_id: input.class_id ?? null,
      section_id: input.section_id ?? null,
      teacher_id: input.teacher_id ?? null,
      title: input.title,
      description: input.description ?? null,
      cover_url: input.cover_url ?? null,
      is_published: input.is_published ?? false,
    })
    .select("*")
    .single()

  if (error) throw error

  await supabase.from("course_modules").insert({
    school_id: input.school_id,
    course_id: data.id,
    title: "General",
    description: null,
    order_no: 0,
  })

  return data as CourseRow
}

export async function updateCourse(
  courseId: string,
  patch: Partial<
    Pick<
      CourseRow,
      | "title"
      | "description"
      | "cover_url"
      | "is_published"
      | "subject_id"
      | "academic_year_id"
      | "class_id"
      | "section_id"
      | "teacher_id"
    >
  >,
) {
  const { error } = await supabase.from("courses").update(patch).eq("id", courseId)
  if (error) throw error
}

export async function createCourseModule(input: {
  school_id: string
  course_id: string
  title: string
  description?: string | null
  order_no?: number
}) {
  const { data, error } = await supabase
    .from("course_modules")
    .insert({
      school_id: input.school_id,
      course_id: input.course_id,
      title: input.title,
      description: input.description ?? null,
      order_no: input.order_no ?? 0,
    })
    .select("*")
    .single()

  if (error) throw error
  return data as CourseModuleRow
}

export async function updateCourseModule(
  moduleId: string,
  patch: Partial<Pick<CourseModuleRow, "title" | "description" | "order_no" | "video_url">>,
) {
  const { error } = await supabase.from("course_modules").update(patch).eq("id", moduleId)
  if (error) throw error
}

export async function softDeleteCourseModule(moduleId: string) {
  const { error } = await supabase.from("course_modules").update({ deleted_at: new Date().toISOString() }).eq("id", moduleId)
  if (error) throw error
}

export async function createCourseLesson(input: {
  school_id: string
  course_id: string
  module_id?: string | null
  title: string
  description?: string | null
  content?: string | null
  order_no?: number
  is_published?: boolean
}) {
  const { data, error } = await supabase
    .from("course_lessons")
    .insert({
      school_id: input.school_id,
      course_id: input.course_id,
      module_id: input.module_id ?? null,
      title: input.title,
      description: input.description ?? null,
      content: input.content ?? null,
      order_no: input.order_no ?? 0,
      is_published: input.is_published ?? false,
    })
    .select("*")
    .single()

  if (error) throw error
  return data as CourseLessonRow
}

export async function updateCourseLesson(
  lessonId: string,
  patch: Partial<
    Pick<
      CourseLessonRow,
      | "title"
      | "description"
      | "content"
      | "order_no"
      | "module_id"
      | "is_published"
      | "duration_min"
      | "video_url"
    >
  >,
) {
  const { error } = await supabase.from("course_lessons").update(patch).eq("id", lessonId)
  if (error) throw error
}

export const LMS_COURSE_MATERIALS_BUCKET = "lms-course-materials"

/** Upload a PDF to LMS storage; returns public URL for study_materials.url */
export async function uploadCoursePdf(params: { schoolId: string; courseId: string; file: File }): Promise<string> {
  const lower = params.file.name.toLowerCase()
  if (!lower.endsWith(".pdf") && params.file.type !== "application/pdf") {
    throw new Error("Please choose a PDF file.")
  }
  const path = `${params.schoolId}/${params.courseId}/${crypto.randomUUID()}.pdf`
  const { error } = await supabase.storage.from(LMS_COURSE_MATERIALS_BUCKET).upload(path, params.file, {
    contentType: "application/pdf",
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from(LMS_COURSE_MATERIALS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Upload a cover image for a course */
export async function uploadCourseCover(params: { schoolId: string; courseId: string; file: File }): Promise<string> {
  if (!params.file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.")
  }
  const ext = params.file.name.split(".").pop() ?? "jpg"
  const path = `${params.schoolId}/${params.courseId}/cover-${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(LMS_COURSE_MATERIALS_BUCKET).upload(path, params.file, {
    contentType: params.file.type,
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from(LMS_COURSE_MATERIALS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function softDeleteCourseLesson(lessonId: string) {
  const { error } = await supabase.from("course_lessons").update({ deleted_at: new Date().toISOString() }).eq("id", lessonId)
  if (error) throw error
}

export async function createStudyMaterial(input: {
  school_id: string
  course_id?: string | null
  lesson_id?: string | null
  title: string
  type: "pdf" | "video" | "doc" | "ppt" | "link" | "image" | "audio"
  url: string
  uploaded_by?: string | null
}) {
  const { data, error } = await supabase
    .from("study_materials")
    .insert({
      school_id: input.school_id,
      course_id: input.course_id ?? null,
      lesson_id: input.lesson_id ?? null,
      title: input.title,
      type: input.type,
      url: input.url,
      uploaded_by: input.uploaded_by ?? null,
    })
    .select("*")
    .single()

  if (error) throw error
  return data as StudyMaterialRow
}

export async function softDeleteStudyMaterial(id: string) {
  const { error } = await supabase.from("study_materials").update({ deleted_at: new Date().toISOString() }).eq("id", id)
  if (error) throw error
}

export async function listAssignmentsForCourse(courseId: string): Promise<AssignmentRow[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as AssignmentRow[]
}

export async function createAssignment(input: {
  school_id: string
  course_id: string
  created_by?: string | null
  title: string
  description?: string | null
  instructions?: string | null
  max_marks?: number
  passing_marks?: number | null
  due_date?: string | null
  allow_late?: boolean
  assignment_type?: string
  quiz_spec?: QuizSpec | null
  is_published?: boolean
}) {
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      school_id: input.school_id,
      course_id: input.course_id,
      created_by: input.created_by ?? null,
      title: input.title,
      description: input.description ?? null,
      instructions: input.instructions ?? null,
      max_marks: input.max_marks ?? 100,
      passing_marks: input.passing_marks ?? null,
      due_date: input.due_date ?? null,
      allow_late: input.allow_late ?? false,
      assignment_type: input.assignment_type ?? "file",
      quiz_spec: input.quiz_spec ?? null,
      is_published: input.is_published ?? false,
    })
    .select("*")
    .single()

  if (error) throw error
  return data as AssignmentRow
}

export async function updateAssignment(
  assignmentId: string,
  patch: Partial<
    Pick<
      AssignmentRow,
      | "title"
      | "description"
      | "instructions"
      | "max_marks"
      | "passing_marks"
      | "due_date"
      | "allow_late"
      | "assignment_type"
      | "quiz_spec"
      | "is_published"
    >
  >,
) {
  const { error } = await supabase.from("assignments").update(patch).eq("id", assignmentId)
  if (error) throw error
}

export async function getAssignmentSubmission(assignmentId: string, studentId: string) {
  const { data, error } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .maybeSingle()

  if (error) throw error
  return data
}

/** Assignments visible to current user (RLS); joins course → subject for labels. */
export async function listAssignmentsCatalog(): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select(
      `
      id,
      title,
      description,
      due_date,
      max_marks,
      assignment_type,
      courses (
        title,
        subjects ( name )
      )
    `,
    )
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })

  if (error) throw error

  return (data ?? []).map((row: Record<string, unknown>) => {
    const courses = row.courses as Record<string, unknown> | Record<string, unknown>[] | undefined
    const c = Array.isArray(courses) ? courses[0] : courses
    const subj = c?.subjects as { name?: string } | { name?: string }[] | undefined
    const sn = Array.isArray(subj) ? subj[0]?.name : subj?.name
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string | null,
      due_date: row.due_date as string | null,
      total_marks: Number(row.max_marks ?? 100),
      assignment_type: row.assignment_type as string | null,
      subject: sn ? { name: sn } : undefined,
      course: c?.title ? { title: String(c.title) } : undefined,
    }
  })
}

export async function listStudyMaterialsCatalog(schoolId: string): Promise<CourseMaterial[]> {
  const { data, error } = await supabase
    .from("study_materials")
    .select(`id, title, url, type, created_at, lesson_id, course_id`)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    description: null,
    url: row.url as string,
    material_type: row.type as string,
    lesson_id: row.lesson_id as string | null,
    course_id: row.course_id as string | null,
    created_at: row.created_at as string,
  }))
}

/** Aggregated LMS metrics for principal / school admin overview (real DB counts). */
export type LmsPrincipalOverview = {
  coursesTotal: number
  coursesPublished: number
  coursesDraft: number
  lessonsTotal: number
  /** LMS course learning-path assignments (not daily homework). */
  assignmentsTotal: number
  assignmentsPublished: number
  studyMaterialsTotal: number
  submissionsRows: number
  submissionsFiled: number
  subjectsTotal: number
  activeEnrollments: number
  examsTotal: number
  lmsCatalogEnrollmentsActive?: number
  lessonProgressRows?: number
  homeworkTotal?: number
  homeworkPublished?: number
  homeworkSubmissionsRows?: number
  homeworkSubmissionsFiled?: number
}

/** Default overview when there is no data or a metric cannot be loaded. */
export const EMPTY_LMS_OVERVIEW: LmsPrincipalOverview = {
  coursesTotal: 0,
  coursesPublished: 0,
  coursesDraft: 0,
  lessonsTotal: 0,
  assignmentsTotal: 0,
  assignmentsPublished: 0,
  studyMaterialsTotal: 0,
  submissionsRows: 0,
  submissionsFiled: 0,
  subjectsTotal: 0,
  activeEnrollments: 0,
  examsTotal: 0,
  lmsCatalogEnrollmentsActive: 0,
  lessonProgressRows: 0,
  homeworkTotal: 0,
  homeworkPublished: 0,
  homeworkSubmissionsRows: 0,
  homeworkSubmissionsFiled: 0,
}

async function safeHeadCount(
  req: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  try {
    const { count, error } = await req
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

function mapRpcToOverview(raw: unknown): LmsPrincipalOverview | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const n = (k: string) => (typeof r[k] === "number" && Number.isFinite(r[k]) ? r[k] : Number(r[k]) || 0)
  const coursesTotal = n("courses_total")
  const coursesPublished = n("courses_published")
  return {
    coursesTotal,
    coursesPublished,
    coursesDraft: Math.max(0, coursesTotal - coursesPublished),
    lessonsTotal: n("lessons_total"),
    assignmentsTotal: n("assignments_total"),
    assignmentsPublished: n("assignments_published"),
    studyMaterialsTotal: n("study_materials_total"),
    submissionsRows: n("submissions_rows"),
    submissionsFiled: n("submissions_filed"),
    subjectsTotal: n("subjects_total"),
    activeEnrollments: n("active_enrollments"),
    examsTotal: n("exams_total"),
    lmsCatalogEnrollmentsActive: n("lms_catalog_enrollments_active"),
    lessonProgressRows: n("lesson_progress_rows"),
    homeworkTotal: n("homework_total"),
    homeworkPublished: n("homework_published"),
    homeworkSubmissionsRows: n("homework_submissions_rows"),
    homeworkSubmissionsFiled: n("homework_submissions_filed"),
  }
}

async function getLmsPrincipalOverviewParallel(schoolId: string): Promise<LmsPrincipalOverview> {
  const filedStatuses = ["submitted", "late", "graded", "returned"] as const

  const [
    coursesTotal,
    coursesPublished,
    lessonsTotal,
    assignmentsTotal,
    assignmentsPublished,
    studyMaterialsTotal,
    submissionsRows,
    submissionsFiled,
    subjectsTotal,
    activeEnrollments,
    examsTotal,
    lmsCatalogEnrollmentsActive,
    lessonProgressRows,
    homeworkTotal,
    homeworkPublished,
    homeworkSubmissionsRows,
    homeworkSubmissionsFiled,
  ] = await Promise.all([
    safeHeadCount(
      supabase.from("courses").select("*", { count: "exact", head: true }).eq("school_id", schoolId).is("deleted_at", null),
    ),
    safeHeadCount(
      supabase
        .from("courses")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .eq("is_published", true),
    ),
    safeHeadCount(
      supabase.from("course_lessons").select("*", { count: "exact", head: true }).eq("school_id", schoolId).is("deleted_at", null),
    ),
    safeHeadCount(
      supabase.from("assignments").select("*", { count: "exact", head: true }).eq("school_id", schoolId).is("deleted_at", null),
    ),
    safeHeadCount(
      supabase
        .from("assignments")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .eq("is_published", true),
    ),
    safeHeadCount(
      supabase.from("study_materials").select("*", { count: "exact", head: true }).eq("school_id", schoolId).is("deleted_at", null),
    ),
    safeHeadCount(
      supabase.from("assignment_submissions").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
    ),
    safeHeadCount(
      supabase
        .from("assignment_submissions")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .in("status", [...filedStatuses]),
    ),
    safeHeadCount(supabase.from("subjects").select("*", { count: "exact", head: true }).eq("school_id", schoolId)),
    safeHeadCount(
      supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "active"),
    ),
    safeHeadCount(
      supabase.from("exams").select("*", { count: "exact", head: true }).eq("school_id", schoolId).is("deleted_at", null),
    ),
    safeHeadCount(
      supabase
        .from("lms_course_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .in("status", ["active", "completed"]),
    ),
    safeHeadCount(supabase.from("lesson_progress").select("*", { count: "exact", head: true }).eq("school_id", schoolId)),
    safeHeadCount(
      supabase.from("homework_assignments").select("*", { count: "exact", head: true }).eq("school_id", schoolId).is("deleted_at", null),
    ),
    safeHeadCount(
      supabase
        .from("homework_assignments")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .eq("is_published", true),
    ),
    safeHeadCount(
      supabase.from("homework_submissions").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
    ),
    safeHeadCount(
      supabase
        .from("homework_submissions")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .in("status", [...filedStatuses]),
    ),
  ])

  const draft = Math.max(0, coursesTotal - coursesPublished)

  return {
    coursesTotal,
    coursesPublished,
    coursesDraft: draft,
    lessonsTotal,
    assignmentsTotal,
    assignmentsPublished,
    studyMaterialsTotal,
    submissionsRows,
    submissionsFiled,
    subjectsTotal,
    activeEnrollments,
    examsTotal,
    lmsCatalogEnrollmentsActive,
    lessonProgressRows,
    homeworkTotal,
    homeworkPublished,
    homeworkSubmissionsRows,
    homeworkSubmissionsFiled,
  }
}

export async function getLmsPrincipalOverview(schoolId: string): Promise<LmsPrincipalOverview> {
  try {
    const { data, error } = await supabase.rpc("get_lms_overview_counts", { p_school_id: schoolId })
    if (!error && data != null) {
      const mapped = mapRpcToOverview(data)
      if (mapped) return mapped
    }
  } catch {
    /* RPC missing or network — use parallel fallback */
  }

  return getLmsPrincipalOverviewParallel(schoolId)
}

/** Back-compat wrappers */
export async function getAssignments(_schoolId: string): Promise<Assignment[]> {
  return listAssignmentsCatalog()
}

export async function getCourseMaterials(schoolId: string): Promise<CourseMaterial[]> {
  return listStudyMaterialsCatalog(schoolId)
}

export async function submitAssignmentManual(params: {
  schoolId: string
  assignmentId: string
  studentId: string
  content?: string
  attachments?: any
}) {
  const { data, error } = await supabase
    .from("assignment_submissions")
    .upsert(
      {
        school_id: params.schoolId,
        assignment_id: params.assignmentId,
        student_id: params.studentId,
        content: params.content || "",
        attachments: params.attachments || [],
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id,student_id" },
    )
    .select()
    .single()

  if (error) throw error
  return data
}

export type AssignmentSubmissionRow = {
  id: string
  school_id: string
  assignment_id: string
  student_id: string
  submitted_at: string | null
  content: string | null
  attachments: unknown
  status: string
  marks_obtained: number | null
  feedback: string | null
  graded_by: string | null
  graded_at: string | null
  created_at: string
  updated_at: string
}

export type ClassSubmissionItem = {
  student_id: string
  student_name: string
  roll_no: string | null
  admission_no: string | null
  submission: AssignmentSubmissionRow | null
}

export async function listSubmissionsForAssignment(
  assignmentId: string,
  courseId: string
): Promise<ClassSubmissionItem[]> {
  try {
    // 1. Fetch all enrolled students for the course
    const { data: enrollments, error: ee } = await supabase
      .from("lms_course_enrollments")
      .select(`
        student_id,
        student:students (
          id,
          first_name,
          last_name,
          roll_no,
          admission_no
        )
      `)
      .eq("course_id", courseId)
      .in("status", ["active", "completed"])

    if (ee) {
      console.error("Error in listSubmissionsForAssignment (enrollments):", ee)
      throw ee
    }

    // 2. Fetch all submissions for this assignment
    const { data: submissions, error: se } = await supabase
      .from("assignment_submissions")
      .select("*")
      .eq("assignment_id", assignmentId)

    if (se) {
      console.error("Error in listSubmissionsForAssignment (submissions):", se)
      throw se
    }

    // Map them together safely
    return (enrollments ?? []).map((e: any) => {
      const rawStudent = e.student ?? e.students
      const s = Array.isArray(rawStudent) ? rawStudent[0] : rawStudent
      const sub = (submissions ?? []).find((subRow: any) => subRow.student_id === e.student_id)
      
      const firstName = s?.first_name || ""
      const lastName = s?.last_name || ""
      const fullName = `${firstName} ${lastName}`.trim()

      return {
        student_id: e.student_id,
        student_name: fullName || "Unknown Student",
        roll_no: s?.roll_no ?? null,
        admission_no: s?.admission_no ?? null,
        submission: sub ? (sub as AssignmentSubmissionRow) : null,
      }
    })
  } catch (err) {
    console.error("Failed listSubmissionsForAssignment:", err)
    throw err
  }
}

export async function gradeSubmission(params: {
  submissionId: string
  marksObtained: number
  feedback?: string
  gradedBy: string
}) {
  const { data, error } = await supabase
    .from("assignment_submissions")
    .update({
      marks_obtained: params.marksObtained,
      feedback: params.feedback || null,
      status: "graded",
      graded_by: params.gradedBy,
      graded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.submissionId)
    .select()
    .single()

  if (error) throw error
  return data
}
