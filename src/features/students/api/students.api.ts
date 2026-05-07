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
