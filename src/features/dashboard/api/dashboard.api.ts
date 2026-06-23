import { supabase } from "@/lib/supabase"
import { fetchMonthlyCollectionChartSeries } from "@/lib/monthly-collection-chart"

export async function getPrincipalDashboard(schoolId: string) {
  const { data, error } = await supabase
    .from('v_principal_dashboard')
    .select('*')
    .eq('school_id', schoolId)
    .single()
    
  if (error && error.code !== 'PGRST116') throw error // Ignore no rows error
  return data
}

export async function getMonthlyCollections(schoolId: string) {
  return fetchMonthlyCollectionChartSeries(schoolId)
}

export async function getTeacherDashboard(profileId: string, schoolId: string) {
  const { data, error } = await supabase
    .from("v_teacher_sections")
    .select("*")
    .eq("profile_id", profileId)
    .eq("school_id", schoolId)

  if (error) throw error
  return data
}

export async function getParentChildren(profileId: string) {
  const { data, error } = await supabase
    .from('v_parent_children')
    .select('*')
    .eq('profile_id', profileId)
    
  if (error) throw error
  return data
}

const PARENT_CHILD_PAGE_SIZE = 1000

async function paginateAttendanceForStudents(studentIds: string[]) {
  const all: {
    student_id: string
    date: string
    status: string
    subject_id: string | null
  }[] = []

  for (let offset = 0; ; offset += PARENT_CHILD_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("attendance")
      .select("student_id, date, status, subject_id")
      .in("student_id", studentIds)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PARENT_CHILD_PAGE_SIZE - 1)

    if (error) throw error
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < PARENT_CHILD_PAGE_SIZE) break
  }

  return all
}

async function paginateExamResultsForStudents(studentIds: string[]) {
  const all: Record<string, unknown>[] = []

  for (let offset = 0; ; offset += PARENT_CHILD_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("exam_results")
      .select(`
        id,
        exam_id,
        student_id,
        school_id,
        marks_obtained,
        grade,
        is_absent,
        remarks,
        exams (
          name,
          max_marks,
          passing_marks,
          subject_id,
          date,
          deleted_at,
          subjects (name)
        )
      `)
      .in("student_id", studentIds)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PARENT_CHILD_PAGE_SIZE - 1)

    if (error) throw error
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < PARENT_CHILD_PAGE_SIZE) break
  }

  return all
}

/** Full history for one student — used by report card (own query + paging, stable sort). */
export async function getParentReportCardAttendance(studentId: string) {
  if (!studentId) return []

  const all: {
    student_id: string
    date: string
    status: string
    subject_id: string | null
  }[] = []

  for (let offset = 0; ; offset += PARENT_CHILD_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("attendance")
      .select("student_id, date, status, subject_id")
      .eq("student_id", studentId)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PARENT_CHILD_PAGE_SIZE - 1)

    if (error) throw error
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < PARENT_CHILD_PAGE_SIZE) break
  }

  return all
}

export async function getParentReportCardExamResults(studentId: string) {
  if (!studentId) return []

  const all: Record<string, unknown>[] = []

  for (let offset = 0; ; offset += PARENT_CHILD_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("exam_results")
      .select(`
        id,
        exam_id,
        student_id,
        school_id,
        marks_obtained,
        grade,
        is_absent,
        remarks,
        exams (
          name,
          max_marks,
          passing_marks,
          subject_id,
          date,
          deleted_at,
          subjects (name)
        )
      `)
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PARENT_CHILD_PAGE_SIZE - 1)

    if (error) throw error
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < PARENT_CHILD_PAGE_SIZE) break
  }

  return all
}

export async function getChildrenAttendance(studentIds: string[]) {
  if (studentIds.length === 0) return []
  return paginateAttendanceForStudents(studentIds)
}

export async function getChildrenExamResults(studentIds: string[]) {
  if (studentIds.length === 0) return []
  return paginateExamResultsForStudents(studentIds)
}

export async function getChildrenInvoices(studentIds: string[]) {
  if (studentIds.length === 0) return []
  const { data, error } = await supabase
    .from("student_invoices")
    .select("student_id, paid_amount, due_amount")
    .in("student_id", studentIds)
    .is("deleted_at", null)
  if (error) throw error
  return data
}

export async function getCounselorPerformance() {
  const { data, error } = await supabase
    .from('v_counselor_performance')
    .select('*')
    .single()
    
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export type StudentUpdates = {
  first_name?: string
  last_name?: string
  gender?: string | null
  date_of_birth?: string | null
  blood_group?: string | null
  nationality?: string | null
  religion?: string | null
  category?: string | null
  phone?: string | null
  email?: string | null
  address?: any
  permanent_address?: any
  medical_info?: any
}

export async function updateStudentDetails(studentId: string, updates: StudentUpdates) {
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', studentId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getTransportDashboard(schoolId: string) {
  const { data, error } = await supabase
    .from('v_transport_dashboard')
    .select('*')
    .eq('school_id', schoolId)
    .single()
    
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function getCrmManagerDashboard(schoolId: string) {
  const { data, error } = await supabase
    .from('v_crm_manager_dashboard')
    .select('*')
    .eq('school_id', schoolId)
    .single()
    
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export type ClassEnrollmentRow = {
  className: string
  students: number
}

/** Active enrollments grouped by grade/class for principal charts. */
export async function getPrincipalClassEnrollment(schoolId: string): Promise<ClassEnrollmentRow[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select(`
      student_id,
      sections (
        name,
        classes ( name, numeric_level )
      )
    `)
    .eq("school_id", schoolId)
    .eq("status", "active")

  if (error) throw error

  const byClass = new Map<string, { count: number; level: number }>()
  for (const row of data ?? []) {
    const section = row.sections as unknown as {
      name: string
      classes: { name: string; numeric_level: number | null } | null
    } | null
    const className = section?.classes?.name ?? "Unassigned"
    const level = section?.classes?.numeric_level ?? 999
    const key = className
    const prev = byClass.get(key)
    byClass.set(key, { count: (prev?.count ?? 0) + 1, level: prev?.level ?? level })
  }

  return Array.from(byClass.entries())
    .map(([className, { count, level }]) => ({
      className,
      students: count,
      level,
    }))
    .sort((a, b) => a.level - b.level || a.className.localeCompare(b.className))
    .map(({ className, students }) => ({ className, students }))
}

export type LeadFunnelRow = {
  status: string
  label: string
  count: number
}

const LEAD_FUNNEL_ORDER: { status: string; label: string }[] = [
  { status: "new", label: "New" },
  { status: "contacted", label: "Contacted" },
  { status: "interested", label: "Interested" },
  { status: "visit_scheduled", label: "Visit" },
  { status: "applied", label: "Applied" },
  { status: "admitted", label: "Admitted" },
]

/** Open pipeline counts by lead status for principal admissions chart. */
export async function getPrincipalLeadFunnel(schoolId: string): Promise<LeadFunnelRow[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("status")
    .eq("school_id", schoolId)
    .is("deleted_at", null)

  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1)
  }

  return LEAD_FUNNEL_ORDER.map(({ status, label }) => ({
    status,
    label,
    count: counts.get(status) ?? 0,
  }))
}
