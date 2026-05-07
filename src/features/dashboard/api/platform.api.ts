import { supabase } from "@/lib/supabase"

/** Minimal row shapes — align with Supabase schema / regenerate via CLI when needed. */
export type SchoolRow = {
  id: string
  organization_id: string | null
  name: string
  slug: string
  code: string | null
  logo_url: string | null
  cover_url: string | null
  address: unknown
  contact_email: string | null
  contact_phone: string | null
  board: string | null
  established_year: number | null
  affiliation_no: string | null
  timezone: string
  currency: string
  academic_start_month: number
  is_active: boolean
  settings: unknown
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type School = SchoolRow

export type Profile = {
  id: string
  school_id: string | null
  platform_role: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  gender: string | null
  date_of_birth: string | null
  address: unknown
  is_active: boolean
  last_login_at: string | null
  metadata: unknown
  deleted_at: string | null
  created_at: string
  updated_at: string
}

/** Values allowed in Postgres `platform_role` enum (edited by super admins). */
export const EDITABLE_PLATFORM_ROLES = [
  "super_admin",
  "operations_admin",
  "finance_admin",
  "support_admin",
  "analyst",
] as const

export type EditablePlatformRole = (typeof EDITABLE_PLATFORM_ROLES)[number]

export const queryKeys = {
  platformSchools: ["platform-schools"] as const,
  schoolLeadership: (schoolId: string) => ["school-leadership", schoolId] as const,
  platformDashboardAnalytics: (days?: number) => ["platform-dashboard-analytics", days ?? 14] as const,
}

export const SCHOOL_LEADERSHIP_ROLES = ["principal", "school_admin", "vice_principal"] as const

export type SchoolLeadershipRole = "principal" | "school_admin"

export type CreateSchoolInput = {
  name: string
  code?: string | null
  contact_email?: string | null
  board?: string | null
}

export type ProfileAssignable = Pick<Profile, "id" | "first_name" | "last_name" | "email" | "school_id">

export type SchoolLeadershipRow = {
  id: string
  user_id: string
  school_id: string
  role: string
  is_active: boolean
  profiles: {
    first_name: string
    last_name: string
    email: string
  } | null
}

function slugify(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return s.length > 0 ? s : "school"
}

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

export async function getPlatformStats() {
  const [schoolsRes, platformUsersRes, studentsRes, staffRes] = await Promise.all([
    supabase.from("schools").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("profiles").select("*", { count: "exact", head: true }).not("platform_role", "is", null),
    supabase.from("students").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("staff").select("*", { count: "exact", head: true }).is("deleted_at", null),
  ])

  return {
    schools: schoolsRes.count || 0,
    platformUsers: platformUsersRes.count || 0,
    students: studentsRes.count || 0,
    staff: staffRes.count || 0,
  }
}

export type PlatformDashboardAttendanceDay = { date: string; count: number }

export type PlatformDashboardTopSchool = {
  school_id: string
  name: string
  student_count: number
}

export type PlatformDashboardAnalytics = {
  attendance_by_day: PlatformDashboardAttendanceDay[]
  top_schools_by_students: PlatformDashboardTopSchool[]
}

function parsePlatformDashboardAnalytics(raw: unknown): PlatformDashboardAnalytics {
  const empty: PlatformDashboardAnalytics = {
    attendance_by_day: [],
    top_schools_by_students: [],
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty
  const o = raw as Record<string, unknown>

  const attendanceRaw = o.attendance_by_day
  const attendance_by_day: PlatformDashboardAttendanceDay[] = Array.isArray(attendanceRaw)
    ? attendanceRaw
        .map((row) => {
          if (!row || typeof row !== "object") return null
          const r = row as Record<string, unknown>
          const date = typeof r.date === "string" ? r.date : null
          const count = typeof r.count === "number" ? r.count : Number(r.count)
          if (!date || !Number.isFinite(count)) return null
          return { date, count }
        })
        .filter((x): x is PlatformDashboardAttendanceDay => x !== null)
    : []

  const topRaw = o.top_schools_by_students
  const top_schools_by_students: PlatformDashboardTopSchool[] = Array.isArray(topRaw)
    ? topRaw
        .map((row) => {
          if (!row || typeof row !== "object") return null
          const r = row as Record<string, unknown>
          const school_id = typeof r.school_id === "string" ? r.school_id : null
          const name = typeof r.name === "string" ? r.name : null
          const student_count =
            typeof r.student_count === "number" ? r.student_count : Number(r.student_count)
          if (!school_id || !name || !Number.isFinite(student_count)) return null
          return { school_id, name, student_count }
        })
        .filter((x): x is PlatformDashboardTopSchool => x !== null)
    : []

  return { attendance_by_day, top_schools_by_students }
}

/** Server-aggregated series for Platform Overview charts (RPC). */
export async function getPlatformDashboardAnalytics(pDays = 14): Promise<PlatformDashboardAnalytics> {
  const days = Number.isFinite(pDays) ? Math.min(366, Math.max(1, Math.round(pDays))) : 14
  const { data, error } = await supabase.rpc("get_platform_dashboard_analytics", { p_days: days })
  if (error) throw error
  return parsePlatformDashboardAnalytics(data)
}

export async function getSchools() {
  const { data, error } = await supabase.from("schools").select("*").is("deleted_at", null).order("name")

  if (error) throw error
  return data as School[]
}

export async function getSchoolById(id: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase
    .from("schools")
    .select("id,name")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

export type SchoolInsightMetrics = {
  studentCount: number
  staffCount: number
  attendanceByDay: { date: string; count: number }[]
}

export async function getSchoolInsightMetrics(schoolId: string): Promise<SchoolInsightMetrics> {
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - 14)
  const isoStart = start.toISOString().slice(0, 10)

  const [studentsRes, staffRes, attRes] = await Promise.all([
    supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .is("deleted_at", null),
    supabase.from("staff").select("*", { count: "exact", head: true }).eq("school_id", schoolId).is("deleted_at", null),
    supabase.from("attendance").select("date").eq("school_id", schoolId).gte("date", isoStart),
  ])

  const vol = new Map<string, number>()
  if (!attRes.error) {
    for (const row of attRes.data ?? []) {
      const raw = row.date as string | null
      if (!raw) continue
      const day = typeof raw === "string" ? raw.slice(0, 10) : ""
      vol.set(day, (vol.get(day) ?? 0) + 1)
    }
  }

  const attendanceByDay = [...vol.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    studentCount: studentsRes.error ? 0 : studentsRes.count ?? 0,
    staffCount: staffRes.error ? 0 : staffRes.count ?? 0,
    attendanceByDay,
  }
}

export async function createSchool(input: CreateSchoolInput): Promise<School> {
  const name = input.name.trim()
  if (!name) throw new Error("School name is required")

  const baseSlug = slugify(name)
  let slug = baseSlug

  for (let attempt = 0; attempt < 10; attempt++) {
    const row = {
      name,
      slug,
      organization_id: null,
      code: input.code?.trim() || null,
      contact_email: input.contact_email?.trim() || null,
      board: input.board?.trim() || null,
    }

    const { data, error } = await supabase.from("schools").insert(row).select("*").single()

    if (!error && data) return data as School

    if (error?.code === "23505") {
      slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`
      continue
    }

    throw error
  }

  throw new Error("Could not create school after resolving slug conflicts.")
}

export async function searchProfilesForAssignment(opts: {
  query?: string
  limit?: number
} = {}): Promise<ProfileAssignable[]> {
  const limit = opts.limit ?? 24
  const rawQuery = opts.query?.trim()

  let q = supabase
    .from("profiles")
    .select("id, first_name, last_name, email, school_id")
    .is("deleted_at", null)
    .is("platform_role", null)
    .limit(limit)

  if (rawQuery && rawQuery.length > 0) {
    const safe = escapeIlikePattern(rawQuery.slice(0, 128))
    const pattern = `%${safe}%`
    q = q.or(`email.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`)
  }

  const { data, error } = await q.order("email")

  if (error) throw error
  return (data ?? []) as ProfileAssignable[]
}

function normalizeEmbeddedProfile(
  p: SchoolLeadershipRow["profiles"] | SchoolLeadershipRow["profiles"][],
): SchoolLeadershipRow["profiles"] {
  if (p == null) return null
  return Array.isArray(p) ? (p[0] ?? null) : p
}

export async function getSchoolLeadership(schoolId: string): Promise<SchoolLeadershipRow[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select(
      `
      id,
      user_id,
      school_id,
      role,
      is_active,
      profiles:user_id (
        first_name,
        last_name,
        email
      )
    `,
    )
    .eq("school_id", schoolId)
    .in("role", [...SCHOOL_LEADERSHIP_ROLES])
    .eq("is_active", true)
    .order("role")

  if (error) throw error

  const rows = data ?? []
  return rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    school_id: row.school_id as string,
    role: row.role as string,
    is_active: row.is_active as boolean,
    profiles: normalizeEmbeddedProfile(
      row.profiles as SchoolLeadershipRow["profiles"] | SchoolLeadershipRow["profiles"][],
    ),
  }))
}

export async function assignSchoolLeadership(params: {
  schoolId: string
  userId: string
  role: SchoolLeadershipRole
}): Promise<void> {
  const { data: authData } = await supabase.auth.getUser()
  const grantedBy = authData.user?.id
  if (!grantedBy) throw new Error("You must be signed in to assign roles.")

  const { error: insertError } = await supabase.from("user_roles").insert({
    user_id: params.userId,
    school_id: params.schoolId,
    role: params.role,
    granted_by: grantedBy,
    is_active: true,
  })

  if (insertError) {
    if (insertError.code === "23505") {
      throw new Error("This user already has this role at this school.")
    }
    throw insertError
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ school_id: params.schoolId })
    .eq("id", params.userId)

  if (profileError) throw profileError
}

export async function getPlatformUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .not("platform_role", "is", null)
    .is("deleted_at", null)
    .order("first_name")

  if (error) throw error
  return data as Profile[]
}

export async function updateUserPlatformRole(params: {
  userId: string
  platformRole: EditablePlatformRole | null
}): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ platform_role: params.platformRole })
    .eq("id", params.userId)

  if (error) throw error
}

export async function getAuditLogs() {
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      `
      *,
      profiles:actor_id(first_name, last_name, email)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) throw error
  return data
}

export async function invitePrincipal(params: {
  email: string
  schoolId: string
  firstName?: string
  lastName?: string
}): Promise<void> {
  const email = params.email.trim().toLowerCase()
  if (!email) throw new Error("Email is required")

  type InviteResponse = { ok: boolean; error?: string }

  const { data, error } = await supabase.functions.invoke<InviteResponse>("invite-principal", {
    body: {
      email,
      school_id: params.schoolId,
      first_name: params.firstName?.trim() ?? "",
      last_name: params.lastName?.trim() ?? "",
    },
  })

  if (error) throw new Error(error.message ?? "Invitation failed.")
  if (data && typeof data === "object" && "ok" in data && data.ok === false) {
    throw new Error((data as InviteResponse).error ?? "Invitation failed.")
  }
}
