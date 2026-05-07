import { useQuery } from "@tanstack/react-query"
import { Users, UserCheck, DollarSign, Target, Percent, Wallet } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { Link } from "react-router-dom"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCardSkeletonGrid } from "@/components/ui/card-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { getPrincipalDashboard, getMonthlyCollections } from "../api/dashboard.api"
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

export function PrincipalDashboard() {
  const activeSchoolId = useAuth((state) => state.activeSchoolId)

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

  if (statsLoading || collectionsLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Principal Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of school performance and metrics.</p>
        </div>
        <StatCardSkeletonGrid count={6} columnsClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full bg-muted/50 animate-pulse rounded-md border" />
          </CardContent>
        </Card>
      </div>
    )
  }

  const s = (stats ?? {}) as PrincipalStats
  const chartData = collections?.length ? collections : []

  const fmtMoney = (n: number | null | undefined) =>
    (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Principal Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of school performance and metrics.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s.total_students ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teachers</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s.teacher_count ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">teacher + class teacher roles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance today</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s.attendance_pct_today ?? 0}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collections (this month)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${fmtMoney(s.collections_this_month)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending fees</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${fmtMoney(s.total_pending_fees)}</div>
            <p className="text-xs text-muted-foreground mt-1">Outstanding invoice balance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{s.active_leads ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Admissions this month: {s.admissions_this_month ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-4">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Revenue collection trend</CardTitle>
            <CardDescription>Monthly fee collections</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCollected)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground border border-dashed rounded-lg">
                No payment data in v_monthly_collections yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link
              to="/timetable"
              className="p-4 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-colors block"
            >
              <h3 className="font-semibold text-sm">Manage timetable</h3>
              <p className="text-xs text-muted-foreground mt-1">Build weekly schedules and assign class teachers</p>
            </Link>
            <Link
              to="/crm"
              className="p-4 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-colors block"
            >
              <h3 className="font-semibold text-sm">Review admissions pipeline</h3>
              <p className="text-xs text-muted-foreground mt-1">Check pending applications and follow-ups</p>
            </Link>
            <Link
              to="/finance"
              className="p-4 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-colors block"
            >
              <h3 className="font-semibold text-sm">Open ERP module</h3>
              <p className="text-xs text-muted-foreground mt-1">Fees, invoices, and collections</p>
            </Link>
            <Link
              to="/staff"
              className="p-4 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-colors block"
            >
              <h3 className="font-semibold text-sm">Staff directory</h3>
              <p className="text-xs text-muted-foreground mt-1">Invite and manage employees</p>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
