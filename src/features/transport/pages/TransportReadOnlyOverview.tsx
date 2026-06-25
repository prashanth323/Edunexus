import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getTransportPrincipalOverview,
  EMPTY_TRANSPORT_OVERVIEW,
  getAssignedTransportStudents,
} from "../api/transport.api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** Read-only transport summary for principal and other non-operational roles. */
export function TransportReadOnlyOverview() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: overview = EMPTY_TRANSPORT_OVERVIEW } = useQuery({
    queryKey: ["transport-principal-overview", activeSchoolId],
    queryFn: () => getTransportPrincipalOverview(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: assigned = [] } = useQuery({
    queryKey: ["transport-assigned", activeSchoolId],
    queryFn: () => getAssignedTransportStudents(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  if (!activeSchoolId) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transport</h1>
        <p className="text-muted-foreground mt-1">Read-only fleet and assignment summary.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Buses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.busesActive}</div>
            <p className="text-xs text-muted-foreground">active of {overview.busesTotal}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Routes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.routesActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Students on routes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.routeStudentsCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assigned students</CardTitle>
        </CardHeader>
        <CardContent>
          {assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assignments.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adm. no</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Route</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assigned.map((row) => (
                  <TableRow key={row.route_student_id}>
                    <TableCell className="font-mono text-sm">{row.admission_no}</TableCell>
                    <TableCell>{row.student_name}</TableCell>
                    <TableCell>
                      {row.class_name ?? "—"}
                      {row.section_name ? ` – ${row.section_name}` : ""}
                    </TableCell>
                    <TableCell>
                      {row.route_code ? `${row.route_code} — ` : ""}
                      {row.route_name}
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
