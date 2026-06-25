import { supabase } from "@/lib/supabase"
import { getStudentIdForProfile } from "@/features/lms/api/lms.api"
import { getParentChildren } from "@/features/dashboard/api/dashboard.api"

/** Student record IDs the logged-in parent or student may view. */
export async function getPortalStudentIds(
  profileId: string,
  schoolId: string,
  activeRole: string,
): Promise<string[]> {
  if (activeRole === "student") {
    const id = await getStudentIdForProfile(profileId, schoolId)
    return id ? [id] : []
  }
  if (activeRole === "parent") {
    const children = await getParentChildren(profileId)
    return children.map((c: { student_id: string }) => c.student_id).filter(Boolean)
  }
  return []
}

/** Active current-year section IDs for the given students. */
export async function getActiveSectionIdsForStudentIds(studentIds: string[]): Promise<string[]> {
  if (!studentIds.length) return []

  const { data, error } = await supabase
    .from("enrollments")
    .select(`
      section_id,
      status,
      academic_years ( is_current )
    `)
    .in("student_id", studentIds)
    .eq("status", "active")

  if (error) throw error

  const ids = new Set<string>()
  for (const row of data ?? []) {
    const ayRaw = (row as { academic_years?: unknown }).academic_years
    const ay = Array.isArray(ayRaw) ? ayRaw[0] : ayRaw
    const isCurrent =
      ay && typeof ay === "object" && "is_current" in ay
        ? !!(ay as { is_current?: boolean }).is_current
        : true
    if (isCurrent && row.section_id) ids.add(String(row.section_id))
  }
  return [...ids]
}

export async function getPortalSectionIds(
  profileId: string,
  schoolId: string,
  activeRole: string,
): Promise<string[]> {
  const studentIds = await getPortalStudentIds(profileId, schoolId, activeRole)
  return getActiveSectionIdsForStudentIds(studentIds)
}
