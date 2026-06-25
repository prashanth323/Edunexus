import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bus, Loader2 } from "lucide-react"
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
import { changeStudentRoute, getRoutes } from "../api/transport.api"

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export type TransportRouteEditTarget = {
  routeStudentId: string
  studentName: string
  admissionNo: string
  currentRouteId: string
  currentRouteName: string
}

type Props = {
  schoolId: string
  target: TransportRouteEditTarget | null
  onClose: () => void
}

export function TransportRouteEditDialog({ schoolId, target, onClose }: Props) {
  const qc = useQueryClient()
  const [routeId, setRouteId] = useState("")

  const { data: routes = [] } = useQuery({
    queryKey: ["routes-edit", schoolId],
    queryFn: () => getRoutes(schoolId, { approvedOnly: true }),
    enabled: !!schoolId && !!target,
  })

  useEffect(() => {
    if (target) setRouteId(target.currentRouteId)
  }, [target])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!target || !routeId) throw new Error("Select a route")
      if (routeId === target.currentRouteId) return
      await changeStudentRoute(target.routeStudentId, routeId)
    },
    onSuccess: () => {
      toast.success("Transport route updated")
      qc.invalidateQueries({ queryKey: ["route-students"] })
      qc.invalidateQueries({ queryKey: ["pending-transport"] })
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
            <Bus className="h-4 w-4" />
            Change transport route
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
              Current: <span className="text-foreground">{target.currentRouteName}</span>
            </p>
            <div className="grid gap-1.5">
              <Label>New route</Label>
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
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!routeId || saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
