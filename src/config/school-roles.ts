/**
 * Mirrors Postgres enum `school_role` (see migrations). Used for principal invite UI.
 * Principals cannot assign `principal` or `vice_principal` here (super admin only).
 */
export const SCHOOL_ROLE_VALUES = [
  "principal",
  "vice_principal",
  "school_admin",
  "admission_manager",
  "counselor",
  "head_accountant",
  "accountant",
  "hr_manager",
  "teacher",
  "class_teacher",
  "librarian",
  "transport_manager",
  "hostel_manager",
  "receptionist",
  "student",
  "parent",
] as const

export type SchoolRoleValue = (typeof SCHOOL_ROLE_VALUES)[number]

/** Roles a principal (or school admin / VP / HR) may assign via invite-school-users. */
export const PRINCIPAL_INVITABLE_ROLES: readonly SchoolRoleValue[] = [
  "school_admin",
  "admission_manager",
  "counselor",
  "head_accountant",
  "accountant",
  "hostel_manager",
  "hr_manager",
  "teacher",
  "class_teacher",
  "librarian",
  "transport_manager",
  "receptionist",
  "student",
  "parent",
]

/** Roles shown in “Add employee” (excludes student/parent). */
export const PRINCIPAL_INVITE_STAFF_ROLES = PRINCIPAL_INVITABLE_ROLES.filter(
  (r) => r !== "student" && r !== "parent",
) as readonly SchoolRoleValue[]

export function formatSchoolRoleLabel(role: string): string {
  return role.replace(/_/g, " ")
}
