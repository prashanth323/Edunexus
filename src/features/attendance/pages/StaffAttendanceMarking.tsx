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
import { getCurrentAcademicYearId } from "../api/attendance.api"
import {
  getActiveStaffForSchool,
  getStaffAttendanceForDate,
  upsertStaffAttendanceBatch,
  type StaffAttendanceStatus,
  type StaffRow,
} from "../api/staff-attendance.api"

const EMPTY_STAFF: StaffRow[] = []
const EMPTY_EXISTING: { staff_id: string; status: string; remarks: string | null }[] = []

export function StaffAttendanceMarking() {
  const queryClient = useQueryClient()
  const { user, activeSchoolId } = useAuth()
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, StaffAttendanceStatus>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: academicYearId, isLoading: yearLoading } = useQuery({
    queryKey: ["academic-year-current", activeSchoolId],
    queryFn: () => getCurrentAcademicYearId(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ["staff-attendance-roster", activeSchoolId],
    queryFn: () => getActiveStaffForSchool(activeSchoolId!),
    enabled: !!activeSchoolId,
  })
  const staff = staffData ?? EMPTY_STAFF

  const { data: existingData, isLoading: existingLoading } = useQuery({
    queryKey: ["staff-attendance-existing", activeSchoolId, date],
    queryFn: () => getStaffAttendanceForDate(activeSchoolId!, date),
    enabled: !!activeSchoolId && !!date,
  })
  const existingRows = existingData ?? EMPTY_EXISTING

  useEffect(() => {
    if (!staff.length) {
      setAttendanceMap({})
      return
    }
    const next: Record<string, StaffAttendanceStatus> = {}
    for (const s of staff) {
      const hit = existingRows.find((r) => r.staff_id === s.id)
      const st = hit?.status
      if (st === "present" || st === "absent" || st === "late" || st === "half_day") {
        next[s.id] = st
      } else {
        next[s.id] = "present"
      }
    }
    setAttendanceMap(next)
  }, [staff, existingRows])

  const handleStatusChange = (staffId: string, status: StaffAttendanceStatus) => {
    setAttendanceMap((prev) => ({ ...prev, [staffId]: status }))
  }

  const markAll = (status: StaffAttendanceStatus) => {
    setAttendanceMap((prev) => {
      const next = { ...prev }
      staff.forEach((s) => {
        next[s.id] = status
      })
      return next
    })
  }

  const handleSave = async () => {
    if (!activeSchoolId || !academicYearId || !user?.id) {
      toast.error("Missing school, academic year, or sign-in")
      return
    }
    setIsSubmitting(true)
    try {
      const rows = staff.map((s) => ({
        school_id: activeSchoolId,
        staff_id: s.id,
        academic_year_id: academicYearId,
        date,
        status: attendanceMap[s.id] ?? "present",
        marked_by: user.id,
      }))
      await upsertStaffAttendanceBatch(rows)
      await queryClient.invalidateQueries({
        queryKey: ["staff-attendance-existing", activeSchoolId, date],
      })
      toast.success("Staff attendance saved successfully")
    } catch (e) {
      console.error(e)
      toast.error("Failed to save staff attendance")
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

  const tableLoading = staffLoading || existingLoading || yearLoading

  if (!activeSchoolId) {
    return (
      <p className="text-muted-foreground text-sm">Select a school to mark staff attendance.</p>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Staff / Employee Attendance</h1>
        <p className="text-muted-foreground mt-1">
          Mark daily attendance for all staff members and teachers.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4 items-start">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Date selection</CardTitle>
            <CardDescription>Choose the date to mark attendance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="staff-attendance-date">
                Date
              </label>
              <div className="relative">
                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="staff-attendance-date"
                  type="date"
                  className="pl-9"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
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
              <CardTitle>Staff Members</CardTitle>
              <CardDescription>Active employees in this school</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAll("present")}
                className="text-green-600 dark:text-green-500"
                type="button"
                disabled={!staff.length}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark all present
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tableLoading ? (
              <TableSkeletonRows rows={6} cols={4} />
            ) : !staff.length ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No active staff members found for this school.
              </p>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Employee Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead className="text-center min-w-[280px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.employee_code ?? "—"}
                        </TableCell>
                        <TableCell>
                          {member.first_name} {member.last_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {member.designation.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center flex-wrap gap-2">
                            <Button
                              size="sm"
                              type="button"
                              variant={
                                attendanceMap[member.id] === "present" ? "default" : "outline"
                              }
                              className={
                                attendanceMap[member.id] === "present"
                                  ? "bg-green-600 hover:bg-green-700"
                                  : ""
                              }
                              onClick={() => handleStatusChange(member.id, "present")}
                            >
                              Present
                            </Button>
                            <Button
                              size="sm"
                              type="button"
                              variant={
                                attendanceMap[member.id] === "absent" ? "destructive" : "outline"
                              }
                              onClick={() => handleStatusChange(member.id, "absent")}
                            >
                              Absent
                            </Button>
                            <Button
                              size="sm"
                              type="button"
                              variant={
                                attendanceMap[member.id] === "late" ? "secondary" : "outline"
                              }
                              className={
                                attendanceMap[member.id] === "late"
                                  ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                                  : ""
                              }
                              onClick={() => handleStatusChange(member.id, "late")}
                            >
                              Late
                            </Button>
                            <Button
                              size="sm"
                              type="button"
                              variant={
                                attendanceMap[member.id] === "half_day" ? "secondary" : "outline"
                              }
                              onClick={() => handleStatusChange(member.id, "half_day")}
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
                disabled={isSubmitting || !staff.length || !academicYearId || !user?.id}
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
                    Save staff attendance
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
