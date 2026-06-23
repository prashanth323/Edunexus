import { supabase } from "@/lib/supabase"

export type PrincipalThread = {
  id: string
  school_id: string
  student_id: string
  parent_profile_id: string
  teacher_staff_id: string | null
  status: string
  subject: string | null
  last_message_at: string
  students?: { admission_no: string; profiles: { full_name: string } | null } | null
}

export type PrincipalMessage = {
  id: string
  thread_id: string
  sender_profile_id: string
  sender_role: string
  visibility: string
  body: string
  created_at: string
  profiles?: { full_name: string } | null
}

export async function listPrincipalThreads(schoolId: string) {
  const { data, error } = await supabase
    .from("principal_communication_threads")
    .select(`
      *,
      students ( admission_no, profiles:profile_id ( full_name ) )
    `)
    .eq("school_id", schoolId)
    .order("last_message_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as PrincipalThread[]
}

export async function listPrincipalMessages(threadId: string) {
  const { data, error } = await supabase
    .from("principal_communication_messages")
    .select(`*, profiles:sender_profile_id ( full_name )`)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as PrincipalMessage[]
}

export async function parentMessageToPrincipal(params: {
  schoolId: string
  studentId: string
  body: string
  subject?: string
}) {
  const { data, error } = await supabase.rpc("parent_message_to_principal", {
    p_school_id: params.schoolId,
    p_student_id: params.studentId,
    p_body: params.body,
    p_subject: params.subject ?? null,
  })
  if (error) throw error
  return data as string
}

export async function principalForwardToTeacher(threadId: string, teacherStaffId: string, body: string) {
  const { error } = await supabase.rpc("principal_forward_to_teacher", {
    p_thread_id: threadId,
    p_teacher_staff_id: teacherStaffId,
    p_body: body,
  })
  if (error) throw error
}

export async function teacherRemarkToPrincipal(threadId: string, body: string) {
  const { error } = await supabase.rpc("teacher_remark_to_principal", {
    p_thread_id: threadId,
    p_body: body,
  })
  if (error) throw error
}

export async function principalReplyToParent(threadId: string, body: string) {
  const { error } = await supabase.rpc("principal_reply_to_parent", {
    p_thread_id: threadId,
    p_body: body,
  })
  if (error) throw error
}

export async function getParentChildrenForPrincipalMessaging(parentProfileId: string) {
  const { data, error } = await supabase
    .from("student_parents")
    .select(`
      student_id,
      students ( id, admission_no, profiles:profile_id ( full_name ) )
    `)
    .eq("parents.profile_id", parentProfileId)

  if (error) {
    const { data: links, error: e2 } = await supabase
      .from("student_parents")
      .select(`
        student_id,
        students!inner ( id, admission_no, school_id, profiles:profile_id ( full_name ) )
      `)
    if (e2) throw e2
    const { data: parents } = await supabase.from("parents").select("id").eq("profile_id", parentProfileId)
    const parentIds = (parents ?? []).map((p) => p.id)
    const filtered = (links ?? []).filter(() => parentIds.length > 0)
    return filtered
  }
  return data ?? []
}
