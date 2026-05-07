import { useQuery } from "@tanstack/react-query"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { format, parseISO } from "date-fns"
import { Users, ShieldAlert, GraduationCap, UserSquare2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import {
  getPlatformDashboardAnalytics,
  getPlatformStats,
  queryKeys,
} from "../../api/platform.api"

const CHART_ANALYTICS_DAYS = 14

function safeShortDate(raw: string) {
  try {
    const d = raw.includes("T") ? parseISO(raw) : parseISO(`${raw}T12:00:00Z`)
    return format(d, "MMM d")
  } catch {
    return raw.slice(5, 10)
  }
}

function truncateLabel(s: string, max = 28) {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1))}\u2026`
}

export function PlatformOverview() {
  const statsQuery = useQuery({
    queryKey: ["platform-stats"],
    queryFn: getPlatformStats,
  })

  const analyticsQuery = useQuery({
    queryKey: queryKeys.platformDashboardAnalytics(CHART_ANALYTICS_DAYS),
    queryFn: () => getPlatformDashboardAnalytics(CHART_ANALYTICS_DAYS),
  })

  const stats = statsQuery.data

  const mixData =
    stats != null
      ? ([
          { name: "Students", value: stats.students },
          { name: "Staff records", value: stats.staff },
        ] satisfies { name: string; value: number }[])
      : []

  const totalsHeadcount = (stats?.students ?? 0) + (stats?.staff ?? 0)

  const analytics = analyticsQuery.data
  const attendanceChartData = analytics?.attendance_by_day.map((d) => ({
    ...d,
    label: safeShortDate(d.date),
  }))

  const topSchoolChartData =
    analytics?.top_schools_by_students.map((row) => ({
      ...row,
      labelShort: truncateLabel(row.name, 26),
    })) ?? []

  const kpiSkeleton = (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in duration-500">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-9 w-16 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const chartSkeleton = (
    <div className="grid gap-6 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="h-72 border-t border-muted/60 pt-4">
            <div className="h-full w-full rounded-md bg-muted/40 animate-pulse min-h-[200px]" />
          </CardContent>
        </Card>
      ))}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="h-5 w-56 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="h-80 border-t border-muted/60 pt-4">
          <div className="h-full w-full rounded-md bg-muted/40 animate-pulse min-h-[240px]" />
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {statsQuery.isPending ? kpiSkeleton : null}

      {statsQuery.isError ? (
        <Card className="border-dashed">
          <CardContent className="pt-8 pb-8 text-center space-y-3 max-w-md mx-auto">
            <p className="font-medium text-foreground">Couldn&apos;t load platform metrics</p>
            <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
            <Button type="button" variant="outline" onClick={() => statsQuery.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Schools</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.schools}</div>
              <p className="text-xs text-muted-foreground mt-1">Active schools (non-deleted)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.students}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all schools</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Staff records</CardTitle>
              <UserSquare2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.staff}</div>
              <p className="text-xs text-muted-foreground mt-1">Staff directory rows</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Platform Users</CardTitle>
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.platformUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">Users with platform roles</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {analyticsQuery.isError ? (
        <Card className="border-dashed">
          <CardContent className="pt-8 pb-8 text-center space-y-3 max-w-lg mx-auto">
            <p className="font-medium text-foreground">Couldn&apos;t load chart data</p>
            <p className="text-sm text-muted-foreground">
              Aggregated analytics may be unavailable, or your role may not include platform insights. Try again in a
              moment.
            </p>
            <Button type="button" variant="outline" onClick={() => analyticsQuery.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {analyticsQuery.isPending && !analyticsQuery.isError ? chartSkeleton : null}

      {analyticsQuery.isSuccess && !analyticsQuery.isError && analytics ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attendance activity</CardTitle>
                <CardDescription>
                  Platform-wide attendance marks per calendar day (past {CHART_ANALYTICS_DAYS} days).
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                {attendanceChartData?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                        height={42}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary) / 0.75)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2 text-center px-4">
                    <p className="text-sm font-medium text-foreground">No attendance in this window</p>
                    <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                      When schools begin daily marking, totals appear here. New or pilot deployments often show an empty
                      timeline until academics go live.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Enrollment mix</CardTitle>
                <CardDescription>Students vs staff directory records (platform-wide).</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                {totalsHeadcount > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mixData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        <Cell fill="hsl(var(--primary))" />
                        <Cell fill="hsl(var(--primary) / 0.42)" />
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2 text-center px-4">
                    <p className="text-sm font-medium text-foreground">No enrollment data yet</p>
                    <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                      Once students and staff are added across schools, this chart shows how records are distributed.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Largest schools by students</CardTitle>
              <CardDescription>Up to twelve schools ranked by live student count (non-deleted records).</CardDescription>
            </CardHeader>
            <CardContent className="h-[min(28rem,70vh)] min-h-[240px]">
              {topSchoolChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={topSchoolChartData}
                    margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="labelShort"
                      width={118}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) =>
                        value != null && typeof value === "number"
                          ? [`${value.toLocaleString()} students`, ""]
                          : [String(value ?? ""), ""]
                      }
                      labelFormatter={(_, payload) => {
                        const row = payload?.[0]?.payload as { name?: string } | undefined
                        return row?.name ?? ""
                      }}
                    />
                    <Bar dataKey="student_count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2 text-center px-4">
                  <p className="text-sm font-medium text-foreground">No schools with students yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                    When schools onboard students, they will appear here ranked by enrollment.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
