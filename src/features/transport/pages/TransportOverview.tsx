import { useQuery } from "@tanstack/react-query"
import { Bus, Loader2, MapPin, Route, Users, Gauge } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import {
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

import { DashboardStatCard } from "@/components/dashboard/StatCard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCardSkeletonGrid } from "@/components/ui/card-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getBuses,
  getRoutes,
  getRouteStudents,
  getTransportPrincipalOverview,
  EMPTY_TRANSPORT_OVERVIEW,
} from "../api/transport.api"
import { TransportManageDialog } from "../components/TransportManageDialog"
import { StudentAdmissionLookupPanel } from "@/features/students/components/StudentAdmissionLookupPanel"
import { getPendingTransportStudents } from "@/features/students/api/studentService.api"

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground) / 0.35)"]
const BAR_FILL = "hsl(var(--primary) / 0.85)"

export function TransportOverview() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get("tab") ?? "overview"
  const setTab = (value: string) => setSearchParams({ tab: value }, { replace: true })

  const { data: buses, isLoading: busesLoading } = useQuery({
    queryKey: ["transport-buses", activeSchoolId],
    queryFn: () => getBuses(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ["transport-routes", activeSchoolId],
    queryFn: () => getRoutes(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: overview = EMPTY_TRANSPORT_OVERVIEW, isFetching } = useQuery({
    queryKey: ["transport-principal-overview", activeSchoolId],
    queryFn: () => getTransportPrincipalOverview(activeSchoolId!),
    enabled: !!activeSchoolId,
    placeholderData: EMPTY_TRANSPORT_OVERVIEW,
    staleTime: 60_000,
  })

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-transport", activeSchoolId],
    queryFn: () => getPendingTransportStudents(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: routeStudents = [] } = useQuery({
    queryKey: ["route-students", activeSchoolId],
    queryFn: () => getRouteStudents(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: routesList = [] } = useQuery({
    queryKey: ["transport-routes-map", activeSchoolId],
    queryFn: () => getRoutes(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const routeNameById = new Map(routesList.map((r) => [r.id, r.name]))

  const o = overview

  const loading = busesLoading || routesLoading

  const busMix = [
    { name: "Active", value: o.busesActive },
    { name: "Inactive", value: o.busesInactive },
  ].filter((d) => d.value > 0)

  const mixForChart = busMix.length > 0 ? busMix : []

  const scaleBars = [
    { label: "Buses", value: o.busesTotal },
    { label: "Routes", value: o.routesTotal },
    { label: "Seat capacity", value: o.fleetSeatCapacity },
    { label: "Students on routes", value: o.routeStudentsCount },
    { label: "Stops", value: o.routeStopsCount },
  ]

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transport</h1>
          <p className="text-muted-foreground mt-1">Fleet, routes, and assignments for the active school.</p>
        </div>
        <StatCardSkeletonGrid count={4} />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full rounded-md bg-muted/60 animate-pulse" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full rounded-md bg-muted/60 animate-pulse" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!activeSchoolId) {
    return (
      <div className="text-sm text-muted-foreground py-12 text-center">Select a school to view transport.</div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transport</h1>
          <p className="text-muted-foreground mt-1">Fleet, routes, and assignments for the active school.</p>
        </div>
        <TransportManageDialog />
        {isFetching ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Updating…
          </div>
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pending">Pending requests ({pending.length})</TabsTrigger>
          <TabsTrigger value="allocate">Allocate</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending transport requests</CardTitle>
              <CardDescription>Students who requested school bus without an active route assignment</CardDescription>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending transport requests.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission no.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Parent phone</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((row) => (
                      <TableRow key={row.student_id}>
                        <TableCell className="font-mono text-sm">{row.admission_no}</TableCell>
                        <TableCell>
                          {row.first_name} {row.last_name}
                        </TableCell>
                        <TableCell>
                          {[row.class_name, row.section_name].filter(Boolean).join(" - ") || "—"}
                        </TableCell>
                        <TableCell>{row.parent_phone ?? "—"}</TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-sm text-primary underline"
                            onClick={() => setTab("allocate")}
                          >
                            Allocate
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocate" className="mt-4">
          {activeSchoolId && (
            <StudentAdmissionLookupPanel schoolId={activeSchoolId} mode="transport" />
          )}
        </TabsContent>

        <TabsContent value="overview" className="mt-4 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard title="Buses" value={o.busesTotal} description={`${o.busesActive} active`} icon={Bus} />
        <DashboardStatCard title="Routes" value={o.routesTotal} description={`${o.routesActive} active`} icon={Route} />
        <DashboardStatCard
          title="Fleet seats"
          value={o.fleetSeatCapacity}
          description="Sum of bus capacities"
          icon={Gauge}
        />
        <DashboardStatCard
          title="Students on routes"
          value={o.routeStudentsCount}
          description="Route assignments"
          icon={Users}
        />
        <DashboardStatCard title="Route stops" value={o.routeStopsCount} icon={MapPin} />
        <DashboardStatCard
          title="Inactive buses"
          value={o.busesInactive}
          description="Not in active service"
          icon={Bus}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transport scale</CardTitle>
            <CardDescription>Key operational counts</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scaleBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12 }} />
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
            <CardTitle>Fleet status</CardTitle>
            <CardDescription>Active vs inactive buses</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col">
            {mixForChart.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                No buses configured yet
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mixForChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {mixForChart.map((_, i) => (
                        <Cell key={mixForChart[i].name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
                <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                  <span>Active: {o.busesActive}</span>
                  <span>Inactive: {o.busesInactive}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bus className="h-5 w-5" />
              Fleet
            </CardTitle>
            <CardDescription>Registered vehicles</CardDescription>
          </CardHeader>
          <CardContent>
            {!buses?.length ? (
              <p className="text-sm text-muted-foreground">No buses found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registration</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Seats</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buses.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.registration_no}</TableCell>
                      <TableCell>{b.make_model ?? "—"}</TableCell>
                      <TableCell className="text-right">{b.capacity}</TableCell>
                      <TableCell>
                        <Badge variant={b.is_active ? "secondary" : "outline"}>
                          {b.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Routes
            </CardTitle>
            <CardDescription>Named routes and fares</CardDescription>
          </CardHeader>
          <CardContent>
            {!routes?.length ? (
              <p className="text-sm text-muted-foreground">No routes found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Fare</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routes.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">
                        {(typeof r.fare === "number" ? r.fare : Number(r.fare)).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? "secondary" : "outline"}>
                          {r.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Students on routes
          </CardTitle>
          <CardDescription>Active route assignments for the current school</CardDescription>
        </CardHeader>
        <CardContent>
          {routeStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students assigned to routes yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission no.</TableHead>
                  <TableHead>Route</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routeStudents.map((rs) => (
                  <TableRow key={rs.id}>
                    <TableCell>{rs.students?.profiles?.full_name ?? "—"}</TableCell>
                    <TableCell>{rs.students?.admission_no ?? "—"}</TableCell>
                    <TableCell>{routeNameById.get(rs.route_id) ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
