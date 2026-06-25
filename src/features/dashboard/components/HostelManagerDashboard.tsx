import { Link } from "react-router-dom"
import { Home } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getHostelResidents } from "@/features/finance/api/feePlans.api"

export function HostelManagerDashboard() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: residents = [] } = useQuery({
    queryKey: ["hostel-residents", activeSchoolId],
    queryFn: () => getHostelResidents(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const away = residents.filter((r) => r.resident_status === "away_home" || r.resident_status === "in_hostel_no_class").length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hostel manager</h1>
        <p className="text-muted-foreground mt-1">
          Manage resident assignments, room changes, and leave status with parent notifications.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active residents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{residents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">On leave</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{away}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Current residents</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/hostel">Manage residents</Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {residents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active hostel residents.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adm. no</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Room</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {residents.slice(0, 8).map((r) => (
                  <TableRow key={r.allocation_id}>
                    <TableCell className="font-mono text-sm">{r.admission_no}</TableCell>
                    <TableCell>{r.student_name}</TableCell>
                    <TableCell>
                      {r.class_name ?? "—"}
                      {r.section_name ? ` – ${r.section_name}` : ""}
                    </TableCell>
                    <TableCell>
                      {r.block ? `${r.block} / ` : ""}
                      {r.room_no ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Button asChild>
        <Link to="/hostel">
          <Home className="h-4 w-4 mr-1" /> Open hostel workspace
        </Link>
      </Button>
    </div>
  )
}
