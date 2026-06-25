import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Calendar as CalendarIcon, CheckCircle2, Loader2, Save, UserMinus } from "lucide-react"
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
import { hasClassTeacherCapabilities } from "@/features/auth/lib/schoolRoles"
import { cn } from "@/lib/utils"
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
import { ATTENDANCE_STATUS_BADGE_CLASSES } from "../lib/dailyAttendanceRead"

const EMPTY_SECTIONS: SectionOption[] = []
const EMPTY_ROSTER: EnrolledStudentRow[] = []
const EMPTY_EXISTING: { student_id: string; status: string; remarks: string | null }[] = []

const RECEPTIONIST_STATUSES = new Set(["late", "half_day"])

function isReceptionistStatus(status: string | undefined) {
  return !!status && RECEPTIONIST_STATUSES.has(status)
}

export function AttendanceMarkingTeacherView() {
  const queryClient = useQueryClient()
  const { user, activeSchoolId, schoolRoles } = useAuth()
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
    queryKey: ["sections-year", activeSchoolId, academicYearId, schoolRoles, user?.id],
    queryFn: async () => {
      const all = await getSectionsForYear(activeSchoolId!, academicYearId!)
      if (!hasClassTeacherCapabilities(schoolRoles) || !user?.id) return all
      const { supabase } = await import("@/lib/supabase")
      const { data: staff } = await supabase
        .from("staff")
        .select("id")
        .eq("profile_id", user.id)
        .eq("school_id", activeSchoolId!)
        .maybeSingle()
      if (!staff?.id) return all
      const { data: assigned } = await supabase
        .from("sections")
        .select("id")
        .eq("class_teacher_id", staff.id)
      const ids = new Set((assigned ?? []).map((s) => s.id))
      return all.filter((s) => ids.has(s.id))
    },
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

  const remarksByStudent = useMemo(() => {
    const map: Record<string, string | null> = {}
    for (const row of existingRows) {
      map[row.student_id] = row.remarks
    }
    return map
  }, [existingRows])

  const receptionistLocked = useMemo(() => {
    const set = new Set<string>()
    for (const row of existingRows) {
      if (isReceptionistStatus(row.status)) set.add(row.student_id)
    }
    return set
  }, [existingRows])

  useEffect(() => {
    if (!roster.length) {
      setAttendanceMap({})
      return
    }
    const next: Record<string, DailyAttendanceStatus> = {}
    for (const s of roster) {
      const hit = existingRows.find((r) => r.student_id === s.id)
      const st = hit?.status
      if (isReceptionistStatus(st)) {
        next[s.id] = st as DailyAttendanceStatus
      } else if (st === "present" || st === "absent") {
        next[s.id] = st
      } else if (st === "excused" || st === "holiday") {
        next[s.id] = "present"
      } else {
        next[s.id] = "present"
      }
    }
    setAttendanceMap(next)
  }, [roster, existingRows])

  const getEffectiveStatus = (studentId: string): DailyAttendanceStatus => {
    return attendanceMap[studentId] ?? "present"
  }

  const handleStatusChange = (studentId: string, status: DailyAttendanceStatus) => {
    if (receptionistLocked.has(studentId)) return
    if (status !== "present" && status !== "absent") return
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }))
  }

  const markAll = (status: DailyAttendanceStatus) => {
    setAttendanceMap((prev) => {
      const next = { ...prev }
      roster.forEach((s) => {
        if (!receptionistLocked.has(s.id)) {
          next[s.id] = status
        }
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
      const rows = roster
        .filter((s) => !receptionistLocked.has(s.id))
        .map((s) => ({
          school_id: activeSchoolId,
          student_id: s.id,
          section_id: sectionId,
          academic_year_id: academicYearId,
          date,
          status: attendanceMap[s.id] ?? "present",
          marked_by: user.id,
        }))
      if (rows.length > 0) {
        await upsertDailyAttendanceBatch(rows)
      }
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
    const vals = roster.map((s) => getEffectiveStatus(s.id))
    return {
      present: vals.filter((v) => v === "present").length,
      absent: vals.filter((v) => v === "absent").length,
      late: vals.filter((v) => v === "late").length,
      half: vals.filter((v) => v === "half_day").length,
    }
  }, [roster, attendanceMap])

  const absentToday = useMemo(
    () =>
      roster.filter((s) => getEffectiveStatus(s.id) === "absent").sort((a, b) => {
        const ra = a.roll_number ?? ""
        const rb = b.roll_number ?? ""
        return ra.localeCompare(rb, undefined, { numeric: true })
      }),
    [roster, attendanceMap],
  )

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
          Mark present or absent for your section. Late and half-day are marked by reception.
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
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <UserMinus className="h-3.5 w-3.5" />
                Absent today
              </h4>
              {tableLoading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : absentToday.length === 0 ? (
                <p className="text-xs text-muted-foreground">No absent students.</p>
              ) : (
                <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                  {absentToday.map((s) => (
                    <li key={s.id} className="flex gap-2">
                      <span className="font-mono text-muted-foreground w-8 shrink-0">
                        {s.roll_number ?? "—"}
                      </span>
                      <span>
                        {s.first_name} {s.last_name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

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
              <TableSkeletonRows rows={6} cols={4} />
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
                      <TableHead className="text-center min-w-[200px]">Status</TableHead>
                      <TableHead className="min-w-[160px]">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.map((student) => {
                      const status = getEffectiveStatus(student.id)
                      const locked = receptionistLocked.has(student.id)
                      const showRemarks = status === "late" || status === "half_day"
                      const remarks = remarksByStudent[student.id]

                      return (
                        <TableRow
                          key={student.id}
                          className={cn(
                            status === "absent" && "bg-destructive/5",
                            status === "late" && "bg-yellow-500/10",
                            status === "half_day" && "bg-muted/50",
                          )}
                        >
                          <TableCell className="font-medium">
                            {student.roll_number ?? "—"}
                          </TableCell>
                          <TableCell>
                            {student.first_name} {student.last_name}
                          </TableCell>
                          <TableCell>
                            {locked ? (
                              <div className="flex justify-center">
                                <Badge
                                  className={`capitalize ${ATTENDANCE_STATUS_BADGE_CLASSES[status] ?? ""}`}
                                >
                                  {status.replace(/_/g, " ")}
                                </Badge>
                                <span className="sr-only">Marked by reception</span>
                              </div>
                            ) : (
                              <div className="flex justify-center flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  type="button"
                                  variant={status === "present" ? "default" : "outline"}
                                  className={
                                    status === "present" ? "bg-green-600 hover:bg-green-700" : ""
                                  }
                                  onClick={() => handleStatusChange(student.id, "present")}
                                >
                                  Present
                                </Button>
                                <Button
                                  size="sm"
                                  type="button"
                                  variant={status === "absent" ? "destructive" : "outline"}
                                  onClick={() => handleStatusChange(student.id, "absent")}
                                >
                                  Absent
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {showRemarks && remarks ? remarks : showRemarks ? "—" : ""}
                          </TableCell>
                        </TableRow>
                      )
                    })}
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
