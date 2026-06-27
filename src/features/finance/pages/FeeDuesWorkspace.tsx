import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, ChevronDown, ChevronRight, CreditCard, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useState, Fragment } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { notifyStudentFeeDue } from "../api/feePlans.api"
import {
  FEE_STATUS_QUERY_KEYS,
  getOverdueFeeDues,
  type OverdueDueRow,
} from "../api/feeManagement.api"
import { feeCategoryLabel } from "../lib/feeCategories"
import { MarkPaymentDialog } from "../components/MarkPaymentDialog"

function buildReminderBody(row: OverdueDueRow): string {
  const lines = row.lines
    .map(
      (l) =>
        `- ${l.name} (${feeCategoryLabel(l.category)}${l.term_label ? ` · ${l.term_label}` : ""}): ₹${Number(l.amount).toLocaleString()} — due ${new Date(l.due_date + "T12:00:00").toLocaleDateString()}`,
    )
    .join("\n")
  return `Fee reminder for ${row.student_name} (Adm. ${row.admission_no})

Overdue items:
${lines}

Total overdue: ₹${row.total_due.toLocaleString()}
Last date to pay: ${row.last_due_date ? new Date(row.last_due_date + "T12:00:00").toLocaleDateString() : "—"}

Please clear dues at the school office.`
}

export function FeeDuesWorkspace() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const qc = useQueryClient()
  const isAccountant = activeRole === "accountant"
  const [expanded, setExpanded] = useState<string | null>(null)
  const [payRow, setPayRow] = useState<OverdueDueRow | null>(null)

  const { data: dues = [], isLoading } = useQuery({
    queryKey: ["overdue-dues", activeSchoolId],
    queryFn: () => getOverdueFeeDues(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const invalidateFees = () => {
    for (const key of FEE_STATUS_QUERY_KEYS) {
      qc.invalidateQueries({ queryKey: [key] })
    }
  }

  const notifyMut = useMutation({
    mutationFn: (row: OverdueDueRow) => {
      const body = buildReminderBody(row)
      return notifyStudentFeeDue({
        studentId: row.student_id,
        title: `Fee payment due — ${row.student_name}`,
        body,
        amount: row.total_due,
        metadata: {
          fee_lines: row.lines,
          last_date_to_pay: row.last_due_date,
          parent_email: row.parent_email,
        },
      })
    },
    onSuccess: () => {
      toast.success("Parent and VP reminded")
      invalidateFees()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const notifyAllMut = useMutation({
    mutationFn: async () => {
      for (const row of dues) {
        const body = buildReminderBody(row)
        await notifyStudentFeeDue({
          studentId: row.student_id,
          title: `Fee payment due — ${row.student_name}`,
          body,
          amount: row.total_due,
          metadata: {
            fee_lines: row.lines,
            last_date_to_pay: row.last_due_date,
            parent_email: row.parent_email,
          },
        })
      }
    },
    onSuccess: () => {
      toast.success(`Reminded ${dues.length} parent(s) and VP`)
      invalidateFees()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fee dues & notify</h1>
          <p className="text-muted-foreground mt-1">
            Overdue invoices (due on or before today). Remind parents or record office payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/finance/fee-structures">
              <CreditCard className="h-4 w-4 mr-1" /> Generate invoices
            </Link>
          </Button>
          {isAccountant && dues.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => notifyAllMut.mutate()}
              disabled={notifyAllMut.isPending || notifyMut.isPending}
            >
              {notifyAllMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <Bell className="h-4 w-4 mr-1" /> Remind all ({dues.length})
            </Button>
          )}
        </div>
      </div>

      <Card className="border-muted">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Workflow</CardTitle>
          <CardDescription>
            1. VP approves class fee plans → 2. Assign structures on{" "}
            <Link to="/finance/fee-structures" className="text-primary underline">
              Fee structures
            </Link>{" "}
            → 3. Remind or mark paid here when due date has passed.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overdue dues</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : dues.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No overdue fees. Generate invoices from{" "}
              <Link to="/finance/fee-structures" className="text-primary underline">
                Fee structures
              </Link>{" "}
              first.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Adm. no</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Parent email</TableHead>
                  <TableHead>Last date to pay</TableHead>
                  <TableHead>Due</TableHead>
                  {isAccountant && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dues.map((row) => {
                  const open = expanded === row.student_id
                  return (
                    <Fragment key={row.student_id}>
                      <TableRow key={row.student_id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setExpanded(open ? null : row.student_id)}
                          >
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.admission_no}</TableCell>
                        <TableCell>{row.student_name}</TableCell>
                        <TableCell>
                          {row.class_name} – {row.section_name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                          {row.parent_email || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.last_due_date
                            ? new Date(row.last_due_date + "T12:00:00").toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">₹{row.total_due.toLocaleString()}</Badge>
                        </TableCell>
                        {isAccountant && (
                          <TableCell className="space-x-1 whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={notifyMut.isPending || notifyAllMut.isPending}
                              onClick={() => notifyMut.mutate(row)}
                            >
                              <Bell className="h-3.5 w-3.5 mr-1" /> Remind
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setPayRow(row)}>
                              Mark paid
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                      {open && (
                        <TableRow key={`${row.student_id}-detail`}>
                          <TableCell colSpan={isAccountant ? 8 : 7} className="bg-muted/30">
                            <ul className="text-sm space-y-1 py-2 pl-8">
                              {row.lines.map((line) => (
                                <li key={line.invoice_id}>
                                  {line.name} — ₹{Number(line.amount).toLocaleString()} (due{" "}
                                  {new Date(line.due_date + "T12:00:00").toLocaleDateString()})
                                </li>
                              ))}
                            </ul>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {payRow && activeSchoolId && (
        <MarkPaymentDialog
          open={!!payRow}
          onOpenChange={(o) => !o && setPayRow(null)}
          schoolId={activeSchoolId}
          row={payRow}
          onSuccess={() => {
            setPayRow(null)
            invalidateFees()
          }}
        />
      )}
    </div>
  )
}
