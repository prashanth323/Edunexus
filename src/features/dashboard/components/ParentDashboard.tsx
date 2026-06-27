import { Link } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  GraduationCap,
  CalendarCheck,
  CreditCard,
  Bus,
  BookOpen,
  ClipboardList,
  Megaphone,
  ChevronRight,
  BarChart3,
  IdCard,
  User,
} from "lucide-react"
import { useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getParentChildren, getChildrenAttendance, getChildrenExamResults, getChildrenInvoices } from "../api/dashboard.api"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useStudentDocumentsDisplayUrl } from "@/features/students/hooks/useStudentDocumentsDisplayUrl"
import { ReportCardModal } from "./ReportCardModal"
import { ClassTeacherCard } from "@/components/school/ClassTeacherCard"
import { ChildServicePreferenceDialog } from "./ChildServicePreferenceDialog"
import { getNotices } from "@/features/notices/api/notices.api"
import { fetchDailyAttendanceForStudent } from "@/features/attendance/lib/dailyAttendanceRead"
import { AttendanceTodayBanner } from "@/features/attendance/components/AttendanceTodayBanner"
import { getMyWardHostelStatus } from "@/features/hostel/api/hostelStatus.api"
import { HOSTEL_LEAVE_STATUSES } from "@/features/hostel/lib/hostelStatusLabels"
import { StudentFeePaymentStatus } from "@/features/finance/components/StudentFeePaymentStatus"
import { format } from "date-fns"

type ParentChildRow = {
  student_id: string
  student_name: string
  photo_url?: string | null
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
  class_teacher_name?: string | null
  class_teacher_phone?: string | null
  class_teacher_email?: string | null
  transport_mode?: string | null
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return "?"
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase()
  return `${p[0]![0]}${p[p.length - 1]![0]}`.toUpperCase()
}

function LinkedChildAvatar({
  photoUrl,
  studentName,
}: {
  photoUrl: string | null | undefined
  studentName: string
}) {
  const resolved = useStudentDocumentsDisplayUrl(photoUrl ?? undefined)
  return (
    <>
      <AvatarImage src={resolved ?? ""} alt={studentName} />
      <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/5 text-primary font-bold text-lg">
        {initials(studentName)}
      </AvatarFallback>
    </>
  )
}

