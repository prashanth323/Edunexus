import { useQuery } from "@tanstack/react-query"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getStudentFeePaymentStatus, type StudentFeeInvoice } from "../api/feeManagement.api"
import { feeCategoryLabel } from "../lib/feeCategories"
import {
  fineStatement,
  formatFeeDate,
  invoiceAccruedFine,
  invoiceTotalPayable,
} from "../lib/feeDueDisplay"

function statusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Paid</Badge>
    case "partial":
      return <Badge variant="secondary">Partial</Badge>
    case "overdue":
      return <Badge variant="destructive">Overdue</Badge>
    default:
      return <Badge variant="outline">Pending</Badge>
  }
}

function overallBadge(status: string) {
  switch (status) {
    case "clear":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Clear</Badge>
    case "on_time":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">On time</Badge>
    case "partial":
      return <Badge variant="secondary">Partial</Badge>
    default:
      return <Badge variant="destructive">Overdue</Badge>
  }
}

function DueDateMark({ inv, parentView }: { inv: StudentFeeInvoice; parentView: boolean }) {
  const timing = inv.due_timing ?? (inv.due_amount <= 0 ? "paid" : "on_time")

  if (!parentView || timing === "paid") {
    return <span className="text-sm whitespace-nowrap">{formatFeeDate(inv.due_date)}</span>
  }

  if (timing === "on_time") {
    return (
      <div className="flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Last date to pay: {formatFeeDate(inv.due_date)}
          </p>
          <p className="text-xs text-muted-foreground">Pay on or before this date to avoid late fine</p>
        </div>
      </div>
    )
  }

  const fineText = fineStatement(inv)
  return (
    <div className="flex items-start gap-2">
      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-destructive">
          Overdue — last date was {formatFeeDate(inv.due_date)}
        </p>
        {fineText && <p className="text-xs text-destructive/90 mt-0.5">{fineText}</p>}
      </div>
    </div>
  )
}

type Props = {
  studentId: string
  showStudentHeader?: boolean
  compact?: boolean
  parentView?: boolean
}

export function StudentFeePaymentStatus({
  studentId,
  showStudentHeader = true,
  compact = false,
  parentView = false,
}: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["student-fee-status", studentId],
    queryFn: () => getStudentFeePaymentStatus(studentId),
    enabled: !!studentId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading fee status…
      </div>
    )
  }

  if (error || !data) {
    return <p className="text-sm text-muted-foreground py-2">Could not load fee payment status.</p>
  }

  const openInvoices = data.invoices.filter((inv) => inv.due_amount > 0)
  const nextDueDate = openInvoices.length
    ? openInvoices.reduce((min, inv) => (inv.due_date < min ? inv.due_date : min), openInvoices[0].due_date)
    : null

  const content = (
    <>
      {showStudentHeader && (
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <p className="font-medium">{data.full_name}</p>
            <p className="text-sm text-muted-foreground">
              Adm. {data.admission_no || "—"} · {data.class_name} – {data.section_name}
            </p>
            {data.parent_email && !parentView && (
              <p className="text-xs text-muted-foreground mt-0.5">Parent: {data.parent_email}</p>
            )}
          </div>
          <div className="text-right">
            {overallBadge(data.overall_status)}
            <p className="text-sm mt-1">
              Paid ₹{data.total_paid.toLocaleString()} · Due ₹{data.total_due.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {parentView && data.overall_status === "on_time" && nextDueDate && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              Fees on time — last date to pay: {formatFeeDate(nextDueDate)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pay on or before the due date shown for each fee line below.
            </p>
          </div>
        </div>
      )}

      {parentView && data.overall_status === "overdue" && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">One or more fees are overdue</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Late fines may apply. See each line below for the fine statement.
            </p>
          </div>
        </div>
      )}

      {data.invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {parentView
            ? "No fee invoices yet. Fees appear here after the school assigns VP-approved structures to your class."
            : "No invoices yet."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              {!compact && <TableHead>Category</TableHead>}
              <TableHead>{parentView ? "Payment deadline" : "Due date"}</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              {parentView && <TableHead className="text-right">Fine</TableHead>}
              {!parentView && <TableHead>Status</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.invoices.map((inv) => {
              const accrued = invoiceAccruedFine(inv)
              const totalFine = Number(inv.fine ?? 0) + accrued
              return (
                <TableRow key={inv.id}>
                  <TableCell className="text-sm">
                    <div className="font-mono text-xs">{inv.invoice_no}</div>
                    <div className="text-muted-foreground">{inv.description || inv.fee_name}</div>
                  </TableCell>
                  {!compact && (
                    <TableCell className="text-sm">
                      {feeCategoryLabel(inv.fee_category, null)}
                      {inv.term_label ? ` · ${inv.term_label}` : ""}
                    </TableCell>
                  )}
                  <TableCell>
                    <DueDateMark inv={inv} parentView={parentView} />
                  </TableCell>
                  <TableCell className="text-right text-sm">₹{inv.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">₹{inv.paid_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    ₹{inv.due_amount.toLocaleString()}
                    {parentView && totalFine > 0 && inv.due_amount > 0 && (
                      <div className="text-xs text-destructive font-normal">
                        + ₹{totalFine.toLocaleString()} fine
                      </div>
                    )}
                    {parentView && inv.due_amount > 0 && (
                      <div className="text-xs text-muted-foreground font-normal">
                        Total: ₹{invoiceTotalPayable(inv).toLocaleString()}
                      </div>
                    )}
                  </TableCell>
                  {parentView && (
                    <TableCell className="text-right text-sm">
                      {totalFine > 0 ? (
                        <span className="text-destructive">₹{totalFine.toLocaleString()}</span>
                      ) : inv.due_timing === "overdue" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  )}
                  {!parentView && <TableCell>{statusBadge(inv.status)}</TableCell>}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </>
  )

  if (compact) return <div>{content}</div>

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Fee payment status</CardTitle>
        <CardDescription>
          {parentView
            ? "VP-approved fees with last date to pay. Green = on time; red = overdue with fine."
            : "Invoice history and current balance"}
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
