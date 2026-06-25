import { supabase } from "@/lib/supabase"

// ── Types ───────────────────────────────────────────────
export type Exam = {
  id: string
  school_id: string
  name: string
  exam_type: string
  subject_id: string | null
  section_id: string | null
  date: string | null
  start_time: string | null
  end_time: string | null
  max_marks: number
  passing_marks: number | null
  academic_year_id: string | null
  created_by: string | null
  created_at: string
  // Joined
  subjects?: { name: string } | null
  sections?: { name: string; classes: { name: string } | null } | null
}

export type ExamResult = {
  id: string
  exam_id: string
  student_id: string
  marks_obtained: number
  grade: string | null
  remarks: string | null
  students?: {
    id: string
    first_name: string
    last_name: string
    admission_no: string
  }
}

export type ExamFormValues = {
  name: string
  exam_type: string
  subject_id: string
  section_id: string
  date: string
  start_time: string
  end_time: string
  max_marks: number
  passing_marks: number
}

// ── CRUD ────────────────────────────────────────────────
export async function getExams(schoolId: string) {
  const { data, error } = await supabase
    .from("exams")
    .select(`
      *,
      exam_type:type,
      subjects (name),
      sections (name, classes (name))
    `)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .limit(100)
  if (error) throw error
  return data as Exam[]
}

export async function getExamsForSections(schoolId: string, sectionIds: string[]) {
  if (!sectionIds.length) return [] as Exam[]

  const { data, error } = await supabase
    .from("exams")
    .select(`
      *,
      exam_type:type,
      subjects (name),
      sections (name, classes (name))
    `)
    .eq("school_id", schoolId)
    .in("section_id", sectionIds)
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .limit(100)
  if (error) throw error
  return data as Exam[]
}

export async function createExam(schoolId: string, values: ExamFormValues, _createdBy: string) {
  // Fetch class_id and academic_year_id from the selected section
  const { data: sectionData, error: secErr } = await supabase
    .from("sections")
    .select("class_id, academic_year_id")
    .eq("id", values.section_id)
    .single()

  if (secErr || !sectionData) {
    throw new Error("Invalid class/section selected")
  }

  const { data, error } = await supabase
    .from("exams")
    .insert({
      school_id: schoolId,
      academic_year_id: sectionData.academic_year_id,
      class_id: sectionData.class_id,
      section_id: values.section_id || null,
      subject_id: values.subject_id || null,
      name: values.name,
      type: values.exam_type, // DB column is 'type'
      date: values.date || null,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      max_marks: values.max_marks,
      passing_marks: values.passing_marks || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteExam(examId: string) {
  const { error } = await supabase
    .from("exams")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", examId)
  if (error) throw error
}

// ── Results ─────────────────────────────────────────────
export async function getExamResults(examId: string) {
  const { data, error } = await supabase
    .from("exam_results")
    .select(`
      *,
      students (id, first_name, last_name, admission_no)
    `)
    .eq("exam_id", examId)
    .order("marks_obtained", { ascending: false })
  if (error) throw error
  return data as ExamResult[]
}

export async function getExamWithDetails(examId: string) {
  const { data, error } = await supabase
    .from("exams")
    .select(`
      *,
      exam_type:type,
      subjects (name),
      sections (id, name, classes (name))
    `)
    .eq("id", examId)
    .single()
  if (error) throw error
  return data as Exam
}

export async function getStudentsForSection(sectionId: string) {
  const { data, error } = await supabase
    .from("enrollments")
    .select(`
      student_id,
      students (id, first_name, last_name, admission_no)
    `)
    .eq("section_id", sectionId)
    .eq("status", "active")
  if (error) throw error

  return (data ?? []).map((e: any) => {
    const s = Array.isArray(e.students) ? e.students[0] : e.students
    return s
  }).filter(Boolean)
}

export async function bulkSaveMarks(
  examId: string,
  schoolId: string,
  marks: Array<{ student_id: string; marks_obtained: number; grade: string | null; remarks: string | null }>,
) {
  // Upsert all results in a single call
  const rows = marks.map((m) => ({
    exam_id: examId,
    school_id: schoolId,
    student_id: m.student_id,
    marks_obtained: m.marks_obtained,
    grade: m.grade,
    remarks: m.remarks,
  }))

  const { error } = await supabase
    .from("exam_results")
    .upsert(rows, { onConflict: "exam_id,student_id" })
  if (error) throw error
}

// ── Subjects for school ──────────────────────────────────
export async function getSubjects(schoolId: string) {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, code")
    .eq("school_id", schoolId)
    .order("name")
  if (error) throw error
  return data ?? []
}

// ── Sections for school (current year) ──────────────────
export async function getSectionsForSchool(schoolId: string) {
  const { data: ay } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle()

  if (!ay?.id) return []

  const { data, error } = await supabase
    .from("sections")
    .select("id, name, classes (name)")
    .eq("school_id", schoolId)
    .eq("academic_year_id", ay.id)
    .order("name")
  if (error) throw error
  return (data ?? []).map((s: any) => {
    const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes
    return {
      id: s.id,
      name: s.name,
      className: cls?.name || "N/A",
      label: `${cls?.name || "?"} - ${s.name}`,
    }
  })
}

// ── Grade calculator ────────────────────────────────────
export function calculateGrade(marks: number, maxMarks: number): string {
  const pct = (marks / maxMarks) * 100
  if (pct >= 90) return "A+"
  if (pct >= 80) return "A"
  if (pct >= 70) return "B+"
  if (pct >= 60) return "B"
  if (pct >= 50) return "C"
  if (pct >= 40) return "D"
  return "F"
}
