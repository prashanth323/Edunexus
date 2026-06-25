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
import { createBus, createRoute } from "../api/transport.api"

export function TransportManageDialog() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"bus" | "route">("bus")
  const [regNo, setRegNo] = useState("")
  const [capacity, setCapacity] = useState("40")
  const [routeName, setRouteName] = useState("")
  const [fare, setFare] = useState("")

  const canWrite = activeRole === "transport_manager"

  const busMutation = useMutation({
    mutationFn: () =>
      createBus(activeSchoolId!, {
        registration_no: regNo,
        capacity: Number(capacity),
      }),
    onSuccess: () => {
      toast.success("Bus added")
      qc.invalidateQueries({ queryKey: ["transport-buses"] })
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const routeMutation = useMutation({
    mutationFn: () => createRoute(activeSchoolId!, { name: routeName, fare: Number(fare) }),
    onSuccess: () => {
      toast.success("Route added")
      qc.invalidateQueries({ queryKey: ["transport-routes"] })
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!canWrite) return null

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> Manage
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transport management</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-3">
            <Button size="sm" variant={tab === "bus" ? "default" : "outline"} onClick={() => setTab("bus")}>Bus</Button>
            <Button size="sm" variant={tab === "route" ? "default" : "outline"} onClick={() => setTab("route")}>Route</Button>
          </div>
          {tab === "bus" ? (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Registration no.</Label>
                <Input value={regNo} onChange={(e) => setRegNo(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Capacity</Label>
                <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Route name</Label>
                <Input value={routeName} onChange={(e) => setRouteName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Fare</Label>
                <Input type="number" value={fare} onChange={(e) => setFare(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => (tab === "bus" ? busMutation.mutate() : routeMutation.mutate())}
              disabled={tab === "bus" ? !regNo : !routeName}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
