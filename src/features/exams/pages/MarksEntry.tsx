import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Loader2, Save, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getExamWithDetails,
  getStudentsForSection,
  getExamResults,
  bulkSaveMarks,
  calculateGrade,
  type ExamResult,
} from "../api/exams.api"

type MarkRow = {
  student_id: string
  first_name: string
  last_name: string
  admission_no: string
  marks_obtained: number
  grade: string | null
  remarks: string | null
}

export function MarksEntry() {
  const { examId } = useParams<{ examId: string }>()
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [marks, setMarks] = useState<MarkRow[]>([])
  const [saving, setSaving] = useState(false)

  // Guard against non-staff roles
  const canManage = !!(
    activeRole &&
    new Set(["principal", "school_admin", "teacher", "class_teacher", "vice_principal"]).has(activeRole)
  )

  useEffect(() => {
    if (!canManage) {
      toast.error("You do not have permission to enter marks.")
      navigate("/exams", { replace: true })
    }
  }, [canManage, navigate])

  if (!canManage) {
    return null
  }

  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ["exam-detail", examId],
    queryFn: () => getExamWithDetails(examId!),
    enabled: !!examId,
  })

  const sectionId = exam?.section_id

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["section-students", sectionId],
    queryFn: () => getStudentsForSection(sectionId!),
    enabled: !!sectionId,
  })

  const { data: existingResults } = useQuery({
    queryKey: ["exam-results", examId],
    queryFn: () => getExamResults(examId!),
    enabled: !!examId,
  })

  // Initialize marks when data loads
  useEffect(() => {
    if (!students || !exam) return

    const resultMap = new Map<string, ExamResult>()
    existingResults?.forEach((r) => {
      resultMap.set(r.student_id, r)
    })

    const rows: MarkRow[] = students.map((s: any) => {
      const existing = resultMap.get(s.id)
      return {
        student_id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        admission_no: s.admission_no,
        marks_obtained: existing?.marks_obtained ?? 0,
        grade: existing?.grade ?? null,
        remarks: existing?.remarks ?? null,
      }
    })

    setMarks(rows.sort((a, b) => a.first_name.localeCompare(b.first_name)))
  }, [students, existingResults, exam])

  function updateMark(index: number, field: keyof MarkRow, value: unknown) {
    setMarks((prev) => {
      const copy = [...prev]
      const row = { ...copy[index]!, [field]: value }

      // Auto-calculate grade when marks change
      if (field === "marks_obtained" && exam) {
        row.grade = calculateGrade(Number(value), exam.max_marks)
      }
      copy[index] = row
      return copy
    })
  }

  async function handleSave() {
    if (!examId || !activeSchoolId) return
    setSaving(true)
    try {
      await bulkSaveMarks(
        examId,
        activeSchoolId,
        marks.map((m) => ({
          student_id: m.student_id,
          marks_obtained: m.marks_obtained,
          grade: m.grade,
          remarks: m.remarks,
        })),
      )
      toast.success("Marks saved successfully")
      qc.invalidateQueries({ queryKey: ["exam-results", examId] })
    } catch (err: any) {
      toast.error(err.message || "Failed to save marks")
    } finally {
      setSaving(false)
    }
  }

  const isLoading = examLoading || studentsLoading

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
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

  const secRaw = Array.isArray(exam.sections) ? exam.sections[0] : exam.sections
  const secObj = secRaw && typeof secRaw === "object" ? secRaw as Record<string, any> : null
  const clsRaw = secObj?.classes
  const clsObj = Array.isArray(clsRaw) ? clsRaw[0] : clsRaw
  const classLabel = `${clsObj?.name || "?"} — ${secObj?.name || "?"}`

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/exams"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Marks Entry</h1>
            <p className="text-muted-foreground mt-0.5 flex items-center gap-2">
              {exam.name}
              <Badge variant="outline" className="text-[10px]">{classLabel}</Badge>
              <Badge variant="secondary" className="text-[10px]">Max: {exam.max_marks}</Badge>
            </p>
          </div>
        </div>
        <Button className="gap-2 shrink-0" onClick={handleSave} disabled={saving || marks.length === 0}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save All Marks
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Marks ({marks.length} students)</CardTitle>
          <CardDescription>Enter marks for each student. Grades auto-calculate. Don't forget to save!</CardDescription>
        </CardHeader>
        <CardContent>
          {marks.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              <p>No students enrolled in this section.</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-3 font-medium w-8">#</th>
                    <th className="p-3 font-medium">Student</th>
                    <th className="p-3 font-medium">Adm. No</th>
                    <th className="p-3 font-medium w-28">Marks</th>
                    <th className="p-3 font-medium w-20">Grade</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {marks.map((row, i) => {
                    const passed = exam.passing_marks != null ? row.marks_obtained >= exam.passing_marks : true
                    return (
                      <tr key={row.student_id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-3 text-muted-foreground">{i + 1}</td>
                        <td className="p-3 font-medium">{row.first_name} {row.last_name}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{row.admission_no}</td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min={0}
                            max={exam.max_marks}
                            value={row.marks_obtained}
                            onChange={(e) => updateMark(i, "marks_obtained", Number(e.target.value))}
                            className="h-8 w-20"
                          />
                        </td>
                        <td className="p-3">
                          <Badge variant={row.grade === "F" ? "destructive" : "secondary"} className="text-xs">
                            {row.grade || "—"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {passed ? (
                            <span className="text-green-600 text-xs flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Pass
                            </span>
                          ) : (
                            <span className="text-destructive text-xs">Fail</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Input
                            value={row.remarks || ""}
                            onChange={(e) => updateMark(i, "remarks", e.target.value || null)}
                            placeholder="Optional"
                            className="h-8"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
