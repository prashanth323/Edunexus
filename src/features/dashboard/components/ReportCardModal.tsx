import { useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Printer, X, Award, Calendar, BookOpen, AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getParentReportCardAttendance, getParentReportCardExamResults } from "@/features/dashboard/api/dashboard.api"

type ParentChildRow = {
  student_id: string
  student_name: string
  first_name: string
  last_name: string
  gender: string | null
  date_of_birth: string | null
  blood_group: string | null
  nationality: string | null
  religion: string | null
  category: string | null
  phone: string | null
  email: string | null
  address: any
  medical_info: any
  class_name: string | null
  section_name: string | null
  attendance_pct_this_month: number | null
  pending_fees: number | null
}

type ReportCardModalProps = {
  child: ParentChildRow
  onClose: () => void
}

function unwrapFk<T extends Record<string, unknown>>(embedded: T | T[] | null | undefined): T | undefined {
  if (embedded == null) return undefined
  return Array.isArray(embedded) ? embedded[0] : embedded
}

function calendarDayKey(isoDate: unknown): string {
  if (isoDate == null) return ""
  const s = String(isoDate)
  const ymd = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return ymd?.[1] ?? s.slice(0, 10)
}

/** One calendar day counts as present if any attendance row that day is present or late (multi-subject rows). */
function summarizeAttendanceByDay(rows: { date?: unknown; status?: string | null }[]) {
  const dayPresent = new Map<string, boolean>()
  for (const r of rows) {
    const key = calendarDayKey(r.date)
    if (!key) continue
    const ok = ["present", "late"].includes((r.status ?? "").toLowerCase())
    dayPresent.set(key, ok || (dayPresent.get(key) ?? false))
  }
  const dates = [...dayPresent.keys()].filter(Boolean).sort()
  const totalDays = dates.length
  const presentDays = dates.filter((d) => dayPresent.get(d)).length
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0
  return { totalDays, presentDays, attendanceRate }
}

