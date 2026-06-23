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
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("name")
  if (error) throw error
  return data as FeeStructure[]
}

export async function createFeeStructure(schoolId: string, input: FeeStructureInput) {
  const { data, error } = await supabase
    .from("fee_structures")
    .insert({
      school_id: schoolId,
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
    .select("amount, name")
    .eq("id", feeStructureId)
    .single()
  if (feeErr) throw feeErr

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

export async function recordPayment(schoolId: string, input: RecordPaymentInput) {
  const { data, error } = await supabase
    .from("payments")
    .insert({
      school_id: schoolId,
      student_id: input.studentId,
      invoice_id: input.invoiceId,
      amount: input.amount,
      method: input.method,
      transaction_ref: input.transactionRef || null,
      notes: input.notes || null,
      payment_date: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

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
