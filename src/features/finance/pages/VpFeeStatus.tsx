import { useState } from "react"
import { format } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import { Bell, ClipboardCheck, CreditCard } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getPendingFeePlans, getRecentFeeNotifications } from "../api/feePlans.api"
import { getOverdueFeeDuesCount } from "../api/feeManagement.api"
import { FeePlanApprovals } from "./FeePlanApprovals"
import { FeeStructureManager } from "./FeeStructureManager"
import { FeeOverdueDues } from "./FeeOverdueDues"

type VpFeeTab = "approvals" | "structures" | "dues" | "alerts"

export function VpFeeStatus() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const [activeTab, setActiveTab] = useState<VpFeeTab>("approvals")

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fee status</h1>
        <p className="text-muted-foreground mt-1">
          Fee approvals from head accountant, approved structures, and overdue dues (due on or before today).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          className="cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => setActiveTab("approvals")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> Fee approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPlans.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending from head accountant</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => setActiveTab("dues")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Fee dues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Overdue students</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => setActiveTab("alerts")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" /> Recent alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentAlerts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Reminders, payments & fines</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as VpFeeTab)}>
        <TabsList className="flex h-auto flex-wrap w-full sm:w-auto">
          <TabsTrigger value="approvals">Fee approvals</TabsTrigger>
          <TabsTrigger value="structures">Fee structures</TabsTrigger>
          <TabsTrigger value="dues">Fee dues</TabsTrigger>
          <TabsTrigger value="alerts">Recent alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Review term-wise class fee plans submitted by the head accountant. Approved plans create fee structures automatically.
          </p>
          <FeePlanApprovals embedded />
        </TabsContent>

        <TabsContent value="structures" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Active fee structures created after your approval. Invoices are published automatically to all students in that class for the accountant to notify parents.
          </p>
          <FeeStructureManager embedded />
        </TabsContent>

        <TabsContent value="dues" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Students with invoice due dates on or before today and an outstanding balance. View only — accountants send reminders and record payments.
          </p>
          <FeeOverdueDues embedded readOnly />
        </TabsContent>

        <TabsContent value="alerts" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Fee activity from the accountant — reminders to parents, payments received, and fines applied.
          </p>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
