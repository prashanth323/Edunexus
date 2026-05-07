import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarCheck, GraduationCap } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { supabase } from "@/lib/supabase"
import {
  ATTENDANCE_STATUS_BADGE_CLASSES,
  fetchDailyAttendanceForStudent,
} from "../lib/dailyAttendanceRead"

type ParentChild = {
  student_id: string
  student_name: string
}

async function getParentLinkedChildren(profileId: string): Promise<ParentChild[]> {
  const { data, error } = await supabase
    .from("v_parent_children")
    .select("student_id, student_name")
    .eq("profile_id", profileId)

  if (error) throw error
  // Deduplicate by student_id (view may return dupes for multiple enrollments)
  const map = new Map<string, ParentChild>()
  for (const row of data ?? []) {
    if (!map.has(row.student_id)) {
      map.set(row.student_id, { student_id: row.student_id, student_name: row.student_name })
    }
  }
  return Array.from(map.values())
}

export function AttendanceParentView() {
  const user = useAuth((s) => s.user)

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const [fromDate, setFromDate] = useState(monthStart.toISOString().split("T")[0])
  const [toDate, setToDate] = useState(today.toISOString().split("T")[0])
  const [selectedChild, setSelectedChild] = useState<string | null>(null)

  const { data: children = [], isLoading: childrenLoading } = useQuery({
    queryKey: ["parent-children-attendance", user?.id],
    queryFn: () => getParentLinkedChildren(user!.id),
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (children.length > 0 && selectedChild === null) {
      setSelectedChild(children[0]!.student_id)
    }
  }, [children, selectedChild])

  const selectedName = children.find((c) => c.student_id === selectedChild)?.student_name ?? ""

  const { data: attendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ["child-attendance", selectedChild, fromDate, toDate],
    queryFn: () => fetchDailyAttendanceForStudent(selectedChild!, fromDate, toDate),
    enabled: !!selectedChild && !!fromDate && !!toDate,
  })

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

  if (childrenLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground mt-1">View attendance history for your children.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-4 items-start">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Select child and date range</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded-md animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded-md animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded-md animate-pulse" />
              </div>
            </CardContent>
          </Card>
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>Attendance records</CardTitle>
              <CardDescription>Daily attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <TableSkeletonRows rows={8} cols={3} />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (children.length === 0) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground mt-1">View your children's attendance records.</p>
        </div>
        <div className="py-16 text-center border border-dashed rounded-lg text-muted-foreground">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-foreground">No linked children</p>
          <p className="text-sm mt-1">
            When your school links your account to a student, their attendance will show here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground mt-1">
          View attendance history for your children.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4 items-start">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Select child and date range</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="child-select">
                Child
              </label>
              <select
                id="child-select"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedChild ?? ""}
                onChange={(e) => setSelectedChild(e.target.value || null)}
              >
                {children.map((c) => (
                  <option key={c.student_id} value={c.student_id}>
                    {c.student_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="from-date">From</label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="to-date">To</label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="pt-4 border-t space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Summary</h4>
              <div className="flex justify-between items-center text-sm">
                <span>Attendance %</span>
                <Badge variant="default">
                  {attendancePct != null ? `${attendancePct}%` : "—"}
                </Badge>
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

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              {selectedName ? `${selectedName}'s attendance` : "Attendance"}
            </CardTitle>
            <CardDescription>Daily attendance records for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceLoading ? (
              <TableSkeletonRows rows={8} cols={3} />
            ) : attendance.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                No attendance records found for this period.
              </p>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead className="text-center">Status</TableHead>
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
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
