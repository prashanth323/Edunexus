import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { createHostelRoom } from "../api/hostel.api"

export function HostelManageDialog() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [roomNo, setRoomNo] = useState("")
  const [block, setBlock] = useState("")
  const [capacity, setCapacity] = useState("2")

  const canWrite = activeRole === "vice_principal" || activeRole === "principal"

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
      setRoomNo("")
      setBlock("")
      setCapacity("2")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!canWrite) return null

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> Add room
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New hostel room</DialogTitle>
          </DialogHeader>
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
            <p className="text-xs text-muted-foreground">
              To assign students, use the Allocate tab and search by admission number.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => roomMutation.mutate()} disabled={!roomNo.trim()}>
              Create room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
