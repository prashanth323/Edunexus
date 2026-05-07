import { supabase } from "@/lib/supabase"
import { fetchMonthlyCollectionChartSeries } from "@/lib/monthly-collection-chart"

async function safeHeadCount(
  req: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  try {
    const { count, error } = await req
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

/** School-level finance KPIs (aligned with `v_principal_dashboard` + invoice counts). */
export type FinancePrincipalMetrics = {
  pendingFeesAmount: number
  collectionsThisMonth: number
  paymentsTotalCount: number
  openInvoicesCount: number
  totalInvoicesCount: number
  overdueInvoicesCount: number
  invoiceStatusPending: number
  invoiceStatusPartial: number
  invoiceStatusPaid: number
}

export const EMPTY_FINANCE_METRICS: FinancePrincipalMetrics = {
  pendingFeesAmount: 0,
  collectionsThisMonth: 0,
  paymentsTotalCount: 0,
  openInvoicesCount: 0,
  totalInvoicesCount: 0,
  overdueInvoicesCount: 0,
  invoiceStatusPending: 0,
  invoiceStatusPartial: 0,
  invoiceStatusPaid: 0,
}

export async function getFinanceOverviewMetrics(schoolId: string): Promise<FinancePrincipalMetrics> {
  const invBase = () =>
    supabase.from("student_invoices").select("*", { count: "exact", head: true }).eq("school_id", schoolId).is(
      "deleted_at",
      null,
    )

  const [
    dashboardRow,
    paymentsTotalCount,
    openInvoicesCount,
    totalInvoicesCount,
    overdueInvoicesCount,
    invoiceStatusPending,
    invoiceStatusPartial,
    invoiceStatusPaid,
  ] = await Promise.all([
    supabase
      .from("v_principal_dashboard")
      .select("total_pending_fees, collections_this_month")
      .eq("school_id", schoolId)
      .maybeSingle(),
    safeHeadCount(
      supabase.from("payments").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq(
        "is_refunded",
        false,
      ),
    ),
    safeHeadCount(invBase().gt("due_amount", 0)),
    safeHeadCount(invBase()),
    safeHeadCount(invBase().eq("status", "overdue").gt("due_amount", 0)),
    safeHeadCount(invBase().eq("status", "pending")),
    safeHeadCount(invBase().eq("status", "partial")),
    safeHeadCount(invBase().eq("status", "paid")),
  ])

  const row = dashboardRow.data
  if (dashboardRow.error && dashboardRow.error.code !== "PGRST116") {
    return {
      ...EMPTY_FINANCE_METRICS,
      paymentsTotalCount,
      openInvoicesCount,
      totalInvoicesCount,
      overdueInvoicesCount,
      invoiceStatusPending,
      invoiceStatusPartial,
      invoiceStatusPaid,
    }
  }

  return {
    pendingFeesAmount: Number(row?.total_pending_fees ?? 0),
    collectionsThisMonth: Number(row?.collections_this_month ?? 0),
    paymentsTotalCount,
    openInvoicesCount,
    totalInvoicesCount,
    overdueInvoicesCount,
    invoiceStatusPending,
    invoiceStatusPartial,
    invoiceStatusPaid,
  }
}

export type FeeTransaction = {
  id: string
  student_id: string
  amount: number
  payment_date: string
  payment_method: string
  reference_number?: string | null
  student?: {
    first_name: string
    last_name: string
    admission_no: string
  } | null
}

export type StudentSearchRow = {
  id: string
  admission_no: string
  first_name: string
  last_name: string
}

export type StudentInvoiceRow = {
  id: string
  invoice_no: string
  description: string | null
  amount: number
  paid_amount: number
  due_amount: number
  status: string
  due_date: string
  student_id: string
  students?: {
    first_name: string
    last_name: string
    admission_no: string
  } | null
}

export async function getRecentTransactions(schoolId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select(
      `
      id,
      student_id,
      amount,
      method,
      transaction_ref,
      paid_at,
      students ( first_name, last_name, admission_no )
    `,
    )
    .eq("school_id", schoolId)
    .eq("is_refunded", false)
    .order("paid_at", { ascending: false })
    .limit(10)

  if (error) throw error

  return (data as any[]).map((d) => ({
    id: d.id,
    student_id: d.student_id,
    amount: Number(d.amount),
    payment_date: d.paid_at,
    payment_method: d.method,
    reference_number: d.transaction_ref,
    student: Array.isArray(d.students) ? d.students[0] : d.students,
  })) as FeeTransaction[]
}

export async function getMonthlyCollectionsStats(schoolId: string) {
  return fetchMonthlyCollectionChartSeries(schoolId)
}

export async function searchStudentsForSchool(schoolId: string, term: string) {
  const raw = term.trim()
  if (!raw) return []

  const safe = raw.replace(/[%(),]/g, "").slice(0, 64)
  if (!safe) return []

  const pattern = `%${safe}%`
  const { data, error } = await supabase
    .from("students")
    .select("id, admission_no, first_name, last_name")
    .eq("school_id", schoolId)
    .or(`admission_no.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`)
    .limit(20)

  if (error) throw error
  return (data ?? []) as StudentSearchRow[]
}

export async function getOpenInvoicesForStudent(schoolId: string, studentId: string) {
  const { data, error } = await supabase
    .from("student_invoices")
    .select(
      "id, invoice_no, description, amount, paid_amount, due_amount, status, due_date, student_id",
    )
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .gt("due_amount", 0)
    .order("due_date", { ascending: true })

  if (error) throw error
  return data as StudentInvoiceRow[]
}

export async function listRecentInvoicesForSchool(schoolId: string, limit = 50) {
  const { data, error } = await supabase
    .from("student_invoices")
    .select(
      `
      id,
      invoice_no,
      description,
      amount,
      paid_amount,
      due_amount,
      status,
      due_date,
      student_id,
      students ( first_name, last_name, admission_no )
    `,
    )
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data as any[]).map((row) => ({
    ...row,
    students: Array.isArray(row.students) ? row.students[0] : row.students,
  })) as StudentInvoiceRow[]
}
