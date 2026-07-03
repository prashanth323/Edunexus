import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getPendingFeePlans,
  reviewClassFeePlan,
  type ClassFeePlan,
} from "../api/feePlans.api"
import { ClassYearlyFeePlanSummary } from "../components/ClassYearlyFeePlanSummary"

function FeePlanReviewCard({
  plan,
  notes,
  onNotesChange,
  onReview,
  isPending,
}: {
  plan: ClassFeePlan
  notes: string
  onNotesChange: (v: string) => void
  onReview: (approve: boolean) => void
  isPending: boolean
}) {
  const cls = plan.classes as { name?: string } | null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg">{cls?.name ?? "Class"} fee plan</CardTitle>
        <Badge>pending VP</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <ClassYearlyFeePlanSummary planId={plan.id} title={`${cls?.name ?? "Class"} — yearly structure`} />

        <Textarea
          placeholder="Notes (optional for rejection)"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
        />
        <div className="flex gap-2">
          <Button onClick={() => onReview(true)} disabled={isPending}>
            <Check className="h-4 w-4 mr-1" /> Approve
          </Button>
          <Button variant="destructive" onClick={() => onReview(false)} disabled={isPending}>
            <X className="h-4 w-4 mr-1" /> Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

type FeePlanApprovalsProps = {
  embedded?: boolean
}

export function FeePlanApprovals({ embedded = false }: FeePlanApprovalsProps) {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()
  const [notes, setNotes] = useState<Record<string, string>>({})

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["pending-fee-plans", activeSchoolId],
    queryFn: () => getPendingFeePlans(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      reviewClassFeePlan(id, approve, notes[id]),
    onSuccess: (_, { approve }) => {
      toast.success(approve ? "Fee plan approved" : "Fee plan rejected")
      qc.invalidateQueries({ queryKey: ["pending-fee-plans", activeSchoolId] })
      qc.invalidateQueries({ queryKey: ["class-fee-plans", activeSchoolId] })
      qc.invalidateQueries({ queryKey: ["fee-structures", activeSchoolId] })
    },
    onError: (e: Error) => {
      const msg = e.message.includes("idx_class_fee_plans_one_approved")
        ? "This class already has an approved fee plan for this year. Apply the latest database migration, or ask an admin to retire the old approved plan first."
        : e.message
      toast.error(msg)
    },
  })

  return (
    <div className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-6"}>
      {!embedded && (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fee plan approvals</h1>
          <p className="text-muted-foreground mt-1">
            Review term-wise class fee plans submitted by the head accountant. Approved plans create fee structures automatically.
          </p>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No fee plans pending approval.
          </CardContent>
        </Card>
      ) : (
        plans.map((p) => (
          <FeePlanReviewCard
            key={p.id}
            plan={p}
            notes={notes[p.id] ?? ""}
            onNotesChange={(v) => setNotes((n) => ({ ...n, [p.id]: v }))}
            onReview={(approve) => reviewMut.mutate({ id: p.id, approve })}
            isPending={reviewMut.isPending}
          />
        ))
      )}
    </div>
  )
}
