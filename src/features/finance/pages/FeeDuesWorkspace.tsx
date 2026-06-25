import { Link } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Bell, Loader2, Receipt } from "lucide-react"
import { toast } from "sonner"

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
import { getPendingDuesReport } from "../api/feeManagement.api"

export function FeeDuesWorkspace() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: dues = [], isLoading } = useQuery({
    queryKey: ["pending-dues", activeSchoolId],
    queryFn: () => getPendingDuesReport(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const notifyMut = useMutation({
    mutationFn: (row: { student_id: string; student_name: string; total_due: number }) =>
      notifyStudentFeeDue({
        studentId: row.student_id,
        title: `Fee payment due — ${row.student_name}`,
        body: `Outstanding balance: ₹${row.total_due.toLocaleString()}. Please clear dues at the school office.`,
        amount: row.total_due,
      }),
    onSuccess: () => toast.success("Parent and VP notified"),
    onError: (e: Error) => toast.error(e.message),
  })

  const notifyAllMut = useMutation({
    mutationFn: async () => {
      for (const row of dues) {
        await notifyStudentFeeDue({
          studentId: row.student_id,
          title: `Fee payment due — ${row.student_name}`,
          body: `Outstanding balance: ₹${row.total_due.toLocaleString()}. Please clear dues at the school office.`,
          amount: row.total_due,
        })
      }
    },
    onSuccess: () => toast.success(`Notified ${dues.length} parent(s) and VP`),
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fee dues & notify</h1>
          <p className="text-muted-foreground mt-1">
            Students with outstanding invoices. Generate invoices from fee structures, then notify parents and VP manually.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/finance/fee-structures">
              <Receipt className="h-4 w-4 mr-1" /> Generate invoices
            </Link>
          </Button>
          {dues.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => notifyAllMut.mutate()}
              disabled={notifyAllMut.isPending || notifyMut.isPending}
            >
              {notifyAllMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <Bell className="h-4 w-4 mr-1" /> Notify all ({dues.length})
            </Button>
          )}
        </div>
      </div>

      <Card className="border-muted">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Workflow</CardTitle>
          <CardDescription>
            1. VP approves class fee plans → 2. Accountant assigns fee structures to sections on{" "}
            <Link to="/finance/fee-structures" className="text-primary underline">
              Fee structures
            </Link>{" "}
            → 3. Notify parents here when dues are outstanding.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Outstanding dues</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : dues.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No pending dues. Generate invoices from{" "}
              <Link to="/finance/fee-structures" className="text-primary underline">
                Fee structures
              </Link>{" "}
              first.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adm. no</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead />
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
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={notifyMut.isPending || notifyAllMut.isPending}
                        onClick={() => notifyMut.mutate(row)}
                      >
                        <Bell className="h-3.5 w-3.5 mr-1" /> Notify parent & VP
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
