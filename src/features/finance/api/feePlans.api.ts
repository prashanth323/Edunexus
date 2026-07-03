import { supabase } from "@/lib/supabase"
import { feeItemDisplayName, type FeeCategory } from "../lib/feeCategories"

export type FeePlanStatus = "draft" | "pending_vp" | "approved" | "rejected" | "superseded"

export type FeePlanItemInput = {
  fee_category: FeeCategory
  custom_label?: string | null
  amount: number
  due_date?: string | null
}

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
  fee_category: FeeCategory
  custom_label: string | null
  due_date: string | null
}

export type YearlyFeePlanLine = {
  item_id: string
  fee_category: string
  custom_label: string | null
  name: string
  amount: number
  due_date: string | null
  invoice_id?: string | null
  paid_amount?: number
  due_amount?: number
  payment_status?: "not_invoiced" | "paid" | "on_time" | "overdue"
}

export type YearlyFeePlanTerm = {
  term_order: number
  term_label: string
  term_due_date: string | null
  items: YearlyFeePlanLine[]
}

export type YearlyFeePlan = {
  plan_id: string
  school_id: string
  class_id: string
  class_name: string
  academic_year_id: string
  academic_year_name: string
  status: FeePlanStatus
  terms: YearlyFeePlanTerm[]
  grand_total: number
  total_by_category: Record<string, number>
  student_id?: string
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
      .select("id, term_id, name, amount, fee_category, custom_label, due_date")
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

export type FeePlanTermInput = {
  id?: string
  term_order: number
  term_label: string
  due_date: string | null
  items: FeePlanItemInput[]
}

export async function saveClassFeePlanTerms(planId: string, terms: FeePlanTermInput[]): Promise<void> {
  const normalized = terms.map((t, index) => ({
    ...t,
    term_order: index + 1,
  }))

  const { data: existingTerms, error: fetchErr } = await supabase
    .from("class_fee_plan_terms")
    .select("id, term_order")
    .eq("plan_id", planId)
    .order("term_order")
  if (fetchErr) throw fetchErr

  const existing = existingTerms ?? []

  // Bump existing rows so term_order updates cannot collide on UNIQUE(plan_id, term_order).
  for (let i = 0; i < existing.length; i++) {
    const { error } = await supabase
      .from("class_fee_plan_terms")
      .update({ term_order: 10_000 + i })
      .eq("id", existing[i].id)
    if (error) throw error
  }

  const matchedIds = new Set<string>()

  for (const term of normalized) {
    let termId = term.id
    if (!termId) {
      const unmatched = existing.filter((row) => !matchedIds.has(row.id))
      if (unmatched.length > 0) {
        termId = unmatched[0].id
      }
    }
    if (termId) matchedIds.add(termId)

    await upsertFeePlanTerm(
      planId,
      {
        id: termId,
        term_order: term.term_order,
        term_label: term.term_label,
        due_date: term.due_date,
      },
      term.items,
    )
  }

  for (const row of existing) {
    if (!matchedIds.has(row.id)) {
      const { error } = await supabase.from("class_fee_plan_terms").delete().eq("id", row.id)
      if (error) throw error
    }
  }
}

export async function upsertFeePlanTerm(
  planId: string,
  term: { id?: string; term_order: number; term_label: string; due_date: string | null },
  items: FeePlanItemInput[],
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

  const validItems = items.filter((i) => i.amount >= 0)
  if (validItems.length) {
    const { error } = await supabase.from("class_fee_plan_items").insert(
      validItems.map((i) => ({
        term_id: termId!,
        name: feeItemDisplayName(i),
        amount: i.amount,
        fee_category: i.fee_category,
        custom_label: i.fee_category === "other" ? i.custom_label?.trim() || null : null,
        due_date: i.due_date || term.due_date || null,
      })),
    )
    if (error) throw error
  }
}

export async function deleteClassFeePlan(planId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_class_fee_plan", { p_plan_id: planId })
  if (error) throw error
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
  metadata?: Record<string, unknown>
}): Promise<{ notification_id: string; parent_email: string | null }> {
  const { data, error } = await supabase.rpc("notify_student_fee_due", {
    p_student_id: params.studentId,
    p_title: params.title,
    p_body: params.body,
    p_amount: params.amount ?? null,
    p_metadata: params.metadata ?? {},
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
  if (approve) {
    await dispatchTermPublishEmails(planId)
  }
}

export type SchoolApprovedFeePlan = {
  plan_id: string
  class_id: string
  class_name: string
  academic_year_id: string
  academic_year_name: string
  term_count: number
  grand_total: number
}

export async function getSchoolApprovedFeePlans(schoolId: string): Promise<SchoolApprovedFeePlan[]> {
  const { data, error } = await supabase.rpc("get_school_approved_fee_plans", {
    p_school_id: schoolId,
  })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    plan_id: String(row.plan_id),
    class_id: String(row.class_id),
    class_name: String(row.class_name ?? "Class"),
    academic_year_id: String(row.academic_year_id),
    academic_year_name: String(row.academic_year_name ?? ""),
    term_count: Number(row.term_count ?? 0),
    grand_total: Number(row.grand_total ?? 0),
  }))
}

export async function getClassYearlyFeePlan(planId: string): Promise<YearlyFeePlan> {
  const { data, error } = await supabase.rpc("get_class_yearly_fee_plan", { p_plan_id: planId })
  if (error) throw error
  return data as YearlyFeePlan
}

export async function getStudentClassYearlyFeePlan(studentId: string): Promise<YearlyFeePlan | null> {
  const { data, error } = await supabase.rpc("get_student_class_yearly_fee_plan", {
    p_student_id: studentId,
  })
  if (error) throw error
  return (data as YearlyFeePlan | null) ?? null
}

export async function logFeeManualReminder(invoiceIds: string[]): Promise<void> {
  if (!invoiceIds.length) return
  const { error } = await supabase.rpc("log_fee_manual_reminder", { p_invoice_ids: invoiceIds })
  if (error) throw error
}

async function dispatchTermPublishEmails(planId: string): Promise<void> {
  const { data, error } = await supabase
    .from("school_notifications")
    .select("id, parent_email")
    .eq("type", "fee_term_published")
    .filter("metadata->>plan_id", "eq", planId)
    .is("email_sent_at", null)
  if (error) throw error
  for (const row of data ?? []) {
    if (row.parent_email) {
      await supabase.functions.invoke("send-operational-email", {
        body: { notification_id: row.id },
      })
    }
  }
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
