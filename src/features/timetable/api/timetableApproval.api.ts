import { supabase } from "@/lib/supabase"

export type TimetableBatch = {
  id: string
  school_id: string
  section_id: string
  academic_year_id: string
  status: "draft" | "pending_approval" | "published"
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  sections?: { name: string; classes: { name: string } | null } | null
}

export async function getTimetableBatches(schoolId: string, status?: string) {
  let q = supabase
    .from("timetable_batches")
    .select(`
      *,
      sections ( name, classes ( name ) )
    `)
    .eq("school_id", schoolId)
    .order("updated_at", { ascending: false })

  if (status) q = q.eq("status", status)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TimetableBatch[]
}

export async function submitTimetableForApproval(batchId: string) {
  const { error } = await supabase
    .from("timetable_batches")
    .update({ status: "pending_approval" })
    .eq("id", batchId)
  if (error) throw error
}

export async function approveTimetableBatch(batchId: string) {
  const { data: user } = await supabase.auth.getUser()
  const { error } = await supabase
    .from("timetable_batches")
    .update({
      status: "published",
      approved_by: user.user?.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", batchId)
  if (error) throw error
}

export async function getOrCreateTimetableBatch(params: {
  schoolId: string
  sectionId: string
  academicYearId: string
}) {
  const { data: existing } = await supabase
    .from("timetable_batches")
    .select("*")
    .eq("school_id", params.schoolId)
    .eq("section_id", params.sectionId)
    .eq("academic_year_id", params.academicYearId)
    .maybeSingle()

  if (existing) return existing as TimetableBatch

  const { data: user } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from("timetable_batches")
    .insert({
      school_id: params.schoolId,
      section_id: params.sectionId,
      academic_year_id: params.academicYearId,
      status: "draft",
      created_by: user.user?.id,
    })
    .select()
    .single()

  if (error) throw error
  return data as TimetableBatch
}
