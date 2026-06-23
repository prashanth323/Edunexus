import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Users,
  UserCheck,
  DollarSign,
  Target,
  Percent,
  Wallet,
  TrendingUp,
  GraduationCap,
  CalendarCheck,
  ArrowRight,
  Receipt,
  Megaphone,
} from "lucide-react"
import { Link } from "react-router-dom"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { DashboardStatCard } from "@/components/dashboard/StatCard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCardSkeletonGrid } from "@/components/ui/card-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  getPrincipalDashboard,
  getMonthlyCollections,
  getPrincipalClassEnrollment,
  getPrincipalLeadFunnel,
} from "../api/dashboard.api"
import {
  EMPTY_PRINCIPAL_ATTENDANCE_STATS,
  getPrincipalAttendanceStats,
} from "@/features/attendance/api/attendance.api"
import {
  EMPTY_FINANCE_METRICS,
  getFinanceOverviewMetrics,
} from "@/features/finance/api/finance.api"
import { useAuth } from "@/features/auth/hooks/useAuth"

type PrincipalStats = {
  total_students?: number | null
  teacher_count?: number | null
  attendance_pct_today?: number | null
  total_pending_fees?: number | null
  collections_this_month?: number | null
  active_leads?: number | null
  admissions_this_month?: number | null
}

const CHART_PRIMARY = "hsl(var(--primary))"
const BAR_FILL = "hsl(var(--primary) / 0.85)"

const PIE_COLORS = [
  "hsl(142 76% 36%)",
  "hsl(var(--destructive))",
  "hsl(45 93% 47%)",
  "hsl(217 91% 60%)",
  "hsl(271 81% 56%)",
  "hsl(var(--muted-foreground))",
]

const INVOICE_PIE_COLORS = [
  "hsl(142 76% 36%)",
  "hsl(45 93% 47%)",
  "hsl(217 91% 60%)",
  "hsl(var(--destructive) / 0.75)",
]

const LEAD_BAR_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#f59e0b", "#06b6d4", "#22c55e"]

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half day",
  holiday: "Holiday",
  excused: "Excused",
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
}

