import { useQuery } from "@tanstack/react-query"
import { Bus, Route, Users, MapPin } from "lucide-react"
import { Link } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GenericCardSkeleton } from "@/components/ui/card-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getTransportDashboard } from "../api/dashboard.api"
import { getAssignedTransportStudents } from "@/features/transport/api/transport.api"

export function TransportManagerDashboard() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data, isLoading } = useQuery({
    queryKey: ["transport-dashboard", activeSchoolId],
    queryFn: () => getTransportDashboard(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: assigned = [] } = useQuery({
    queryKey: ["transport-assigned", activeSchoolId],
    queryFn: () => getAssignedTransportStudents(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transport manager</h1>
          <p className="text-muted-foreground mt-1">Manage buses, routes, and assignments for your school.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <GenericCardSkeleton rows={2} />
          <GenericCardSkeleton rows={2} />
          <GenericCardSkeleton rows={2} />
        </div>
      </div>
    )
  }

  const stats = data || {
    total_buses: 0,
    active_buses: 0,
    total_routes: 0,
    active_routes: 0,
    total_route_students: 0,
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transport manager</h1>
          <p className="text-muted-foreground mt-1">
            Manage buses, routes, and assignments for your school.
          </p>
        </div>
        <Button asChild className="shrink-0 gap-2">
          <Link to="/transport">
            <MapPin className="h-4 w-4" /> Open transport
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Buses</CardTitle>
            <Bus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_buses}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.active_buses} active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Routes</CardTitle>
            <Route className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_routes}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.active_routes} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students Assigned</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_route_students}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active route allocations
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Students on school bus</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/transport">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students assigned to routes yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adm. no</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Route</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assigned.slice(0, 8).map((row) => (
                  <TableRow key={row.route_student_id}>
                    <TableCell className="font-mono text-sm">{row.admission_no}</TableCell>
                    <TableCell>{row.student_name}</TableCell>
                    <TableCell>
                      {row.class_name ?? "—"}
                      {row.section_name ? ` – ${row.section_name}` : ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
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
