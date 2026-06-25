import { supabase } from "@/lib/supabase"
import { getSchools } from "@/features/dashboard/api/platform.api"

export type NoticeAudience = "all" | "teachers" | "students" | "parents" | "staff"

export type Notice = {
  id: string
  school_id: string
  author_id: string | null
  title: string
  body: string
  audience: NoticeAudience
  is_published: boolean
  published_at: string | null
  expires_at: string | null
  created_at: string
  author?: { first_name: string; last_name: string } | null
}

const SCHOOL_WIDE: NoticeAudience = "all"
const STAFF_AUDIENCES: NoticeAudience[] = ["staff", SCHOOL_WIDE]

function audiencesVisibleToRole(role: string | null): NoticeAudience[] | null {
  if (!role) return ["parents", SCHOOL_WIDE]

  const fullAccess = [
    "principal",
    "school_admin",
    "vice_principal",
    "super_admin",
    "operations_admin",
    "support_admin",
    "analyst",
    "finance_admin",
  ]

  if (fullAccess.includes(role)) return null

  const map: Partial<Record<string, NoticeAudience[]>> = {
    teacher: ["teachers", SCHOOL_WIDE],
    class_teacher: ["teachers", SCHOOL_WIDE],
    student: ["students", SCHOOL_WIDE],
    parent: ["parents", SCHOOL_WIDE],
    counselor: ["parents", "teachers", SCHOOL_WIDE],
    hostel_manager: STAFF_AUDIENCES,
    transport_manager: STAFF_AUDIENCES,
    head_accountant: STAFF_AUDIENCES,
    accountant: STAFF_AUDIENCES,
    librarian: STAFF_AUDIENCES,
    receptionist: STAFF_AUDIENCES,
    hr_manager: STAFF_AUDIENCES,
    admission_manager: STAFF_AUDIENCES,
  }

  return map[role] ?? [SCHOOL_WIDE]
}

export function hasFullNoticeAccess(role: string | null): boolean {
  return audiencesVisibleToRole(role) === null
}

export async function getNotices(schoolId: string, activeRole: string | null): Promise<Notice[]> {
  const audiences = audiencesVisibleToRole(activeRole)
  const portalRole = audiences !== null

  let query = supabase
    .from("notices")
    .select(
      `
      id,
      school_id,
      author_id,
      title,
      body,
      audience,
      is_published,
      published_at,
      expires_at,
      created_at
    `,
    )
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (portalRole) {
    query = query.eq("is_published", true)
  }

  if (audiences?.length) {
    query = query.in("audience", audiences)
  }

  const { data, error } = await query

  if (error) throw error

  return (data ?? []) as Notice[]
}

export async function createSchoolNotice(params: {
  schoolId: string
  title: string
  body: string
  audience: NoticeAudience
  is_published: boolean
}): Promise<void> {
  const { data: authData } = await supabase.auth.getUser()
  const uid = authData.user?.id
  if (!uid) throw new Error("You must be signed in.")

  const now = new Date().toISOString()
  const { error } = await supabase.from("notices").insert({
    school_id: params.schoolId,
    author_id: uid,
    title: params.title.trim(),
    body: params.body.trim(),
    audience: params.audience,
    is_published: params.is_published,
    published_at: params.is_published ? now : null,
  })

  if (error) throw error
}

/** Super admin broadcast: inserts one notice row per target school (RLS-compatible). */
export async function broadcastNotices(params: {
  /** Empty → all schools from {@link getSchools}. */
  schoolIds?: string[]
  title: string
  body: string
  audience: NoticeAudience
  is_published: boolean
}): Promise<void> {
  const targets =
    params.schoolIds === undefined ? (await getSchools()).map((s) => s.id) : [...params.schoolIds]
  if (targets.length === 0) throw new Error("No schools to send to.")

  const { data: authData } = await supabase.auth.getUser()
  const uid = authData.user?.id
  if (!uid) throw new Error("You must be signed in.")

  const now = new Date().toISOString()
  const rows = targets.map((school_id) => ({
    school_id,
    author_id: uid,
    title: params.title.trim(),
    body: params.body.trim(),
    audience: params.audience,
    is_published: params.is_published,
    published_at: params.is_published ? now : null,
  }))

  const { error } = await supabase.from("notices").insert(rows)
  if (error) throw error
}
