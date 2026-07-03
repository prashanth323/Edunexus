import { supabase } from "@/lib/supabase"

// ── Types ───────────────────────────────────────────────
export type FeeStructure = {
  id: string
  school_id: string
  name: string
  amount: number
  frequency: string
  due_day: number | null
  late_fine_per_day: number | null
  description: string | null
  is_active: boolean
  created_at: string
  class_id: string | null
  term_order: number | null
  term_label: string | null
  class_fee_plan_id: string | null
  approval_status: string | null
  fee_category: string | null
  custom_label: string | null
  classes?: { name: string } | null
}

export type FeeStructureGroup = {
  classId: string
  className: string
  terms: {
    termOrder: number
    termLabel: string
    items: FeeStructure[]
  }[]
}

export function groupFeeStructuresByClassAndTerm(structures: FeeStructure[]): FeeStructureGroup[] {
  const approved = structures.filter(
    (s) =>
      s.approval_status === "approved" ||
      s.approval_status === "legacy" ||
      s.approval_status == null,
  )
  const byClass = new Map<string, FeeStructureGroup>()

  for (const fs of approved) {
    const classId = fs.class_id ?? "unassigned"
    const className =
      (Array.isArray(fs.classes) ? fs.classes[0]?.name : fs.classes?.name) ?? "General"
    if (!byClass.has(classId)) {
      byClass.set(classId, { classId, className, terms: [] })
    }
    const group = byClass.get(classId)!
    const termOrder = fs.term_order ?? 0
    const termLabel = fs.term_label ?? "Fees"
    let term = group.terms.find((t) => t.termOrder === termOrder)
    if (!term) {
      term = { termOrder, termLabel, items: [] }
      group.terms.push(term)
    }
    term.items.push(fs)
  }

  return Array.from(byClass.values())
    .map((g) => ({
      ...g,
      terms: g.terms.sort((a, b) => a.termOrder - b.termOrder),
    }))
    .sort((a, b) => a.className.localeCompare(b.className))
}

export type FeeStructureInput = {
  name: string
  amount: number
  frequency: string
  due_day: number | null
  late_fine_per_day: number | null
  description: string
}

// ── Fee Structures ──────────────────────────────────────
export async function getFeeStructures(schoolId: string) {
  const { data, error } = await supabase
    .from("fee_structures")
    .select(
      "id, school_id, name, amount, frequency, due_day, late_fine_per_day, description, is_active, created_at, class_id, term_order, term_label, class_fee_plan_id, approval_status, fee_category, custom_label, classes ( name )",
    )
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("class_id")
    .order("term_order")
    .order("name")
  if (error) throw error
  return (data ?? []).map((row) => {
    const classes = row.classes
    const cls = Array.isArray(classes) ? classes[0] : classes
    return { ...row, classes: cls } as FeeStructure
  })
}

