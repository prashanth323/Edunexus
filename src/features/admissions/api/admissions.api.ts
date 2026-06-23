import { supabase } from "@/lib/supabase"

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "documents_pending"
  | "approved"
  | "rejected"
  | "waitlisted"
  | "withdrawn"

export type Application = {
  id: string
  school_id: string
  lead_id: string
  academic_year_id: string | null
  class_applying: string
  application_no: string
  status: ApplicationStatus
  form_data: Record<string, unknown>
  documents: { type: string; url: string; label?: string }[]
  needs_hostel: boolean
  needs_transport: boolean
  reviewed_by: string | null
  rejection_reason: string | null
  created_at: string
  leads?: {
    student_name: string
    parent_name: string
    parent_phone: string
    lead_sources?: { name: string } | null
  } | null
}

export type LeadSource = { id: string; name: string }

export async function getLeadSources(schoolId: string) {
  const { data, error } = await supabase
    .from("lead_sources")
    .select("id, name")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("name")

  if (error) throw error
  return (data ?? []) as LeadSource[]
}

export async function ensureDefaultLeadSources(schoolId: string) {
  const defaults = ["Walk-in", "Phone", "Website", "Referral"]
  const existing = await getLeadSources(schoolId)
  const names = new Set(existing.map((s) => s.name.toLowerCase()))
  const toInsert = defaults.filter((d) => !names.has(d.toLowerCase()))
  if (toInsert.length === 0) return existing

  const { error } = await supabase.from("lead_sources").insert(
    toInsert.map((name) => ({ school_id: schoolId, name })),
  )
  if (error) throw error
  return getLeadSources(schoolId)
}

export async function getApplications(
  schoolId: string,
  filters?: { status?: ApplicationStatus },
) {
  let q = supabase
    .from("applications")
    .select(`
      *,
      leads (
        student_name,
        parent_name,
        parent_phone,
        lead_sources ( name )
      )
    `)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })

  if (filters?.status) q = q.eq("status", filters.status)

  const { data, error } = await q
  if (error) throw error

  return (data ?? []).map((row) => {
    const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads
    const src = lead?.lead_sources
    return {
      ...row,
      documents: Array.isArray(row.documents) ? row.documents : [],
      form_data: (row.form_data as Record<string, unknown>) ?? {},
      leads: lead
        ? {
            ...lead,
            lead_sources: Array.isArray(src) ? src[0] : src,
          }
        : null,
    }
  }) as Application[]
}

export async function createApplication(params: {
  schoolId: string
  leadId: string
  classApplying: string
  academicYearId?: string
  formData?: Record<string, unknown>
  needsHostel?: boolean
  needsTransport?: boolean
}) {
  const prefix = `APP-${new Date().getFullYear()}`
  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("school_id", params.schoolId)

  const appNo = `${prefix}-${String((count ?? 0) + 1).padStart(5, "0")}`

  const { data, error } = await supabase
    .from("applications")
    .insert({
      school_id: params.schoolId,
      lead_id: params.leadId,
      class_applying: params.classApplying,
      application_no: appNo,
      academic_year_id: params.academicYearId ?? null,
      form_data: params.formData ?? {},
      status: "draft",
      needs_hostel: params.needsHostel ?? false,
      needs_transport: params.needsTransport ?? false,
    })
    .select()
    .single()

  if (error) throw error
  return data as Application
}

export async function updateApplication(
  id: string,
  patch: Partial<{
    form_data: Record<string, unknown>
    documents: { type: string; url: string; label?: string }[]
    status: ApplicationStatus
    class_applying: string
    needs_hostel: boolean
    needs_transport: boolean
    rejection_reason: string
  }>,
) {
  const { data, error } = await supabase
    .from("applications")
    .update(patch)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data as Application
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  rejectionReason?: string,
) {
  const { data: user } = await supabase.auth.getUser()
  const patch: Record<string, unknown> = { status }
  if (["approved", "rejected", "under_review"].includes(status)) {
    patch.reviewed_by = user.user?.id
  }
  if (rejectionReason) patch.rejection_reason = rejectionReason

  const { data, error } = await supabase
    .from("applications")
    .update(patch)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data as Application
}

export async function uploadApplicationDocument(
  schoolId: string,
  applicationId: string,
  file: File,
  docType: string,
) {
  const ext = file.name.split(".").pop() ?? "pdf"
  const path = `${schoolId}/applications/${applicationId}/${docType}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("student-documents")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from("student-documents").getPublicUrl(path)

  const { data: app, error: fetchErr } = await supabase
    .from("applications")
    .select("documents")
    .eq("id", applicationId)
    .single()

  if (fetchErr) throw fetchErr

  const docs = Array.isArray(app.documents) ? [...app.documents] : []
  const filtered = docs.filter((d: { type?: string }) => d.type !== docType)
  filtered.push({ type: docType, url: urlData.publicUrl, label: docType })

  return updateApplication(applicationId, { documents: filtered })
}

export type FeeCommitmentInput = {
  schoolId: string
  studentId?: string
  applicationId?: string
  academicYearId: string
  totalFee: number
  paidAmount?: number
  commitmentDate?: string
  schedule: { amount: number; due_date: string; label?: string }[]
}

export async function createFeeCommitment(input: FeeCommitmentInput) {
  const { data, error } = await supabase
    .from("fee_commitments")
    .insert({
      school_id: input.schoolId,
      student_id: input.studentId ?? null,
      application_id: input.applicationId ?? null,
      academic_year_id: input.academicYearId,
      total_fee: input.totalFee,
      paid_amount: input.paidAmount ?? 0,
      commitment_date: input.commitmentDate ?? null,
      schedule: input.schedule,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getFeeCommitments(schoolId: string, studentId?: string) {
  let q = supabase
    .from("fee_commitments")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })

  if (studentId) q = q.eq("student_id", studentId)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
