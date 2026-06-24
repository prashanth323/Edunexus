import { supabase } from "@/lib/supabase"

export type Student = {
  id: string
  admission_no: string
  roll_no: string | null
  first_name: string
  last_name: string
  gender: string | null
  /** Derived from `is_active` for display */
  status: string
  classes?: { name: string } | null
  sections?: { name: string } | null
}

function classSectionFromEnrollmentRow(row: {
  sections?: unknown
}): { classes: { name: string } | null; sections: { name: string } | null } {
  const sectionsRaw = row.sections
  const sec = Array.isArray(sectionsRaw) ? sectionsRaw[0] : sectionsRaw
  const secObj =
    sec && typeof sec === "object"
      ? (sec as { name?: string; classes?: unknown })
      : undefined
  const clRaw = secObj?.classes
  const cl = Array.isArray(clRaw) ? clRaw[0] : clRaw
  return {
    sections: secObj?.name ? { name: String(secObj.name) } : null,
    classes: cl && typeof cl === "object" && cl !== null && "name" in cl && cl.name ? { name: String(cl.name) } : null,
  }
}

/** Pick class/section for list display: prefer active enrollment in marked current year; else first active enrollment. */
function pickDisplayEnrollment(enrollments: unknown): {
  classes: { name: string } | null
  sections: { name: string } | null
} {
  if (!Array.isArray(enrollments)) {
    return { classes: null, sections: null }
  }

  const rows = enrollments.filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)

  let activeCurrent: Record<string, unknown> | undefined
  let anyActive: Record<string, unknown> | undefined

  for (const row of rows) {
    const status = row.status
    if (status !== "active") continue

    const ayRaw = row.academic_years
    const ay = Array.isArray(ayRaw) ? ayRaw[0] : ayRaw
    const isCurrent =
      typeof ay === "object" && ay !== null && "is_current" in ay ? Boolean((ay as { is_current?: boolean }).is_current) : false

    if (isCurrent) {
      activeCurrent = row
      break
    }
    if (!anyActive) anyActive = row
  }

  const chosen = activeCurrent ?? anyActive
  return chosen ? classSectionFromEnrollmentRow(chosen as { sections?: unknown }) : { classes: null, sections: null }
}

export async function getStudents(schoolId: string) {
  /**
   * Do not filter embedded `enrollments` with `.eq(...)` — in PostgREST that behaves like an inner join and
   * **hides students** with no enrollment or without a matching nested row (e.g. invited before placement).
   * Fetch enrollments for display; derive class/section in `pickDisplayEnrollment`.
   */
  const { data, error } = await supabase
    .from("students")
    .select(
      `
      id,
      admission_no,
      roll_no,
      first_name,
      last_name,
      gender,
      is_active,
      enrollments (
        status,
        academic_years ( is_current ),
        sections (
          name,
          classes ( name )
        )
      )
    `,
    )
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("first_name", { ascending: true })

  if (error) throw error
  return (data as any[]).map((s) => {
    const { classes, sections } = pickDisplayEnrollment(s.enrollments)
    return {
      id: s.id,
      admission_no: s.admission_no,
      roll_no: s.roll_no,
      first_name: s.first_name,
      last_name: s.last_name,
      gender: s.gender,
      status: s.is_active ? "active" : "inactive",
      classes,
      sections,
    } as Student
  })
}

export async function deleteStudent(id: string) {
  const { error } = await supabase.from("students").delete().eq("id", id)

  if (error) throw error
}

export type StudentPendingPortalLogin = {
  id: string
  admission_no: string
  first_name: string
  last_name: string
  email: string | null
  classLabel: string | null
  applicationNo: string | null
  parentEmail: string | null
  parentPhone: string | null
  parentFirstName: string | null
  parentLastName: string | null
  parentNeedsLogin: boolean
}

export type StudentPortalLoginLookup = StudentPendingPortalLogin & {
  hasPortalLogin: boolean
}

function mapStudentPortalLoginRow(
  row: Record<string, unknown>,
  profileId: string | null,
): StudentPortalLoginLookup {
  const admissionsRaw = row.admissions
  const admission = Array.isArray(admissionsRaw) ? admissionsRaw[0] : admissionsRaw
  const appRaw =
    admission && typeof admission === "object" && "applications" in admission
      ? (admission as { applications?: unknown }).applications
      : null
  const app = Array.isArray(appRaw) ? appRaw[0] : appRaw
  const appObj = app && typeof app === "object" ? (app as Record<string, unknown>) : null

  const parentLinks = Array.isArray(row.student_parents) ? row.student_parents : []
  const primaryLink =
    parentLinks.find((l: { is_primary?: boolean }) => l.is_primary) ?? parentLinks[0]
  const parRaw =
    primaryLink && typeof primaryLink === "object" && "parents" in primaryLink
      ? (primaryLink as { parents?: unknown }).parents
      : null
  const par = Array.isArray(parRaw) ? parRaw[0] : parRaw
  const parObj = par && typeof par === "object" ? (par as Record<string, unknown>) : null

  return {
    id: row.id as string,
    admission_no: row.admission_no as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    email: (row.email as string | null) ?? null,
    classLabel: appObj?.class_applying ? String(appObj.class_applying) : null,
    applicationNo: appObj?.application_no ? String(appObj.application_no) : null,
    parentEmail: parObj?.email ? String(parObj.email) : null,
    parentPhone: parObj?.phone ? String(parObj.phone) : null,
    parentFirstName: parObj?.first_name ? String(parObj.first_name) : null,
    parentLastName: parObj?.last_name ? String(parObj.last_name) : null,
    parentNeedsLogin: parObj ? !parObj.profile_id : false,
    hasPortalLogin: !!profileId,
  }
}

const PORTAL_LOGIN_SELECT = `
  id,
  admission_no,
  first_name,
  last_name,
  email,
  profile_id,
  created_at,
  admissions (
    applications ( application_no, class_applying )
  ),
  student_parents (
    is_primary,
    parents ( first_name, last_name, email, phone, profile_id )
  )
`

/** Admitted students without a portal login — invite from Students → Add student. */
export async function getStudentsPendingPortalLogin(
  schoolId: string,
): Promise<StudentPendingPortalLogin[]> {
  const { data, error } = await supabase
    .from("students")
    .select(PORTAL_LOGIN_SELECT)
    .eq("school_id", schoolId)
    .is("profile_id", null)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => {
    const mapped = mapStudentPortalLoginRow(row as Record<string, unknown>, null)
    const { hasPortalLogin: _, ...pending } = mapped
    return pending
  })
}

export async function getStudentForPortalLoginByAdmissionNo(
  schoolId: string,
  admissionNo: string,
): Promise<StudentPortalLoginLookup> {
  const { data, error } = await supabase
    .from("students")
    .select(PORTAL_LOGIN_SELECT)
    .eq("school_id", schoolId)
    .eq("admission_no", admissionNo.trim())
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("No student found with this admission number")

  return mapStudentPortalLoginRow(
    data as Record<string, unknown>,
    (data as { profile_id?: string | null }).profile_id ?? null,
  )
}