export async function createFeeStructure(schoolId: string, input: FeeStructureInput) {
  const { data: ay } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle()

  const { data, error } = await supabase
    .from("fee_structures")
    .insert({
      school_id: schoolId,
      academic_year_id: ay?.id ?? null,
      name: input.name,
      amount: input.amount,
      frequency: input.frequency,
      due_day: input.due_day,
      late_fine_per_day: input.late_fine_per_day,
      description: input.description || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteFeeStructure(id: string) {
  const { error } = await supabase
    .from("fee_structures")
    .update({ is_active: false })
    .eq("id", id)
  if (error) throw error
}

// ── Invoices ────────────────────────────────────────────
export async function generateBulkInvoices(
  schoolId: string,
  feeStructureId: string,
  sectionId: string,
  dueDate: string,
  description: string,
) {
  // Get all active students in the section
  const { data: enrollments, error: enrollErr } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("section_id", sectionId)
    .eq("status", "active")
  if (enrollErr) throw enrollErr

  // Get fee structure details
  const { data: fee, error: feeErr } = await supabase
    .from("fee_structures")
    .select("amount, name, academic_year_id")
    .eq("id", feeStructureId)
    .single()
  if (feeErr) throw feeErr

  const { data: sectionEnrollment } = await supabase
    .from("enrollments")
    .select("academic_year_id")
    .eq("section_id", sectionId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()

  const academicYearId = fee.academic_year_id ?? sectionEnrollment?.academic_year_id

  if (!enrollments || enrollments.length === 0) {
    throw new Error("No active students in this section")
  }

  // Generate invoice number prefix
  const prefix = `INV-${new Date().getFullYear()}`
  const { count } = await supabase
    .from("student_invoices")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)

  const startNum = (count ?? 0) + 1

  const invoices = enrollments.map((e, i) => ({
    school_id: schoolId,
    student_id: e.student_id,
    fee_structure_id: feeStructureId,
    academic_year_id: academicYearId,
    invoice_no: `${prefix}-${String(startNum + i).padStart(5, "0")}`,
    amount: fee.amount,
    discount: 0,
    fine: 0,
    total_amount: fee.amount,
    paid_amount: 0,
    due_amount: fee.amount,
    due_date: dueDate,
    status: "pending",
    description: description || `${fee.name} fee`,
  }))

  const { error: insertErr } = await supabase
    .from("student_invoices")
    .insert(invoices)
  if (insertErr) throw insertErr

  return invoices.length
}

// ── Payments ────────────────────────────────────────────
export type RecordPaymentInput = {
  invoiceId: string
  studentId: string
  amount: number
  method: string
  transactionRef: string
  notes: string
}

export async function applyTermInvoiceFine(invoiceIds: string[], fineAmount: number): Promise<number> {
  const { data, error } = await supabase.rpc("apply_term_invoice_fine", {
    p_invoice_ids: invoiceIds,
    p_fine_amount: fineAmount,
  })
  if (error) throw error
  return Number(data ?? fineAmount)
}

export async function notifyFeeVpActivity(params: {
  studentId: string
  title: string
  body: string
  amount?: number
  metadata?: Record<string, unknown>
}): Promise<void> {
  const { error } = await supabase.rpc("notify_fee_vp_activity", {
    p_student_id: params.studentId,
    p_title: params.title,
    p_body: params.body,
    p_amount: params.amount ?? null,
    p_metadata: params.metadata ?? {},
  })
  if (error) throw error
}

export async function recordTermPayments(
  schoolId: string,
  studentId: string,
  lines: OverdueFeeLine[],
  method: string,
  transactionRef: string,
): Promise<number> {
  let total = 0
  for (const line of lines) {
    if (line.amount <= 0) continue
    await recordPayment(schoolId, {
      invoiceId: line.invoice_id,
      studentId,
      amount: line.amount,
      method,
      transactionRef,
      notes: "",
    })
    total += line.amount
  }
  return total
}

export async function recordPayment(schoolId: string, input: RecordPaymentInput) {
  const prefix = `RCP-${new Date().getFullYear()}`
  const { count } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)

  const receiptNo = `${prefix}-${String((count ?? 0) + 1).padStart(5, "0")}`

  const methodMap: Record<string, string> = {
    cash: "cash",
    upi: "upi",
    bank: "bank_transfer",
    bank_transfer: "bank_transfer",
    cheque: "cheque",
    card: "card",
  }
  const method = methodMap[input.method] ?? input.method

  const { data, error } = await supabase
    .from("payments")
    .insert({
      school_id: schoolId,
      student_id: input.studentId,
      invoice_id: input.invoiceId,
      receipt_no: receiptNo,
      amount: input.amount,
      method,
      transaction_ref: input.transactionRef || null,
      notes: input.notes || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export const FEE_STATUS_QUERY_KEYS = [
  "pending-dues",
  "overdue-dues",
  "open-fee-dues",
  "class-fee-plans-pending-invoices",
  "finance",
  "student-fee-status",
  "children-invoices",
] as const

// ── Discounts ───────────────────────────────────────────
export async function applyDiscount(invoiceId: string, discountAmount: number, _reason: string) {
  // Get current invoice
  const { data: invoice, error: fetchErr } = await supabase
    .from("student_invoices")
    .select("amount, discount, fine, paid_amount")
    .eq("id", invoiceId)
    .single()
  if (fetchErr) throw fetchErr

  const newDiscount = Number(invoice.discount) + discountAmount
  const totalAmount = Number(invoice.amount) - newDiscount + Number(invoice.fine)
  const dueAmount = totalAmount - Number(invoice.paid_amount)

  const { error: updateErr } = await supabase
    .from("student_invoices")
    .update({
      discount: newDiscount,
      total_amount: totalAmount,
      due_amount: Math.max(0, dueAmount),
      status: dueAmount <= 0 ? "paid" : "partial",
    })
    .eq("id", invoiceId)
  if (updateErr) throw updateErr
}

// ── Pending Dues Report ─────────────────────────────────
export type PendingDueRow = {
  student_id: string
  student_name: string
  admission_no: string
  class_name: string
  section_name: string
  total_due: number
  invoices_count: number
  oldest_due_date: string
}

export async function getPendingDuesReport(schoolId: string): Promise<PendingDueRow[]> {
  // Get all open invoices with student and enrollment info
  const { data, error } = await supabase
    .from("student_invoices")
    .select(`
      id, due_amount, due_date,
      students (id, first_name, last_name, admission_no,
        enrollments (
          sections (name, classes (name))
        )
      )
    `)
    .eq("school_id", schoolId)
    .gt("due_amount", 0)
    .is("deleted_at", null)
    .in("status", ["pending", "partial", "overdue"])
    .order("due_date")

  if (error) throw error

  // Aggregate by student
  const studentMap = new Map<string, PendingDueRow>()

  for (const inv of data ?? []) {
    const student: any = Array.isArray(inv.students) ? inv.students[0] : inv.students
    if (!student) continue

    const sid = student.id
    const existing = studentMap.get(sid)

    const enrollment = Array.isArray(student.enrollments) ? student.enrollments[0] : student.enrollments
    const section = enrollment?.sections
    const secObj = Array.isArray(section) ? section[0] : section
    const cls = secObj?.classes
    const clsObj = Array.isArray(cls) ? cls[0] : cls

    if (existing) {
      existing.total_due += Number(inv.due_amount)
      existing.invoices_count += 1
      if (inv.due_date < existing.oldest_due_date) {
        existing.oldest_due_date = inv.due_date
      }
    } else {
      studentMap.set(sid, {
        student_id: sid,
        student_name: `${student.first_name} ${student.last_name}`,
        admission_no: student.admission_no || "",
        class_name: clsObj?.name || "N/A",
        section_name: secObj?.name || "N/A",
        total_due: Number(inv.due_amount),
        invoices_count: 1,
        oldest_due_date: inv.due_date,
      })
    }
  }

  return Array.from(studentMap.values()).sort((a, b) => b.total_due - a.total_due)
}

// ── Overdue dues (due_date <= today) ────────────────────
export type OverdueFeeLine = {
  invoice_id: string
  invoice_no: string
  name: string
  amount: number
  due_date: string
  category: string
  term_label: string | null
  is_overdue?: boolean
}

export type OverdueDueRow = {
  student_id: string
  student_name: string
  admission_no: string
  class_name: string
  section_name: string
  parent_email: string | null
  total_due: number
  last_due_date: string
  is_overdue?: boolean
  lines: OverdueFeeLine[]
}

function mapFeeDueRow(row: Record<string, unknown>): OverdueDueRow {
  return {
    student_id: String(row.student_id),
    student_name: String(row.student_name ?? ""),
    admission_no: String(row.admission_no ?? ""),
    class_name: String(row.class_name ?? "N/A"),
    section_name: String(row.section_name ?? "N/A"),
    parent_email: row.parent_email ? String(row.parent_email) : null,
    total_due: Number(row.total_due ?? 0),
    last_due_date: String(row.last_due_date ?? ""),
    is_overdue: row.is_overdue === true,
    lines: (Array.isArray(row.lines) ? row.lines : []).map((line) => {
      const l = line as Record<string, unknown>
      return {
        invoice_id: String(l.invoice_id),
        invoice_no: String(l.invoice_no ?? ""),
        name: String(l.name ?? "Fee"),
        amount: Number(l.amount ?? 0),
        due_date: String(l.due_date ?? ""),
        category: String(l.category ?? "tuition"),
        term_label: l.term_label ? String(l.term_label) : null,
        is_overdue: l.is_overdue === true,
      }
    }),
  }
}

export async function getOverdueFeeDues(schoolId: string): Promise<OverdueDueRow[]> {
  const { data, error } = await supabase.rpc("get_overdue_fee_dues", { p_school_id: schoolId })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...mapFeeDueRow(row),
    is_overdue: true,
  }))
}

export async function getOpenFeeDues(schoolId: string): Promise<OverdueDueRow[]> {
  const { data, error } = await supabase.rpc("get_open_fee_dues", { p_school_id: schoolId })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => mapFeeDueRow(row))
}

export type ClassFeePlanPendingInvoices = {
  plan_id: string
  class_name: string
  structure_count: number
  invoice_count: number
}

export async function getClassFeePlansPendingInvoices(
  schoolId: string,
): Promise<ClassFeePlanPendingInvoices[]> {
  const { data, error } = await supabase.rpc("get_class_fee_plans_pending_invoices", {
    p_school_id: schoolId,
  })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    plan_id: String(row.plan_id),
    class_name: String(row.class_name ?? "Class"),
    structure_count: Number(row.structure_count ?? 0),
    invoice_count: Number(row.invoice_count ?? 0),
  }))
}

