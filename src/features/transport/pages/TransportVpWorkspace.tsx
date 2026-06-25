import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, X } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
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
import { getPendingTransportStudents } from "@/features/students/api/studentService.api"
import { StudentAdmissionLookupPanel } from "@/features/students/components/StudentAdmissionLookupPanel"
import {
  getPendingBuses,
  getPendingRoutes,
  reviewBus,
  reviewRoute,
} from "../api/transport.api"
import {
  TransportRouteEditDialog,
  type TransportRouteEditTarget,
} from "../components/TransportRouteEditDialog"
import { getAssignedTransportStudents } from "../api/transport.api"

export function TransportVpWorkspace() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get("tab") ?? "pending"
  const admissionNoFromUrl = searchParams.get("admissionNo") ?? ""
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [editTarget, setEditTarget] = useState<TransportRouteEditTarget | null>(null)

  const setTab = (value: string) => {
    if (value === "allocate" && admissionNoFromUrl) {
      setSearchParams({ tab: value, admissionNo: admissionNoFromUrl }, { replace: true })
    } else {
      setSearchParams({ tab: value }, { replace: true })
    }
  }

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-transport", activeSchoolId],
    queryFn: () => getPendingTransportStudents(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: pendingBuses = [] } = useQuery({
    queryKey: ["pending-buses", activeSchoolId],
    queryFn: () => getPendingBuses(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: pendingRoutes = [] } = useQuery({
    queryKey: ["pending-routes", activeSchoolId],
    queryFn: () => getPendingRoutes(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: assigned = [] } = useQuery({
    queryKey: ["transport-assigned", activeSchoolId],
    queryFn: () => getAssignedTransportStudents(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const reviewBusMut = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      reviewBus(id, approve, notes[`bus-${id}`]),
    onSuccess: (_, { approve }) => {
      toast.success(approve ? "Bus approved" : "Bus rejected")
      qc.invalidateQueries({ queryKey: ["pending-buses", activeSchoolId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const reviewRouteMut = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      reviewRoute(id, approve, notes[`route-${id}`]),
    onSuccess: (_, { approve }) => {
      toast.success(approve ? "Route approved" : "Route rejected")
      qc.invalidateQueries({ queryKey: ["pending-routes", activeSchoolId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!activeSchoolId) return null

  return (
    <div className="flex flex-col gap-6">
      {activeSchoolId && (
        <TransportRouteEditDialog
          schoolId={activeSchoolId}
          target={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transport</h1>
        <p className="text-muted-foreground mt-1">
          Approve fleet submitted by the transport manager and assign students from parent requests.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pending">Pending requests ({pending.length})</TabsTrigger>
          <TabsTrigger value="allocate">Assign student</TabsTrigger>
          <TabsTrigger value="approvals">
            Fleet approvals ({pendingBuses.length + pendingRoutes.length})
          </TabsTrigger>
          <TabsTrigger value="assigned">Assigned ({assigned.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Parent transport requests</CardTitle>
              <CardDescription>Students who requested school bus — assign an approved route</CardDescription>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending transport requests.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Adm. no</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((row) => (
                      <TableRow key={row.student_id}>
                        <TableCell className="font-mono text-sm">{row.admission_no}</TableCell>
                        <TableCell>
                          {row.first_name} {row.last_name}
                        </TableCell>
                        <TableCell>
                          {[row.class_name, row.section_name].filter(Boolean).join(" - ") || "—"}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-sm text-primary underline"
                            onClick={() =>
                              setSearchParams(
                                { tab: "allocate", admissionNo: row.admission_no },
                                { replace: true },
                              )
                            }
                          >
                            Assign route
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocate" className="mt-4">
          <StudentAdmissionLookupPanel
            schoolId={activeSchoolId}
            mode="transport"
            initialAdmissionNo={admissionNoFromUrl}
          />
        </TabsContent>

        <TabsContent value="approvals" className="mt-4 space-y-4">
          {pendingBuses.length === 0 && pendingRoutes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No buses or routes pending approval.
              </CardContent>
            </Card>
          ) : (
            <>
              {pendingBuses.map((b) => (
                <Card key={b.id}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>
                        Bus {b.bus_number || b.registration_no} — {b.registration_no}
                      </span>
                      <Badge>pending</Badge>
                    </CardTitle>
                    <CardDescription>{b.capacity} seats</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Textarea
                      placeholder="Notes (optional)"
                      value={notes[`bus-${b.id}`] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [`bus-${b.id}`]: e.target.value }))}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => reviewBusMut.mutate({ id: b.id, approve: true })}>
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button variant="destructive" onClick={() => reviewBusMut.mutate({ id: b.id, approve: false })}>
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pendingRoutes.map((r) => (
                <Card key={r.id}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>
                        {r.route_code ? `Route ${r.route_code} — ` : ""}
                        {r.name}
                      </span>
                      <Badge>pending</Badge>
                    </CardTitle>
                    <CardDescription>
                      Fare ₹{Number(r.fare).toLocaleString()} · {r.description ?? "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Textarea
                      placeholder="Notes (optional)"
                      value={notes[`route-${r.id}`] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [`route-${r.id}`]: e.target.value }))}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => reviewRouteMut.mutate({ id: r.id, approve: true })}>
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button variant="destructive" onClick={() => reviewRouteMut.mutate({ id: r.id, approve: false })}>
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="assigned" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assigned students</CardTitle>
            </CardHeader>
            <CardContent>
              {assigned.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assignments yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Adm. no</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead />
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
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setEditTarget({
                                routeStudentId: row.route_student_id,
                                studentName: row.student_name,
                                admissionNo: row.admission_no,
                                currentRouteId: row.route_id,
                                currentRouteName: row.route_name,
                              })
                            }
                          >
                            Change route
                          </Button>
                        </TableCell>
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
