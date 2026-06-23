import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  approveTimetableBatch,
  getTimetableBatches,
  submitTimetableForApproval,
} from "../api/timetableApproval.api"

export function TimetableApprovalPanel() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const qc = useQueryClient()

  const { data: batches = [] } = useQuery({
    queryKey: ["timetable-batches", activeSchoolId],
    queryFn: () => getTimetableBatches(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const submit = useMutation({
    mutationFn: submitTimetableForApproval,
    onSuccess: () => {
      toast.success("Submitted for principal approval")
      qc.invalidateQueries({ queryKey: ["timetable-batches"] })
    },
  })

  const approve = useMutation({
    mutationFn: approveTimetableBatch,
    onSuccess: () => {
      toast.success("Timetable published")
      qc.invalidateQueries({ queryKey: ["timetable-batches"] })
    },
  })

  const pending = batches.filter((b) => b.status === "pending_approval")
  const drafts = batches.filter((b) => b.status === "draft")

  if (!batches.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timetable approval</CardTitle>
        <CardDescription>VP creates drafts → Principal publishes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {batches.map((b) => {
          const sec = b.sections
          const cls = sec && typeof sec === "object" && "classes" in sec ? (sec as { classes?: { name?: string }; name?: string }).classes?.name : ""
          const secName = sec && typeof sec === "object" && "name" in sec ? (sec as { name?: string }).name : ""
          return (
            <div key={b.id} className="flex items-center justify-between border-b pb-2 text-sm">
              <span>{cls} — Section {secName}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{b.status.replace(/_/g, " ")}</Badge>
                {activeRole === "vice_principal" && b.status === "draft" && (
                  <Button size="sm" variant="outline" onClick={() => submit.mutate(b.id)}>
                    <Send className="h-3 w-3 mr-1" /> Submit
                  </Button>
                )}
                {activeRole === "principal" && b.status === "pending_approval" && (
                  <Button size="sm" onClick={() => approve.mutate(b.id)}>
                    <Check className="h-3 w-3 mr-1" /> Approve
                  </Button>
                )}
              </div>
            </div>
          )
        })}
        {activeRole === "principal" && pending.length > 0 && (
          <p className="text-xs text-muted-foreground">{pending.length} awaiting your approval</p>
        )}
        {activeRole === "vice_principal" && drafts.length > 0 && (
          <p className="text-xs text-muted-foreground">{drafts.length} draft(s) — edit timetable then submit</p>
        )}
      </CardContent>
    </Card>
  )
}
