import { supabase } from "@/lib/supabase"

export type FeePlanStatus = "draft" | "pending_vp" | "approved" | "rejected"

export type ClassFeePlan = {
  id: string
  school_id: string
  academic_year_id: string
  class_id: string
  status: FeePlanStatus
  rejection_notes: string | null
  submitted_at: string | null
  classes?: { name: string } | null
}

export type FeePlanTerm = {
  id: string
  plan_id: string
  term_order: number
  term_label: string
  due_date: string | null
  items?: FeePlanItem[]
}

export type FeePlanItem = {
  id: string
  term_id: string
  name: string
  amount: number
}

export type FeeCatalogRow = {
  plan_id: string
  class_id: string
  class_name: string
  term_order: number
  term_label: string
  due_date: string | null
  item_name: string
  amount: number
}

export async function getClassFeePlans(schoolId: string): Promise<ClassFeePlan[]> {
  const { data, error } = await supabase
    .from("class_fee_plans")
    .select("id, school_id, academic_year_id, class_id, status, rejection_notes, submitted_at, classes ( name )")
    .eq("school_id", schoolId)
    .order("updated_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalizeClassFeePlan)
}

function normalizeClassFeePlan(row: Record<string, unknown>): ClassFeePlan {
  const classes = row.classes
  const cls = Array.isArray(classes) ? classes[0] : classes
  return {
    ...(row as unknown as ClassFeePlan),
    classes: cls as { name: string } | null,
  }
}

export async function getPendingFeePlans(schoolId: string): Promise<ClassFeePlan[]> {
  const { data, error } = await supabase
    .from("class_fee_plans")
    .select("id, school_id, academic_year_id, class_id, status, submitted_at, classes ( name )")
    .eq("school_id", schoolId)
    .eq("status", "pending_vp")
    .order("submitted_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalizeClassFeePlan)
}

export async function getFeePlanWithTerms(planId: string): Promise<{ plan: ClassFeePlan; terms: FeePlanTerm[] }> {
  const { data: plan, error: pErr } = await supabase
    .from("class_fee_plans")
    .select("id, school_id, academic_year_id, class_id, status, rejection_notes, submitted_at, classes ( name )")
    .eq("id", planId)
    .single()
  if (pErr) throw pErr

  const { data: terms, error: tErr } = await supabase
    .from("class_fee_plan_terms")
    .select("id, plan_id, term_order, term_label, due_date")
    .eq("plan_id", planId)
    .order("term_order")
  if (tErr) throw tErr

  const termIds = (terms ?? []).map((t) => t.id)
  let items: FeePlanItem[] = []
  if (termIds.length) {
    const { data: itemRows, error: iErr } = await supabase
      .from("class_fee_plan_items")
      .select("id, term_id, name, amount")
      .in("term_id", termIds)
    if (iErr) throw iErr
    items = (itemRows ?? []) as FeePlanItem[]
  }

  const termsWithItems = (terms ?? []).map((t) => ({
    ...t,
    items: items.filter((i) => i.term_id === t.id),
  })) as FeePlanTerm[]

  return { plan: normalizeClassFeePlan(plan as Record<string, unknown>), terms: termsWithItems }
}

export async function createClassFeePlan(
  schoolId: string,
  academicYearId: string,
  classId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("class_fee_plans")
    .insert({
      school_id: schoolId,
      academic_year_id: academicYearId,
      class_id: classId,
      status: "draft",
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function upsertFeePlanTerm(
  planId: string,
  term: { id?: string; term_order: number; term_label: string; due_date: string | null },
  items: { id?: string; name: string; amount: number }[],
): Promise<void> {
  let termId = term.id
  if (termId) {
    const { error } = await supabase
      .from("class_fee_plan_terms")
      .update({
        term_order: term.term_order,
        term_label: term.term_label,
        due_date: term.due_date,
      })
      .eq("id", termId)
    if (error) throw error
    await supabase.from("class_fee_plan_items").delete().eq("term_id", termId)
  } else {
    const { data, error } = await supabase
      .from("class_fee_plan_terms")
      .insert({
        plan_id: planId,
        term_order: term.term_order,
        term_label: term.term_label,
        due_date: term.due_date,
      })
      .select("id")
      .single()
    if (error) throw error
    termId = data.id
  }

  if (items.length) {
    const { error } = await supabase.from("class_fee_plan_items").insert(
      items.map((i) => ({
        term_id: termId!,
        name: i.name,
        amount: i.amount,
      })),
    )
    if (error) throw error
  }
}

export async function deleteFeePlanTerm(termId: string): Promise<void> {
  const { error } = await supabase.from("class_fee_plan_terms").delete().eq("id", termId)
  if (error) throw error
}

export async function notifyStudentFeeDue(params: {
  studentId: string
  title: string
  body: string
  amount?: number
}): Promise<{ notification_id: string; parent_email: string | null }> {
  const { data, error } = await supabase.rpc("notify_student_fee_due", {
    p_student_id: params.studentId,
    p_title: params.title,
    p_body: params.body,
    p_amount: params.amount ?? null,
  })
  if (error) throw error
  const row = data as { notification_id: string; parent_email: string | null }
  if (row.notification_id && row.parent_email) {
    await supabase.functions.invoke("send-operational-email", {
      body: { notification_id: row.notification_id },
    })
  }
  return row
}

export type FeeNotificationRow = {
  id: string
  title: string
  body: string
  created_at: string
  admission_no: string | null
  student_name: string | null
  amount: number | null
}

export async function getRecentFeeNotifications(
  schoolId: string,
  limit = 5,
): Promise<FeeNotificationRow[]> {
  const { data, error } = await supabase
    .from("school_notifications")
    .select("id, title, body, created_at, metadata")
    .eq("school_id", schoolId)
    .like("type", "fee_due_%")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>
    return {
      id: String(row.id),
      title: String(row.title),
      body: String(row.body),
      created_at: String(row.created_at),
      admission_no: meta.admission_no ? String(meta.admission_no) : null,
      student_name: meta.student_name ? String(meta.student_name) : null,
      amount: meta.amount != null ? Number(meta.amount) : null,
    }
  })
}

export async function submitClassFeePlan(planId: string): Promise<void> {
  const { error } = await supabase.rpc("submit_class_fee_plan", { p_plan_id: planId })
  if (error) throw error
}

export async function reviewClassFeePlan(
  planId: string,
  approve: boolean,
  notes?: string,
): Promise<void> {
  const { error } = await supabase.rpc("review_class_fee_plan", {
    p_plan_id: planId,
    p_approve: approve,
    p_notes: notes ?? null,
  })
  if (error) throw error
}

export async function getApprovedFeeCatalog(schoolId: string): Promise<FeeCatalogRow[]> {
  const { data, error } = await supabase.rpc("get_approved_fee_catalog", { p_school_id: schoolId })
  if (error) throw error
  return (data ?? []) as FeeCatalogRow[]
}

export async function dispatchOperationalNotification(params: {
  type: string
  studentId: string
  title: string
  body: string
  notifyParent?: boolean
  notifyVp?: boolean
  notifyClassTeacher?: boolean
}): Promise<{ notification_id: string; parent_email: string | null }> {
  const { data, error } = await supabase.rpc("dispatch_operational_notification", {
    p_type: params.type,
    p_student_id: params.studentId,
    p_title: params.title,
    p_body: params.body,
    p_notify_parent: params.notifyParent ?? true,
    p_notify_vp: params.notifyVp ?? true,
    p_notify_class_teacher: params.notifyClassTeacher ?? true,
  })
  if (error) throw error
  const row = data as { notification_id: string; parent_email: string | null }
  if (row.notification_id && row.parent_email) {
    await supabase.functions.invoke("send-operational-email", {
      body: { notification_id: row.notification_id },
    })
  }
  return row
}

export async function updateHostelResidentStatus(
  allocationId: string,
  status: string,
  notes?: string,
): Promise<{ event_id: string; notification_id: string | null; parent_email: string | null }> {
  const { data, error } = await supabase.rpc("update_hostel_resident_status", {
    p_allocation_id: allocationId,
    p_status: status,
    p_notes: notes ?? null,
  })
  if (error) throw error
  const row = (data ?? {}) as Record<string, unknown>
  return {
    event_id: String(row.event_id ?? ""),
    notification_id: row.notification_id ? String(row.notification_id) : null,
    parent_email: row.parent_email ? String(row.parent_email) : null,
  }
}

export type HostelResidentRow = {
  allocation_id: string
  student_id: string
  admission_no: string
  student_name: string
  class_name: string | null
  section_name: string | null
  room_no: string | null
  block: string | null
  resident_status: string
  updated_at: string
}

export async function getHostelResidents(schoolId: string): Promise<HostelResidentRow[]> {
  const { data, error } = await supabase.rpc("get_hostel_residents", {
    p_school_id: schoolId,
  })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    allocation_id: String(row.allocation_id),
    student_id: String(row.student_id),
    admission_no: String(row.admission_no ?? ""),
    student_name: String(row.student_name ?? ""),
    class_name: row.class_name ? String(row.class_name) : null,
    section_name: row.section_name ? String(row.section_name) : null,
    room_no: row.room_no ? String(row.room_no) : null,
    block: row.block ? String(row.block) : null,
    resident_status: String(row.resident_status ?? "in_hostel"),
    updated_at: String(row.updated_at ?? ""),
  }))
}
