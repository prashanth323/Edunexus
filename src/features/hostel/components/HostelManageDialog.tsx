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
  const [floor, setFloor] = useState("")
  const [roomType, setRoomType] = useState("double")
  const [capacity, setCapacity] = useState("2")
  const [monthlyFee, setMonthlyFee] = useState("0")
  const [amenities, setAmenities] = useState("")

  const canWrite = activeRole === "hostel_manager"

  const roomMutation = useMutation({
    mutationFn: () =>
      createHostelRoom(activeSchoolId!, {
        room_no: roomNo,
        block: block || null,
        floor: floor ? Number(floor) : null,
        type: roomType,
        capacity: Number(capacity),
        monthly_fee: Number(monthlyFee) || 0,
        amenities: amenities.trim() ? amenities.split(",").map((s) => s.trim()) : null,
        is_active: false,
      }),
    onSuccess: () => {
      toast.success("Room draft saved — submit to VP from the rooms list")
      qc.invalidateQueries({ queryKey: ["hostel-rooms-mgr"] })
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
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Floor</Label>
                <Input type="number" value={floor} onChange={(e) => setFloor(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                >
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="triple">Triple</option>
                  <option value="dormitory">Dormitory</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Capacity</Label>
                <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Monthly fee</Label>
                <Input type="number" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Amenities (comma-separated)</Label>
              <Input value={amenities} onChange={(e) => setAmenities(e.target.value)} placeholder="AC, attached bath" />
            </div>
            <p className="text-xs text-muted-foreground">
              Room is saved as a draft. Submit to the VP for approval before students can be assigned.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => roomMutation.mutate()} disabled={!roomNo.trim()}>
              Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
