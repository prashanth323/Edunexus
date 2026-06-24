import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Bus, ClipboardCheck, GraduationCap, Home, Target, Users } from "lucide-react"
import { Link } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { PrincipalDashboard } from "./PrincipalDashboard"
import { getCrmManagerDashboard } from "../api/dashboard.api"
import { getLeads } from "@/features/crm/api/crm.api"
import { getPendingApprovalApplications } from "@/features/admissions/api/admissions.api"
import { getStudentsPendingPortalLogin } from "@/features/students/api/students.api"
import { PendingStudentLoginPanel } from "@/features/students/components/PendingStudentLoginPanel"

export function VpDashboard() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: crmStats } = useQuery({
    queryKey: ["vp-crm-stats", activeSchoolId],
    queryFn: () => getCrmManagerDashboard(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: pendingApps = [] } = useQuery({
    queryKey: ["vp-pending-apps", activeSchoolId],
    queryFn: () => getPendingApprovalApplications(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: leads = [] } = useQuery({
    queryKey: ["vp-walkins-today", activeSchoolId],
    queryFn: () => getLeads(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: pendingLogins = [] } = useQuery({
    queryKey: ["students-pending-login", activeSchoolId],
    queryFn: () => getStudentsPendingPortalLogin(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const today = new Date().toISOString().slice(0, 10)
  const walkInsToday = leads.filter(
    (l) => l.created_at.startsWith(today) && l.lead_sources?.name?.toLowerCase().includes("walk"),
  ).length

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" /> CRM leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(crmStats as { total_leads?: number })?.total_leads ?? 0}</div>
            <p className="text-xs text-muted-foreground">{walkInsToday} walk-ins today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> Pending approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApps.length}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/admissions">Review admissions</Link>
            </Button>
          </CardContent>
        </Card>
        <Link to="/students" className="block h-full">
          <PendingStudentLoginPanel pending={pendingLogins} onInvite={() => {}} compact />
        </Link>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/students"><GraduationCap className="h-3 w-3 mr-1" /> Students</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/transport"><Bus className="h-3 w-3 mr-1" /> Transport</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/hostel"><Home className="h-3 w-3 mr-1" /> Hostel</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/attendance"><Users className="h-3 w-3 mr-1" /> Attendance</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/crm">CRM <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <PrincipalDashboard
        title="Vice Principal Dashboard"
        subtitle="Monitor operations, CRM, teacher attendance, and pending approvals."
      />
    </div>
  )
}