function formatStudentDob(value: string | null | undefined): string {
  if (value == null || String(value).trim() === "") return "—"
  const s = String(value)
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  if (!m?.[1]) return s
  const d = new Date(`${m[1]}T12:00:00`)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function resolveExamDisplay(res: any): {
  name: string
  maxMarks: number
  passingMarks: number | null
  subjectName: string
  isArchived: boolean
} {
  const exam = unwrapFk(res?.exams as Record<string, unknown> | Record<string, unknown>[] | undefined)
  const sub = unwrapFk(
    exam?.subjects as Record<string, unknown> | Record<string, unknown>[] | undefined,
  )

  const nameRaw = exam?.name != null ? String(exam.name) : "Exam"
  const archived = Boolean(exam?.deleted_at)

  return {
    name: archived ? `${nameRaw} (archived)` : nameRaw,
    maxMarks: Number(exam?.max_marks ?? 100),
    passingMarks: exam?.passing_marks != null ? Number(exam.passing_marks) : null,
    subjectName: sub?.name ? String(sub.name) : "Other",
    isArchived: archived,
  }
}

export function ReportCardModal({ child, onClose }: ReportCardModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null)
  const studentId = child.student_id

  const attendanceQuery = useQuery({
    queryKey: ["parent-report-card-attendance", studentId],
    queryFn: () => getParentReportCardAttendance(studentId),
    enabled: !!studentId,
  })

  const examsQuery = useQuery({
    queryKey: ["parent-report-card-exams", studentId],
    queryFn: () => getParentReportCardExamResults(studentId),
    enabled: !!studentId,
  })

  const reportLoading = attendanceQuery.isPending || examsQuery.isPending
  const reportError = attendanceQuery.error ?? examsQuery.error

  const studentAttendance = attendanceQuery.data ?? []
  const studentResults = (examsQuery.data ?? []) as any[]

  const { totalDays, presentDays, attendanceRate } = summarizeAttendanceByDay(studentAttendance)

  const totalObtained = studentResults.reduce((acc, r) => acc + Number(r.marks_obtained ?? 0), 0)
  const totalMax = studentResults.reduce((acc, r) => acc + resolveExamDisplay(r).maxMarks, 0)
  const academicRate = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0

  // Standard grade scale helper
  function getOverallGrade(percentage: number): { grade: string; description: string; color: string } {
    if (percentage >= 90) return { grade: "A+", description: "Outstanding Performance", color: "#10b981" }
    if (percentage >= 80) return { grade: "A", description: "Excellent Progress", color: "#059669" }
    if (percentage >= 70) return { grade: "B+", description: "Very Good Performance", color: "#3b82f6" }
    if (percentage >= 60) return { grade: "B", description: "Good Performance", color: "#2563eb" }
    if (percentage >= 50) return { grade: "C", description: "Satisfactory", color: "#f59e0b" }
    if (percentage >= 40) return { grade: "D", description: "Passing Threshold", color: "#d97706" }
    return { grade: "F", description: "Needs Significant Improvement", color: "#ef4444" }
  }

  const resultMeta = studentResults.length > 0
    ? getOverallGrade(academicRate)
    : { grade: "N/A", description: "No Graded Exams", color: "#9ca3af" }

  function handlePrint() {
    if (reportLoading || reportError) return
    const content = printAreaRef.current
    if (!content) return

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    // Get all style tags and link elements from parent document to ensure print matches design
    let stylesHtml = ""
    document.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
      stylesHtml += node.outerHTML
    })

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Academic Report Card - ${child.student_name}</title>
        ${stylesHtml}
        <style>
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { padding: 40px; background: white; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body class="bg-background flex items-center justify-center min-h-screen">
        <div class="w-full max-w-3xl border border-border rounded-2xl p-8 bg-card shadow-sm">${content.innerHTML}</div>
      </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 350)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-4xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b shrink-0">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Academic Report Card
            </CardTitle>
            <CardDescription>Preview and print your child's dynamic performance summary sheet.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={reportLoading || !!reportError}
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" /> Print / Save PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-y-auto p-6 bg-muted/20 flex-1 space-y-4">
          {reportLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-9 w-9 animate-spin text-primary" />
              <p className="text-sm font-medium text-center max-w-xs">
                Loading full attendance and exam history for printing (this may take a moment).
              </p>
            </div>
          ) : reportError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {reportError instanceof Error ? reportError.message : "Could not load report card data."}
              </span>
            </div>
          ) : null}

          {/* Printable Container */}
          {!reportLoading && !reportError ? (
          <div
            ref={printAreaRef}
            className="bg-background p-8 border rounded-2xl shadow-sm max-w-3xl mx-auto"
            style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
          >
            {/* Report Header */}
            <div className="text-center border-b-2 border-double pb-6 mb-6">
              <h1 className="text-2xl font-black tracking-tight text-primary uppercase">EduNexus Academy</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Official Academic Progress Report</p>
              <div className="text-[10px] text-muted-foreground mt-0.5">Term Session: 2026 Academic Year</div>
            </div>

            {/* Student metadata Grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 bg-muted/30 p-4 rounded-xl border border-muted text-sm mb-6">
              <div className="flex justify-between border-b border-dashed pb-1.5">
                <span className="font-semibold text-muted-foreground">Student Name</span>
                <span className="font-bold text-foreground">{child.student_name}</span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1.5">
                <span className="font-semibold text-muted-foreground">Class & Section</span>
                <span className="font-bold text-foreground">
                  {child.class_name} · Section {child.section_name || "A"}
                </span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1.5">
                <span className="font-semibold text-muted-foreground">Date of Birth</span>
                <span className="font-bold text-foreground">{formatStudentDob(child.date_of_birth)}</span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1.5">
                <span className="font-semibold text-muted-foreground">Blood Group</span>
                <span className="font-bold text-foreground">{child.blood_group || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1.5">
                <span className="font-semibold text-muted-foreground">Email Profile</span>
                <span className="font-bold text-foreground truncate max-w-[180px]">{child.email || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1.5">
                <span className="font-semibold text-muted-foreground">Mobile Contact</span>
                <span className="font-bold text-foreground">{child.phone || "—"}</span>
              </div>
            </div>

            {/* Academic Results Grid Table */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-primary" /> Subject-wise Examination Scores
              </h3>
              {studentResults.length === 0 ? (
                <div className="flex items-center gap-2 p-4 border rounded-xl bg-amber-500/5 text-amber-600 border-amber-500/20 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>No graded exam results recorded for this student yet. Report card fields will show empty fields.</span>
                </div>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted text-muted-foreground">
                      <th className="border p-2.5 text-left font-bold uppercase tracking-wider">Subject</th>
                      <th className="border p-2.5 text-left font-bold uppercase tracking-wider">Exam Title</th>
                      <th className="border p-2.5 text-center font-bold uppercase tracking-wider">Obtained Marks</th>
                      <th className="border p-2.5 text-center font-bold uppercase tracking-wider">Max Marks</th>
                      <th className="border p-2.5 text-center font-bold uppercase tracking-wider">Passing Marks</th>
                      <th className="border p-2.5 text-center font-bold uppercase tracking-wider">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentResults.map((res: any, idx: number) => {
                      const display = resolveExamDisplay(res)
                      const obtained = Number(res.marks_obtained ?? 0)
                      const max = display.maxMarks
                      const pass = display.passingMarks ?? 35
                      const absent = Boolean(res.is_absent)
                      const isFail = !absent && obtained < pass
                      const rowKey = String(res.id ?? `${res.student_id}-${res.exam_id}-${idx}`)

                      return (
                        <tr key={rowKey} className="hover:bg-muted/10">
                          <td className="border p-2.5 font-bold">{display.subjectName}</td>
                          <td className="border p-2.5">{display.name}</td>
                          <td className={`border p-2.5 text-center font-extrabold ${absent ? "text-muted-foreground" : isFail ? "text-destructive" : "text-emerald-500"}`}>
                            {absent ? "Absent" : obtained}
                          </td>
                          <td className="border p-2.5 text-center">{max}</td>
                          <td className="border p-2.5 text-center text-muted-foreground">{pass}</td>
                          <td className="border p-2.5 text-center font-extrabold">{res.grade || "N/A"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Attendance Overview */}
            <div className="mb-8">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" /> Session Attendance Summary
              </h3>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="border p-2.5 text-center font-bold uppercase tracking-wider">Total Working Days</th>
                    <th className="border p-2.5 text-center font-bold uppercase tracking-wider">Present Days</th>
                    <th className="border p-2.5 text-center font-bold uppercase tracking-wider">Absent Days</th>
                    <th className="border p-2.5 text-center font-bold uppercase tracking-wider">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2.5 text-center font-bold">{totalDays}</td>
                    <td className="border p-2.5 text-center text-emerald-500 font-bold">{presentDays}</td>
                    <td className="border p-2.5 text-center text-destructive font-bold">{totalDays - presentDays}</td>
                    <td className="border p-2.5 text-center font-extrabold text-primary">{attendanceRate}%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Aggregate Progress Card */}
            <div className="bg-gradient-to-br from-primary/5 to-indigo-500/5 border border-primary/20 rounded-xl p-5 grid grid-cols-2 gap-6 mb-8 text-xs">
              <div className="space-y-1">
                <h4 className="font-bold text-primary uppercase tracking-widest text-[10px]">Academic Standing</h4>
                <div className="text-2xl font-black text-foreground">
                  {studentResults.length > 0 ? `${academicRate}%` : "—"}
                </div>
                <div className="text-muted-foreground mt-0.5">
                  {studentResults.length > 0
                    ? `Overall Aggregate Score: ${totalObtained} / ${totalMax} Marks`
                    : "No graded marks available"}
                </div>
              </div>
              <div className="space-y-1 border-l pl-6">
                <h4 className="font-bold text-primary uppercase tracking-widest text-[10px]">Result Classification</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-2xl font-black text-foreground" style={{ color: resultMeta.color }}>
                    {resultMeta.grade}
                  </span>
                  <Badge variant="outline" className="text-[10px] py-0 px-2 font-bold whitespace-nowrap capitalize">
                    {resultMeta.description}
                  </Badge>
                </div>
                <div className="text-muted-foreground mt-0.5">
                  Passing Outcome: {studentResults.length > 0 ? (academicRate >= 40 ? "QUALIFIED / PASS" : "UNSATISFACTORY / FAIL") : "EVALUATION PENDING"}
                </div>
              </div>
            </div>

            {/* Signature Blocks */}
            <div className="flex justify-between mt-12 pt-8 border-t border-dashed">
              <div className="text-center w-40 border-t border-muted-foreground/30 pt-1.5 text-[10px] text-muted-foreground">
                Class Teacher Signature
              </div>
              <div className="text-center w-40 border-t border-muted-foreground/30 pt-1.5 text-[10px] text-muted-foreground">
                Principal Endorsement
              </div>
            </div>
          </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
