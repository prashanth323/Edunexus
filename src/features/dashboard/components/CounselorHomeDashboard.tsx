import { useQuery } from "@tanstack/react-query"
import { Target, Users } from "lucide-react"
import { Link } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCardSkeletonGrid } from "@/components/ui/card-skeleton"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getLeads, type LeadStatus } from "@/features/crm/api/crm.api"
import { getFollowups } from "@/features/crm/api/crm.api"
import { CallLogPanel } from "@/features/crm/components/CallLogPanel"

const OPEN: LeadStatus[] = ["new", "contacted", "interested", "followup_scheduled"]
const VISIT: LeadStatus[] = ["visit_scheduled", "visited"]
const PIPELINE: LeadStatus[] = ["applied"]

export function CounselorHomeDashboard() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["counselor-home-leads", activeSchoolId],
    queryFn: () => getLeads(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: followups = [] } = useQuery({
    queryKey: ["counselor-followups", activeSchoolId],
    queryFn: () => getFollowups(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const pendingCallbacks = followups.filter(
    (f) => f.type === "call" && f.next_followup && new Date(f.next_followup) >= new Date(),
  ).length

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Counselor home</h1>
            <p className="text-muted-foreground mt-1">Admissions pipeline snapshot for your school.</p>
          </div>
          <div className="h-10 w-40 rounded-md bg-muted animate-pulse" />
        </div>
        <StatCardSkeletonGrid count={4} columnsClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" />
      </div>
    )
  }

  const count = (statuses: LeadStatus[]) =>
    leads.filter((l) => statuses.includes(l.status)).length

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Counselor home</h1>
          <p className="text-muted-foreground mt-1">
            Admissions pipeline snapshot for your school.
          </p>
        </div>
        <Button asChild>
          <Link to="/crm">Open full CRM</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{count(OPEN)}</div>
            <p className="text-xs text-muted-foreground mt-1">New through follow-up</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visits</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{count(VISIT)}</div>
            <p className="text-xs text-muted-foreground mt-1">Scheduled or completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Applications</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{count(PIPELINE)}</div>
            <p className="text-xs text-muted-foreground mt-1">Applied stage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Call queue</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCallbacks}</div>
            <p className="text-xs text-muted-foreground mt-1">Scheduled callbacks</p>
          </CardContent>
        </Card>
      </div>

      {activeSchoolId && <CallLogPanel schoolId={activeSchoolId} />}
    </div>
  )
}
