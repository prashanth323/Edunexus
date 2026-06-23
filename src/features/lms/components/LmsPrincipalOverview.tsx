import { useQuery } from "@tanstack/react-query"
import {
  BookOpen,
  BookMarked,
  ClipboardList,
  FileStack,
  GraduationCap,
  Layers,
  Loader2,
  NotebookPen,
  Pencil,
  Send,
  Trophy,
  Users,
} from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CourseCardSkeletonGrid } from "@/components/ui/card-skeleton"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getLmsPrincipalOverview, EMPTY_LMS_OVERVIEW, listStaffCourses, type LmsPrincipalOverview as Overview } from "../api/lms.api"
import { BookDistributionPanel } from "./BookDistributionPanel"

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground) / 0.35)"]
const BAR_FILL = "hsl(var(--primary) / 0.85)"

export function LmsPrincipalOverview() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const [showCourses, setShowCourses] = useState(false)

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

  const { data: allCourses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["lms-all-courses", activeSchoolId],
    queryFn: () => listStaffCourses(activeSchoolId!),
    enabled: !!activeSchoolId && showCourses,
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
    { label: "LMS assignments", value: o.assignmentsTotal },
    { label: "Daily homework", value: o.homeworkTotal ?? 0 },
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
            Course structure and learning-path workloads. Daily class homework lives under Homework dashboards and uses
            section enrollments separately from course lessons.
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
          onClick={() => setShowCourses(true)}
        />
        <DashboardStatCard title="Course lessons" value={o.lessonsTotal} icon={Layers} />
        <DashboardStatCard
          title="Learning-path assignments"
          value={o.assignmentsTotal}
          description={`${o.assignmentsPublished} published — tasks inside LMS courses`}
          icon={ClipboardList}
        />
        <DashboardStatCard
          title="Daily homework tasks"
          value={o.homeworkTotal ?? 0}
          description={`${o.homeworkPublished ?? 0} published — section roster`}
          icon={NotebookPen}
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
          title="Course submission slots"
          value={o.submissionsRows}
          description={`${o.submissionsFiled} filed for LMS assignments`}
          icon={Send}
        />
        <DashboardStatCard title="Exams" value={o.examsTotal} icon={Trophy} />
        <DashboardStatCard
          title="Daily homework submissions"
          value={o.homeworkSubmissionsRows ?? 0}
          description={`${o.homeworkSubmissionsFiled ?? 0} filed`}
          icon={Send}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>LMS scale</CardTitle>
            <CardDescription>Key LMS counts versus daily homework</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scaleBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={128} tick={{ fontSize: 12 }} />
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
              <CardTitle>LMS assignment submissions</CardTitle>
              <CardDescription>Per learning-path assignment and student slot</CardDescription>
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

      <Dialog open={showCourses} onOpenChange={setShowCourses}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>School courses</DialogTitle>
            <DialogDescription>
              All published and draft courses currently in {activeSchoolId ? "this school" : "the selected school"}.
            </DialogDescription>
          </DialogHeader>

          {loadingCourses ? (
            <CourseCardSkeletonGrid />
          ) : allCourses.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
              No courses found.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-4">
              {allCourses.map((c: any) => (
                <Card key={c.id} className="flex flex-col justify-between hover:border-primary/40 transition-colors overflow-hidden group">
                  {c.cover_url ? (
                    <div className="aspect-video w-full overflow-hidden border-b bg-muted">
                      <img 
                        src={c.cover_url} 
                        alt={c.title} 
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full flex items-center justify-center bg-muted/30 border-b">
                      <BookOpen className="h-10 w-10 text-muted-foreground/20" />
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex justify-between gap-2 items-start">
                      <Badge variant={c.is_published ? "default" : "secondary"}>{c.is_published ? "Published" : "Draft"}</Badge>
                      <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                    <CardTitle className="text-lg leading-tight">{c.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {(c as { subjects?: { name?: string } }).subjects?.name ?? "Class & section"}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="flex gap-2 border-t pt-4 mt-auto bg-muted/10">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link to={`/lms/courses/${c.id}`}>Open</Link>
                    </Button>
                    <Button variant="secondary" size="sm" className="flex-1 gap-1" asChild>
                      <Link to={`/lms/courses/${c.id}/edit`}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BookDistributionPanel />
    </div>
  )
}
