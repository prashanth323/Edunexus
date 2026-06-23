import { supabase } from "@/lib/supabase"

export type HalfDayRequest = {
  id: string
  school_id: string
  student_id: string
  request_date: string
  reason: string | null
  status: "pending" | "approved" | "rejected"
  requested_by: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  students?: { admission_no: string; profiles: { full_name: string } | null } | null
}

export async function getHalfDayRequests(
  schoolId: string,
  status?: "pending" | "approved" | "rejected",
) {
  let q = supabase
    .from("half_day_requests")
    .select(`
      *,
      students (
        admission_no,
        profiles:profile_id ( full_name )
      )
    `)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })

  if (status) q = q.eq("status", status)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((row) => {
    const st = row.students
    const student = Array.isArray(st) ? st[0] : st
    const prof = student?.profiles
    const profile = Array.isArray(prof) ? prof[0] : prof
    return {
      ...row,
      students: student
        ? { admission_no: student.admission_no, profiles: profile ?? null }
        : null,
    }
  }) as HalfDayRequest[]
}

export async function createHalfDayRequest(params: {
  schoolId: string
  studentId: string
  requestDate: string
  reason: string
}) {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("half_day_requests")
    .insert({
      school_id: params.schoolId,
      student_id: params.studentId,
      request_date: params.requestDate,
      reason: params.reason,
      requested_by: user.user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function approveHalfDayRequest(requestId: string) {
  const { error } = await supabase.rpc("approve_half_day_request", {
    p_request_id: requestId,
  })
  if (error) throw error
}

export async function rejectHalfDayRequest(requestId: string) {
  const { data: user } = await supabase.auth.getUser()
  const { error } = await supabase
    .from("half_day_requests")
    .update({
      status: "rejected",
      reviewed_by: user.user?.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)

  if (error) throw error
}