export function ParentDashboard() {
  const user = useAuth((s) => s.user)
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()
  const [editingChild, setEditingChild] = useState<ParentChildRow | null>(null)
  const [selectedReportChild, setSelectedReportChild] = useState<ParentChildRow | null>(null)

  const { data: children, isLoading } = useQuery({
    queryKey: ["parent-children", user?.id],
    queryFn: () => getParentChildren(user!.id),
    enabled: !!user?.id,
  })

  const rows = (children ?? []) as ParentChildRow[]
  const studentIds = rows.map((c) => c.student_id)

  const { data: attendanceData, isLoading: isAttendanceLoading } = useQuery({
    queryKey: ["children-attendance", studentIds],
    queryFn: () => getChildrenAttendance(studentIds),
    enabled: studentIds.length > 0,
  })

  const { data: examResultsData, isLoading: isExamsLoading } = useQuery({
    queryKey: ["children-exams", studentIds],
    queryFn: () => getChildrenExamResults(studentIds),
    enabled: studentIds.length > 0,
  })

  const { data: invoicesData, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ["children-invoices", studentIds],
    queryFn: () => getChildrenInvoices(studentIds),
    enabled: studentIds.length > 0,
  })

  const { data: parentNotices = [] } = useQuery({
    queryKey: ["notices", activeSchoolId, "parent"],
    queryFn: () => getNotices(activeSchoolId!, "parent"),
    enabled: !!activeSchoolId,
  })

  const { data: wardHostelStatus = [] } = useQuery({
    queryKey: ["ward-hostel-status", user?.id],
    queryFn: () => getMyWardHostelStatus(),
    enabled: !!user?.id,
  })

  const wardLeaveAlerts = wardHostelStatus.filter((w) =>
    HOSTEL_LEAVE_STATUSES.has(w.resident_status),
  )

  const todayStr = new Date().toISOString().split("T")[0]
  const { data: childrenTodayFlags = [] } = useQuery({
    queryKey: ["parent-children-today-attendance", studentIds, todayStr],
    queryFn: async () => {
      const results = await Promise.all(
        studentIds.map(async (id) => {
          const att = await fetchDailyAttendanceForStudent(id, todayStr, todayStr)
          return { student_id: id, row: att[0] }
        }),
      )
      return results.filter(
        (r) => r.row && ["absent", "late", "half_day"].includes(r.row.status),
      )
    },
    enabled: studentIds.length > 0,
  })

  if (isLoading || isAttendanceLoading || isExamsLoading || isInvoicesLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-80 md:col-span-2 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    )
  }

  // Dynamic stats
  const activeChildrenCount = rows.length
  
  // Calculate true average attendance from raw database attendance records
  const avgAttendance = (() => {
    if (!attendanceData || attendanceData.length === 0) return 0
    const presentOrLate = attendanceData.filter(
      (r) => r.status?.toLowerCase() === "present" || r.status?.toLowerCase() === "late"
    ).length
    return (presentOrLate / attendanceData.length) * 100
  })()

  // Calculate true fee aggregates from student_invoices table
  const totalPaidFees = invoicesData ? invoicesData.reduce((acc, inv) => acc + Number(inv.paid_amount ?? 0), 0) : 0
  const totalDueFees = invoicesData ? invoicesData.reduce((acc, inv) => acc + Number(inv.due_amount ?? 0), 0) : 0
  const totalPendingFees = totalDueFees

  // Format dynamic attendance monthly trend
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const attendanceTrendData = (() => {
    if (!attendanceData || attendanceData.length === 0) return []
    const grouped: Record<string, { total: number; present: number }> = {}
    attendanceData.forEach((row) => {
      if (!row.date) return
      const dateObj = new Date(row.date)
      const monthIndex = dateObj.getMonth()
      if (isNaN(monthIndex)) return
      const monthName = monthNames[monthIndex]
      if (!grouped[monthName]) {
        grouped[monthName] = { total: 0, present: 0 }
      }
      grouped[monthName].total += 1
      if (row.status?.toLowerCase() === "present" || row.status?.toLowerCase() === "late") {
        grouped[monthName].present += 1
      }
    })
    return monthNames
      .filter((m) => grouped[m] !== undefined)
      .map((m) => {
        const { total, present } = grouped[m]!
        return {
          name: m,
          Attendance: total > 0 ? Math.round((present / total) * 100) : 0,
          Target: 85,
        }
      })
  })()

  // Format dynamic subject-wise scores from exam_results table
  const subjectPerformanceData = (() => {
    if (!examResultsData || examResultsData.length === 0) return []
    const grouped: Record<string, { obtained: number; max: number }> = {}
    examResultsData.forEach((row: any) => {
      const subName = row.exams?.subjects?.name || "Other"
      const marks = Number(row.marks_obtained ?? 0)
      const max = Number(row.exams?.max_marks ?? 100)
      if (!grouped[subName]) {
        grouped[subName] = { obtained: 0, max: 0 }
      }
      grouped[subName].obtained += marks
      grouped[subName].max += max
    })
    return Object.entries(grouped).map(([name, val]) => ({
      name,
      Score: val.max > 0 ? Math.round((val.obtained / val.max) * 100) : 0,
    }))
  })()

  // Format dynamic PieChart data
  const feeDonutData = [
    { name: "Paid Fees", value: totalPaidFees, color: "#10b981" },
    { name: "Outstanding Dues", value: totalDueFees, color: "#f43f5e" },
  ]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      {editingChild && (
        <ChildServicePreferenceDialog
          child={editingChild}
          onClose={() => setEditingChild(null)}
          onSuccess={async () => {
            await qc.refetchQueries({ queryKey: ["parent-children", user?.id] })
          }}
        />
      )}

      {selectedReportChild && (
        <ReportCardModal child={selectedReportChild} onClose={() => setSelectedReportChild(null)} />
      )}

      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-6 sm:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Parent Portal</h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl">
              Welcome back! Real-time academic tracking, performance insights, and administrative updates for your linked children.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="gap-2 rounded-xl w-fit shadow-sm border border-primary/10" asChild>
            <Link to="/student-id-card">
              <IdCard className="h-4 w-4" />
              Student ID cards
            </Link>
          </Button>
        </div>
      </div>

      {childrenTodayFlags.map(({ student_id, row }) => {
        const childName = rows.find((c) => c.student_id === student_id)?.student_name ?? "Child"
        if (!row) return null
        return (
          <div key={student_id} className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{childName}</p>
            <AttendanceTodayBanner status={row.status} remarks={row.remarks} />
          </div>
        )
      })}

      {wardLeaveAlerts.map((ward) => (
        <div
          key={ward.student_id}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
        >
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            Your ward — hostel leave
          </p>
          <p className="text-amber-800/90 dark:text-amber-200/90 mt-1">
            {ward.student_name} (Adm. no. {ward.admission_no}) is marked{" "}
            <span className="font-medium">{ward.status_label.toLowerCase()}</span>
            {ward.status_updated_at
              ? ` as of ${format(new Date(ward.status_updated_at), "dd MMM yyyy")}`
              : ""}
            {ward.room_label ? ` · Room ${ward.room_label}` : ""}.
          </p>
        </div>
      ))}

      {/* Visual Analytics Hub Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-semibold text-[10px] text-primary">Connected Family</CardDescription>
            <CardTitle className="text-3xl font-extrabold">{activeChildrenCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4 text-primary shrink-0" />
            <span>Active Student profile(s) linked</span>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card to-purple-500/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-semibold text-[10px] text-purple-500">Average Attendance</CardDescription>
            <CardTitle className="text-3xl font-extrabold">{avgAttendance > 0 ? `${avgAttendance.toFixed(1)}%` : "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <CalendarCheck className="h-4 w-4 text-purple-500 shrink-0" />
            <span>Across current term classes</span>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card to-rose-500/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-semibold text-[10px] text-rose-500">Pending Financials</CardDescription>
            <CardTitle className={`text-3xl font-extrabold ${totalPendingFees > 0 ? "text-rose-500" : "text-emerald-500"}`}>
              ${totalPendingFees.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-rose-500 shrink-0" />
            <span>{totalPendingFees > 0 ? "Action required for outstanding balances" : "All balances fully clear"}</span>
          </CardContent>
        </Card>
      </div>

      {/* Children list */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          Linked Children Profiles
        </h2>
        
        {rows.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed rounded-3xl text-muted-foreground bg-card/40">
            <GraduationCap className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="font-semibold text-foreground text-lg">No Linked Student Profiles</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">
              Please contact the school administration to link your parent account to your child's student profile.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rows.map((child) => (
              <Card key={child.student_id} className="relative overflow-hidden border hover:border-primary/40 transition-all hover:shadow-md rounded-2xl">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-purple-600" />
                <CardHeader className="pb-4 flex flex-row items-center gap-4 pt-6">
                  <Avatar className="h-14 w-14 border-2 border-background shadow-md shrink-0">
                    <LinkedChildAvatar photoUrl={child.photo_url} studentName={child.student_name} />
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <CardTitle className="text-lg font-bold truncate leading-tight">{child.student_name}</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full shrink-0"
                        title="Service preferences"
                        onClick={() => setEditingChild(child)}
                      >
                        <Bus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <CardDescription className="truncate text-xs mt-1">
                      {[child.class_name, child.section_name ? `Section ${child.section_name}` : null]
                        .filter(Boolean)
                        .join(" · ") || "Class Assignment Pending"}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 p-3 border rounded-xl bg-muted/30">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Attendance</span>
                      <span className="text-base font-extrabold mt-0.5">
                        {child.attendance_pct_this_month != null
                          ? `${Number(child.attendance_pct_this_month).toFixed(1)}%`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 border rounded-xl bg-muted/30">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pending Fees</span>
                      <span className="text-base font-extrabold mt-0.5 text-rose-500">
                        ${Number(child.pending_fees ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 p-3 border rounded-xl bg-muted/20">
                    <ClassTeacherCard
                      compact
                      classTeacherName={child.class_teacher_name}
                      classTeacherPhone={child.class_teacher_phone}
                      classTeacherEmail={child.class_teacher_email}
                    />
                  </div>
                  {(() => {
                    const ward = wardHostelStatus.find((w) => w.student_id === child.student_id)
                    if (!ward) return null
                    const onLeave = HOSTEL_LEAVE_STATUSES.has(ward.resident_status)
                    return (
                      <div
                        className={`mt-3 p-3 border rounded-xl text-xs ${
                          onLeave ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/20"
                        }`}
                      >
                        <p className="font-semibold">Your ward — hostel</p>
                        <p className="text-muted-foreground mt-1">
                          Adm. no. {ward.admission_no} · {ward.status_label}
                          {ward.status_updated_at
                            ? ` · ${format(new Date(ward.status_updated_at), "dd MMM yyyy")}`
                            : ""}
                        </p>
                      </div>
                    )
                  })()}
                  <div className="flex flex-col gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 rounded-xl text-xs"
                      asChild
                    >
                      <Link to={`/my-profile/${child.student_id}`}>
                        <User className="h-3.5 w-3.5" /> View full profile
                      </Link>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full gap-2 rounded-xl text-xs hover:bg-primary/5 border-primary/20 hover:border-primary/40 text-primary"
                      onClick={() => setSelectedReportChild(child)}
                    >
                      <ClipboardList className="h-3.5 w-3.5" /> Download Report Card
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions Panel */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Quick Navigation</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { to: "/attendance", title: "Attendance Tracking", desc: "View detailed calendars", icon: CalendarCheck, color: "bg-blue-500/10 text-blue-600 border-blue-500/10 hover:bg-blue-500/[0.02]" },
            { to: "/my-profile", title: "Student profiles", desc: "Full school records", icon: User, color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/10 hover:bg-indigo-500/[0.02]" },
            { to: "/exams", title: "Exams & results", desc: "Your class exams only", icon: ClipboardList, color: "bg-purple-500/10 text-purple-600 border-purple-500/10 hover:bg-purple-500/[0.02]" },
            { to: "/finance", title: "Fee Portal", desc: "Pay dues & save receipts", icon: CreditCard, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/10 hover:bg-emerald-500/[0.02]" },
            { to: "/lms", title: "Learning Hub", desc: "Homework assignments", icon: BookOpen, color: "bg-amber-500/10 text-amber-600 border-amber-500/10 hover:bg-amber-500/[0.02]" },
            { to: "/notices", title: "Announcements", desc: "School notice board", icon: Megaphone, color: "bg-rose-500/10 text-rose-600 border-rose-500/10 hover:bg-rose-500/[0.02]" },
          ].map(({ to, title, desc, icon: Icon, color }) => (
            <Link
              key={to}
              to={to}
              className={`group flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md ${color}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-bold text-sm text-foreground">
                  {title}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0" />
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5 leading-normal">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Advanced Recharts Interactive Panels */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Attendance Area Trend */}
        <Card className="md:col-span-2 rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarCheck className="h-5 w-5 text-blue-500" />
              Attendance Performance Trend
            </CardTitle>
            <CardDescription>Monthly student attendance percentage versus threshold target (85%)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            {attendanceTrendData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <CalendarCheck className="h-12 w-12 text-muted-foreground opacity-20 mb-3" />
                <p className="text-sm font-semibold text-foreground">No Attendance Data Logged</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Daily attendance logs are updated in real-time once classes begin.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceTrendData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(59, 130, 246)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="rgb(59, 130, 246)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[70, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Attendance" stroke="rgb(59, 130, 246)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAttendance)" />
                  <Area type="monotone" dataKey="Target" stroke="rgb(239, 68, 68)" strokeDasharray="5 5" strokeWidth={1.5} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Fees Distribution Pie */}
        <Card className="rounded-3xl border shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Financial Distribution
            </CardTitle>
            <CardDescription>Paid fees versus outstanding dues ratio</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 h-[220px] flex flex-col justify-center pb-2">
            {totalPaidFees === 0 && totalDueFees === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-6">
                <CreditCard className="h-12 w-12 text-muted-foreground opacity-20 mb-3" />
                <p className="text-sm font-semibold text-foreground">No Pending Invoices</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  All dues are clear or no invoices have been generated for this academic year.
                </p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={feeDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {feeDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 text-xs mt-2 shrink-0 border-t pt-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
                    <span className="text-muted-foreground">Paid: ${totalPaidFees.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f43f5e]" />
                    <span className="text-muted-foreground">Pending: ${totalDueFees.toLocaleString()}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {studentIds.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Fee payment status</h2>
          {rows.map((child) => (
            <StudentFeePaymentStatus key={child.student_id} studentId={child.student_id} />
          ))}
        </div>
      )}

      {/* Academic Performance + Communication Hub */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Subject wise score chart */}
        <Card className="md:col-span-2 rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              Academic Performance Analysis
            </CardTitle>
            <CardDescription>Student subject score compared with the overall class average</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            {subjectPerformanceData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground opacity-20 mb-3" />
                <p className="text-sm font-semibold text-foreground">No Exam Results Published Yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Academic performance reports and analytics will display here once midterm/final exams are completed and graded.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectPerformanceData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Score" fill="rgb(168, 85, 247)" radius={[4, 4, 0, 0]} name="Student Score" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Notices Board & Quick Updates */}
        <Card className="rounded-3xl border shadow-sm flex flex-col bg-gradient-to-br from-card to-rose-500/[0.01]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Megaphone className="h-5 w-5 text-rose-500" />
              School Notice Hub
            </CardTitle>
            <CardDescription>Stay aligned with circulars & events</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between pt-2">
            <div className="space-y-4">
              {parentNotices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No parent notices published yet.
                </p>
              ) : (
                parentNotices.slice(0, 3).map((notice) => (
                  <div
                    key={notice.id}
                    className="flex gap-3 items-start p-3 border rounded-xl bg-card hover:shadow-sm transition-shadow"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
                      <Megaphone className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold leading-normal truncate">{notice.title}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{notice.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <Button variant="outline" className="w-full mt-6 gap-2 shrink-0 rounded-xl" asChild>
              <Link to="/notices">
                View All Circulars <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
