import { useState, Fragment } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getOverdueFeeDues } from "../api/feeManagement.api"
import { feeCategoryLabel } from "../lib/feeCategories"

type Props = {
  readOnly?: boolean
  embedded?: boolean
}

export function FeeOverdueDues({ readOnly = true, embedded = false }: Props) {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: dues = [], isLoading } = useQuery({
    queryKey: ["overdue-dues", activeSchoolId],
    queryFn: () => getOverdueFeeDues(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const isVp = activeRole === "vice_principal" || activeRole === "principal"

  return (
    <div className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-6"}>
      {!embedded && (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overdue fee dues</h1>
          <p className="text-muted-foreground mt-1">
            Students with invoice due dates on or before today.{" "}
            {readOnly || isVp
              ? "View only — accountants send reminders and record payments."
              : "Remind parents or record payments from Fee dues & notify."}
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overdue students ({dues.length})</CardTitle>
          <CardDescription>Due date ≤ today and balance outstanding</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : dues.length === 0 ? (
            <p className="text-muted-foreground text-sm">No overdue fees.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Adm. no</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Last date to pay</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead />
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
                        <TableCell className="whitespace-nowrap">
                          {row.last_due_date
                            ? new Date(row.last_due_date + "T12:00:00").toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive">₹{row.total_due.toLocaleString()}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="link" size="sm" className="h-auto p-0" asChild>
                            <Link to={`/students/${row.student_id}`}>View profile</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                      {open && (
                        <TableRow key={`${row.student_id}-lines`}>
                          <TableCell colSpan={7} className="bg-muted/30">
                            <ul className="text-sm space-y-1 py-2 pl-8">
                              {row.lines.map((line) => (
                                <li key={line.invoice_id} className="flex flex-wrap gap-x-3 gap-y-0.5">
                                  <span className="font-medium">{line.name}</span>
                                  <span className="text-muted-foreground">
                                    {feeCategoryLabel(line.category)}
                                    {line.term_label ? ` · ${line.term_label}` : ""}
                                  </span>
                                  <span>₹{Number(line.amount).toLocaleString()}</span>
                                  <span className="text-muted-foreground">
                                    due {new Date(line.due_date + "T12:00:00").toLocaleDateString()}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {row.parent_email && (
                              <p className="text-xs text-muted-foreground pl-8 pb-2">
                                Parent email: {row.parent_email}
                              </p>
                            )}
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
    </div>
  )
}
