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
