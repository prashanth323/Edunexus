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
import { getPendingHostelStudents } from "@/features/students/api/studentService.api"
import { StudentAdmissionLookupPanel } from "@/features/students/components/StudentAdmissionLookupPanel"
import { getHostelAllocations, getPendingHostelRooms, reviewHostelRoom } from "../api/hostel.api"
import {
  HostelRoomEditDialog,
  type HostelRoomEditTarget,
} from "../components/HostelRoomEditDialog"

export function HostelVpWorkspace() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get("tab") ?? "pending"
  const admissionNoFromUrl = searchParams.get("admissionNo") ?? ""
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [editTarget, setEditTarget] = useState<HostelRoomEditTarget | null>(null)

  const setTab = (value: string) => {
    if (value === "allocate" && admissionNoFromUrl) {
      setSearchParams({ tab: value, admissionNo: admissionNoFromUrl }, { replace: true })
    } else {
      setSearchParams({ tab: value }, { replace: true })
    }
  }

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-hostel", activeSchoolId],
    queryFn: () => getPendingHostelStudents(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: pendingRooms = [] } = useQuery({
    queryKey: ["pending-hostel-rooms", activeSchoolId],
    queryFn: () => getPendingHostelRooms(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: allocations = [] } = useQuery({
    queryKey: ["hostel-allocations", activeSchoolId],
    queryFn: () => getHostelAllocations(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      reviewHostelRoom(id, approve, notes[id]),
    onSuccess: (_, { approve }) => {
      toast.success(approve ? "Room approved" : "Room rejected")
      qc.invalidateQueries({ queryKey: ["pending-hostel-rooms", activeSchoolId] })
      qc.invalidateQueries({ queryKey: ["hostel-rooms"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!activeSchoolId) return null

  return (
    <div className="flex flex-col gap-6">
      {activeSchoolId && (
        <HostelRoomEditDialog
          schoolId={activeSchoolId}
          target={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hostel</h1>
        <p className="text-muted-foreground mt-1">
          Approve rooms submitted by the hostel manager and assign students from parent requests.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pending">Pending requests ({pending.length})</TabsTrigger>
          <TabsTrigger value="allocate">Assign student</TabsTrigger>
          <TabsTrigger value="approvals">Room approvals ({pendingRooms.length})</TabsTrigger>
          <TabsTrigger value="residents">Residents ({allocations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Parent hostel requests</CardTitle>
              <CardDescription>Students who requested hostel — assign an approved room</CardDescription>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending hostel requests.</p>
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
                            Allocate room
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
            mode="hostel"
            initialAdmissionNo={admissionNoFromUrl}
          />
        </TabsContent>

        <TabsContent value="approvals" className="mt-4 space-y-4">
          {pendingRooms.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No rooms pending approval.
              </CardContent>
            </Card>
          ) : (
            pendingRooms.map((room) => (
              <Card key={room.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>
                      Room {room.room_no}
                      {room.block ? ` — Block ${room.block}` : ""}
                    </span>
                    <Badge>pending</Badge>
                  </CardTitle>
                  <CardDescription>
                    {room.type} · {room.capacity} beds · ₹{Number(room.monthly_fee).toLocaleString()}/mo
                    {room.floor != null ? ` · Floor ${room.floor}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Textarea
                    placeholder="Notes (optional)"
                    value={notes[room.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [room.id]: e.target.value }))}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => reviewMut.mutate({ id: room.id, approve: true })}>
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button variant="destructive" onClick={() => reviewMut.mutate({ id: room.id, approve: false })}>
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="residents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Current residents</CardTitle>
            </CardHeader>
            <CardContent>
              {allocations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active residents.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Adm. no</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead />
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
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setEditTarget({
                                allocationId: a.id,
                                studentName: a.students?.profiles?.full_name ?? "Student",
                                admissionNo: a.students?.admission_no ?? "—",
                                currentRoomId: a.room_id,
                                currentRoomLabel: a.hostel_rooms
                                  ? `${a.hostel_rooms.block ? `${a.hostel_rooms.block} / ` : ""}${a.hostel_rooms.room_no}`
                                  : "—",
                              })
                            }
                          >
                            Change room
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
