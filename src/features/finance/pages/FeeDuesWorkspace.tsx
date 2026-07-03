import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, ChevronDown, ChevronRight, CreditCard, Loader2, Receipt, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { useMemo, useState } from "react"

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
import { notifyStudentFeeDue, logFeeManualReminder } from "../api/feePlans.api"
import {
  FEE_STATUS_QUERY_KEYS,
  getOpenFeeDues,
  getOverdueFeeDues,
  type OverdueDueRow,
  type OverdueFeeLine,
} from "../api/feeManagement.api"
import { feeCategoryLabel } from "../lib/feeCategories"
import { TermPaymentDialog } from "../components/TermPaymentDialog"
import { AddFineNotifyDialog } from "../components/AddFineNotifyDialog"

type TermGroup = {
  termLabel: string
  lines: OverdueFeeLine[]
  subtotal: number
  lastDueDate: string
  isOverdue: boolean
}

type TermAction = {
  row: OverdueDueRow
  term: TermGroup
  mode: "pay" | "fine"
}

function groupLinesByTerm(lines: OverdueFeeLine[]): TermGroup[] {
  const map = new Map<string, OverdueFeeLine[]>()
  for (const line of lines) {
    const key = line.term_label?.trim() || "Fees"
    const bucket = map.get(key) ?? []
    bucket.push(line)
    map.set(key, bucket)
  }
  return Array.from(map.entries()).map(([termLabel, termLines]) => {
    const sorted = [...termLines].sort((a, b) => a.due_date.localeCompare(b.due_date))
    const subtotal = sorted.reduce((s, l) => s + Number(l.amount), 0)
    const lastDueDate = sorted[sorted.length - 1]?.due_date ?? ""
    return {
      termLabel,
      lines: sorted,
      subtotal,
      lastDueDate,
      isOverdue: sorted.some((l) => l.is_overdue),
    }
  })
}

function groupByClass(rows: OverdueDueRow[]): { className: string; students: OverdueDueRow[] }[] {
  const map = new Map<string, OverdueDueRow[]>()
  for (const row of rows) {
    const bucket = map.get(row.class_name) ?? []
    bucket.push(row)
    map.set(row.class_name, bucket)
  }
  return Array.from(map.entries())
    .map(([className, students]) => ({
      className,
      students: students.sort((a, b) => a.student_name.localeCompare(b.student_name)),
    }))
    .sort((a, b) => a.className.localeCompare(b.className))
}

function buildTermReminderBody(row: OverdueDueRow, term: TermGroup): string {
  const lines = term.lines
    .map(
      (l) =>
        `- ${l.name} (${feeCategoryLabel(l.category)}): ₹${Number(l.amount).toLocaleString()} — due ${new Date(l.due_date + "T12:00:00").toLocaleDateString()}`,
    )
    .join("\n")
  const deadlineLabel = term.isOverdue ? "Last date to pay (passed)" : "Last date to pay"
  return `Fee reminder — ${term.termLabel}

Student: ${row.student_name}
Admission no: ${row.admission_no}
Class: ${row.class_name} – ${row.section_name}

Fee items (${term.termLabel} only):
${lines}

${term.termLabel} subtotal: ₹${term.subtotal.toLocaleString()}
${deadlineLabel}: ${term.lastDueDate ? new Date(term.lastDueDate + "T12:00:00").toLocaleDateString() : "—"}
${term.isOverdue ? "\nThis fee is overdue. Late fine may apply." : "\nPlease pay on or before the last date to avoid late fine."}

Please clear dues at the school office.`
}

