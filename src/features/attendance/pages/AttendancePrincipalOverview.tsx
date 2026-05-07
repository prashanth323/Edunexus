import type { ComponentType } from "react"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  CalendarDays,
  Clock,
  Loader2,
  Percent,
  PieChart as PieChartIcon,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  EMPTY_PRINCIPAL_ATTENDANCE_STATS,
  getPrincipalAttendanceStats,
  type PrincipalAttendanceStats,
} from "../api/attendance.api"

const AREA_STROKE = "hsl(var(--primary) / 0.9)"
const BAR_FILL = "hsl(var(--primary) / 0.85)"

const STATUS_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half day",
  holiday: "Holiday",
  excused: "Excused",
}

const STATUS_ORDER = ["present", "absent", "late", "half_day", "holiday", "excused"] as const

const PIE_COLORS = [
  "hsl(142 76% 36%)",
  "hsl(var(--destructive))",
  "hsl(45 93% 47%)",
  "hsl(var(--muted-foreground))",
  "hsl(217 91% 60%)",
  "hsl(271 81% 56%)",
]

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string | number
  description?: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {description ? <p className="text-xs text-muted-foreground mt-1">{description}</p> : null}
      </CardContent>
    </Card>
  )
}

function formatDayLabel(iso: string) {
  if (!iso) return ""
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function AttendancePrincipalOverview() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const [periodDays, setPeriodDays] = useState(14)

  const { data = EMPTY_PRINCIPAL_ATTENDANCE_STATS, isFetching } = useQuery({
    queryKey: ["principal-attendance-stats", activeSchoolId, periodDays],
    queryFn: async () => {
      if (!activeSchoolId) return EMPTY_PRINCIPAL_ATTENDANCE_STATS
      return getPrincipalAttendanceStats(activeSchoolId, periodDays)
    },
    enabled: !!activeSchoolId,
    placeholderData: EMPTY_PRINCIPAL_ATTENDANCE_STATS,
    staleTime: 60_000,
  })

  const o = data as PrincipalAttendanceStats

  const trendData = useMemo(
    () =>
      o.by_day.map((row) => ({
        ...row,
        label: formatDayLabel(row.date),
      })),
    [o.by_day],
  )

  const statusBars = useMemo(() => {
    return STATUS_ORDER.map((key) => ({
      key,
      label: STATUS_LABELS[key] ?? key,
      value: o.status_breakdown[key] ?? 0,
    })).filter((r) => r.value > 0)
  }, [o.status_breakdown])

  const pieData = useMemo(() => {
    return STATUS_ORDER.map((key) => ({
      name: STATUS_LABELS[key] ?? key,
      value: o.status_breakdown[key] ?? 0,
      key,
    })).filter((d) => d.value > 0)
  }, [o.status_breakdown])

  const hasTrend = trendData.length > 0
  const hasStatus = pieData.length > 0

  if (!activeSchoolId) {
    return (
      <div className="text-sm text-muted-foreground py-12 text-center">
        Select a school to view attendance analytics.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance overview</h1>
          <p className="text-muted-foreground mt-1">
            School-wide daily attendance (period totals and today). Subject-period rows are excluded.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground shrink-0" htmlFor="attendance-period">
            Period
          </label>
          <select
            id="attendance-period"
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-[140px]"
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          {isFetching ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Updating…
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's present rate"
          value={`${o.today.rate_pct}%`}
          description={
            o.today.total > 0
              ? `${o.today.present.toLocaleString()} present · ${o.today.total.toLocaleString()} marked`
              : "No daily rows for today yet"
          }
          icon={Percent}
        />
        <StatCard
          title="Marked today"
          value={o.today.total}
          description="Daily attendance records (all sections)"
          icon={Users}
        />
        <StatCard title="Present today" value={o.today.present} icon={UserCheck} />
        <StatCard title="Absent today" value={o.today.absent} icon={UserMinus} />
        <StatCard title="Late today" value={o.today.late} icon={Clock} />
        <StatCard title="Half day today" value={o.today.half_day} icon={CalendarDays} />
        <StatCard
          title="Holiday / excused today"
          value={o.today.other}
          description="Counted as non-present categories"
          icon={CalendarDays}
        />
        <StatCard
          title="Window"
          value={o.period_days}
          description="Days in status charts below"
          icon={PieChartIcon}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily present rate</CardTitle>
            <CardDescription>
              Share of present among daily marks, by calendar day ({periodDays}-day window)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] pt-0">
            {!hasTrend ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No daily attendance in this period yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="attRateFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${v}%`}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value) => {
                      const n = typeof value === "number" ? value : Number(value)
                      return [`${Number.isFinite(n) ? n : 0}%`, "Present rate"]
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate_pct"
                    name="Present rate"
                    stroke={AREA_STROKE}
                    fill="url(#attRateFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status mix ({periodDays} days)</CardTitle>
            <CardDescription>Counts from daily attendance rows in the selected window</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] pt-0">
            {!hasStatus ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No status data in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) =>
                      `${name ?? ""} ${Math.round((percent ?? 0) * 100)}%`
                    }
                  >
                    {pieData.map((entry, i) => (
                      <Cell
                        key={entry.key}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status counts</CardTitle>
          <CardDescription>Same window as the pie chart — easy numeric comparison</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] pt-0">
          {statusBars.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusBars}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={88} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={BAR_FILL} name="Records" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
