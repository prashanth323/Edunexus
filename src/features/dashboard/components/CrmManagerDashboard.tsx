import { useQuery } from "@tanstack/react-query"
import {
  Users,
  Target,
  TrendingUp,
  UserCheck,
  Flame,
  Eye,
  FileText,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react"
import { Link } from "react-router-dom"
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatCardSkeletonGrid } from "@/components/ui/card-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getCrmManagerDashboard } from "../api/dashboard.api"
import { getLeads } from "@/features/crm/api/crm.api"

type CrmStats = {
  school_id: string
  school_name: string
  total_leads: number
  leads_new: number
  leads_engaged: number
  leads_visit: number
  leads_applied: number
  leads_admitted: number
  leads_lost: number
  leads_this_month: number
  admissions_this_month: number
  conversion_rate: string
  high_priority_open: number
}

const PIPELINE_STAGES = [
  { key: "leads_new", label: "New", icon: Users, color: "#3b82f6", bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { key: "leads_engaged", label: "Engaged", icon: TrendingUp, color: "#8b5cf6", bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  { key: "leads_visit", label: "Visit", icon: Eye, color: "#f59e0b", bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { key: "leads_applied", label: "Applied", icon: FileText, color: "#06b6d4", bg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  { key: "leads_admitted", label: "Admitted", icon: CheckCircle, color: "#22c55e", bg: "bg-green-500/10 text-green-600 dark:text-green-400" },
]

export function CrmManagerDashboard() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: stats, isLoading: statsLoading } = useQuery<CrmStats | null>({
    queryKey: ["crm-manager-dashboard", activeSchoolId],
    queryFn: () => getCrmManagerDashboard(activeSchoolId!) as Promise<CrmStats | null>,
    enabled: !!activeSchoolId,
  })

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["crm-leads-recent", activeSchoolId],
    queryFn: () => getLeads(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const isLoading = statsLoading || leadsLoading

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">CRM Dashboard</h1>
            <p className="text-muted-foreground mt-1">Admissions pipeline overview and lead management.</p>
          </div>
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
        <StatCardSkeletonGrid count={4} columnsClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  const s = (stats ?? {}) as CrmStats
  const total = s.total_leads ?? 0
  const conversionRate = parseFloat(s.conversion_rate ?? "0")

  // Source breakdown from leads data
  const sourceBreakdown = leads.reduce((acc: Record<string, number>, lead) => {
    const name = lead.lead_sources?.name ?? "Unknown"
    acc[name] = (acc[name] ?? 0) + 1
    return acc
  }, {})

  const sourceChartData = Object.entries(sourceBreakdown)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4"]

  // Pipeline funnel bar chart data
  const funnelData = PIPELINE_STAGES.map((stage) => ({
    name: stage.label,
    count: (s as any)[stage.key] ?? 0,
    fill: stage.color,
  }))

  // Recent leads (top 5, open/active)
  const recentLeads = leads
    .filter((l) => !["admitted", "not_interested", "lost"].includes(l.status))
    .slice(0, 5)

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      contacted: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
      interested: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
      followup_scheduled: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
      visit_scheduled: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      visited: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
      applied: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    }
    return map[status] ?? "bg-muted text-muted-foreground"
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Admissions pipeline overview and lead management.
          </p>
        </div>
        <Button asChild className="shrink-0 gap-2">
          <Link to="/crm">
            Open Pipeline <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Leads */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {s.leads_this_month ?? 0} new this month
            </p>
          </CardContent>
        </Card>

        {/* High Priority */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority Open</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {s.high_priority_open ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Need immediate follow-up</p>
          </CardContent>
        </Card>

        {/* Admissions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admitted</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {s.leads_admitted ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {s.admissions_this_month ?? 0} this month
            </p>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {s.leads_lost ?? 0} leads lost
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Funnel + Source Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Funnel bar chart */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Funnel</CardTitle>
            <CardDescription>Leads at each stage of the admissions journey</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value) => [`${value} leads`, ""]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground border border-dashed rounded-lg">
                No leads yet — add your first lead from the pipeline.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source breakdown pie chart */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
            <CardDescription>Where are your leads coming from?</CardDescription>
          </CardHeader>
          <CardContent>
            {sourceChartData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="h-[200px] w-[200px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {sourceChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  {sourceChartData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground border border-dashed rounded-lg">
                No source data available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stage summary strip + Recent open leads */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Stage progress cards */}
        <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {PIPELINE_STAGES.map((stage) => {
            const count = (s as any)[stage.key] ?? 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            const Icon = stage.icon
            return (
              <Card key={stage.key} className="relative overflow-hidden">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className={`inline-flex items-center justify-center p-2 rounded-lg mb-2 ${stage.bg}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-bold">{count}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{stage.label}</p>
                  <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: stage.color }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{pct}% of pipeline</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Recent Open Leads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Active Leads</CardTitle>
            <CardDescription>Open leads requiring follow-up action</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/crm">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2 border border-dashed rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <p className="text-sm font-medium">All clear! No open leads.</p>
              <p className="text-xs text-muted-foreground">Add new leads from the pipeline view.</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between py-3 gap-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{lead.student_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.parent_name} · {lead.parent_phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lead.priority === "high" && (
                      <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 gap-1">
                        <Flame className="h-2.5 w-2.5" /> High
                      </Badge>
                    )}
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${statusBadge(lead.status)}`}
                    >
                      {lead.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/crm"
            className="p-4 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-colors block group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Full Pipeline</h3>
            </div>
            <p className="text-xs text-muted-foreground">Kanban board with all leads by stage</p>
          </Link>
          <Link
            to="/students"
            className="p-4 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-colors block"
          >
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-green-500" />
              <h3 className="font-semibold text-sm">Enrolled Students</h3>
            </div>
            <p className="text-xs text-muted-foreground">View and manage student records</p>
          </Link>
          <Link
            to="/notices"
            className="p-4 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-colors block"
          >
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-blue-500" />
              <h3 className="font-semibold text-sm">Notices & Updates</h3>
            </div>
            <p className="text-xs text-muted-foreground">Post school-wide announcements</p>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