export async function generateInvoicesForClassFeePlan(planId: string): Promise<number> {
  const { data, error } = await supabase.rpc("generate_invoices_for_class_fee_plan", {
    p_plan_id: planId,
  })
  if (error) throw error
  return Number(data ?? 0)
}

export async function getOverdueFeeDuesCount(schoolId: string): Promise<number> {
  const rows = await getOverdueFeeDues(schoolId)
  return rows.length
}

// ── Student fee payment status ────────────────────────────
export type StudentFeeInvoice = {
  id: string
  invoice_no: string
  description: string | null
  amount: number
  paid_amount: number
  due_amount: number
  fine?: number
  status: string
  due_date: string
  fee_name: string | null
  fee_category: string | null
  term_label: string | null
  late_fine_per_day?: number
  days_overdue?: number
  accrued_late_fine?: number
  due_timing?: "paid" | "on_time" | "overdue"
}

export type StudentFeePaymentStatusData = {
  student_id: string
  admission_no: string
  full_name: string
  class_name: string
  section_name: string
  parent_email: string | null
  invoices: StudentFeeInvoice[]
  total_paid: number
  total_due: number
  overall_status: "clear" | "partial" | "overdue" | "on_time"
}

export async function getStudentFeePaymentStatus(
  studentId: string,
): Promise<StudentFeePaymentStatusData> {
  const { data, error } = await supabase.rpc("get_student_fee_payment_status", {
    p_student_id: studentId,
  })
  if (error) throw error
  const row = data as Record<string, unknown>
  const invoices = (Array.isArray(row.invoices) ? row.invoices : []).map((inv) => {
    const r = inv as Record<string, unknown>
    const dueAmount = Number(r.due_amount ?? 0)
    const dueDate = String(r.due_date ?? "")
    let dueTiming = r.due_timing as StudentFeeInvoice["due_timing"] | undefined
    if (!dueTiming && dueDate) {
      const today = new Date().toISOString().slice(0, 10)
      if (dueAmount <= 0) dueTiming = "paid"
      else if (dueDate < today) dueTiming = "overdue"
      else dueTiming = "on_time"
    }
    const daysOverdue =
      Number(r.days_overdue ?? 0) ||
      (dueTiming === "overdue" && dueDate
        ? Math.max(0, Math.floor((Date.now() - new Date(dueDate + "T12:00:00").getTime()) / 86400000))
        : 0)
    const lateRate = Number(r.late_fine_per_day ?? 0)
    const accrued =
      Number(r.accrued_late_fine ?? 0) || (daysOverdue > 0 ? daysOverdue * lateRate : 0)
    return {
      id: String(r.id),
      invoice_no: String(r.invoice_no ?? ""),
      description: r.description ? String(r.description) : null,
      amount: Number(r.amount ?? 0),
      paid_amount: Number(r.paid_amount ?? 0),
      due_amount: dueAmount,
      fine: Number(r.fine ?? 0),
      status: String(r.status ?? "pending"),
      due_date: dueDate,
      fee_name: r.fee_name ? String(r.fee_name) : null,
      fee_category: r.fee_category ? String(r.fee_category) : null,
      term_label: r.term_label ? String(r.term_label) : null,
      late_fine_per_day: lateRate,
      days_overdue: daysOverdue,
      accrued_late_fine: accrued,
      due_timing: dueTiming,
    }
  })

  const totalPaid = Number(row.total_paid ?? 0)
  const totalDue = Number(row.total_due ?? 0)
  let overallStatus = row.overall_status as StudentFeePaymentStatusData["overall_status"] | undefined
  if (!overallStatus || overallStatus === "overdue") {
    if (totalDue <= 0) overallStatus = "clear"
    else if (invoices.some((i) => i.due_timing === "overdue" && i.due_amount > 0)) overallStatus = "overdue"
    else if (totalPaid > 0) overallStatus = "partial"
    else overallStatus = "on_time"
  }

  return {
    student_id: String(row.student_id),
    admission_no: String(row.admission_no ?? ""),
    full_name: String(row.full_name ?? ""),
    class_name: String(row.class_name ?? "N/A"),
    section_name: String(row.section_name ?? "N/A"),
    parent_email: row.parent_email ? String(row.parent_email) : null,
    invoices,
    total_paid: totalPaid,
    total_due: totalDue,
    overall_status: overallStatus ?? "clear",
  }
}
