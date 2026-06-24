import { supabase } from "@/lib/supabase"
import { createLead as crmCreateLead, type CreateLeadInput } from "@/features/crm/api/crm.api"
import { listClasses, listSectionsForYear } from "@/features/students/api/academics.api"

export { type CreateLeadInput }
export const createLead = crmCreateLead

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "documents_pending"
  | "approved"
  | "rejected"
  | "waitlisted"
  | "withdrawn"

export type FeeBreakdownLine = {
  fee_structure_id: string
  name: string
  amount: number
  concession?: number
}

export type Application = {
  id: string
  school_id: string
  lead_id: string
  academic_year_id: string | null
  class_id: string | null
  section_id: string | null
  class_applying: string
  application_no: string
  status: ApplicationStatus
  form_data: Record<string, unknown>
  documents: { type: string; url: string; label?: string }[]
  needs_hostel: boolean
  needs_transport: boolean
  identity_type: string | null
  identity_number: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
  leads?: {
    student_name: string
    parent_name: string
    parent_phone: string
    parent_email?: string | null
    lead_sources?: { name: string } | null
  } | null
  admissions?: {
    id: string
    student_id: string | null
    students?: {
      id: string
      admission_no: string
      first_name: string
      last_name: string
      email: string | null
      profile_id: string | null
    } | null
  } | null
}

const APPLICATION_SELECT = `
  *,
  leads (
    student_name,
    parent_name,
    parent_phone,
    parent_email,
    lead_sources ( name )
  ),
  admissions (
    id,
    student_id,
    students (
      id,
      admission_no,
      first_name,
      last_name,
      email,
      profile_id
    )
  )
`

function mapApplicationRow(row: Record<string, unknown>): Application {
  const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads
  const src =
    lead && typeof lead === "object" && "lead_sources" in lead
      ? (lead as { lead_sources?: unknown }).lead_sources
      : null
  const admissionsRaw = row.admissions
  const admission = Array.isArray(admissionsRaw) ? admissionsRaw[0] : admissionsRaw
  let admissionsMapped: Application["admissions"] = null
  if (admission && typeof admission === "object") {
    const adm = admission as Record<string, unknown>
    const stuRaw = adm.students
    const stu = Array.isArray(stuRaw) ? stuRaw[0] : stuRaw
    admissionsMapped = {
      id: String(adm.id),
      student_id: adm.student_id ? String(adm.student_id) : null,
      students:
        stu && typeof stu === "object"
          ? {
              id: String((stu as Record<string, unknown>).id),
              admission_no: String((stu as Record<string, unknown>).admission_no),
              first_name: String((stu as Record<string, unknown>).first_name),
              last_name: String((stu as Record<string, unknown>).last_name),
              email: ((stu as Record<string, unknown>).email as string | null) ?? null,
              profile_id: ((stu as Record<string, unknown>).profile_id as string | null) ?? null,
            }
          : null,
    }
  }
  return {
    ...(row as unknown as Application),
    documents: Array.isArray(row.documents) ? row.documents : [],
    form_data: (row.form_data as Record<string, unknown>) ?? {},
    leads: lead
      ? {
          ...(lead as Application["leads"] & object),
          lead_sources: Array.isArray(src) ? src[0] : src,
        }
      : null,
    admissions: admissionsMapped,
  }
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

  // Include inactive rows — UNIQUE(school_id, name) applies regardless of is_active.
  const { data: allSources, error: fetchErr } = await supabase
    .from("lead_sources")
    .select("id, name, is_active")
    .eq("school_id", schoolId)

  if (fetchErr) throw fetchErr

  const byLowerName = new Map(
    (allSources ?? []).map((s) => [s.name.toLowerCase(), s as { id: string; name: string; is_active: boolean }]),
  )

  const toInsert: string[] = []
  const toReactivate: string[] = []

  for (const name of defaults) {
    const existing = byLowerName.get(name.toLowerCase())
    if (!existing) {
      toInsert.push(name)
    } else if (!existing.is_active) {
      toReactivate.push(existing.id)
    }
  }

  if (toReactivate.length > 0) {
    const { error } = await supabase
      .from("lead_sources")
      .update({ is_active: true })
      .in("id", toReactivate)
    if (error) throw error
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("lead_sources").insert(
      toInsert.map((name) => ({ school_id: schoolId, name })),
    )
    if (error) {
      // Concurrent ensure or source created elsewhere — refetch instead of failing.
      if (error.code === "23505") return getLeadSources(schoolId)
      throw error
    }
  }

  return getLeadSources(schoolId)
}

export async function getApplications(
  schoolId: string,
  filters?: { status?: ApplicationStatus; excludeApproved?: boolean },
) {
  let q = supabase
    .from("applications")
    .select(APPLICATION_SELECT)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })

  if (filters?.status) q = q.eq("status", filters.status)
  if (filters?.excludeApproved) q = q.neq("status", "approved")

  const { data, error } = await q
  if (error) throw error

  return (data ?? []).map((row) => mapApplicationRow(row as Record<string, unknown>))
}

