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

function audiencesVisibleToRole(role: string | null): NoticeAudience[] | null {
  if (!role) return ["all"]

  const fullAccess = [
    "principal",
    "school_admin",
    "vice_principal",
    "super_admin",
    "operations_admin",
    "support_admin",
    "analyst",
    "finance_admin",
    "hr_manager",
    "admission_manager",
    "transport_manager",
    "accountant",
    "librarian",
  ]

  if (fullAccess.includes(role)) return null

  const map: Partial<Record<string, NoticeAudience[]>> = {
    teacher: ["all", "teachers", "staff"],
    class_teacher: ["all", "teachers", "staff"],
    student: ["all", "students"],
    parent: ["all", "parents"],
    counselor: ["all", "teachers", "staff", "parents"],
  }

  return map[role] ?? ["all"]
}

export async function getNotices(schoolId: string, activeRole: string | null): Promise<Notice[]> {
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

  const audiences = audiencesVisibleToRole(activeRole)
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
