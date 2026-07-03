import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getSchoolApprovedFeePlans } from "../api/feePlans.api"
import { ClassYearlyFeePlanSummary } from "./ClassYearlyFeePlanSummary"

type Props = {
  schoolId: string
  title?: string
  description?: string
  showPaymentStatus?: boolean
  defaultExpandedPlanId?: string | null
}

export function ApprovedYearlyFeePlansPanel({
  schoolId,
  title = "Approved yearly fee plans",
  description = "Full class fee structure for the current academic year — all terms, lines, and due dates.",
  showPaymentStatus = false,
  defaultExpandedPlanId = null,
}: Props) {
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(defaultExpandedPlanId)

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["school-approved-fee-plans", schoolId],
    queryFn: () => getSchoolApprovedFeePlans(schoolId),
    enabled: !!schoolId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!plans.length) {
    return (
      <Card className="border-muted">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>No VP-approved fee plans for the current academic year yet.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {plans.map((plan) => {
          const open = expandedPlanId === plan.plan_id
          return (
            <div key={plan.plan_id} className="border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/50 text-sm"
                onClick={() => setExpandedPlanId(open ? null : plan.plan_id)}
              >
                <span className="flex items-center gap-2 font-medium">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {plan.class_name}
                  {plan.academic_year_name ? ` · ${plan.academic_year_name}` : ""}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {plan.term_count} term{plan.term_count === 1 ? "" : "s"} · ₹
                  {plan.grand_total.toLocaleString()}
                </span>
              </button>
              {open && (
                <div className="border-t p-3 bg-muted/20">
                  <ClassYearlyFeePlanSummary
                    planId={plan.plan_id}
                    embedded
                    showPaymentStatus={showPaymentStatus}
                    title={`${plan.class_name} — yearly structure`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