const PENDING_STATUSES: ApplicationStatus[] = ["submitted", "under_review", "documents_pending"]

export async function getPendingApprovalApplications(schoolId: string) {
  const { data, error } = await supabase
    .from("applications")
    .select(APPLICATION_SELECT)
    .eq("school_id", schoolId)
    .in("status", PENDING_STATUSES)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapApplicationRow(row as Record<string, unknown>))
}

export async function getApprovedApplicationsWithAdmission(schoolId: string) {
  const { data, error } = await supabase
    .from("applications")
    .select(APPLICATION_SELECT)
    .eq("school_id", schoolId)
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false, nullsFirst: false })

  if (error) throw error
  return (data ?? []).map((row) => mapApplicationRow(row as Record<string, unknown>))
}

export async function getClassesForSchool(schoolId: string) {
  return listClasses(schoolId)
}

export async function getSectionsForClass(
  schoolId: string,
  academicYearId: string,
  classId: string,
) {
  return listSectionsForYear(schoolId, academicYearId, classId)
}

export type FeeStructureRow = {
  id: string
  name: string
  amount: number
  frequency: string
  is_optional: boolean
}

export async function getFeeStructuresForClass(
  schoolId: string,
  academicYearId: string,
  classId: string,
): Promise<FeeStructureRow[]> {
  const { data, error } = await supabase
    .from("fee_structures")
    .select("id, name, amount, frequency, is_optional")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .eq("is_active", true)
    .or(`class_id.eq.${classId},class_id.is.null`)
    .order("name")

  if (error) throw error
  return (data ?? []) as FeeStructureRow[]
}

export async function createApplication(params: {
  schoolId: string
  leadId: string
  classApplying: string
  academicYearId?: string
  classId?: string
  sectionId?: string
  formData?: Record<string, unknown>
  needsHostel?: boolean
  needsTransport?: boolean
  identityType?: string
  identityNumber?: string
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
      class_id: params.classId ?? null,
      section_id: params.sectionId ?? null,
      form_data: params.formData ?? {},
      status: "draft",
      needs_hostel: params.needsHostel ?? false,
      needs_transport: params.needsTransport ?? false,
      identity_type: params.identityType ?? null,
      identity_number: params.identityNumber ?? null,
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
  feeBreakdown?: FeeBreakdownLine[]
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
      fee_breakdown: input.feeBreakdown ?? [],
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

export async function getFeeCommitmentByApplication(applicationId: string) {
  const { data, error } = await supabase
    .from("fee_commitments")
    .select("*")
    .eq("application_id", applicationId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function updateFeeCommitmentBreakdown(
  applicationId: string,
  breakdown: FeeBreakdownLine[],
  concessionNotes?: string,
) {
  const total = breakdown.reduce((sum, line) => sum + (line.amount - (line.concession ?? 0)), 0)
  const { data, error } = await supabase
    .from("fee_commitments")
    .update({
      fee_breakdown: breakdown,
      total_fee: total,
      concession_notes: concessionNotes ?? null,
    })
    .eq("application_id", applicationId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function approveAdmissionApplication(
  applicationId: string,
  feeBreakdown?: FeeBreakdownLine[],
  options?: {
    transportMode?: "self" | "school_bus" | "hostel"
    routeId?: string | null
    hostelRoomId?: string | null
  },
): Promise<{ studentId: string; admissionNo: string }> {
  // Remote DB function signature (already deployed):
  // approve_admission_application(p_application_id, p_concession_overrides, p_route_id, p_hostel_room_id, p_transport_mode)
  const concessionOverrides =
    feeBreakdown?.map((line) => {
      const concession = line.concession ?? 0
      return {
        fee_structure_id: line.fee_structure_id || null,
        name: line.name,
        amount: line.amount,
        concession_amount: concession,
        final_amount: line.amount - concession,
      }
    }) ?? []

  const transportMode = options?.transportMode ?? "self"

  const { data: studentId, error } = await supabase.rpc("approve_admission_application", {
    p_application_id: applicationId,
    p_concession_overrides: concessionOverrides,
    p_route_id: options?.routeId ?? null,
    p_hostel_room_id: options?.hostelRoomId ?? null,
    p_transport_mode: transportMode,
  })

  if (error) throw error
  if (!studentId) throw new Error("Approval did not return a student id")

  const { data: student, error: stuErr } = await supabase
    .from("students")
    .select("admission_no")
    .eq("id", studentId)
    .single()

  if (stuErr || !student) {
    throw new Error(stuErr?.message ?? "Student not found after approval")
  }

  return {
    studentId: String(studentId),
    admissionNo: student.admission_no as string,
  }
}
