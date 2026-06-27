import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

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
import { getStudentFeePaymentStatus } from "../api/feeManagement.api"
import { feeCategoryLabel } from "../lib/feeCategories"

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
    case "partial":
      return <Badge variant="secondary">Partial</Badge>
    default:
      return <Badge variant="destructive">Overdue</Badge>
  }
}

type Props = {
  studentId: string
  showStudentHeader?: boolean
  compact?: boolean
}

export function StudentFeePaymentStatus({ studentId, showStudentHeader = true, compact = false }: Props) {
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

  const content = (
    <>
      {showStudentHeader && (
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <p className="font-medium">{data.full_name}</p>
            <p className="text-sm text-muted-foreground">
              Adm. {data.admission_no || "—"} · {data.class_name} – {data.section_name}
            </p>
            {data.parent_email && (
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

      {data.invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              {!compact && <TableHead>Category</TableHead>}
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.invoices.map((inv) => (
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
                <TableCell className="text-sm whitespace-nowrap">
                  {inv.due_date ? new Date(inv.due_date + "T12:00:00").toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-right text-sm">₹{inv.amount.toLocaleString()}</TableCell>
                <TableCell className="text-right text-sm">₹{inv.paid_amount.toLocaleString()}</TableCell>
                <TableCell className="text-right text-sm font-medium">
                  ₹{inv.due_amount.toLocaleString()}
                </TableCell>
                <TableCell>{statusBadge(inv.status)}</TableCell>
              </TableRow>
            ))}
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
        <CardDescription>Invoice history and current balance</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
