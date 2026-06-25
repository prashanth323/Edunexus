import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CalendarCheck, GraduationCap } from "lucide-react"

import { Card, CardContent, CardDescription, CardGrid, CardHeader, CardTitle } from "@/components/ui/card"
import { TableSkeletonRows } from "@/components/ui/card-skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getStudentIdForProfile } from "@/features/lms/api/lms.api"
import {
  getStaggerContainerLoose,
  getStaggerItem,
  getStudentPageVariants,
} from "@/features/student-ui/studentMotion"
import {
  ATTENDANCE_STATUS_BADGE_CLASSES,
  fetchDailyAttendanceForStudent,
} from "../lib/dailyAttendanceRead"
import { AttendanceTodayBanner } from "../components/AttendanceTodayBanner"

export function AttendanceStudentView() {
  const reduce = useReducedMotion()
  const user = useAuth((s) => s.user)
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const pageV = getStudentPageVariants(!!reduce)
  const staggerI = getStaggerItem(!!reduce)
  const gridVariants = getStaggerContainerLoose(!!reduce)

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const [fromDate, setFromDate] = useState(monthStart.toISOString().split("T")[0])
  const [toDate, setToDate] = useState(today.toISOString().split("T")[0])

  const { data: studentId, isLoading: sidLoading } = useQuery({
    queryKey: ["attendance-student-id", user?.id, activeSchoolId],
    queryFn: () => getStudentIdForProfile(user!.id, activeSchoolId!),
    enabled: !!user?.id && !!activeSchoolId,
  })

  const { data: attendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ["student-self-attendance", studentId, fromDate, toDate],
    queryFn: () => fetchDailyAttendanceForStudent(studentId!, fromDate, toDate),
    enabled: !!studentId && !!fromDate && !!toDate,
  })

  const todayStr = today.toISOString().split("T")[0]

  const { data: todayAttendance = [] } = useQuery({
    queryKey: ["student-self-attendance-today", studentId, todayStr],
    queryFn: () => fetchDailyAttendanceForStudent(studentId!, todayStr, todayStr),
    enabled: !!studentId,
  })
  const todayRow = todayAttendance[0]

  const stats = {
    total: attendance.length,
    present: attendance.filter((a) => a.status === "present").length,
    absent: attendance.filter((a) => a.status === "absent").length,
    late: attendance.filter((a) => a.status === "late").length,
    half_day: attendance.filter((a) => a.status === "half_day").length,
  }

  const attendancePct =
    stats.total > 0
      ? Math.round(((stats.present + stats.late) / stats.total) * 1000) / 10
      : null

  if (!activeSchoolId) {
    return <p className="text-muted-foreground text-sm">Select a school.</p>
  }

  if (sidLoading) {
    return (
      <motion.div
        className="flex flex-col gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.2 }}
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground mt-1">Your daily attendance for the selected period.</p>
        </div>
        <CardGrid className="grid gap-6 md:grid-cols-4 items-start" staggerVariants={gridVariants}>
          <Card variants={staggerI} className="md:col-span-1">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Date range</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-8 bg-muted animate-pulse rounded" />
                <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
              </div>
              <div className="pt-4 border-t space-y-3">
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="h-6 w-full bg-muted animate-pulse rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card variants={staggerI} className="md:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
                Your attendance
              </CardTitle>
              <CardDescription>Daily records (whole-day attendance)</CardDescription>
            </CardHeader>
            <CardContent>
              <TableSkeletonRows rows={8} cols={3} />
            </CardContent>
          </Card>
        </CardGrid>
      </motion.div>
    )
  }

  if (!studentId) {
    return (
      <motion.div
        className="flex flex-col gap-6"
        initial="hidden"
        animate="visible"
        variants={pageV}
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground mt-1">View your daily attendance history.</p>
        </div>
        <motion.div
          className="py-12 text-center border border-dashed rounded-lg text-muted-foreground flex flex-col items-center gap-4"
          variants={staggerI}
        >
          <GraduationCap className="h-16 w-16 text-muted-foreground/30" aria-hidden />
          <div className="space-y-1 max-w-md">
            <p className="font-medium text-foreground">No student profile for this school</p>
            <p className="text-sm mt-1">
              When your school links your account as a student, your attendance will show here.
            </p>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div className="flex flex-col gap-6" initial="hidden" animate="visible" variants={pageV}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground mt-1">Your daily attendance for the selected period.</p>
      </div>

      {todayRow && (
        <AttendanceTodayBanner status={todayRow.status} remarks={todayRow.remarks} />
      )}

      <CardGrid className="grid gap-6 md:grid-cols-4 items-start" staggerVariants={gridVariants}>
        <Card variants={staggerI} className="md:col-span-1">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Filters</CardTitle>
                <CardDescription>Date range</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="from-date-stu">
                From
              </label>
              <Input
                id="from-date-stu"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="to-date-stu">
                To
              </label>
              <Input
                id="to-date-stu"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="pt-4 border-t space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Summary</h4>
              <div className="flex justify-between items-center text-sm">
                <span>Attendance %</span>
                <Badge variant="default">{attendancePct != null ? `${attendancePct}%` : "—"}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Present</span>
                <Badge className="bg-green-600 hover:bg-green-700">{stats.present}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Absent</span>
                <Badge variant="destructive">{stats.absent}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Late</span>
                <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">{stats.late}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Half day</span>
                <Badge variant="outline">{stats.half_day}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variants={staggerI} className="md:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Your attendance
            </CardTitle>
            <CardDescription>Daily records (whole-day attendance)</CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {attendanceLoading ? (
                <motion.div
                  key="att-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-2"
                >
                  <TableSkeletonRows rows={8} cols={3} />
                </motion.div>
              ) : attendance.length === 0 ? (
                <motion.div
                  key="att-empty"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.25 }}
                  className="flex flex-col items-center gap-4 py-8 border border-dashed rounded-lg"
                >
                  <CalendarCheck className="h-16 w-16 text-muted-foreground/30" aria-hidden />
                  <p className="text-sm text-muted-foreground text-center px-4">
                    No attendance records found for this period.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="att-table"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border rounded-md overflow-x-auto"
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.map((row) => {
                        const d = new Date(row.date + "T00:00:00")
                        const day = d.toLocaleDateString(undefined, { weekday: "short" })
                        const dateStr = d.toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })

                        return (
                          <TableRow key={row.date}>
                            <TableCell className="font-medium">{dateStr}</TableCell>
                            <TableCell className="text-muted-foreground">{day}</TableCell>
                            <TableCell className="text-center">
                              <Badge
                                className={`capitalize ${ATTENDANCE_STATUS_BADGE_CLASSES[row.status] ?? ""}`}
                                variant={ATTENDANCE_STATUS_BADGE_CLASSES[row.status] ? "default" : "outline"}
                              >
                                {row.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {(row.status === "late" || row.status === "half_day") && row.remarks
                                ? row.remarks
                                : "—"}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </CardGrid>
    </motion.div>
  )
}
