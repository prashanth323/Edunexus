import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { AlertCircle, Download, Search } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getPendingDuesReport } from "../api/feeManagement.api"

export function PendingDuesReport() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const [search, setSearch] = useState("")

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pending-dues", activeSchoolId],
    queryFn: () => getPendingDuesReport(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const filtered = rows.filter((r) =>
    r.student_name.toLowerCase().includes(search.toLowerCase()) ||
    r.admission_no.toLowerCase().includes(search.toLowerCase()) ||
    r.class_name.toLowerCase().includes(search.toLowerCase()),
  )

  const totalDue = filtered.reduce((s, r) => s + r.total_due, 0)

  function exportCSV() {
    const header = "Student,Admission No,Class,Section,Total Due,Invoices,Oldest Due Date\n"
    const csvRows = filtered.map((r) =>
      `"${r.student_name}","${r.admission_no}","${r.class_name}","${r.section_name}",${r.total_due},${r.invoices_count},"${r.oldest_due_date}"`,
    )
    const blob = new Blob([header + csvRows.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pending_dues_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div><h1 className="text-3xl font-bold tracking-tight">Pending Dues</h1></div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pending Dues Report</h1>
          <p className="text-muted-foreground mt-1">
            Students with outstanding fee balances, sorted by amount due.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Summary card */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Students with Dues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{filtered.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">${totalDue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{filtered.reduce((s, r) => s + r.invoices_count, 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, admission no, or class…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          <AlertCircle className="h-14 w-14 opacity-30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            {search ? "No matching students" : "No pending dues 🎉"}
          </h3>
          <p className="text-sm mt-1">
            {search ? "Try a different search term." : "All student fees are paid up."}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-3 font-medium">#</th>
                    <th className="p-3 font-medium">Student</th>
                    <th className="p-3 font-medium">Adm. No</th>
                    <th className="p-3 font-medium">Class</th>
                    <th className="p-3 font-medium text-right">Total Due</th>
                    <th className="p-3 font-medium text-center">Invoices</th>
                    <th className="p-3 font-medium">Oldest Due</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const isOverdue = new Date(r.oldest_due_date) < new Date()
                    return (
                      <tr key={r.student_id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-3 text-muted-foreground">{i + 1}</td>
                        <td className="p-3 font-medium">{r.student_name}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{r.admission_no}</td>
                        <td className="p-3 whitespace-nowrap">{r.class_name} — {r.section_name}</td>
                        <td className="p-3 text-right font-bold text-destructive">${r.total_due.toLocaleString()}</td>
                        <td className="p-3 text-center">{r.invoices_count}</td>
                        <td className="p-3 whitespace-nowrap">{new Date(r.oldest_due_date).toLocaleDateString()}</td>
                        <td className="p-3">
                          <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-[10px]">
                            {isOverdue ? "Overdue" : "Pending"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                            <Link to={`/students/${r.student_id}`}>View</Link>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
