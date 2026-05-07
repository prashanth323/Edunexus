import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Calendar as CalendarIcon, CheckCircle2, Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TableSkeletonRows } from "@/components/ui/card-skeleton"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getCurrentAcademicYearId,
  getDailyAttendanceForSectionDate,
  getEnrolledStudentsForSection,
  getSectionsForYear,
  upsertDailyAttendanceBatch,
  type DailyAttendanceStatus,
  type EnrolledStudentRow,
  type SectionOption,
} from "../api/attendance.api"

/** Stable defaults so useQuery fallbacks don't allocate new [] each render (breaks effects). */
const EMPTY_SECTIONS: SectionOption[] = []
const EMPTY_ROSTER: EnrolledStudentRow[] = []
const EMPTY_EXISTING: { student_id: string; status: string }[] = []

export function AttendanceMarkingTeacherView() {
  const queryClient = useQueryClient()
  const { user, activeSchoolId } = useAuth()
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [attendanceMap, setAttendanceMap] = useState<Record<string, DailyAttendanceStatus>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: academicYearId, isLoading: yearLoading } = useQuery({
    queryKey: ["academic-year-current", activeSchoolId],
    queryFn: () => getCurrentAcademicYearId(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: sectionsData, isLoading: sectionsLoading } = useQuery({
    queryKey: ["sections-year", activeSchoolId, academicYearId],
    queryFn: () => getSectionsForYear(activeSchoolId!, academicYearId!),
    enabled: !!activeSchoolId && !!academicYearId,
  })
  const sections = sectionsData ?? EMPTY_SECTIONS

  useEffect(() => {
    if (sections.length && !sectionId) {
      setSectionId(sections[0].id)
    }
  }, [sections, sectionId])

  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ["enrollment-roster", activeSchoolId, sectionId, academicYearId],
    queryFn: () =>
      getEnrolledStudentsForSection(activeSchoolId!, sectionId!, academicYearId!),
    enabled: !!activeSchoolId && !!sectionId && !!academicYearId,
  })
  const roster = rosterData ?? EMPTY_ROSTER

  const { data: existingRowsData, isLoading: existingLoading } = useQuery({
    queryKey: ["attendance-existing", activeSchoolId, sectionId, date],
    queryFn: () =>
      getDailyAttendanceForSectionDate(activeSchoolId!, sectionId!, date),
    enabled: !!activeSchoolId && !!sectionId && !!date,
  })
  const existingRows = existingRowsData ?? EMPTY_EXISTING

  useEffect(() => {
    if (!roster.length) {
      setAttendanceMap({})
      return
    }
    const next: Record<string, DailyAttendanceStatus> = {}
    for (const s of roster) {
      const hit = existingRows.find((r) => r.student_id === s.id)
      const st = hit?.status
      if (st === "present" || st === "absent" || st === "late" || st === "half_day") {
        next[s.id] = st
      } else if (st === "excused" || st === "holiday") {
        next[s.id] = "present"
      } else {
        next[s.id] = "present"
      }
    }
    setAttendanceMap(next)
  }, [roster, existingRows])

  const handleStatusChange = (studentId: string, status: DailyAttendanceStatus) => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }))
  }

  const markAll = (status: DailyAttendanceStatus) => {
    setAttendanceMap((prev) => {
      const next = { ...prev }
      roster.forEach((s) => {
        next[s.id] = status
      })
      return next
    })
  }

  const handleSave = async () => {
    if (!activeSchoolId || !sectionId || !academicYearId || !user?.id) {
      toast.error("Missing school, section, or sign-in")
      return
    }
    setIsSubmitting(true)
    try {
      const rows = roster.map((s) => ({
        school_id: activeSchoolId,
        student_id: s.id,
        section_id: sectionId,
        academic_year_id: academicYearId,
        date,
        status: attendanceMap[s.id] ?? "present",
        marked_by: user.id,
      }))
      await upsertDailyAttendanceBatch(rows)
      await queryClient.invalidateQueries({
        queryKey: ["attendance-existing", activeSchoolId, sectionId, date],
      })
      toast.success("Attendance saved successfully")
    } catch (e) {
      console.error(e)
      toast.error("Failed to save attendance")
    } finally {
      setIsSubmitting(false)
    }
  }

  const stats = useMemo(() => {
    const vals = Object.values(attendanceMap)
    return {
      present: vals.filter((v) => v === "present").length,
      absent: vals.filter((v) => v === "absent").length,
      late: vals.filter((v) => v === "late").length,
      half: vals.filter((v) => v === "half_day").length,
    }
  }, [attendanceMap])

  const sectionLoading = yearLoading || sectionsLoading
  const tableLoading = rosterLoading || existingLoading

  const selectedSectionLabel = sections.find((s) => s.id === sectionId)

  if (!activeSchoolId) {
    return (
      <p className="text-muted-foreground text-sm">Select a school to mark attendance.</p>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daily Attendance</h1>
        <p className="text-muted-foreground mt-1">
          Mark attendance for a section and date. Data is stored per student per day.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4 items-start">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Class details</CardTitle>
            <CardDescription>Select section and date</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="attendance-date">
                Date
              </label>
              <div className="relative">
                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="attendance-date"
                  type="date"
                  className="pl-9"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="section-select">
                Section
              </label>
              {sectionLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading sections…
                </div>
              ) : !academicYearId ? (
                <p className="text-sm text-muted-foreground">
                  No academic year configured for this school.
                </p>
              ) : (
                <select
                  id="section-select"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={sectionId ?? ""}
                  onChange={(e) => setSectionId(e.target.value || null)}
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.class_name} — {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedSectionLabel && (
              <p className="text-xs text-muted-foreground">
                {selectedSectionLabel.class_name} · Section {selectedSectionLabel.name}
              </p>
            )}

            <div className="pt-4 border-t space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Quick stats</h4>
              <div className="flex justify-between items-center text-sm">
                <span>Present</span>
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                  {stats.present}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Absent</span>
                <Badge variant="destructive">{stats.absent}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Late</span>
                <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  {stats.late}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Half day</span>
                <Badge variant="outline">{stats.half}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Students</CardTitle>
              <CardDescription>Active enrollments in this section</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAll("present")}
                className="text-green-600 dark:text-green-500"
                type="button"
                disabled={!roster.length}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark all present
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tableLoading ? (
              <TableSkeletonRows rows={6} cols={3} />
            ) : !roster.length ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No active students in this section for the current academic year.
              </p>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Roll No.</TableHead>
                      <TableHead>Student name</TableHead>
                      <TableHead className="text-center min-w-[280px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.roll_number ?? "—"}
                        </TableCell>
                        <TableCell>
                          {student.first_name} {student.last_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center flex-wrap gap-2">
                            <Button
                              size="sm"
                              type="button"
                              variant={
                                attendanceMap[student.id] === "present" ? "default" : "outline"
                              }
                              className={
                                attendanceMap[student.id] === "present"
                                  ? "bg-green-600 hover:bg-green-700"
                                  : ""
                              }
                              onClick={() => handleStatusChange(student.id, "present")}
                            >
                              Present
                            </Button>
                            <Button
                              size="sm"
                              type="button"
                              variant={
                                attendanceMap[student.id] === "absent" ? "destructive" : "outline"
                              }
                              onClick={() => handleStatusChange(student.id, "absent")}
                            >
                              Absent
                            </Button>
                            <Button
                              size="sm"
                              type="button"
                              variant={
                                attendanceMap[student.id] === "late" ? "secondary" : "outline"
                              }
                              className={
                                attendanceMap[student.id] === "late"
                                  ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                                  : ""
                              }
                              onClick={() => handleStatusChange(student.id, "late")}
                            >
                              Late
                            </Button>
                            <Button
                              size="sm"
                              type="button"
                              variant={
                                attendanceMap[student.id] === "half_day" ? "secondary" : "outline"
                              }
                              onClick={() => handleStatusChange(student.id, "half_day")}
                            >
                              Half day
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSave}
                disabled={
                  isSubmitting || !roster.length || !sectionId || !academicYearId || !user?.id
                }
                className="w-full md:w-auto"
                type="button"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save attendance
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
