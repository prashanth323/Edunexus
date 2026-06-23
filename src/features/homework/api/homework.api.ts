import { supabase } from "@/lib/supabase"

/** Rows in `homework_assignments` — standalone daily homework, not LMS course learning path. */
export type HomeworkAssignmentRow = {
  id: string
  school_id: string
  academic_year_id: string
  section_id: string
  class_id: string | null
  subject_id: string
  teacher_id: string | null
  created_by: string | null
  title: string
  description: string | null
  max_marks: number
  due_date: string | null
  is_published: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type HomeworkSubmissionRow = {
  id: string
  school_id: string
  homework_assignment_id: string
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

export type DailyHomeworkClassItem = {
  student_id: string
  student_name: string
  roll_no: string | null
  admission_no: string | null
  submission: HomeworkSubmissionRow | null
}

export type ChildHomeworkProgress = {
  student_id: string
  /** `homework_assignments.id` */
  homework_id: string
  title: string
  description: string | null
  max_marks: number
  due_date: string | null
  /** Human grouping line (daily homework bucket). */
  course_title: string
  subject_name: string
  class_name: string | null
  section_name: string | null
  submission: {
    id: string
    status: string
    submitted_at: string | null
    content: string | null
    marks_obtained: number | null
    feedback: string | null
    graded_at: string | null
  } | null
}

export async function listDailyHomeworkForGroup(params: {
  schoolId: string
  subjectId: string
  sectionId: string
}): Promise<HomeworkAssignmentRow[]> {
  const { data, error } = await supabase
    .from("homework_assignments")
    .select("*")
    .eq("school_id", params.schoolId)
    .eq("subject_id", params.subjectId)
    .eq("section_id", params.sectionId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) throw error
  return ((data ?? []) as HomeworkAssignmentRow[]).map((r) => ({
    ...r,
    max_marks: Number(r.max_marks ?? 100),
  }))
}

export async function createDailyHomework(input: {
  school_id: string
  academic_year_id: string
  section_id: string
  class_id: string | null
  subject_id: string
  teacher_id: string | null
  created_by: string | null
  title: string
  description?: string | null
  max_marks?: number
  due_date?: string | null
  is_published?: boolean
}): Promise<HomeworkAssignmentRow> {
  const { data, error } = await supabase
    .from("homework_assignments")
    .insert({
      school_id: input.school_id,
      academic_year_id: input.academic_year_id,
      section_id: input.section_id,
      class_id: input.class_id,
      subject_id: input.subject_id,
      teacher_id: input.teacher_id,
      created_by: input.created_by,
      title: input.title,
      description: input.description ?? null,
      max_marks: input.max_marks ?? 100,
      due_date: input.due_date ?? null,
      is_published: input.is_published ?? false,
    })
    .select("*")
    .single()

  if (error) throw error
  return { ...(data as HomeworkAssignmentRow), max_marks: Number((data as HomeworkAssignmentRow).max_marks ?? 100) }
}

export async function submitHomeworkManual(params: {
  schoolId: string
  homeworkAssignmentId: string
  studentId: string
  content?: string
  attachments?: unknown
}) {
  const { data, error } = await supabase
    .from("homework_submissions")
    .upsert(
      {
        school_id: params.schoolId,
        homework_assignment_id: params.homeworkAssignmentId,
        student_id: params.studentId,
        content: params.content ?? "",
        attachments: (params.attachments as object) ?? [],
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "homework_assignment_id,student_id" },
    )
    .select()
    .single()

  if (error) throw error
  return data as HomeworkSubmissionRow
}

export async function gradeHomeworkSubmission(params: {
  submissionId: string
  marksObtained: number
  feedback?: string
  gradedBy: string
}) {
  const { data, error } = await supabase
    .from("homework_submissions")
    .update({
      marks_obtained: params.marksObtained,
      feedback: params.feedback ?? null,
      status: "graded",
      graded_by: params.gradedBy,
      graded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.submissionId)
    .select()
    .single()

  if (error) throw error
  return data as HomeworkSubmissionRow
}

export async function listSubmissionsForHomework(homeworkAssignmentId: string): Promise<DailyHomeworkClassItem[]> {
  const { data: homework, error: he } = await supabase
    .from("homework_assignments")
    .select("school_id, section_id, academic_year_id")
    .eq("id", homeworkAssignmentId)
    .maybeSingle()

  if (he) throw he
  if (!homework)
    throw new Error("Homework not found.")

  const { data: roster, error: re } = await supabase
    .from("enrollments")
    .select(
      `
      student_id,
      student:students (
        id,
        first_name,
        last_name,
        roll_no,
        admission_no
      )
    `,
    )
    .eq("school_id", homework.school_id)
    .eq("section_id", homework.section_id)
    .eq("academic_year_id", homework.academic_year_id)
    .eq("status", "active")

  if (re) throw re

  const { data: submissions, error: se } = await supabase
    .from("homework_submissions")
    .select("*")
    .eq("homework_assignment_id", homeworkAssignmentId)

  if (se) throw se

  return (roster ?? []).map((e: any) => {
    const rawStudent = e.student ?? e.students
    const s = Array.isArray(rawStudent) ? rawStudent[0] : rawStudent
    const sub = (submissions ?? []).find((x: any) => x.student_id === e.student_id)
    const firstName = s?.first_name ?? ""
    const lastName = s?.last_name ?? ""

    return {
      student_id: e.student_id,
      student_name: `${firstName} ${lastName}`.trim() || "Unknown Student",
      roll_no: s?.roll_no ?? null,
      admission_no: s?.admission_no ?? null,
      submission: sub ? (sub as HomeworkSubmissionRow) : null,
    }
  })
}

export async function getChildrenHomeworkProgress(studentIds: string[]): Promise<ChildHomeworkProgress[]> {
  if (studentIds.length === 0) return []

  const { data: enrolRows, error: ee } = await supabase
    .from("enrollments")
    .select("student_id, section_id, academic_year_id, school_id")
    .in("student_id", studentIds)
    .eq("status", "active")

  if (ee) throw ee
  const enrollments = enrolRows ?? []
  if (enrollments.length === 0) return []

  const schoolIds = [...new Set(enrollments.map((r: any) => r.school_id as string))]

  const { data: hwRows, error: ae } = await supabase
    .from("homework_assignments")
    .select(
      `
      *,
      subjects ( name ),
      classes ( id, name ),
      sections ( id, name )
    `,
    )
    .in("school_id", schoolIds)
    .eq("is_published", true)
    .is("deleted_at", null)

  if (ae) throw ae

  const homeworkList = (hwRows ?? []) as HomeworkAssignmentRow[]

  const filteredHw = homeworkList.filter((hw) =>
    enrollments.some(
      (e: any) =>
        e.school_id === hw.school_id &&
        e.section_id === hw.section_id &&
        e.academic_year_id === hw.academic_year_id &&
        studentIds.includes(e.student_id),
    ),
  )

  if (filteredHw.length === 0) return []

  const hwIds = filteredHw.map((h) => h.id)

  const { data: subRows, error: se } = await supabase
    .from("homework_submissions")
    .select("*")
    .in("homework_assignment_id", hwIds)
    .in("student_id", studentIds)

  if (se) throw se
  const submissions = subRows ?? []

  const nestedName = (rel: unknown): string | null => {
    const o = (Array.isArray(rel) ? rel[0] : rel) as { name?: string } | undefined
    return o?.name?.trim() || null
  }

  const result: ChildHomeworkProgress[] = []

  for (const hw of filteredHw) {
    const hRow = hw as HomeworkAssignmentRow & Record<string, unknown>
    const subjectName = nestedName(hRow.subjects) ?? "Subject"
    const clsNameFromJoin = nestedName(hRow.classes)
    const secJoin = nestedName(hRow.sections)

    for (const e of enrollments) {
      const en = e as any
      if (
        en.school_id !== hw.school_id ||
        en.section_id !== hw.section_id ||
        en.academic_year_id !== hw.academic_year_id ||
        !studentIds.includes(en.student_id)
      ) {
        continue
      }

      const sub = submissions.find((s: any) => s.homework_assignment_id === hw.id && s.student_id === en.student_id)

      result.push({
        student_id: en.student_id,
        homework_id: hw.id,
        title: hw.title,
        description: hw.description,
        max_marks: Number(hw.max_marks),
        due_date: hw.due_date,
        course_title: "Daily homework",
        subject_name: subjectName,
        class_name: clsNameFromJoin,
        section_name: secJoin,
        submission: sub
          ? {
              id: sub.id,
              status: sub.status as string,
              submitted_at: sub.submitted_at,
              content: sub.content,
              marks_obtained: sub.marks_obtained != null ? Number(sub.marks_obtained) : null,
              feedback: sub.feedback,
              graded_at: sub.graded_at,
            }
          : null,
      })
    }
  }

  return result
}
