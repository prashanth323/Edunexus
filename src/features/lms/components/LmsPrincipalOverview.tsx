import { useQuery } from "@tanstack/react-query"
import {
  BookOpen,
  BookMarked,
  ClipboardList,
  FileStack,
  GraduationCap,
  Layers,
  Loader2,
  Send,
  Trophy,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { DashboardStatCard } from "@/components/dashboard/StatCard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getLmsPrincipalOverview, EMPTY_LMS_OVERVIEW, type LmsPrincipalOverview as Overview } from "../api/lms.api"

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground) / 0.35)"]
const BAR_FILL = "hsl(var(--primary) / 0.85)"

export function LmsPrincipalOverview() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data = EMPTY_LMS_OVERVIEW, isFetching } = useQuery({
    queryKey: ["lms-principal-overview", activeSchoolId],
    queryFn: async () => {
      if (!activeSchoolId) return EMPTY_LMS_OVERVIEW
      try {
        return await getLmsPrincipalOverview(activeSchoolId)
      } catch {
        return EMPTY_LMS_OVERVIEW
      }
    },
    enabled: !!activeSchoolId,
    placeholderData: EMPTY_LMS_OVERVIEW,
    staleTime: 120_000,
  })

  const o = data as Overview

  if (!activeSchoolId) {
    return (
      <div className="text-sm text-muted-foreground py-12 text-center">
        Select a school to view LMS metrics.
      </div>
    )
  }

  const courseMix = [
    { name: "Published", value: o.coursesPublished },
    { name: "Draft", value: o.coursesDraft },
  ].filter((d) => d.value > 0)

  const mixForChart = courseMix.length > 0 ? courseMix : []

  const scaleBars = [
    { label: "Subjects", value: o.subjectsTotal },
    { label: "Courses", value: o.coursesTotal },
    { label: "Lessons", value: o.lessonsTotal },
    { label: "Assignments", value: o.assignmentsTotal },
    { label: "Materials", value: o.studyMaterialsTotal },
    { label: "Enrollments", value: o.activeEnrollments },
  ]

  const subPie =
    o.submissionsRows > 0
      ? [
          { name: "Filed", value: o.submissionsFiled },
          { name: "Not submitted", value: Math.max(0, o.submissionsRows - o.submissionsFiled) },
        ].filter((d) => d.value > 0)
      : []

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Learning Management</h1>
          <p className="text-muted-foreground mt-1">
            School-wide LMS metrics: courses, enrollments, assignments, and materials.
          </p>
        </div>
        {isFetching ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Updating…
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard
          title="Courses"
          value={o.coursesTotal}
          description={`${o.coursesPublished} published · ${o.coursesDraft} draft`}
          icon={BookOpen}
        />
        <DashboardStatCard title="Course lessons" value={o.lessonsTotal} icon={Layers} />
        <DashboardStatCard
          title="Assignments"
          value={o.assignmentsTotal}
          description={`${o.assignmentsPublished} published`}
          icon={ClipboardList}
        />
        <DashboardStatCard title="Study materials" value={o.studyMaterialsTotal} icon={FileStack} />
        <DashboardStatCard title="Subjects" value={o.subjectsTotal} icon={BookMarked} />
        <DashboardStatCard
          title="Active enrollments"
          value={o.activeEnrollments}
          description="Students enrolled in sections (active)"
          icon={Users}
        />
        <DashboardStatCard
          title="Submission rows"
          value={o.submissionsRows}
          description={`${o.submissionsFiled} filed (submitted or graded)`}
          icon={Send}
        />
        <DashboardStatCard title="Exams" value={o.examsTotal} icon={Trophy} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>LMS scale</CardTitle>
            <CardDescription>Key counts compared side by side</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scaleBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={BAR_FILL} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Courses</CardTitle>
              <CardDescription>Published vs draft</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] flex flex-col">
              {mixForChart.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  No courses yet
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mixForChart}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {mixForChart.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                    <span>Published: {o.coursesPublished}</span>
                    <span>Draft: {o.coursesDraft}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Submissions</CardTitle>
              <CardDescription>Per assignment–student slot</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] flex flex-col">
              {subPie.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  No submission rows yet
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={subPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {subPie.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                    <span>Filed: {o.submissionsFiled}</span>
                    <span>Pending: {Math.max(0, o.submissionsRows - o.submissionsFiled)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            How to read “enrollments”
          </CardTitle>
          <CardDescription>
            Active enrollments counts section placements for students in this school (same enrollment data used across
            academics). LMS courses link to classes and sections; there is no separate “course enrollment” table in
            this schema.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
