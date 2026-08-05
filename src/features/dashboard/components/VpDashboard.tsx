import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Bus, ClipboardCheck, CreditCard, GraduationCap, Home, Target, Users } from "lucide-react"
import { Link } from "react-router-dom"

import { DashboardStatCard } from "@/components/dashboard/StatCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { PrincipalDashboard } from "./PrincipalDashboard"
import { getCrmManagerDashboard } from "../api/dashboard.api"
import { getLeads } from "@/features/crm/api/crm.api"
import { getPendingApprovalApplications } from "@/features/admissions/api/admissions.api"
import { getStudentsPendingPortalLogin } from "@/features/students/api/students.api"
import { PendingStudentLoginPanel } from "@/features/students/components/PendingStudentLoginPanel"
import {
  getPendingHostelStudents,
  getPendingTransportStudents,
} from "@/features/students/api/studentService.api"
import { getPendingFeePlans } from "@/features/finance/api/feePlans.api"
import { getOverdueFeeDuesCount } from "@/features/finance/api/feeManagement.api"
import { getPendingBuses, getPendingRoutes } from "@/features/transport/api/transport.api"
import { getPendingHostelRooms } from "@/features/hostel/api/hostel.api"
import { getSectionAttendanceSnapshot } from "@/features/attendance/api/attendance.api"
import { HostelStatusAlertsPanel } from "@/features/hostel/components/HostelStatusAlertsPanel"

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

  const { data: pendingHostel = [] } = useQuery({
    queryKey: ["pending-hostel", activeSchoolId],
    queryFn: () => getPendingHostelStudents(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: pendingTransport = [] } = useQuery({
    queryKey: ["pending-transport", activeSchoolId],
    queryFn: () => getPendingTransportStudents(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: pendingFeePlans = [] } = useQuery({
    queryKey: ["pending-fee-plans", activeSchoolId],
    queryFn: () => getPendingFeePlans(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: overdueFeeCount = 0 } = useQuery({
    queryKey: ["overdue-dues-count", activeSchoolId],
    queryFn: () => getOverdueFeeDuesCount(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: pendingBuses = [] } = useQuery({
    queryKey: ["pending-buses", activeSchoolId],
    queryFn: () => getPendingBuses(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: pendingRoutes = [] } = useQuery({
    queryKey: ["pending-routes", activeSchoolId],
    queryFn: () => getPendingRoutes(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: pendingHostelRooms = [] } = useQuery({
    queryKey: ["pending-hostel-rooms", activeSchoolId],
    queryFn: () => getPendingHostelRooms(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const today = new Date().toISOString().slice(0, 10)

  const { data: attendanceSnapshot = [] } = useQuery({
    queryKey: ["section-attendance-snapshot", activeSchoolId, today],
    queryFn: () => getSectionAttendanceSnapshot(activeSchoolId!, today),
    enabled: !!activeSchoolId,
  })

  const absentTodayCount = attendanceSnapshot.filter((r) => r.status === "absent").length

  const walkInsToday = leads.filter(
    (l) => l.created_at.startsWith(today) && l.lead_sources?.name?.toLowerCase().includes("walk"),
  ).length

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <DashboardStatCard
          title="CRM leads"
          value={(crmStats as { total_leads?: number })?.total_leads ?? 0}
          description={`${walkInsToday} walk-ins today`}
          icon={Target}
          color="violet"
        />
        <DashboardStatCard
          title="Pending approvals"
          value={pendingApps.length}
          description="Review admissions"
          icon={ClipboardCheck}
          color="violet"
        />
        <Link to="/students" className="block h-full">
          <PendingStudentLoginPanel pending={pendingLogins} onInvite={() => {}} compact />
        </Link>
        <DashboardStatCard
          title="Pending hostel"
          value={pendingHostel.length}
          description="Allocate rooms"
          icon={Home}
          color="violet"
        />
        <DashboardStatCard
          title="Pending transport"
          value={pendingTransport.length}
          description="Assign routes"
          icon={Bus}
          color="violet"
        />
        <DashboardStatCard
          title="Fleet approvals"
          value={pendingBuses.length + pendingRoutes.length}
          description="Review buses/routes"
          icon={Bus}
          color="purple"
        />
        <DashboardStatCard
          title="Room approvals"
          value={pendingHostelRooms.length}
          description="Review rooms"
          icon={Home}
          color="violet"
        />
        <Card className="bg-[#310b65] text-white border-transparent shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Fee status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <p>
                <span className="font-semibold">{pendingFeePlans.length}</span> pending approval
                {pendingFeePlans.length === 1 ? "" : "s"}
              </p>
              <p>
                <span className="font-semibold">{overdueFeeCount}</span> overdue student
                {overdueFeeCount === 1 ? "" : "s"}
              </p>
            </div>
            <Button variant="link" className="h-auto p-0 text-xs mt-2 text-white/80 hover:text-white" asChild>
              <Link to="/finance/vp-fee-status">Open fee status</Link>
            </Button>
          </CardContent>
        </Card>
        <DashboardStatCard
          title="Absent today"
          value={absentTodayCount}
          description="View by class"
          icon={ClipboardCheck}
          color="violet"
        />
        <Card className="bg-[#a855f7] text-white border-transparent shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white" asChild>
              <Link to="/classes"><GraduationCap className="h-3 w-3 mr-1" /> Classes</Link>
            </Button>
            <Button size="sm" variant="outline" className="border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white" asChild>
              <Link to="/students"><GraduationCap className="h-3 w-3 mr-1" /> Students</Link>
            </Button>
            <Button size="sm" variant="outline" className="border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white" asChild>
              <Link to="/transport"><Bus className="h-3 w-3 mr-1" /> Transport</Link>
            </Button>
            <Button size="sm" variant="outline" className="border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white" asChild>
              <Link to="/hostel"><Home className="h-3 w-3 mr-1" /> Hostel</Link>
            </Button>
            <Button size="sm" variant="outline" className="border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white" asChild>
              <Link to="/attendance"><Users className="h-3 w-3 mr-1" /> Attendance</Link>
            </Button>
            <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" asChild>
              <Link to="/crm">CRM <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <HostelStatusAlertsPanel
        title="Hostel resident updates"
        description="Status changes recorded by hostel staff — for Vice Principal review."
        limit={10}
        audience="vp"
      />

      <PrincipalDashboard
        title="Vice Principal Dashboard"
        subtitle="Monitor operations, CRM, teacher attendance, and pending approvals."
      />
    </div>
  )
}
