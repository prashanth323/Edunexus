/** Active school roles from `user_roles` (may include multiple per school). */

export type UserRoleRow = {
  role: string
  school_id: string | null
  is_active?: boolean | null
}

/** Higher index = higher display priority for `activeRole` label. */
const ROLE_DISPLAY_PRIORITY: readonly string[] = [
  "student",
  "parent",
  "teacher",
  "class_teacher",
  "librarian",
  "receptionist",
  "transport_manager",
  "counselor",
  "admission_manager",
  "accountant",
  "hr_manager",
  "school_admin",
  "vice_principal",
  "principal",
]

export function getActiveSchoolRoles(
  userRoles: UserRoleRow[] | null | undefined,
  schoolId: string | null,
): string[] {
  if (!schoolId || !userRoles?.length) return []
  return userRoles
    .filter((r) => r.school_id === schoolId && r.is_active !== false)
    .map((r) => r.role)
}

export function hasSchoolRole(roles: readonly string[], role: string): boolean {
  return roles.includes(role)
}

export function hasAnySchoolRole(roles: readonly string[], allowed: readonly string[]): boolean {
  return allowed.some((r) => roles.includes(r))
}

export function hasClassTeacherCapabilities(roles: readonly string[]): boolean {
  return hasSchoolRole(roles, "class_teacher")
}

export function hasSubjectTeacherCapabilities(roles: readonly string[]): boolean {
  return hasSchoolRole(roles, "teacher")
}

export function hasAnyTeachingRole(roles: readonly string[]): boolean {
  return hasClassTeacherCapabilities(roles) || hasSubjectTeacherCapabilities(roles)
}

/** Primary role for header display when user holds multiple school roles. */
export function pickPrimarySchoolRole(roles: readonly string[]): string | null {
  if (!roles.length) return null
  let best: string | null = null
  let bestIdx = -1
  for (const role of roles) {
    const idx = ROLE_DISPLAY_PRIORITY.indexOf(role)
    const effectiveIdx = idx >= 0 ? idx : 0
    if (effectiveIdx > bestIdx) {
      bestIdx = effectiveIdx
      best = role
    }
  }
  return best ?? roles[0] ?? null
}

export function formatTeachingRolesLabel(roles: readonly string[]): string | null {
  const subject = hasSubjectTeacherCapabilities(roles)
  const classT = hasClassTeacherCapabilities(roles)
  if (subject && classT) return "Subject & Class Teacher"
  if (subject) return "Subject Teacher"
  if (classT) return "Class Teacher"
  return null
}

export function formatDisplayRoleLabel(
  activeRole: string | null,
  schoolRoles: readonly string[],
): string {
  const teaching = formatTeachingRolesLabel(schoolRoles)
  if (teaching && (activeRole === "teacher" || activeRole === "class_teacher")) {
    return teaching
  }
  if (!activeRole) return "User"
  return activeRole
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
