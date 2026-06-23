import { useQuery } from "@tanstack/react-query"
import { ArrowRight, CalendarCheck, ClipboardList, GraduationCap, UserSquare2 } from "lucide-react"
import { Link } from "react-router-dom"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatCardSkeletonGrid } from "@/components/ui/card-skeleton"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getApplications } from "@/features/admissions/api/admissions.api"
import { getHalfDayRequests } from "@/features/attendance/api/halfDay.api"
import { getLeads } from "@/features/crm/api/crm.api"

export function ReceptionDashboard() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: draftApps = [], isLoading: appsLoading } = useQuery({
    queryKey: ["reception-draft-apps", activeSchoolId],
    queryFn: () => getApplications(activeSchoolId!, { status: "draft" }),
    enabled: !!activeSchoolId,
  })

  const { data: submittedApps = [], isLoading: submittedLoading } = useQuery({
    queryKey: ["reception-submitted-apps", activeSchoolId],
    queryFn: () => getApplications(activeSchoolId!, { status: "submitted" }),
    enabled: !!activeSchoolId,
  })

  const { data: halfDayPending = [] } = useQuery({
    queryKey: ["reception-half-day", activeSchoolId],
    queryFn: () => getHalfDayRequests(activeSchoolId!, "pending"),
    enabled: !!activeSchoolId,
  })

  const { data: leads = [] } = useQuery({
    queryKey: ["reception-leads-today", activeSchoolId],
    queryFn: () => getLeads(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const today = new Date().toISOString().slice(0, 10)
  const todayLeads = leads.filter((l) => l.created_at.startsWith(today)).length

  if (appsLoading || submittedLoading) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight">Reception</h1>
        <StatCardSkeletonGrid count={4} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reception Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Admissions, documents, half-day requests, and front-desk operations.
          </p>
        </div>
        <Button asChild>
          <Link to="/admissions">New admission <ArrowRight className="h-4 w-4 ml-1" /></Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Draft applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftApps.length}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Awaiting review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{submittedApps.length}</div>
            <p className="text-xs text-muted-foreground">Submitted to leadership</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s enquiries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayLeads}</div>
            <p className="text-xs text-muted-foreground">Leads captured today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Half-day requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{halfDayPending.length}</div>
            {halfDayPending.length > 0 && <Badge className="mt-1">Pending VP</Badge>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/admissions" className="block">
          <Card className="hover:bg-accent/50 transition-colors h-full">
            <CardHeader>
              <ClipboardList className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">Admissions</CardTitle>
              <CardDescription>Fill forms, upload Aadhaar and documents</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link to="/students" className="block">
          <Card className="hover:bg-accent/50 transition-colors h-full">
            <CardHeader>
              <GraduationCap className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">Students</CardTitle>
              <CardDescription>Search and view student directory</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link to="/attendance" className="block">
          <Card className="hover:bg-accent/50 transition-colors h-full">
            <CardHeader>
              <CalendarCheck className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">Half-day requests</CardTitle>
              <CardDescription>Submit half-day attendance requests</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link to="/staff" className="block">
          <Card className="hover:bg-accent/50 transition-colors h-full">
            <CardHeader>
              <UserSquare2 className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">Staff directory</CardTitle>
              <CardDescription>Front-desk staff lookup</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
