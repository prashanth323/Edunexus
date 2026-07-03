import type { StudentFeeInvoice } from "../api/feeManagement.api"

export type FeeDueTiming = "paid" | "on_time" | "overdue"

export function formatFeeDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso + "T12:00:00").toLocaleDateString()
}

export function invoiceAccruedFine(inv: StudentFeeInvoice): number {
  if (inv.accrued_late_fine != null) return inv.accrued_late_fine
  if (inv.due_timing !== "overdue" || inv.due_amount <= 0) return 0
  const days = inv.days_overdue ?? 0
  const rate = inv.late_fine_per_day ?? 0
  return days * rate
}

export function invoiceTotalPayable(inv: StudentFeeInvoice): number {
  return inv.due_amount + Number(inv.fine ?? 0) + invoiceAccruedFine(inv)
}

export function fineStatement(inv: StudentFeeInvoice): string | null {
  if (inv.due_timing !== "overdue" || inv.due_amount <= 0) return null
  const accrued = invoiceAccruedFine(inv)
  const stored = Number(inv.fine ?? 0)
  const totalFine = accrued + stored
  const days = inv.days_overdue ?? 0
  if (totalFine > 0 && (inv.late_fine_per_day ?? 0) > 0) {
    return `Late fine: ₹${totalFine.toLocaleString()} (${days} day${days === 1 ? "" : "s"} × ₹${Number(inv.late_fine_per_day).toLocaleString()}/day)`
  }
  if (totalFine > 0) {
    return `Late fine: ₹${totalFine.toLocaleString()}`
  }
  return `Payment overdue by ${days} day${days === 1 ? "" : "s"}. Please pay at the school office.`
}