function fmtMoney(n: number | null | undefined) {
  return `₹${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function formatDayLabel(iso: string) {
  if (!iso) return ""
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground px-4 text-center">
      {message}
    </div>
  )
}

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return <Skeleton className={`w-full rounded-lg`} style={{ height }} />
}

type PrincipalDashboardProps = {
  title?: string
  subtitle?: string
}

export function PrincipalDashboard({
  title = "Principal Dashboard",
  subtitle = "Live metrics across attendance, finance, admissions, and enrollment.",
}: PrincipalDashboardProps = {}) {
  const activeSchoolId = useAuth((state) => state.activeSchoolId)
  const [attendanceDays, setAttendanceDays] = useState(14)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["principal-stats", activeSchoolId],
    queryFn: () => getPrincipalDashboard(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: collections, isLoading: collectionsLoading } = useQuery({
    queryKey: ["monthly-collections", activeSchoolId],
    queryFn: () => getMonthlyCollections(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: attendance = EMPTY_PRINCIPAL_ATTENDANCE_STATS, isLoading: attendanceLoading } = useQuery({
    queryKey: ["principal-attendance-stats", activeSchoolId, attendanceDays],
    queryFn: () => getPrincipalAttendanceStats(activeSchoolId!, attendanceDays),
    enabled: !!activeSchoolId,
    placeholderData: EMPTY_PRINCIPAL_ATTENDANCE_STATS,
  })

  const { data: finance = EMPTY_FINANCE_METRICS, isLoading: financeLoading } = useQuery({
    queryKey: ["principal-finance-metrics", activeSchoolId],
    queryFn: () => getFinanceOverviewMetrics(activeSchoolId!),
    enabled: !!activeSchoolId,
    placeholderData: EMPTY_FINANCE_METRICS,
  })

  const { data: classEnrollment = [], isLoading: enrollmentLoading } = useQuery({
    queryKey: ["principal-class-enrollment", activeSchoolId],
    queryFn: () => getPrincipalClassEnrollment(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: leadFunnel = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["principal-lead-funnel", activeSchoolId],
    queryFn: () => getPrincipalLeadFunnel(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const isLoading =
    statsLoading ||
    collectionsLoading ||
    attendanceLoading ||
    financeLoading ||
    enrollmentLoading ||
    leadsLoading

  const s = (stats ?? {}) as PrincipalStats

  const attendanceTrend = useMemo(
    () =>
      attendance.by_day.map((row) => ({
        ...row,
        label: formatDayLabel(row.date),
      })),
    [attendance.by_day],
  )

  const attendancePie = useMemo(
    () =>
      Object.entries(attendance.status_breakdown)
        .map(([key, value]) => ({
          name: ATTENDANCE_STATUS_LABELS[key] ?? key,
          value,
          key,
        }))
        .filter((d) => d.value > 0),
    [attendance.status_breakdown],
  )

  const invoicePie = useMemo(
    () =>
      [
        { name: "Paid", value: finance.invoiceStatusPaid },
        { name: "Partial", value: finance.invoiceStatusPartial },
        { name: "Pending", value: finance.invoiceStatusPending },
        { name: "Overdue", value: finance.overdueInvoicesCount },
      ].filter((d) => d.value > 0),
    [finance],
  )

  const revenueData = collections?.length ? collections : []
  const collectionTotal = revenueData.reduce((sum, r) => sum + r.collected, 0)
  const leadTotal = leadFunnel.reduce((sum, r) => sum + r.count, 0)

  const todayRate = attendance.today.rate_pct || s.attendance_pct_today || 0

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <StatCardSkeletonGrid count={6} columnsClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" />
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/attendance">
              <CalendarCheck className="h-4 w-4 mr-1.5" />
              Attendance
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/finance">
              <Receipt className="h-4 w-4 mr-1.5" />
              Finance
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/crm">
              <Target className="h-4 w-4 mr-1.5" />
              Admissions
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <DashboardStatCard title="Students" value={s.total_students ?? 0} icon={Users} />
        <DashboardStatCard title="Teachers" value={s.teacher_count ?? 0} icon={UserCheck} description="Active teaching staff" />
        <DashboardStatCard
          title="Attendance today"
          displayValue={`${todayRate}%`}
          icon={Percent}
          description={`${attendance.today.present}/${attendance.today.total} present`}
        />
        <DashboardStatCard
          title="Collected (month)"
          displayValue={fmtMoney(s.collections_this_month)}
          icon={DollarSign}
          description="Fee receipts this month"
        />
        <DashboardStatCard
          title="Pending fees"
          displayValue={fmtMoney(s.total_pending_fees)}
          icon={Wallet}
          description={`${finance.openInvoicesCount} open invoices`}
        />
        <DashboardStatCard
          title="Active leads"
          value={s.active_leads ?? 0}
          icon={Target}
          description={`${s.admissions_this_month ?? 0} admitted this month`}
        />
      </div>

      {/* Attendance + Revenue row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Attendance trend
              </CardTitle>
              <CardDescription>Daily present rate — last {attendanceDays} days</CardDescription>
            </div>
            <select
              className="flex h-9 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={attendanceDays}
              onChange={(e) => setAttendanceDays(Number(e.target.value))}
              aria-label="Attendance period"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </CardHeader>
          <CardContent className="h-[300px]">
            {attendanceTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceTrend} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [`${Number(value ?? 0)}%`, "Present rate"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate_pct"
                    stroke={CHART_PRIMARY}
                    strokeWidth={2}
                    fill="url(#attendanceGradient)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="No attendance records in this period. Mark daily attendance to populate this chart." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              Revenue collection
            </CardTitle>
            <CardDescription>
              Monthly fee collections
              {collectionTotal > 0 ? ` · ${fmtMoney(collectionTotal)} total shown` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {revenueData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : v}`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [fmtMoney(Number(value ?? 0)), "Collected"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    stroke="hsl(142 76% 36%)"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                    dot={{ r: 3, fill: "hsl(142 76% 36%)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="No payment history yet. Record fee payments to see revenue trends." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Distribution row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s attendance mix</CardTitle>
            <CardDescription>Status breakdown for the selected period</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {attendancePie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendancePie}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {attendancePie.map((entry, i) => (
                      <Cell key={entry.key} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="No status data for this window." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice health</CardTitle>
            <CardDescription>{finance.totalInvoicesCount} invoices tracked</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {invoicePie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={invoicePie}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {invoicePie.map((_, i) => (
                      <Cell key={i} fill={INVOICE_PIE_COLORS[i % INVOICE_PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="No invoices issued yet." />
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Enrollment by class
            </CardTitle>
            <CardDescription>{s.total_students ?? 0} active students</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {classEnrollment.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classEnrollment} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="className"
                    width={72}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v ?? 0), "Students"]} />
                  <Bar dataKey="students" fill={BAR_FILL} radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="Enroll students into sections to see class distribution." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Admissions + quick actions */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Admissions pipeline</CardTitle>
              <CardDescription>
                Lead counts by stage · {leadTotal} total in CRM
              </CardDescription>
            </div>
            <Badge variant="secondary">{s.admissions_this_month ?? 0} admitted this month</Badge>
          </CardHeader>
          <CardContent className="h-[280px]">
            {leadFunnel.some((r) => r.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadFunnel} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v ?? 0), "Leads"]} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {leadFunnel.map((row, i) => (
                      <Cell key={row.status} fill={LEAD_BAR_COLORS[i % LEAD_BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="No admission leads yet. Add leads in CRM to track your pipeline." />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Jump to key modules</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              { to: "/students", icon: GraduationCap, title: "Students", desc: "Directory & profiles" },
              { to: "/staff", icon: UserCheck, title: "Staff", desc: "Team & invites" },
              { to: "/exams", icon: Receipt, title: "Examinations", desc: "Marks & results" },
              { to: "/timetable", icon: CalendarCheck, title: "Timetable", desc: "Schedules" },
              { to: "/notices", icon: Megaphone, title: "Notices", desc: "School announcements" },
              { to: "/messages", icon: ArrowRight, title: "Messages", desc: "Parent–teacher comms" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/60 transition-colors group"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
