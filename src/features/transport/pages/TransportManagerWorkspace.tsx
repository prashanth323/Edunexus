import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  createBus,
  createRoute,
  getAssignedTransportStudents,
  getBuses,
  getRoutes,
  submitBusForApproval,
  submitRouteForApproval,
} from "../api/transport.api"

export function TransportManagerWorkspace() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()

  const [busNumber, setBusNumber] = useState("")
  const [regNo, setRegNo] = useState("")
  const [capacity, setCapacity] = useState("40")
  const [routeCode, setRouteCode] = useState("")
  const [routeName, setRouteName] = useState("")
  const [fare, setFare] = useState("")
  const [description, setDescription] = useState("")
  const [linkedBusId, setLinkedBusId] = useState("")

  const { data: buses = [] } = useQuery({
    queryKey: ["transport-buses-mgr", activeSchoolId],
    queryFn: () => getBuses(activeSchoolId!, { managerView: true }),
    enabled: !!activeSchoolId,
  })

  const { data: routes = [] } = useQuery({
    queryKey: ["transport-routes-mgr", activeSchoolId],
    queryFn: () => getRoutes(activeSchoolId!, { managerView: true }),
    enabled: !!activeSchoolId,
  })

  const { data: assigned = [], isLoading: assignedLoading } = useQuery({
    queryKey: ["transport-assigned", activeSchoolId],
    queryFn: () => getAssignedTransportStudents(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const approvedBuses = buses.filter((b) => b.approval_status === "approved" || b.approval_status === "legacy")

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transport-buses-mgr", activeSchoolId] })
    qc.invalidateQueries({ queryKey: ["transport-routes-mgr", activeSchoolId] })
  }

  const busMut = useMutation({
    mutationFn: () =>
      createBus(activeSchoolId!, {
        registration_no: regNo.trim(),
        bus_number: busNumber.trim() || null,
        capacity: Number(capacity) || 40,
      }),
    onSuccess: () => {
      toast.success("Bus draft saved — submit to VP when ready")
      setBusNumber("")
      setRegNo("")
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const routeMut = useMutation({
    mutationFn: () =>
      createRoute(activeSchoolId!, {
        name: routeName.trim(),
        route_code: routeCode.trim() || null,
        description: description.trim() || null,
        fare: Number(fare) || 0,
        bus_id: linkedBusId || null,
      }),
    onSuccess: () => {
      toast.success("Route draft saved — submit to VP when ready")
      setRouteCode("")
      setRouteName("")
      setFare("")
      setDescription("")
      setLinkedBusId("")
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submitBusMut = useMutation({
    mutationFn: submitBusForApproval,
    onSuccess: () => {
      toast.success("Bus submitted to VP")
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submitRouteMut = useMutation({
    mutationFn: submitRouteForApproval,
    onSuccess: () => {
      toast.success("Route submitted to VP")
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!activeSchoolId) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transport</h1>
        <p className="text-muted-foreground mt-1">
          Add bus and route details for VP approval. View students assigned to school routes.
        </p>
      </div>

      <Tabs defaultValue="fleet">
        <TabsList>
          <TabsTrigger value="fleet">Fleet & routes</TabsTrigger>
          <TabsTrigger value="assigned">Assigned students ({assigned.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="fleet" className="space-y-4 mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add bus</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Bus number</Label>
                  <Input value={busNumber} onChange={(e) => setBusNumber(e.target.value)} placeholder="Fleet no." />
                </div>
                <div>
                  <Label>Registration no.</Label>
                  <Input value={regNo} onChange={(e) => setRegNo(e.target.value)} />
                </div>
                <div>
                  <Label>Capacity</Label>
                  <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
                </div>
                <Button onClick={() => busMut.mutate()} disabled={!regNo.trim() || busMut.isPending}>
                  Save bus draft
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add route</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Route number</Label>
                  <Input value={routeCode} onChange={(e) => setRouteCode(e.target.value)} placeholder="e.g. R-12" />
                </div>
                <div>
                  <Label>Route name</Label>
                  <Input value={routeName} onChange={(e) => setRouteName(e.target.value)} />
                </div>
                <div>
                  <Label>Linked bus</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={linkedBusId}
                    onChange={(e) => setLinkedBusId(e.target.value)}
                  >
                    <option value="">Select approved bus…</option>
                    {approvedBuses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bus_number || b.registration_no} ({b.registration_no})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Fare</Label>
                  <Input type="number" value={fare} onChange={(e) => setFare(e.target.value)} />
                </div>
                <div>
                  <Label>Stops / description</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <Button onClick={() => routeMut.mutate()} disabled={!routeName.trim() || routeMut.isPending}>
                  Save route draft
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Drafts awaiting submission</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {buses.filter((b) => b.approval_status === "draft" || b.approval_status === "rejected").length === 0 &&
              routes.filter((r) => r.approval_status === "draft" || r.approval_status === "rejected").length === 0 ? (
                <p className="text-sm text-muted-foreground">No drafts.</p>
              ) : (
                <>
                  {buses
                    .filter((b) => b.approval_status === "draft" || b.approval_status === "rejected")
                    .map((b) => (
                      <div key={b.id} className="flex items-center justify-between border rounded-md p-2">
                        <span>
                          Bus {b.bus_number || b.registration_no} — {b.registration_no}{" "}
                          <Badge variant="outline">{b.approval_status}</Badge>
                        </span>
                        <Button size="sm" onClick={() => submitBusMut.mutate(b.id)} disabled={submitBusMut.isPending}>
                          <Send className="h-3 w-3 mr-1" /> Submit to VP
                        </Button>
                      </div>
                    ))}
                  {routes
                    .filter((r) => r.approval_status === "draft" || r.approval_status === "rejected")
                    .map((r) => (
                      <div key={r.id} className="flex items-center justify-between border rounded-md p-2">
                        <span>
                          {r.route_code ? `${r.route_code} — ` : ""}
                          {r.name} <Badge variant="outline">{r.approval_status}</Badge>
                        </span>
                        <Button size="sm" onClick={() => submitRouteMut.mutate(r.id)} disabled={submitRouteMut.isPending}>
                          <Send className="h-3 w-3 mr-1" /> Submit to VP
                        </Button>
                      </div>
                    ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">VP-approved fleet</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedBuses.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>Bus</TableCell>
                      <TableCell>
                        {b.bus_number ? `${b.bus_number} / ` : ""}
                        {b.registration_no} · {b.capacity} seats
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">approved</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {routes
                    .filter((r) => r.approval_status === "approved" || r.approval_status === "legacy")
                    .map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>Route</TableCell>
                        <TableCell>
                          {r.route_code ? `${r.route_code} — ` : ""}
                          {r.name} · ₹{Number(r.fare).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">approved</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assigned" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Students on school bus</CardTitle>
            </CardHeader>
            <CardContent>
              {assignedLoading ? (
                <p className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </p>
              ) : assigned.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students assigned yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Adm. no</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Bus reg.</TableHead>
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
                        <TableCell>{row.bus_registration ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
