import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { format, parseISO } from "date-fns"
import { BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCardSkeletonGrid } from "@/components/ui/card-skeleton"
import { getSchoolById, getSchoolInsightMetrics } from "@/features/dashboard/api/platform.api"

function safeShortDate(raw: string) {
  try {
    const d = raw.includes("T") ? parseISO(raw) : parseISO(`${raw}T12:00:00Z`)
    return format(d, "MMM d")
  } catch {
    return raw.slice(5, 10)
  }
}

export function SchoolInsightsDetail() {
  const { schoolId = "" } = useParams<{ schoolId: string }>()

  const schoolQuery = useQuery({
    queryKey: ["school-brief", schoolId],
    queryFn: () => getSchoolById(schoolId),
    enabled: !!schoolId,
  })

  const metricsQuery = useQuery({
    queryKey: ["school-insights", schoolId],
    queryFn: () => getSchoolInsightMetrics(schoolId),
    enabled: !!schoolId,
  })

  if (!schoolId) {
    return <p className="text-muted-foreground text-sm">Invalid school.</p>
  }

  const loading = schoolQuery.isPending || metricsQuery.isPending

  const school = schoolQuery.data
  const metrics = metricsQuery.data

  const headcountData = metrics
    ? [
        { name: "Students", value: metrics.studentCount },
        { name: "Staff", value: metrics.staffCount },
      ]
    : []

  const attendanceChartData = metrics?.attendanceByDay.map((d) => ({
    ...d,
    label: safeShortDate(d.date),
  }))

  const showEmptyEnrollmentNote =
    metrics && metrics.studentCount === 0 && metrics.staffCount === 0 && !metricsQuery.isFetching

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <Link to="/insights" className="text-sm text-muted-foreground hover:text-foreground inline-block">
        ← All schools
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
          <BarChart3 className="h-8 w-8 text-primary shrink-0" aria-hidden />
          <span>{school?.name ?? (loading ? "Loading…" : "School overview")}</span>
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Snapshot by enrollment and recent attendance marking activity (past 14 days).
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <StatCardSkeletonGrid count={2} columnsClassName="grid gap-4 sm:grid-cols-2" />
          <Card>
            <CardContent className="pt-6">
              <div className="h-[220px] w-full rounded-md bg-muted/50 animate-pulse border" />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!loading && schoolQuery.isError ? (
        <Card className="border-dashed">
          <CardContent className="pt-8 pb-8 text-center space-y-3 max-w-lg mx-auto">
            <p className="font-medium text-foreground">Couldn&apos;t load this school</p>
            <p className="text-sm text-muted-foreground">
              Please try again shortly. If the problem persists the school reference may no longer be available.
            </p>
            <Button type="button" variant="outline" onClick={() => schoolQuery.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !schoolQuery.isError && schoolQuery.isFetched && school == null ? (
        <Card className="border-dashed">
          <CardContent className="pt-8 pb-8 text-center space-y-2">
            <p className="font-medium text-foreground">School not found</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This school doesn&apos;t exist in your current view or may have been archived. Confirm the link or choose
              another school from the insights list.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/insights">Back to school insights</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && school && metricsQuery.isError ? (
        <Card className="border-dashed">
          <CardContent className="pt-8 pb-8 text-center space-y-3 max-w-lg mx-auto">
            <p className="font-medium text-foreground">Unable to refresh metrics right now</p>
            <p className="text-sm text-muted-foreground">
              Check your connection and try again. If the issue continues, metrics may still be provisioning for this
              school.
            </p>
            <Button type="button" variant="outline" onClick={() => metricsQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && school && metricsQuery.isSuccess && metrics ? (
        <div className="space-y-4">
          {showEmptyEnrollmentNote ? (
            <Card className="bg-muted/30 border-muted">
              <CardContent className="py-4 text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground font-medium">No staffing or student records yet.</strong> Figures
                will populate once this school onboard people in the Staff and Students modules. Attendance charts fill
                in when marking begins for enrolled classes — until then you may see zeros or an empty timeline.
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Headcount</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={headcountData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {metrics.studentCount === 0 && metrics.staffCount === 0 ? (
                  <p className="sr-only">Zero students and zero staff recorded for this school.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attendance activity</CardTitle>
                <p className="text-xs text-muted-foreground font-normal mt-1">
                  Number of attendance marks logged per calendar day (all sections).
                </p>
              </CardHeader>
              <CardContent className="h-64">
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
                    <p className="text-sm font-medium text-foreground">No attendance recorded in this window</p>
                    <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                      After timetables and daily attendance marking are in use, you&apos;ll see a day-by-day view here.
                      This is expected for new schools still setting up academics.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  )
}
