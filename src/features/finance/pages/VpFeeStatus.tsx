import { format } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import { Bell, ClipboardCheck, CreditCard } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getPendingFeePlans, getRecentFeeNotifications } from "../api/feePlans.api"
import { getOverdueFeeDuesCount } from "../api/feeManagement.api"
import { FeePlanApprovals } from "./FeePlanApprovals"
import { FeeStructureManager } from "./FeeStructureManager"
import { FeeOverdueDues } from "./FeeOverdueDues"

export function VpFeeStatus() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: pendingPlans = [] } = useQuery({
    queryKey: ["pending-fee-plans", activeSchoolId],
    queryFn: () => getPendingFeePlans(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: overdueCount = 0 } = useQuery({
    queryKey: ["overdue-dues-count", activeSchoolId],
    queryFn: () => getOverdueFeeDuesCount(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: recentAlerts = [] } = useQuery({
    queryKey: ["recent-fee-notifications", activeSchoolId],
    queryFn: () => getRecentFeeNotifications(activeSchoolId!, 10),
    enabled: !!activeSchoolId,
  })

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fee status</h1>
        <p className="text-muted-foreground mt-1">
          Review pending fee plans, approved structures, overdue balances, and recent parent fee alerts — all in one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> Pending approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPlans.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Overdue students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" /> Recent alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentAlerts.length}</div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4" id="approvals">
        <h2 className="text-xl font-semibold">Pending fee plan approvals</h2>
        <FeePlanApprovals embedded />
      </section>

      <section className="space-y-4" id="structures">
        <h2 className="text-xl font-semibold">Approved fee structures</h2>
        <FeeStructureManager embedded />
      </section>

      <section className="space-y-4" id="overdue">
        <h2 className="text-xl font-semibold">Overdue fee dues</h2>
        <FeeOverdueDues embedded readOnly />
      </section>

      <section className="space-y-4" id="alerts">
        <h2 className="text-xl font-semibold">Recent fee due alerts</h2>
        <Card>
          <CardContent className="py-6">
            {recentAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">No recent fee due notifications.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recentAlerts.map((n) => (
                  <li
                    key={n.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b last:border-0 pb-2 last:pb-0"
                  >
                    <span>
                      {n.student_name ?? "Student"}
                      {n.admission_no ? (
                        <span className="text-muted-foreground font-mono ml-1">({n.admission_no})</span>
                      ) : null}
                      {n.amount != null ? ` · ₹${n.amount.toLocaleString()}` : null}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(n.created_at), "dd MMM yyyy, h:mm a")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
