import { supabase } from "@/lib/supabase"

export type ParentPortalCredential = {
  parent_id: string
  first_name: string
  last_name: string
  relation: string
  is_primary: boolean
  login_email: string | null
  has_portal_login: boolean
  phone: string | null
}

export type StudentPortalCredentials = {
  student_id: string
  admission_no: string
  student_name: string
  student_login_email: string | null
  student_has_portal_login: boolean
  parents: ParentPortalCredential[]
}

function mapCredentials(raw: Record<string, unknown>): StudentPortalCredentials {
  const parentsRaw = Array.isArray(raw.parents) ? raw.parents : []
  return {
    student_id: String(raw.student_id ?? ""),
    admission_no: String(raw.admission_no ?? ""),
    student_name: String(raw.student_name ?? ""),
    student_login_email: raw.student_login_email ? String(raw.student_login_email) : null,
    student_has_portal_login: raw.student_has_portal_login === true,
    parents: parentsRaw.map((p) => {
      const row = p as Record<string, unknown>
      return {
        parent_id: String(row.parent_id ?? ""),
        first_name: String(row.first_name ?? ""),
        last_name: String(row.last_name ?? ""),
        relation: String(row.relation ?? ""),
        is_primary: row.is_primary === true,
        login_email: row.login_email ? String(row.login_email) : null,
        has_portal_login: row.has_portal_login === true,
        phone: row.phone ? String(row.phone) : null,
      }
    }),
  }
}

export async function getStudentPortalCredentials(
  studentId: string,
): Promise<StudentPortalCredentials | null> {
  const { data, error } = await supabase.rpc("get_student_portal_credentials", {
    p_student_id: studentId,
  })
  if (error) {
    if (error.message?.toLowerCase().includes("not authorized")) return null
    throw error
  }
  if (!data || typeof data !== "object") return null
  return mapCredentials(data as Record<string, unknown>)
}

export async function getStudentPortalCredentialsByAdmission(
  schoolId: string,
  admissionNo: string,
): Promise<StudentPortalCredentials> {
  const { data, error } = await supabase.rpc("get_student_portal_credentials_by_admission", {
    p_school_id: schoolId,
    p_admission_no: admissionNo.trim(),
  })
  if (error) throw error
  if (!data || typeof data !== "object") throw new Error("No credentials found")
  return mapCredentials(data as Record<string, unknown>)
}

export function canViewPortalCredentials(role: string | null | undefined): boolean {
  return role === "principal" || role === "vice_principal"
}
