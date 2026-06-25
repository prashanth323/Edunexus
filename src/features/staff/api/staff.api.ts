import { supabase } from "@/lib/supabase"
import { normalizeLmsTeacherProfile, type LmsTeacherProfile } from "@/features/settings/lib/lmsTeacherProfile"

export type Qualification = {
  degree: string
  institute: string
  year: string
}

export type StaffMember = {
  id: string
  school_id: string
  profile_id: string | null
  first_name: string
  last_name: string
  email: string
  phone?: string | null
  gender?: string | null
  date_of_birth?: string | null
  address?: Record<string, unknown> | null
  avatar_url?: string | null
  role: string
  department?: string | null
  department_id?: string | null
  designation?: string | null
  joining_date: string | null
  employment_type?: string | null
  is_active?: boolean
  status: "active" | "on_leave" | "resigned"
  qualifications: Qualification[]
  experience_years?: number | null
  specialization?: string | null
  biography?: string | null
  primary_subject_name?: string | null
  lmsTeacherProfile: LmsTeacherProfile
}

export async function getStaffMembers(schoolId: string) {
  const { data, error } = await supabase
    .from("staff")
    .select(
      `
      id,
      school_id,
      profile_id,
      department_id,
      designation,
      joining_date,
      employment_type,
      is_active,
      deleted_at,
      experience_years,
      specialization,
      biography,
      qualifications,
      lms_teacher_profile,
      departments ( name ),
      subjects!staff_primary_subject_id_fkey ( name ),
      profiles (
        first_name,
        last_name,
        email,
        phone,
        gender,
        date_of_birth,
        address,
        avatar_url,
        user_roles!user_roles_user_id_fkey ( role, school_id, is_active )
      )
    `,
    )
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("joining_date", { ascending: false, nullsFirst: false })

  if (error) throw error

  return (data as any[]).map((row): StaffMember => {
    const prof = row.profiles
    const p = Array.isArray(prof) ? prof[0] : prof
    const dept = row.departments
    const deptName = Array.isArray(dept) ? dept[0]?.name : dept?.name

    const rolesRaw = p?.user_roles
    const rolesList: { role: string; school_id: string; is_active: boolean }[] = Array.isArray(rolesRaw)
      ? rolesRaw
      : rolesRaw
        ? [rolesRaw]
        : []

    const forSchool = rolesList.filter((r) => r.school_id === schoolId && r.is_active)
    const role =
      forSchool.map((r) => r.role).join(", ") ||
      (row.designation ? "staff" : "—")

    const first_name = p?.first_name ?? "—"
    const last_name = p?.last_name ?? "—"
    const email = p?.email ?? "—"

    let status: StaffMember["status"] = "active"
    if (row.deleted_at) status = "resigned"
    else if (!row.is_active) status = "on_leave"

    const subj = row.subjects
    const subjectRow = Array.isArray(subj) ? subj[0] : subj
    const addr = p?.address
    const addressObj =
      addr && typeof addr === "object" && !Array.isArray(addr) ? (addr as Record<string, unknown>) : null

    return {
      id: row.id,
      school_id: row.school_id,
      profile_id: row.profile_id ?? null,
      first_name,
      last_name,
      email,
      phone: p?.phone ?? null,
      gender: p?.gender ?? null,
      date_of_birth: p?.date_of_birth ?? null,
      address: addressObj,
      avatar_url: p?.avatar_url ?? null,
      role,
      department: deptName ?? null,
      department_id: row.department_id ?? null,
      designation: row.designation ?? null,
      joining_date: row.joining_date ?? null,
      employment_type: row.employment_type ?? null,
      is_active: row.is_active ?? true,
      status,
      qualifications: (row.qualifications as Qualification[]) ?? [],
      experience_years: row.experience_years,
      specialization: row.specialization,
      biography: row.biography,
      primary_subject_name: subjectRow?.name ?? null,
      lmsTeacherProfile: normalizeLmsTeacherProfile(row.lms_teacher_profile),
    }
  })
}

export async function getStaffMemberForEdit(staffId: string) {
  const { data, error } = await supabase
    .from("staff")
    .select(
      `
      id,
      school_id,
      profile_id,
      department_id,
      designation,
      joining_date,
      employment_type,
      experience_years,
      specialization,
      biography,
      is_active,
      profiles ( first_name, last_name, email, phone, gender, date_of_birth )
    `,
    )
    .eq("id", staffId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("Staff member not found")
  return data
}

export async function updateStaffProfileByAdmin(
  staffId: string,
  profile: Record<string, unknown>,
  staff: Record<string, unknown>,
) {
  const { error } = await supabase.rpc("update_staff_profile_by_admin", {
    p_staff_id: staffId,
    p_profile: profile,
    p_staff: staff,
  })
  if (error) throw error
}

export type StaffTeachingRoles = {
  subjectTeacher: boolean
  classTeacher: boolean
}

export async function getStaffTeachingRoles(staffId: string): Promise<StaffTeachingRoles> {
  const { data, error } = await supabase.rpc("get_staff_teaching_roles", {
    p_staff_id: staffId,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    subjectTeacher: Boolean(row?.subject_teacher),
    classTeacher: Boolean(row?.class_teacher),
  }
}

export async function setStaffTeachingRoles(
  staffId: string,
  subjectTeacher: boolean,
  classTeacher: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("set_staff_teaching_roles", {
    p_staff_id: staffId,
    p_subject_teacher: subjectTeacher,
    p_class_teacher: classTeacher,
  })
  if (error) throw error
}

export function teachingRoleBadges(roles: string): string[] {
  const set = new Set(roles.split(",").map((r) => r.trim()))
  const badges: string[] = []
  if (set.has("teacher")) badges.push("Subject")
  if (set.has("class_teacher")) badges.push("Class")
  return badges
}
