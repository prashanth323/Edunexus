import { isPlatformRole } from "@/config/navigation"

/** School roles that must complete phone, gender, and DOB after invite (employees / teachers). */
export const PROFILE_ONBOARDING_SCHOOL_ROLES = new Set<string>([
  "teacher",
  "class_teacher",
  "school_admin",
  "head_accountant",
  "accountant",
  "hostel_manager",
  "hr_manager",
  "admission_manager",
  "counselor",
  "librarian",
  "transport_manager",
  "vice_principal",
])

export function needsProfileOnboarding(params: {
  platformRole: string | null | undefined
  activeRole: string | null | undefined
  profile: {
    phone?: string | null
    gender?: string | null
    date_of_birth?: string | null
    onboarding_completed_at?: string | null
  } | null
}): boolean {
  const { platformRole, activeRole, profile } = params
  if (!profile || !activeRole) return false
  if (isPlatformRole(platformRole)) return false
  if (!PROFILE_ONBOARDING_SCHOOL_ROLES.has(activeRole)) return false
  if (profile.onboarding_completed_at) return false
  return !profile.phone?.trim() || !profile.gender || !profile.date_of_birth
}
