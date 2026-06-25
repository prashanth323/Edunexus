import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getFeePlanWithTerms,
  getPendingFeePlans,
  reviewClassFeePlan,
  type ClassFeePlan,
} from "../api/feePlans.api"

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
  const { data, isLoading } = useQuery({
    queryKey: ["fee-plan-review-detail", plan.id],
    queryFn: () => getFeePlanWithTerms(plan.id),
  })

  const cls = plan.classes as { name?: string } | null
  const terms = data?.terms ?? []
  const grandTotal = terms.reduce(
    (sum, t) => sum + (t.items ?? []).reduce((s, i) => s + Number(i.amount), 0),
    0,
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg">{cls?.name ?? "Class"} fee plan</CardTitle>
        <Badge>pending VP</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading breakdown…</p>
        ) : terms.length === 0 ? (
          <p className="text-sm text-destructive">No terms defined in this plan.</p>
        ) : (
          <div className="space-y-4">
            {terms.map((term) => {
              const termTotal = (term.items ?? []).reduce((s, i) => s + Number(i.amount), 0)
              return (
                <div key={term.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-medium">{term.term_label}</span>
                    <span className="text-muted-foreground">
                      Due: {term.due_date ? new Date(term.due_date + "T12:00:00").toLocaleDateString() : "—"}
                      {" · "}
                      Subtotal: ₹{termTotal.toLocaleString()}
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fee component</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(term.items ?? []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            ₹{Number(item.amount).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            })}
            <p className="text-sm font-semibold text-right">
              Grand total: ₹{grandTotal.toLocaleString()}
            </p>
          </div>
        )}

        <Textarea
          placeholder="Notes (optional for rejection)"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
        />
        <div className="flex gap-2">
          <Button onClick={() => onReview(true)} disabled={isPending || isLoading}>
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

export function FeePlanApprovals() {
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
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fee plan approvals</h1>
        <p className="text-muted-foreground mt-1">
          Review term-wise class fee plans submitted by the head accountant. Approved plans create fee structures automatically.
        </p>
      </div>

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
