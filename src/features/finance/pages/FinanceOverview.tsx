import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  DollarSign,
  Download,
  CreditCard,
  Search,
  Loader2,
  ExternalLink,
  Receipt,
  FileStack,
  AlertTriangle,
  Wallet,
  Landmark,
} from "lucide-react"
import { Link } from "react-router-dom"
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
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format } from "date-fns"

import { DashboardStatCard } from "@/components/dashboard/StatCard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCardSkeletonGrid, TableSkeletonRows } from "@/components/ui/card-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getRecentTransactions,
  getMonthlyCollectionsStats,
  searchStudentsForSchool,
  getOpenInvoicesForStudent,
  listRecentInvoicesForSchool,
  getFinanceOverviewMetrics,
  EMPTY_FINANCE_METRICS,
  type FinancePrincipalMetrics,
} from "../api/finance.api"

type FinanceOverviewProps = {
  /** When true, omit full page chrome for use on role home dashboards. */
  embedded?: boolean
}

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground) / 0.45)", "hsl(var(--muted-foreground) / 0.25)", "hsl(var(--destructive) / 0.6)"]
const BAR_FILL = "hsl(var(--primary) / 0.85)"

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function FinanceOverviewMetricsSection({
  m,
  transactionsLen,
}: {
  m: FinancePrincipalMetrics
  transactionsLen: number
}) {
  const scaleBars = [
    { label: "Payment records", value: m.paymentsTotalCount },
    { label: "Total invoices", value: m.totalInvoicesCount },
    { label: "Open balances", value: m.openInvoicesCount },
    { label: "Overdue", value: m.overdueInvoicesCount },
  ]

  const statusPie = [
    { name: "Pending", value: m.invoiceStatusPending },
    { name: "Partial", value: m.invoiceStatusPartial },
    { name: "Paid", value: m.invoiceStatusPaid },
    { name: "Overdue", value: m.overdueInvoicesCount },
  ].filter((d) => d.value > 0)

  const pieData = statusPie.length > 0 ? statusPie : []

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard
          title="Pending fees"
          displayValue={fmtMoney(m.pendingFeesAmount)}
          description="Sum of due on open invoices"
          icon={Wallet}
        />
        <DashboardStatCard
          title="Collections (this month)"
          displayValue={fmtMoney(m.collectionsThisMonth)}
          description="Recorded in school dashboard view"
          icon={Landmark}
        />
        <DashboardStatCard
          title="Payment records"
          value={m.paymentsTotalCount}
          description="All non-refunded payments"
          icon={CreditCard}
        />
        <DashboardStatCard
          title="Recent list preview"
          value={transactionsLen}
          description="Latest rows shown beside chart"
          icon={Receipt}
        />
        <DashboardStatCard
          title="Open invoices"
          value={m.openInvoicesCount}
          description="Invoices with due &gt; 0"
          icon={FileStack}
        />
        <DashboardStatCard title="Total invoices" value={m.totalInvoicesCount} icon={Receipt} />
        <DashboardStatCard
          title="Overdue"
          value={m.overdueInvoicesCount}
          description="Status overdue, balance outstanding"
          icon={AlertTriangle}
        />
        <DashboardStatCard
          title="Partially paid"
          value={m.invoiceStatusPartial}
          icon={DollarSign}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ERP scale</CardTitle>
            <CardDescription>Volume metrics compared side by side</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scaleBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={BAR_FILL} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice status</CardTitle>
            <CardDescription>Counts by invoice state</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col">
            {pieData.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                No invoice data yet
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {pieData.map((d, i) => (
                        <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
                <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground pt-2">
                  {pieData.map((d) => (
                    <span key={d.name}>
                      {d.name}: {d.value.toLocaleString()}
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export function FinanceOverview({ embedded = false }: FinanceOverviewProps) {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)

  const { data: transactions = [], isLoading: txLoading, isFetching: txFetching } = useQuery({
    queryKey: ["recent-transactions", activeSchoolId],
    queryFn: () => getRecentTransactions(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: collections = [], isLoading: colLoading, isFetching: colFetching } = useQuery({
    queryKey: ["monthly-collections", activeSchoolId],
    queryFn: () => getMonthlyCollectionsStats(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const {
    data: finMetrics,
    isLoading: metricsLoading,
    isFetching: metricsFetching,
  } = useQuery({
    queryKey: ["finance-overview-metrics", activeSchoolId],
    queryFn: () => getFinanceOverviewMetrics(activeSchoolId!),
    enabled: !!activeSchoolId,
    staleTime: 60_000,
  })

  const m = finMetrics

  const { data: searchResults = [], isFetching: searchBusy } = useQuery({
    queryKey: ["finance-student-search", activeSchoolId, searchTerm],
    queryFn: () => searchStudentsForSchool(activeSchoolId!, searchTerm),
    enabled: !!activeSchoolId && searchTerm.trim().length >= 2,
  })

  const { data: studentInvoices = [], isLoading: invStudentLoading } = useQuery({
    queryKey: ["finance-student-open-invoices", activeSchoolId, selectedStudentId],
    queryFn: () => getOpenInvoicesForStudent(activeSchoolId!, selectedStudentId!),
    enabled: !!activeSchoolId && !!selectedStudentId,
  })

  const { data: schoolInvoices = [], isLoading: invListLoading } = useQuery({
    queryKey: ["finance-school-invoices", activeSchoolId],
    queryFn: () => listRecentInvoicesForSchool(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const isLoading = txLoading || colLoading || metricsLoading

  const chartData = collections?.length ? collections : []

  const overviewRefreshing = metricsFetching || txFetching || colFetching

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ERP</h1>
          <p className="text-muted-foreground mt-1">Track fee collections, pending dues, and invoices.</p>
        </div>
        <StatCardSkeletonGrid count={4} columnsClassName="grid gap-4 md:grid-cols-2 lg:grid-cols-4" />
        <Skeleton className="h-10 w-full max-w-lg rounded-md" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardContent className="pt-6">
              <div className="h-[280px] w-full rounded-md bg-muted/50 animate-pulse" />
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardContent className="pt-6">
              <div className="h-[280px] w-full rounded-md bg-muted/50 animate-pulse" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const headerBlock = embedded ? (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 flex-1 w-full">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">ERP</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Summary and quick access — open the full module for detailed work.
          </p>
        </div>
        {overviewRefreshing ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Updating…
          </div>
        ) : null}
      </div>
      <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
        <Link to="/finance">
          Full ERP view <ExternalLink className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  ) : (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 flex-1 w-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ERP</h1>
          <p className="text-muted-foreground mt-1">
            Track fee collections, pending dues, and invoices.
          </p>
        </div>
        {overviewRefreshing ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Updating…
          </div>
        ) : null}
      </div>
      <Button className="shrink-0 gap-2" type="button" variant="secondary">
        <Download className="h-4 w-4" /> Export Report
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {headerBlock}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="collect">Collect Fee</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <FinanceOverviewMetricsSection
            m={m ?? EMPTY_FINANCE_METRICS}
            transactionsLen={transactions.length}
          />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Collection trends</CardTitle>
                <CardDescription>
                  {collections?.length
                    ? "Monthly revenue from the database view"
                    : "No rows in v_monthly_collections for this school yet."}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                {collections?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="erpCollectedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                      />
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
                      />
                      <RechartsTooltip
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
                        fill="url(#erpCollectedGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground border border-dashed rounded-lg">
                    No collection series to display.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Recent transactions</CardTitle>
                <CardDescription>Latest payments for this school</CardDescription>
              </CardHeader>
              <CardContent>
                {!transactions.length ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No payments found. Record payments against invoices to see them here.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-sm truncate">
                            {tx.student?.first_name} {tx.student?.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {tx.student?.admission_no} •{" "}
                            {format(new Date(tx.payment_date), "MMM dd, yyyy")}
                          </span>
                        </div>
                        <div className="flex flex-col items-end shrink-0 ml-2">
                          <span className="font-bold text-green-600 dark:text-green-500">
                            +{Number(tx.amount).toLocaleString()}
                          </span>
                          <Badge variant="outline" className="text-[10px] mt-1 h-5 capitalize">
                            {String(tx.payment_method).replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="collect">
          <Card>
            <CardHeader>
              <CardTitle>Collect student fee</CardTitle>
              <CardDescription>
                Search by admission number or name, then review open invoice balances (due_amount &gt;
                0).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row w-full sm:max-w-lg gap-2">
                <Input
                  type="text"
                  placeholder="Admission number or name (min 2 chars)..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setSelectedStudentId(null)
                  }}
                />
                <Button type="button" variant="secondary" disabled={searchTerm.trim().length < 2}>
                  Search
                </Button>
              </div>

              {searchBusy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              )}

              {searchTerm.trim().length >= 2 && !searchBusy && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground">No students matched.</p>
              )}

              {searchResults.length > 0 && (
                <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                  {searchResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 ${selectedStudentId === s.id ? "bg-muted" : ""}`}
                      onClick={() => setSelectedStudentId(s.id)}
                    >
                      <span className="font-medium">
                        {s.first_name} {s.last_name}
                      </span>
                      <span className="text-muted-foreground ml-2">{s.admission_no}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedStudentId && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Open invoices</h4>
                  {invStudentLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : !studentInvoices.length ? (
                    <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-6">
                      No invoices with an outstanding balance for this student.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {studentInvoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex flex-wrap justify-between gap-2 border rounded-lg p-3 text-sm"
                        >
                          <div>
                            <p className="font-medium">{inv.invoice_no}</p>
                            <p className="text-muted-foreground text-xs">
                              Due {format(new Date(inv.due_date), "yyyy-MM-dd")} · {inv.status}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-destructive">
                              Due: {Number(inv.due_amount).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Paid {Number(inv.paid_amount).toFixed(2)} of{" "}
                              {Number(inv.amount).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        Recording a payment updates invoices via the database trigger on{" "}
                        <code className="text-[10px]">payments</code>.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!selectedStudentId && searchTerm.trim().length < 2 && (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg text-muted-foreground">
                  <Search className="h-10 w-10 mb-4 opacity-50" />
                  <p className="text-center text-sm">Enter at least two characters to search.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Invoice list</CardTitle>
              <CardDescription>Recent invoices for the active school.</CardDescription>
            </CardHeader>
            <CardContent>
              {invListLoading ? (
                <TableSkeletonRows rows={6} cols={5} />
              ) : !schoolInvoices.length ? (
                <p className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-lg">
                  No invoices found.
                </p>
              ) : (
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="p-3 font-medium">Invoice</th>
                        <th className="p-3 font-medium">Student</th>
                        <th className="p-3 font-medium">Due</th>
                        <th className="p-3 font-medium text-right">Due amt</th>
                        <th className="p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolInvoices.map((inv) => (
                        <tr key={inv.id} className="border-b last:border-0">
                          <td className="p-3 font-mono text-xs">{inv.invoice_no}</td>
                          <td className="p-3">
                            {inv.students
                              ? `${inv.students.first_name} ${inv.students.last_name}`
                              : "—"}
                            <span className="text-muted-foreground text-xs block">
                              {inv.students?.admission_no}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {format(new Date(inv.due_date), "MMM d, yyyy")}
                          </td>
                          <td className="p-3 text-right">{Number(inv.due_amount).toFixed(2)}</td>
                          <td className="p-3 capitalize">{inv.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