export function FeeDuesWorkspace() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const qc = useQueryClient()
  const isAccountant = activeRole === "accountant"
  const [expandedClass, setExpandedClass] = useState<string | null>(null)
  const [termAction, setTermAction] = useState<TermAction | null>(null)
  const [notifyingKey, setNotifyingKey] = useState<string | null>(null)

  const { data: dues = [], isLoading } = useQuery({
    queryKey: ["open-fee-dues", activeSchoolId],
    queryFn: () =>
      isAccountant ? getOpenFeeDues(activeSchoolId!) : getOverdueFeeDues(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const classGroups = useMemo(() => groupByClass(dues), [dues])

  const invalidateFees = () => {
    for (const key of FEE_STATUS_QUERY_KEYS) {
      qc.invalidateQueries({ queryKey: [key] })
    }
    qc.invalidateQueries({ queryKey: ["recent-fee-notifications"] })
  }

  const notifyMut = useMutation({
    mutationFn: async ({ row, term }: { row: OverdueDueRow; term: TermGroup }) => {
      const key = `${row.student_id}-${term.termLabel}`
      setNotifyingKey(key)
      const body = buildTermReminderBody(row, term)
      const result = await notifyStudentFeeDue({
        studentId: row.student_id,
        title: `Fee reminder — ${term.termLabel} — ${row.student_name}`,
        body,
        amount: term.subtotal,
        metadata: {
          activity: "reminder",
          fee_lines: term.lines,
          term_label: term.termLabel,
          term_subtotal: term.subtotal,
          last_date_to_pay: term.lastDueDate,
          parent_email: row.parent_email,
          class_name: row.class_name,
          section_name: row.section_name,
          admission_no: row.admission_no,
          student_name: row.student_name,
        },
      })
      await logFeeManualReminder(term.lines.map((l) => l.invoice_id))
      return result
    },
    onSuccess: () => {
      toast.success("Parent and VP notified")
      invalidateFees()
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setNotifyingKey(null),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fee dues & notify</h1>
          <p className="text-muted-foreground mt-1">
            {isAccountant
              ? "Browse by class — notify parents, record payments, or apply fines per term."
              : "Overdue invoices (due on or before today)."}
          </p>
        </div>
        {isAccountant && (
          <Button variant="outline" asChild>
            <Link to="/finance/fee-structures">
              <CreditCard className="h-4 w-4 mr-1" /> Fee structures
            </Link>
          </Button>
        )}
      </div>

      {isAccountant ? (
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : classGroups.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No published fees yet. After VP approves a class fee plan, students appear here
                automatically.
              </CardContent>
            </Card>
          ) : (
            classGroups.map((group) => {
              const open = expandedClass === group.className
              const classTotal = group.students.reduce((s, r) => s + r.total_due, 0)
              return (
                <Card key={group.className}>
                  <CardHeader
                    className="cursor-pointer select-none pb-3"
                    onClick={() => setExpandedClass(open ? null : group.className)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {open ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <CardTitle className="text-lg">{group.className}</CardTitle>
                          <CardDescription>
                            {group.students.length} student{group.students.length !== 1 ? "s" : ""} ·
                            ₹{classTotal.toLocaleString()} total due
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary">{group.students.length}</Badge>
                    </div>
                  </CardHeader>
                  {open && (
                    <CardContent className="space-y-6 pt-0">
                      {group.students.map((row) => {
                        const termGroups = groupLinesByTerm(row.lines)
                        return (
                          <div
                            key={row.student_id}
                            className="rounded-lg border bg-muted/20 p-4 space-y-4"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <div>
                                <p className="font-medium">{row.student_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Adm. {row.admission_no} · {row.section_name}
                                  {row.parent_email ? ` · ${row.parent_email}` : ""}
                                </p>
                              </div>
                              <Badge variant={row.is_overdue ? "destructive" : "secondary"}>
                                ₹{row.total_due.toLocaleString()} due
                              </Badge>
                            </div>

                            {termGroups.map((term) => {
                              const actionKey = `${row.student_id}-${term.termLabel}`
                              const isNotifying = notifyingKey === actionKey
                              return (
                                <div
                                  key={term.termLabel}
                                  className="rounded-md border bg-background p-3 space-y-2"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-medium">{term.termLabel}</p>
                                      <p className="text-xs text-muted-foreground">
                                        ₹{term.subtotal.toLocaleString()}
                                        {term.lastDueDate
                                          ? ` · due ${new Date(term.lastDueDate + "T12:00:00").toLocaleDateString()}`
                                          : ""}
                                        {term.isOverdue && (
                                          <span className="text-destructive ml-1">· overdue</span>
                                        )}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={isNotifying || notifyMut.isPending}
                                        onClick={() => notifyMut.mutate({ row, term })}
                                      >
                                        {isNotifying ? (
                                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                        ) : (
                                          <Bell className="h-3.5 w-3.5 mr-1" />
                                        )}
                                        Notify parent
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => setTermAction({ row, term, mode: "pay" })}
                                      >
                                        <Receipt className="h-3.5 w-3.5 mr-1" />
                                        Received payment
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10"
                                        onClick={() => setTermAction({ row, term, mode: "fine" })}
                                      >
                                        <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                                        Add fine & notify
                                      </Button>
                                    </div>
                                  </div>
                                  <ul className="text-xs text-muted-foreground space-y-0.5 pl-1">
                                    {term.lines.map((line) => (
                                      <li key={line.invoice_id}>
                                        {line.name} ({feeCategoryLabel(line.category)}) — ₹
                                        {Number(line.amount).toLocaleString()}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </CardContent>
                  )}
                </Card>
              )
            })
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overdue dues</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : dues.length === 0 ? (
              <p className="text-muted-foreground text-sm">No overdue fees.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Adm. no</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dues.map((row) => (
                    <TableRow key={row.student_id}>
                      <TableCell className="font-mono text-sm">{row.admission_no}</TableCell>
                      <TableCell>{row.student_name}</TableCell>
                      <TableCell>
                        {row.class_name} – {row.section_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">₹{row.total_due.toLocaleString()}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {termAction?.mode === "pay" && activeSchoolId && (
        <TermPaymentDialog
          open
          onOpenChange={(o) => !o && setTermAction(null)}
          schoolId={activeSchoolId}
          row={termAction.row}
          term={termAction.term}
          onSuccess={() => {
            setTermAction(null)
            invalidateFees()
          }}
        />
      )}

      {termAction?.mode === "fine" && (
        <AddFineNotifyDialog
          open
          onOpenChange={(o) => !o && setTermAction(null)}
          row={termAction.row}
          term={termAction.term}
          onSuccess={() => {
            setTermAction(null)
            invalidateFees()
          }}
        />
      )}
    </div>
  )
}
