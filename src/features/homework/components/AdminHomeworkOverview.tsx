import { useQuery } from "@tanstack/react-query"
import { ClipboardList, Loader2, BarChart3 } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getLmsPrincipalOverview,
  listStaffCourses,
  EMPTY_LMS_OVERVIEW,
} from "@/features/lms/api/lms.api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function AdminHomeworkOverview() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  // 1. Fetch school-wide LMS statistics
  const { data: stats = EMPTY_LMS_OVERVIEW, isLoading: loadingStats } = useQuery({
    queryKey: ["lms-principal-overview", activeSchoolId],
    queryFn: () => getLmsPrincipalOverview(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  // 2. Fetch all courses to show curriculum progress
  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["lms-staff-courses", activeSchoolId],
    queryFn: () => listStaffCourses(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  if (!activeSchoolId) {
    return <p className="text-muted-foreground text-sm p-6 text-center">Select a school to access homework metrics.</p>
  }

  if (loadingStats || loadingCourses) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-semibold">Loading school academic compliance...</p>
      </div>
    )
  }

  const dailyHwCompliance =
    (stats.homeworkSubmissionsRows ?? 0) > 0 && stats.homeworkSubmissionsRows != null
      ? Math.round(((stats.homeworkSubmissionsFiled ?? 0) / stats.homeworkSubmissionsRows) * 100)
      : null

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto py-2">
      {/* Title */}
      <div className="border-b pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Homework Administration</h1>
        <p className="text-muted-foreground mt-1.5 font-medium">
          Daily homework roster (by class section) and LMS course assignment metrics — separate workloads.
        </p>
      </div>

      {/* Metrics Banner */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total courses</span>
            <CardTitle className="text-3xl font-black tracking-tight text-primary flex items-baseline gap-1">
              {stats.coursesTotal}
              <span className="text-xs font-semibold text-muted-foreground">LMS</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">LMS path assignments</span>
            <CardTitle className="text-3xl font-black tracking-tight text-indigo-600 flex items-baseline gap-1">
              {stats.assignmentsTotal}
              <span className="text-xs font-semibold text-muted-foreground">courses</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Daily homework</span>
            <CardTitle className="text-3xl font-black tracking-tight text-sky-600 flex items-baseline gap-1">
              {stats.homeworkTotal ?? 0}
              <span className="text-xs font-semibold text-muted-foreground">tasks</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">LMS submissions</span>
            <CardTitle className="text-3xl font-black tracking-tight text-emerald-600 flex items-baseline gap-1">
              {stats.submissionsFiled}
              <span className="text-xs font-semibold text-muted-foreground">filed</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Daily HW submissions</span>
            <CardTitle className="text-3xl font-black tracking-tight text-teal-600 flex items-baseline gap-1">
              {stats.homeworkSubmissionsFiled ?? 0}
              <span className="text-xs font-semibold text-muted-foreground">filed</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Daily HW turnout</span>
            <CardTitle className="text-3xl font-black tracking-tight text-amber-500">
              {dailyHwCompliance != null ? `${dailyHwCompliance}%` : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Roster & Compliance Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Course Roster and Homework counts */}
        <Card className="md:col-span-2 rounded-3xl border shadow-sm">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Course Curriculum Homework Tracking
            </CardTitle>
            <CardDescription className="text-xs">
              List of school courses, their published status, and assigned curriculum homework counts.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-16">No courses logged in this school.</p>
            ) : (
              <div className="divide-y divide-border">
                {courses.map((c) => (
                  <div key={c.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-foreground truncate max-w-sm sm:max-w-md">{c.title}</h4>
                      <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                        {(c as any).subjects?.name ?? "Subject"}
                        {(() => {
                          const cn = (c as any).classes?.name ?? null
                          const sn = (c as any).sections?.name ?? null
                          if (!cn && !sn) return null
                          const bits = [cn, sn ? `Section ${sn}` : null].filter(Boolean)
                          return bits.length ? ` · ${bits.join(" · ")}` : ""
                        })()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={c.is_published ? "default" : "secondary"} className="text-[9px] font-bold uppercase tracking-wider">
                        {c.is_published ? "Published" : "Draft"}
                      </Badge>
                      <Badge variant="outline" className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-muted/20">
                        Class Course
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Administration Guidelines Panel */}
        <div className="space-y-6">
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader className="bg-indigo-50/40 dark:bg-indigo-950/10 border-b pb-4">
              <CardTitle className="text-base font-extrabold text-indigo-800 flex items-center gap-2">
                <BarChart3 className="h-4.5 w-4.5" />
                Syllabus Oversight
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs leading-relaxed text-muted-foreground">
              <p>
                As a principal or school administrator, you have complete oversight over course curriculum and syllabus distribution.
              </p>
              <div className="space-y-2.5 pt-2">
                <div className="flex items-start gap-2.5">
                  <div className="h-5 w-5 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-800 text-[10px]">1</div>
                  <p>Assignments and quizzes can be posted under each class course syllabus.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="h-5 w-5 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-800 text-[10px]">2</div>
                  <p>Monitor submission metrics to identify underperforming or low-engagement courses.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="h-5 w-5 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-800 text-[10px]">3</div>
                  <p>Class teachers enter grades and comments which are instantly synchronized to students and parents.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
