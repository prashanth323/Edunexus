import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Home, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { changeHostelRoom, getHostelRooms } from "../api/hostel.api"

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export type HostelRoomEditTarget = {
  allocationId: string
  studentName: string
  admissionNo: string
  currentRoomId: string
  currentRoomLabel: string
}

type Props = {
  schoolId: string
  target: HostelRoomEditTarget | null
  onClose: () => void
}

export function HostelRoomEditDialog({ schoolId, target, onClose }: Props) {
  const qc = useQueryClient()
  const [roomId, setRoomId] = useState("")

  const { data: rooms = [] } = useQuery({
    queryKey: ["hostel-rooms-edit", schoolId],
    queryFn: () => getHostelRooms(schoolId, { approvedOnly: true }),
    enabled: !!schoolId && !!target,
  })

  useEffect(() => {
    if (target) setRoomId(target.currentRoomId)
  }, [target])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!target || !roomId) throw new Error("Select a hostel room")
      if (roomId === target.currentRoomId) return
      await changeHostelRoom(target.allocationId, roomId)
    },
    onSuccess: () => {
      toast.success("Hostel room updated")
      qc.invalidateQueries({ queryKey: ["hostel-allocations"] })
      qc.invalidateQueries({ queryKey: ["pending-hostel"] })
      qc.invalidateQueries({ queryKey: ["student-service-lookup"] })
      qc.invalidateQueries({ queryKey: ["student-service-details"] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Change hostel room
          </DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                {target.studentName} · <span className="font-mono">{target.admissionNo}</span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {target && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Current: <span className="text-foreground">{target.currentRoomLabel}</span>
            </p>
            <div className="grid gap-1.5">
              <Label>New room</Label>
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
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!roomId || saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
