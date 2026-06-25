import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Trophy, TrendingUp, Users, BarChart3, Award } from "lucide-react"
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

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { hasAnySchoolRole } from "@/features/auth/lib/schoolRoles"
import { getExamWithDetails, getExamResults } from "../api/exams.api"
import { getPortalStudentIds } from "@/features/students/api/portalStudents.api"

const GRADE_COLORS: Record<string, string> = {
  "A+": "#22c55e",
  A: "#4ade80",
  "B+": "#60a5fa",
  B: "#93c5fd",
  C: "#fbbf24",
  D: "#fb923c",
  F: "#ef4444",
}

const PIE_COLORS = ["#22c55e", "#ef4444"]

export function ExamResults() {
  const { examId } = useParams<{ examId: string }>()
  const activeRole = useAuth((s) => s.activeRole)
  const schoolRoles = useAuth((s) => s.schoolRoles)
  const user = useAuth((s) => s.user)
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const isPortalViewer = activeRole === "parent" || activeRole === "student"

  const canManage =
    hasAnySchoolRole(schoolRoles, ["teacher", "class_teacher"]) ||
    !!(
      activeRole &&
      new Set(["principal", "school_admin", "vice_principal"]).has(activeRole)
    )

  const { data: portalStudentIds = [] } = useQuery({
    queryKey: ["portal-student-ids", user?.id, activeSchoolId, activeRole],
    queryFn: () => getPortalStudentIds(user!.id, activeSchoolId!, activeRole!),
    enabled: !!isPortalViewer && !!user?.id && !!activeSchoolId && !!activeRole,
  })

  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ["exam-detail", examId],
    queryFn: () => getExamWithDetails(examId!),
    enabled: !!examId,
  })

  const { data: results = [], isLoading: resultsLoading } = useQuery({
    queryKey: ["exam-results", examId],
    queryFn: () => getExamResults(examId!),
    enabled: !!examId,
  })

  const isLoading = examLoading || resultsLoading

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <h2 className="text-xl font-semibold">Exam not found</h2>
        <Button asChild variant="outline"><Link to="/exams">← Back to exams</Link></Button>
      </div>
    )
  }

  // Compute analytics (portal viewers only see their own / linked children's rows)
  const portalIdSet = new Set(portalStudentIds)
  const visibleResults = isPortalViewer
    ? results.filter((r) => portalIdSet.has(r.student_id))
    : results

  const sorted = [...visibleResults].sort((a, b) => b.marks_obtained - a.marks_obtained)
  const totalStudents = visibleResults.length
  const avgMarks = totalStudents > 0 ? visibleResults.reduce((s, r) => s + r.marks_obtained, 0) / totalStudents : 0
  const passed = exam.passing_marks != null ? visibleResults.filter((r) => r.marks_obtained >= exam.passing_marks!).length : totalStudents
  const failed = totalStudents - passed
  const passRate = totalStudents > 0 ? (passed / totalStudents) * 100 : 0
  const topScore = sorted[0]?.marks_obtained ?? 0

  // Grade distribution
  const gradeCounts: Record<string, number> = {}
  visibleResults.forEach((r) => {
    const g = r.grade || "?"
    gradeCounts[g] = (gradeCounts[g] || 0) + 1
  })
  const gradeData = Object.entries(gradeCounts)
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => {
      const order = ["A+", "A", "B+", "B", "C", "D", "F"]
      return order.indexOf(a.grade) - order.indexOf(b.grade)
    })

  // Pass/Fail pie
  const passFailData = [
    { name: "Passed", value: passed },
    { name: "Failed", value: failed },
  ].filter((d) => d.value > 0)

  // Rank list
  const ranked = sorted.map((r, i) => ({
    ...r,
    rank: i + 1,
    student: Array.isArray(r.students) ? r.students[0] : r.students,
  }))

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/exams"><ArrowLeft className="h-5 w-5" /></Link></Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {isPortalViewer ? "My exam result" : "Results & Analytics"}
          </h1>
          <p className="text-muted-foreground mt-0.5">
            {exam.name}
            <Badge variant="outline" className="ml-2 text-[10px] capitalize">{exam.exam_type.replace(/_/g, " ")}</Badge>
          </p>
        </div>
      </div>

      {totalStudents === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          <BarChart3 className="h-14 w-14 opacity-30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            {isPortalViewer ? "No result posted yet" : "No results entered yet"}
          </h3>
          <p className="text-sm mt-1 mb-4">
            {isPortalViewer
              ? "Your marks for this exam have not been published yet."
              : canManage
                ? "Enter marks first to see analytics and rankings."
                : "Marks have not been posted for this exam yet."}
          </p>
          {canManage && (
            <Button asChild variant="outline">
              <Link to={`/exams/${examId}/marks`}>Enter Marks</Link>
            </Button>
          )}
        </div>
      ) : isPortalViewer ? (
        <div className="space-y-4">
          {ranked.map((r) => {
            const isPassed =
              exam.passing_marks != null ? r.marks_obtained >= exam.passing_marks : true
            const student = r.student
            return (
              <Card key={r.id}>
                <CardHeader>
                  <CardTitle>
                    {student ? `${student.first_name} ${student.last_name}` : "Your result"}
                  </CardTitle>
                  <CardDescription>
                    {student?.admission_no ? `Admission no. ${student.admission_no}` : exam.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Marks: </span>
                    <span className="font-semibold">
                      {r.marks_obtained} / {exam.max_marks}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Grade: </span>
                    <Badge variant={r.grade === "F" ? "destructive" : "secondary"}>{r.grade || "—"}</Badge>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status: </span>
                    <span className={isPassed ? "text-green-600" : "text-destructive"}>
                      {isPassed ? "Pass" : "Fail"}
                    </span>
                  </p>
                  {r.remarks ? (
                    <p className="sm:col-span-2">
                      <span className="text-muted-foreground">Remarks: </span>
                      {r.remarks}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Students</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalStudents}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Marks</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgMarks.toFixed(1)} / {exam.max_marks}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${passRate >= 70 ? "text-green-600" : passRate >= 50 ? "text-amber-600" : "text-destructive"}`}>
                  {passRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">{passed} passed / {failed} failed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Highest Score</CardTitle>
                <Trophy className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{topScore} / {exam.max_marks}</div>
                {ranked[0]?.student && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {ranked[0].student.first_name} {ranked[0].student.last_name}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Grade Distribution</CardTitle>
                <CardDescription>Number of students per grade</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Students">
                      {gradeData.map((entry) => (
                        <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] || "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pass / Fail</CardTitle>
                <CardDescription>Overall pass rate visualization</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex flex-col">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={passFailData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {passFailData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
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
                  <span>✅ Passed: {passed}</span>
                  <span>❌ Failed: {failed}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rank list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Rank List
              </CardTitle>
              <CardDescription>Students ranked by marks obtained</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="p-3 font-medium w-16">Rank</th>
                      <th className="p-3 font-medium">Student</th>
                      <th className="p-3 font-medium">Adm. No</th>
                      <th className="p-3 font-medium text-right">Marks</th>
                      <th className="p-3 font-medium">Grade</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((r) => {
                      const isPassed = exam.passing_marks != null ? r.marks_obtained >= exam.passing_marks : true
                      return (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="p-3">
                            <div className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold ${
                              r.rank === 1 ? "bg-amber-100 text-amber-700" :
                              r.rank === 2 ? "bg-gray-100 text-gray-700" :
                              r.rank === 3 ? "bg-orange-100 text-orange-700" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {r.rank}
                            </div>
                          </td>
                          <td className="p-3 font-medium">
                            {r.student?.first_name} {r.student?.last_name}
                          </td>
                          <td className="p-3 font-mono text-xs text-muted-foreground">
                            {r.student?.admission_no}
                          </td>
                          <td className="p-3 text-right font-semibold">
                            {r.marks_obtained} / {exam.max_marks}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={r.grade === "F" ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              {r.grade || "—"}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <span className={`text-xs ${isPassed ? "text-green-600" : "text-destructive"}`}>
                              {isPassed ? "Pass" : "Fail"}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">{r.remarks || "—"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
