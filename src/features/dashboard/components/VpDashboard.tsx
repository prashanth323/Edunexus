import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Bus, ClipboardCheck, CreditCard, GraduationCap, Home, Target, Users } from "lucide-react"
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
import {
  getPendingHostelStudents,
  getPendingTransportStudents,
} from "@/features/students/api/studentService.api"
import { getPendingFeePlans } from "@/features/finance/api/feePlans.api"
import { getOverdueFeeDuesCount } from "@/features/finance/api/feeManagement.api"
import { getPendingBuses, getPendingRoutes } from "@/features/transport/api/transport.api"
import { getPendingHostelRooms } from "@/features/hostel/api/hostel.api"
import { getSectionAttendanceSnapshot } from "@/features/attendance/api/attendance.api"

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
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Home className="h-4 w-4" /> Pending hostel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingHostel.length}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/hostel?tab=pending">Allocate rooms</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bus className="h-4 w-4" /> Pending transport
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTransport.length}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/transport?tab=pending">Assign routes</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bus className="h-4 w-4" /> Fleet approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingBuses.length + pendingRoutes.length}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/transport?tab=approvals">Review buses/routes</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Home className="h-4 w-4" /> Room approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingHostelRooms.length}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/hostel?tab=approvals">Review rooms</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Fee status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-semibold text-foreground">{pendingFeePlans.length}</span> pending approval
                {pendingFeePlans.length === 1 ? "" : "s"}
              </p>
              <p>
                <span className="font-semibold text-foreground">{overdueFeeCount}</span> overdue student
                {overdueFeeCount === 1 ? "" : "s"}
              </p>
            </div>
            <Button variant="link" className="h-auto p-0 text-xs mt-2" asChild>
              <Link to="/finance/vp-fee-status">Open fee status</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> Absent today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{absentTodayCount}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/attendance">View by class</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/classes"><GraduationCap className="h-3 w-3 mr-1" /> Classes</Link>
            </Button>
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
