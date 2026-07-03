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
  const { error } = await supabase.rpc("submit_timetable_for_approval", {
    p_batch_id: batchId,
  })
  if (error) throw error
}

export async function approveTimetableBatch(batchId: string) {
  const { error } = await supabase.rpc("approve_timetable_batch", {
    p_batch_id: batchId,
  })
  if (error) throw error
}

export async function revertTimetableBatchToDraft(batchId: string) {
  const { error } = await supabase.rpc("revert_timetable_batch_to_draft", {
    p_batch_id: batchId,
  })
  if (error) throw error
}

export async function getOrCreateTimetableBatch(params: {
  schoolId: string
  sectionId: string
  academicYearId: string
}): Promise<TimetableBatch> {
  const { data, error } = await supabase.rpc("get_or_create_timetable_batch", {
    p_school_id: params.schoolId,
    p_section_id: params.sectionId,
    p_academic_year_id: params.academicYearId,
  })

  if (error) throw error
  return data as TimetableBatch
}

/** Read batch for a section without creating a new draft row. */
export async function getTimetableBatchForSection(params: {
  schoolId: string
  sectionId: string
  academicYearId: string
}): Promise<TimetableBatch | null> {
  const { data, error } = await supabase
    .from("timetable_batches")
    .select("*")
    .eq("school_id", params.schoolId)
    .eq("section_id", params.sectionId)
    .eq("academic_year_id", params.academicYearId)
    .maybeSingle()

  if (error) throw error
  return data as TimetableBatch | null
}
