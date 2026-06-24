import { supabase } from "@/lib/supabase"

export type ParentInvitePayload = {
  email: string
  first_name?: string
  last_name?: string
  phone: string
  relation: string
  is_primary?: boolean
}

export type SchoolInviteRow = {
  email: string
  first_name?: string
  last_name?: string
  role: string
  admission_no?: string
  auto_admission_no?: boolean
  /** Link an existing student row (e.g. after admission approval). */
  student_id?: string
  parent_id?: string
  skip_enrollment?: boolean
  skip_fee_invoices?: boolean
  /** Required for `parent` role. */
  phone?: string
  /** When inviting a student, optional guardians (invite email + link). */
  parents?: ParentInvitePayload[]
  /** Optional class section — student is enrolled for the current academic year. */
  section_id?: string
  /** Optional fee structure IDs — auto-generates invoices for the student. */
  fee_structure_ids?: string[]
}

export type InviteSchoolUsersResult = {
  ok: boolean
  results: { email: string; ok: boolean; error?: string; user_id?: string }[]
}

export async function inviteSchoolUsers(params: {
  schoolId: string
  invitations: SchoolInviteRow[]
}): Promise<InviteSchoolUsersResult> {
  const { data, error } = await supabase.functions.invoke<InviteSchoolUsersResult>("invite-school-users", {
    body: {
      school_id: params.schoolId,
      invitations: params.invitations,
    },
  })

  if (error) throw new Error(error.message ?? "Invitation failed.")
  if (data && typeof data === "object" && "ok" in data && data.ok === false && !data.results) {
    throw new Error((data as { error?: string }).error ?? "Invitation failed.")
  }
  if (!data) throw new Error("No response from invite-school-users.")
  return data
}
