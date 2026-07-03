import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Pencil, RotateCcw, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  approveTimetableBatch,
  getTimetableBatches,
  revertTimetableBatchToDraft,
  submitTimetableForApproval,
  type TimetableBatch,
} from "../api/timetableApproval.api"

function invalidateTimetableQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["timetable-batches"] })
  qc.invalidateQueries({ queryKey: ["timetable-batch"] })
  qc.invalidateQueries({ queryKey: ["timetable-section"] })
  qc.invalidateQueries({ queryKey: ["teacher-timetable"] })
  qc.invalidateQueries({ queryKey: ["my-teacher-timetable"] })
  qc.invalidateQueries({ queryKey: ["student-timetable"] })
  qc.invalidateQueries({ queryKey: ["class-teacher-timetable"] })
  qc.invalidateQueries({ queryKey: ["teacher-dashboard"] })
}

type TimetableApprovalPanelProps = {
  onEditSection?: (sectionId: string) => void
}

export function TimetableApprovalPanel({ onEditSection }: TimetableApprovalPanelProps) {
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
      invalidateTimetableQueries(qc)
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Submit failed"),
  })

  const approve = useMutation({
    mutationFn: approveTimetableBatch,
    onSuccess: () => {
      toast.success("Timetable published — teachers and students can now see it")
      invalidateTimetableQueries(qc)
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Publish failed"),
  })

  const withdraw = useMutation({
    mutationFn: revertTimetableBatchToDraft,
    onSuccess: () => {
      toast.success("Returned to draft — you can edit and submit again")
      invalidateTimetableQueries(qc)
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not return to draft"),
  })

  const actionable = batches.filter((b) => b.status !== "published")
  const pending = actionable.filter((b) => b.status === "pending_approval")
  const drafts = actionable.filter((b) => b.status === "draft")

  const canSubmit =
    activeRole === "vice_principal" || activeRole === "school_admin" || activeRole === "principal"
  const canApprove = activeRole === "principal"
  const canEdit =
    activeRole === "principal" ||
    activeRole === "vice_principal" ||
    activeRole === "school_admin"

  if (!actionable.length) return null

  function handleEdit(batch: TimetableBatch) {
    onEditSection?.(batch.section_id)
  }

  function batchLabel(batch: TimetableBatch) {
    const sec = batch.sections
    const cls =
      sec && typeof sec === "object" && "classes" in sec
        ? (sec as { classes?: { name?: string }; name?: string }).classes?.name
        : ""
    const secName =
      sec && typeof sec === "object" && "name" in sec ? (sec as { name?: string }).name : ""
    return `${cls} — Section ${secName}`
  }

  const sorted = [...actionable].sort((a, b) => {
    const order: Record<string, number> = { pending_approval: 0, draft: 1 }
    return (order[a.status] ?? 2) - (order[b.status] ?? 2)
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timetable approval</CardTitle>
        <CardDescription>
          Submit sections for principal review. Pending timetables can still be edited — approve one section at a time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((b) => (
          <div key={b.id} className="flex items-center justify-between border-b pb-2 text-sm gap-2">
            <button
              type="button"
              className="min-w-0 truncate text-left hover:underline"
              onClick={() => canEdit && handleEdit(b)}
            >
              {batchLabel(b)}
            </button>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              <Badge variant="outline" className="capitalize">
                {b.status.replace(/_/g, " ")}
              </Badge>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => handleEdit(b)} title="Open and edit">
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              )}
              {canSubmit && b.status === "draft" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={submit.isPending}
                  onClick={() => submit.mutate(b.id)}
                >
                  <Send className="h-3 w-3 mr-1" /> Submit
                </Button>
              )}
              {canSubmit && b.status === "pending_approval" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={submit.isPending}
                  onClick={() => submit.mutate(b.id)}
                  title="Notify principal again after edits"
                >
                  <Send className="h-3 w-3 mr-1" /> Re-submit
                </Button>
              )}
              {canEdit && b.status === "pending_approval" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={withdraw.isPending}
                  onClick={() => withdraw.mutate(b.id)}
                  title="Return to draft without deleting slots"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> To draft
                </Button>
              )}
              {canApprove && b.status === "pending_approval" && (
                <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(b.id)}>
                  <Check className="h-3 w-3 mr-1" /> Publish
                </Button>
              )}
              {canApprove && b.status === "draft" && (
                <Button size="sm" variant="secondary" disabled={approve.isPending} onClick={() => approve.mutate(b.id)}>
                  <Check className="h-3 w-3 mr-1" /> Publish
                </Button>
              )}
            </div>
          </div>
        ))}
        {canApprove && pending.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {pending.length} section{pending.length !== 1 ? "s" : ""} awaiting approval — use Edit to change any
            pending timetable before publishing.
          </p>
        )}
        {canSubmit && drafts.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {drafts.length} draft(s) — edit in the grid, then submit for principal approval.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
