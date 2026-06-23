import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { assignHostelRoom, createHostelRoom, getHostelRooms } from "../api/hostel.api"
import { supabase } from "@/lib/supabase"

export function HostelManageDialog() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"room" | "assign">("room")
  const [roomNo, setRoomNo] = useState("")
  const [block, setBlock] = useState("")
  const [capacity, setCapacity] = useState("2")
  const [studentId, setStudentId] = useState("")
  const [roomId, setRoomId] = useState("")

  const canWrite = activeRole === "vice_principal" || activeRole === "principal"

  const { data: rooms = [] } = useQuery({
    queryKey: ["hostel-rooms-manage", activeSchoolId],
    queryFn: () => getHostelRooms(activeSchoolId!),
    enabled: open && !!activeSchoolId,
  })

  const { data: students = [] } = useQuery({
    queryKey: ["hostel-students", activeSchoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, admission_no, profiles:profile_id ( full_name )")
        .eq("school_id", activeSchoolId!)
        .is("deleted_at", null)
        .limit(100)
      return data ?? []
    },
    enabled: open && mode === "assign" && !!activeSchoolId,
  })

  const roomMutation = useMutation({
    mutationFn: () =>
      createHostelRoom(activeSchoolId!, {
        room_no: roomNo,
        block: block || null,
        floor: null,
        type: "double",
        capacity: Number(capacity),
        monthly_fee: 0,
        is_active: true,
      }),
    onSuccess: () => {
      toast.success("Room created")
      qc.invalidateQueries({ queryKey: ["hostel-rooms"] })
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const assignMutation = useMutation({
    mutationFn: async () => {
      const { data: ay } = await supabase
        .from("academic_years")
        .select("id")
        .eq("school_id", activeSchoolId!)
        .eq("is_current", true)
        .maybeSingle()
      if (!ay?.id) throw new Error("No academic year")
      return assignHostelRoom({
        schoolId: activeSchoolId!,
        studentId,
        roomId,
        academicYearId: ay.id,
      })
    },
    onSuccess: () => {
      toast.success("Student assigned to room")
      qc.invalidateQueries({ queryKey: ["hostel-allocations"] })
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!canWrite) return null

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> Manage rooms
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hostel management</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-3">
            <Button size="sm" variant={mode === "room" ? "default" : "outline"} onClick={() => setMode("room")}>New room</Button>
            <Button size="sm" variant={mode === "assign" ? "default" : "outline"} onClick={() => setMode("assign")}>Assign student</Button>
          </div>
          {mode === "room" ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Room no.</Label>
                  <Input value={roomNo} onChange={(e) => setRoomNo(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Block</Label>
                  <Input value={block} onChange={(e) => setBlock(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Capacity</Label>
                <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Student</Label>
                <select className="flex h-10 rounded-md border px-3 text-sm w-full" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                  <option value="">Select</option>
                  {students.map((s: { id: string; admission_no: string; profiles: { full_name: string } | { full_name: string }[] | null }) => {
                    const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
                    return <option key={s.id} value={s.id}>{p?.full_name ?? s.admission_no}</option>
                  })}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Room</Label>
                <select className="flex h-10 rounded-md border px-3 text-sm w-full" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                  <option value="">Select room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.block ? `${r.block}-` : ""}{r.room_no}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => (mode === "room" ? roomMutation.mutate() : assignMutation.mutate())}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
