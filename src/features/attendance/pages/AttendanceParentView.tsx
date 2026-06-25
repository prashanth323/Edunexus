import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarCheck, GraduationCap, Edit2, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TableSkeletonRows } from "@/components/ui/card-skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
import { AttendanceTodayBanner } from "../components/AttendanceTodayBanner"

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
  const qc = useQueryClient()

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const [fromDate, setFromDate] = useState(monthStart.toISOString().split("T")[0])
  const [toDate, setToDate] = useState(today.toISOString().split("T")[0])
  const [selectedChild, setSelectedChild] = useState<string | null>(null)

  // Local editing states for remarks reason
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [reasonText, setReasonText] = useState("")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function handleSaveRemarks(attendanceId: string) {
    if (updatingId) return
    setUpdatingId(attendanceId)
    try {
      const { error } = await supabase.rpc("parent_update_attendance_remarks", {
        p_attendance_id: attendanceId,
        p_remarks: reasonText.trim() || null,
      })

      if (error) throw error
      toast.success("Attendance remarks updated successfully")
      qc.invalidateQueries({ queryKey: ["child-attendance", selectedChild, fromDate, toDate] })
      setEditingRowId(null)
    } catch (e: any) {
      toast.error(e.message || "Failed to save remarks")
    } finally {
      setUpdatingId(null)
    }
  }

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

  const todayStr = today.toISOString().split("T")[0]

  const { data: todayAttendance = [] } = useQuery({
    queryKey: ["child-attendance-today", selectedChild, todayStr],
    queryFn: () => fetchDailyAttendanceForStudent(selectedChild!, todayStr, todayStr),
    enabled: !!selectedChild,
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

      {todayRow && (
        <AttendanceTodayBanner status={todayRow.status} remarks={todayRow.remarks} />
      )}

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
                      <TableHead>Notes</TableHead>
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

                      const isLateOrHalf =
                        row.status === "late" || row.status === "half_day"
                      const isAbsent = row.status === "absent"
                      const showParentReason = isAbsent
                      const isEditing = editingRowId === row.id

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
                          <TableCell>
                            {isLateOrHalf ? (
                              <div className="space-y-1 py-1">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                                  School note
                                </p>
                                <p className="text-xs text-foreground">
                                  {row.remarks || "No note recorded by reception."}
                                </p>
                              </div>
                            ) : showParentReason ? (
                              isEditing ? (
                                <div className="space-y-1">
                                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                                    Your reason
                                  </p>
                                  <div className="flex items-center gap-2 max-w-sm">
                                  <Input
                                    value={reasonText}
                                    onChange={(e) => setReasonText(e.target.value)}
                                    placeholder="Enter reason (e.g. sick leave, travel)..."
                                    className="h-8 text-xs rounded-xl"
                                    disabled={updatingId === row.id}
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    className="h-8 px-2.5 rounded-xl gap-1 shrink-0"
                                    disabled={updatingId === row.id}
                                    onClick={() => handleSaveRemarks(row.id)}
                                  >
                                    {updatingId === row.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Save className="h-3 w-3" />
                                    )}
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2.5 rounded-xl shrink-0 text-muted-foreground"
                                    disabled={updatingId === row.id}
                                    onClick={() => setEditingRowId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                                </div>
                              ) : (
                                <div className="space-y-1 py-1">
                                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                                    Your reason
                                  </p>
                                  <div className="flex items-center justify-between gap-4">
                                  <span className={`text-xs ${row.remarks ? "text-foreground font-medium" : "text-muted-foreground italic"}`}>
                                    {row.remarks || "No reason provided yet."}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 rounded-lg text-[10px] gap-1 border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-primary shrink-0"
                                    onClick={() => {
                                      setEditingRowId(row.id)
                                      setReasonText(row.remarks || "")
                                    }}
                                  >
                                    <Edit2 className="h-2.5 w-2.5" />
                                    {row.remarks ? "Edit reason" : "Provide reason"}
                                  </Button>
                                </div>
                                </div>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground italic">—</span>
                            )}
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
