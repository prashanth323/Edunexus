import { supabase } from "@/lib/supabase"

/** Matches Postgres `lead_status` enum. */
export type LeadStatus =
  | "new"
  | "contacted"
  | "interested"
  | "followup_scheduled"
  | "visit_scheduled"
  | "visited"
  | "applied"
  | "admitted"
  | "not_interested"
  | "lost"

export type Lead = {
  id: string
  school_id: string
  lead_source_id: string | null
  student_name: string
  parent_name: string
  parent_email: string | null
  parent_phone: string
  status: LeadStatus
  priority: string
  notes: string | null
  created_at: string
  lead_sources?: { name: string } | null
}

export const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "followup_scheduled", label: "Follow-up scheduled" },
  { value: "visit_scheduled", label: "Visit scheduled" },
  { value: "visited", label: "Visited" },
  { value: "applied", label: "Applied" },
  { value: "admitted", label: "Admitted" },
  { value: "not_interested", label: "Not interested" },
  { value: "lost", label: "Lost" },
]

export async function getLeads(schoolId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select(
      `
      id,
      school_id,
      lead_source_id,
      student_name,
      parent_name,
      parent_email,
      parent_phone,
      status,
      priority,
      notes,
      created_at,
      lead_sources ( name )
    `,
    )
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data as any[]).map((row) => ({
    ...row,
    lead_sources: Array.isArray(row.lead_sources) ? row.lead_sources[0] : row.lead_sources,
  })) as Lead[]
}

export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const { error } = await supabase.from("leads").update({ status }).eq("id", leadId)

  if (error) throw error
}

export type CreateLeadInput = {
  schoolId: string
  studentName: string
  parentName: string
  parentPhone: string
  parentEmail?: string
  leadSourceId?: string
  priority?: string
  notes?: string
  classInterested?: string
}

export async function createLead(input: CreateLeadInput) {
  const { data, error } = await supabase
    .from("leads")
    .insert({
      school_id: input.schoolId,
      student_name: input.studentName,
      parent_name: input.parentName,
      parent_phone: input.parentPhone,
      parent_email: input.parentEmail ?? null,
      lead_source_id: input.leadSourceId ?? null,
      priority: input.priority ?? "medium",
      notes: input.notes ?? null,
      class_interested: input.classInterested ?? null,
      status: "new",
    })
    .select(`
      id, school_id, lead_source_id, student_name, parent_name, parent_email,
      parent_phone, status, priority, notes, created_at,
      lead_sources ( name )
    `)
    .single()

  if (error) throw error
  const row = data as Record<string, unknown>
  const src = row.lead_sources
  return {
    ...row,
    lead_sources: Array.isArray(src) ? src[0] : src,
  } as Lead
}

export type Followup = {
  id: string
  lead_id: string
  type: string
  scheduled_at: string
  completed_at: string | null
  status: string
  outcome: string | null
  next_followup: string | null
  notes: string | null
  leads?: { student_name: string; parent_phone: string } | null
}

export async function getFollowups(schoolId: string, leadId?: string) {
  let q = supabase
    .from("followups")
    .select(`
      id, lead_id, type, scheduled_at, completed_at, status, outcome, next_followup, notes,
      leads ( student_name, parent_phone )
    `)
    .eq("school_id", schoolId)
    .order("scheduled_at", { ascending: false })

  if (leadId) q = q.eq("lead_id", leadId)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((row) => {
    const lead = row.leads
    const leadObj = Array.isArray(lead) ? lead[0] : lead
    return { ...row, leads: leadObj ?? null }
  }) as Followup[]
}

export async function createCallFollowup(params: {
  schoolId: string
  leadId: string
  counselorId: string
  scheduledAt: string
  outcome?: string
  notes?: string
  nextFollowup?: string
}) {
  const { data, error } = await supabase
    .from("followups")
    .insert({
      school_id: params.schoolId,
      lead_id: params.leadId,
      counselor_id: params.counselorId,
      type: "call",
      scheduled_at: params.scheduledAt,
      completed_at: new Date().toISOString(),
      status: "done",
      outcome: params.outcome ?? null,
      notes: params.notes ?? null,
      next_followup: params.nextFollowup ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getCounselorIdForCurrentUser(schoolId: string): Promise<string | null> {
  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("school_id", schoolId)
    .eq("profile_id", (await supabase.auth.getUser()).data.user?.id)
    .maybeSingle()

  if (!staff?.id) return null

  const { data: counselor } = await supabase
    .from("counselors")
    .select("id")
    .eq("school_id", schoolId)
    .eq("staff_id", staff.id)
    .maybeSingle()

  if (counselor?.id) return counselor.id

  const { data: created, error } = await supabase
    .from("counselors")
    .insert({ school_id: schoolId, staff_id: staff.id })
    .select("id")
    .single()

  if (error) return null
  return created.id
}
