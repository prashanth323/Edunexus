import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { supabase } from "@/lib/supabase"
import {
  getHostelResidents,
  updateHostelResidentStatus,
} from "@/features/finance/api/feePlans.api"
import {
  getHostelRooms,
  submitHostelRoomForApproval,
} from "../api/hostel.api"
import { HostelManageDialog } from "../components/HostelManageDialog"

const STATUS_OPTIONS = [
  { value: "in_hostel", label: "In hostel" },
  { value: "joined", label: "Joined hostel" },
  { value: "checked_out", label: "Vacated hostel" },
  { value: "away_home", label: "Leave — went home" },
  { value: "in_hostel_no_class", label: "Leave — in hostel, no class" },
] as const

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
)

export function HostelManagerWorkspace() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()

  const { data: rooms = [] } = useQuery({
    queryKey: ["hostel-rooms-mgr", activeSchoolId],
    queryFn: () => getHostelRooms(activeSchoolId!, { managerView: true }),
    enabled: !!activeSchoolId,
  })

  const { data: residents = [], isLoading } = useQuery({
    queryKey: ["hostel-residents", activeSchoolId],
    queryFn: () => getHostelResidents(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const statusMut = useMutation({
    mutationFn: async ({
      allocationId,
      status,
    }: {
      allocationId: string
      studentId: string
      studentName: string
      status: string
    }) => {
      const result = await updateHostelResidentStatus(allocationId, status)
      if (result.notification_id && result.parent_email) {
        await supabase.functions.invoke("send-operational-email", {
          body: { notification_id: result.notification_id },
        })
      }
      return result
    },
    onSuccess: () => {
      toast.success("Status updated — recorded on student profile")
      qc.invalidateQueries({ queryKey: ["hostel-residents", activeSchoolId] })
      qc.invalidateQueries({ queryKey: ["student-hostel-status"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submitRoomMut = useMutation({
    mutationFn: submitHostelRoomForApproval,
    onSuccess: () => {
      toast.success("Room submitted to VP")
      qc.invalidateQueries({ queryKey: ["hostel-rooms-mgr", activeSchoolId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const draftRooms = rooms.filter((r) => r.approval_status === "draft" || r.approval_status === "rejected")
  const approvedRooms = rooms.filter((r) => r.approval_status === "approved" || r.approval_status === "legacy")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hostel</h1>
          <p className="text-muted-foreground mt-1">
            Add room details for VP approval. Track residents and update leave status.
          </p>
        </div>
        <HostelManageDialog />
      </div>

      <Tabs defaultValue="residents">
        <TabsList>
          <TabsTrigger value="residents">Residents ({residents.length})</TabsTrigger>
          <TabsTrigger value="rooms">Rooms ({rooms.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Draft rooms — submit to VP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {draftRooms.length === 0 ? (
                <p className="text-sm text-muted-foreground">No draft rooms.</p>
              ) : (
                draftRooms.map((room) => (
                  <div key={room.id} className="flex items-center justify-between border rounded-md p-2">
                    <span>
                      {room.block ? `${room.block} / ` : ""}
                      {room.room_no} · {room.capacity} beds · <Badge variant="outline">{room.approval_status}</Badge>
                    </span>
                    <Button size="sm" onClick={() => submitRoomMut.mutate(room.id)} disabled={submitRoomMut.isPending}>
                      <Send className="h-3 w-3 mr-1" /> Submit to VP
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">VP-approved rooms</CardTitle>
            </CardHeader>
            <CardContent>
              {approvedRooms.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approved rooms yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Fee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedRooms.map((room) => (
                      <TableRow key={room.id}>
                        <TableCell>
                          {room.block ? `${room.block} / ` : ""}
                          {room.room_no}
                        </TableCell>
                        <TableCell>{room.type}</TableCell>
                        <TableCell>{room.capacity}</TableCell>
                        <TableCell>₹{Number(room.monthly_fee).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="residents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current residents</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : residents.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active hostel residents.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adm. no</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[200px]">Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {residents.map((r) => (
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
                    <TableCell>
                      <Badge variant="secondary">{STATUS_LABEL[r.resident_status] ?? r.resident_status}</Badge>
                    </TableCell>
                    <TableCell>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs max-w-full"
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value
                          if (!v) return
                          statusMut.mutate({
                            allocationId: r.allocation_id,
                            studentId: r.student_id,
                            studentName: r.student_name,
                            status: v,
                          })
                          e.target.value = ""
                        }}
                      >
                        <option value="">Set status…</option>
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
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
