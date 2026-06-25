import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getHostelPrincipalOverview, EMPTY_HOSTEL_OVERVIEW, getHostelAllocations } from "../api/hostel.api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function HostelReadOnlyOverview() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: overview = EMPTY_HOSTEL_OVERVIEW } = useQuery({
    queryKey: ["hostel-principal-overview", activeSchoolId],
    queryFn: () => getHostelPrincipalOverview(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: allocations = [] } = useQuery({
    queryKey: ["hostel-allocations", activeSchoolId],
    queryFn: () => getHostelAllocations(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  if (!activeSchoolId) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hostel</h1>
        <p className="text-muted-foreground mt-1">Read-only hostel occupancy summary.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.roomsActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bed capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.bedCapacityTotal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Residents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.allocationsCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Residents</CardTitle>
        </CardHeader>
        <CardContent>
          {allocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No residents.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adm. no</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Room</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.students?.admission_no ?? "—"}</TableCell>
                    <TableCell>{a.students?.profiles?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      {a.hostel_rooms?.block ? `${a.hostel_rooms.block} / ` : ""}
                      {a.hostel_rooms?.room_no ?? "—"}
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
