import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getStudentServiceByAdmissionNo } from "@/features/students/api/studentService.api"
import {
  getCurrentAcademicYearId,
  upsertReceptionistAttendance,
  type DailyAttendanceStatus,
} from "../api/attendance.api"

export function ReceptionistAttendancePanel() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const user = useAuth((s) => s.user)
  const qc = useQueryClient()

  const [query, setQuery] = useState("")
  const [searchNo, setSearchNo] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState<"late" | "half_day">("late")
  const [remarks, setRemarks] = useState("")

  const { data: student, isFetching, isError, error } = useQuery({
    queryKey: ["receptionist-attendance-lookup", activeSchoolId, searchNo],
    queryFn: () => getStudentServiceByAdmissionNo(activeSchoolId!, searchNo),
    enabled: !!activeSchoolId && searchNo.trim().length >= 3,
    retry: false,
  })

  const { data: academicYearId } = useQuery({
    queryKey: ["academic-year-current", activeSchoolId],
    queryFn: () => getCurrentAcademicYearId(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  useEffect(() => {
    setRemarks("")
  }, [student?.id, status])

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!activeSchoolId || !student || !user?.id) throw new Error("Missing context")
      const sectionId = student.section_id
      const yearId = student.academic_year_id || academicYearId
      if (!sectionId || !yearId) throw new Error("Student has no active section enrollment")

      await upsertReceptionistAttendance({
        school_id: activeSchoolId,
        student_id: student.student_id,
        section_id: sectionId,
        academic_year_id: yearId,
        date,
        status: status as DailyAttendanceStatus,
        marked_by: user.id,
        remarks: remarks.trim(),
      })
    },
    onSuccess: () => {
      toast.success("Attendance updated")
      setRemarks("")
      qc.invalidateQueries({ queryKey: ["section-attendance-snapshot", activeSchoolId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!activeSchoolId) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance marking</h1>
        <p className="text-muted-foreground mt-1">
          Look up a student by admission number and mark late or half-day with remarks. Updates apply immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Student lookup</CardTitle>
          <CardDescription>Enter admission number (min. 3 characters)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-lg">
          <div className="flex gap-2">
            <Input
              placeholder="Admission no."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearchNo(query.trim())}
            />
            <Button type="button" onClick={() => setSearchNo(query.trim())} disabled={query.trim().length < 3}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {isFetching && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </p>
          )}
          {isError && (
            <p className="text-sm text-destructive">{(error as Error)?.message ?? "Student not found"}</p>
          )}

          {student && (
            <div className="rounded-md border p-3 space-y-3">
              <div>
                <p className="font-medium">
                  {student.first_name} {student.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Adm. {student.admission_no} · {[student.class_name, student.section_name].filter(Boolean).join(" - ")}
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="recv-status"
                    checked={status === "late"}
                    onChange={() => setStatus("late")}
                  />
                  Late
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="recv-status"
                    checked={status === "half_day"}
                    onChange={() => setStatus("half_day")}
                  />
                  Half day
                </label>
              </div>

              <div className="grid gap-1.5">
                <Label>Remarks (required)</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Reason for late arrival or half-day leave"
                  rows={3}
                />
              </div>

              <Button
                onClick={() => saveMut.mutate()}
                disabled={!remarks.trim() || saveMut.isPending}
              >
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save attendance
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
