import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bus, Home, Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  getStudentServiceByAdmissionNo,
  type StudentServiceLookup,
} from "@/features/students/api/studentService.api"
import { assignHostelRoom, getHostelRooms } from "@/features/hostel/api/hostel.api"
import { assignStudentToRoute, getRoutes } from "@/features/transport/api/transport.api"
import { supabase } from "@/lib/supabase"

type Props = {
  schoolId: string
  mode: "hostel" | "transport"
  initialAdmissionNo?: string
  onAllocated?: () => void
}

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function StudentAdmissionLookupPanel({
  schoolId,
  mode,
  initialAdmissionNo = "",
  onAllocated,
}: Props) {
  const qc = useQueryClient()
  const [query, setQuery] = useState(initialAdmissionNo)
  const [searchNo, setSearchNo] = useState(initialAdmissionNo)
  const [roomId, setRoomId] = useState("")
  const [routeId, setRouteId] = useState("")

  useEffect(() => {
    if (initialAdmissionNo.trim().length >= 3) {
      setQuery(initialAdmissionNo)
      setSearchNo(initialAdmissionNo.trim())
    }
  }, [initialAdmissionNo])

  const { data: student, isFetching, isError, error } = useQuery({
    queryKey: ["student-service-lookup", schoolId, searchNo],
    queryFn: () => getStudentServiceByAdmissionNo(schoolId, searchNo),
    enabled: !!schoolId && searchNo.trim().length >= 3,
    retry: false,
  })

  const { data: rooms = [] } = useQuery({
    queryKey: ["hostel-rooms-lookup", schoolId],
    queryFn: () => getHostelRooms(schoolId),
    enabled: mode === "hostel" && !!student,
  })

  const { data: routes = [] } = useQuery({
    queryKey: ["routes-lookup", schoolId],
    queryFn: () => getRoutes(schoolId),
    enabled: mode === "transport" && !!student,
  })

  const allocateMutation = useMutation({
    mutationFn: async (row: StudentServiceLookup) => {
      const { data: ay } = await supabase
        .from("academic_years")
        .select("id")
        .eq("school_id", schoolId)
        .eq("is_current", true)
        .maybeSingle()
      if (!ay?.id) throw new Error("No current academic year")

      if (mode === "hostel") {
        if (!roomId) throw new Error("Select a hostel room")
        await assignHostelRoom({
          schoolId,
          studentId: row.id,
          roomId,
          academicYearId: ay.id,
        })
      } else {
        if (!routeId) throw new Error("Select a transport route")
        await assignStudentToRoute({
          schoolId,
          studentId: row.id,
          routeId,
          academicYearId: ay.id,
        })
      }
    },
    onSuccess: () => {
      toast.success(mode === "hostel" ? "Hostel room assigned" : "Transport route assigned")
      qc.invalidateQueries({ queryKey: ["student-service-lookup"] })
      qc.invalidateQueries({ queryKey: ["hostel-allocations"] })
      qc.invalidateQueries({ queryKey: ["route-students"] })
      qc.invalidateQueries({ queryKey: ["pending-hostel"] })
      qc.invalidateQueries({ queryKey: ["pending-transport"] })
      setRoomId("")
      setRouteId("")
      onAllocated?.()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function runSearch() {
    const trimmed = query.trim()
    if (trimmed.length < 3) return
    setSearchNo(trimmed)
  }

  const Icon = mode === "hostel" ? Home : Bus
  const title = mode === "hostel" ? "Allocate hostel by admission number" : "Allocate transport by admission number"

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>
          Search student, review details, then assign {mode === "hostel" ? "a room" : "a route"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 max-w-md">
          <Input
            placeholder="Admission number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <Button type="button" onClick={runSearch} disabled={query.trim().length < 3}>
            <Search className="h-4 w-4 mr-1.5" />
            Find
          </Button>
        </div>

        {isFetching && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Looking up…
          </p>
        )}

        {isError && searchNo && (
          <p className="text-sm text-destructive">{(error as Error)?.message ?? "Student not found"}</p>
        )}

        {student && (
          <div className="rounded-md border bg-background p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {student.first_name} {student.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {student.admission_no}
                  {student.class_name ? ` · ${student.class_name}` : ""}
                  {student.section_name ? ` - ${student.section_name}` : ""}
                </p>
              </div>
              <Badge variant="outline">{student.transport_mode.replace(/_/g, " ")}</Badge>
            </div>

            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">Student email:</span> {student.email ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Parent phone:</span> {student.parent_phone ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Parent email:</span> {student.parent_email ?? "—"}
              </p>
              {mode === "hostel" && (
                <p>
                  <span className="text-muted-foreground">Current room:</span>{" "}
                  {student.hostel_room ?? (student.has_hostel_allocation ? "Assigned" : "—")}
                </p>
              )}
              {mode === "transport" && (
                <p>
                  <span className="text-muted-foreground">Current route:</span>{" "}
                  {student.route_name ?? (student.has_route_assignment ? "Assigned" : "—")}
                </p>
              )}
            </div>

            {mode === "hostel" && (
              <div className="grid gap-1.5 max-w-xs">
                <Label>Hostel room</Label>
                <select className={selectClass} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                  <option value="">Select room</option>
                  {rooms
                    .filter((r) => r.is_active)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.block ? `${r.block} - ` : ""}
                        {r.room_no} (cap {r.capacity})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {mode === "transport" && (
              <div className="grid gap-1.5 max-w-xs">
                <Label>Route</Label>
                <select className={selectClass} value={routeId} onChange={(e) => setRouteId(e.target.value)}>
                  <option value="">Select route</option>
                  {routes
                    .filter((r) => r.is_active)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <Button
              size="sm"
              type="button"
              disabled={allocateMutation.isPending}
              onClick={() => allocateMutation.mutate(student)}
            >
              {allocateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {mode === "hostel" ? "Assign hostel room" : "Assign transport route"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
