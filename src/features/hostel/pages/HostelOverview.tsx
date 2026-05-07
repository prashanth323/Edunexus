import { useQuery } from "@tanstack/react-query"
import { Home, Loader2, BedDouble, Users, Percent } from "lucide-react"
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
  getHostelRooms,
  getHostelPrincipalOverview,
  EMPTY_HOSTEL_OVERVIEW,
} from "../api/hostel.api"

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground) / 0.35)"]
const BAR_FILL = "hsl(var(--primary) / 0.85)"

export function HostelOverview() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["hostel-rooms", activeSchoolId],
    queryFn: () => getHostelRooms(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: overview = EMPTY_HOSTEL_OVERVIEW, isFetching } = useQuery({
    queryKey: ["hostel-principal-overview", activeSchoolId],
    queryFn: () => getHostelPrincipalOverview(activeSchoolId!),
    enabled: !!activeSchoolId,
    placeholderData: EMPTY_HOSTEL_OVERVIEW,
    staleTime: 60_000,
  })

  const h = overview

  const roomsInactive = Math.max(0, h.roomsTotal - h.roomsActive)

  const occupancyMix =
    h.bedCapacityTotal > 0
      ? [
          { name: "Filled", value: h.allocationsCount },
          { name: "Available", value: Math.max(0, h.bedCapacityTotal - h.allocationsCount) },
        ].filter((d) => d.value > 0)
      : []

  const mixForChart = occupancyMix.length > 0 ? occupancyMix : []

  const scaleBars = [
    { label: "Rooms", value: h.roomsTotal },
    { label: "Active rooms", value: h.roomsActive },
    { label: "Bed capacity", value: h.bedCapacityTotal },
    { label: "Residents", value: h.allocationsCount },
  ]

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hostel</h1>
          <p className="text-muted-foreground mt-1">Rooms, capacity, and occupancy for the active school.</p>
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
      <div className="text-sm text-muted-foreground py-12 text-center">Select a school to view hostel data.</div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hostel</h1>
          <p className="text-muted-foreground mt-1">Rooms, capacity, and occupancy for the active school.</p>
        </div>
        {isFetching ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Updating…
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard title="Rooms" value={h.roomsTotal} description="All configured" icon={Home} />
        <DashboardStatCard
          title="Active rooms"
          value={h.roomsActive}
          description={`${roomsInactive} inactive`}
          icon={BedDouble}
        />
        <DashboardStatCard title="Bed capacity" value={h.bedCapacityTotal} description="Active rooms only" icon={Users} />
        <DashboardStatCard
          title="Current residents"
          value={h.allocationsCount}
          description="Allocations on file"
          icon={Users}
        />
        <DashboardStatCard
          title="Occupancy"
          displayValue={`${h.occupancyPct}%`}
          description="Residents vs capacity"
          icon={Percent}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hostel scale</CardTitle>
            <CardDescription>Inventory vs occupancy drivers</CardDescription>
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
            <CardTitle>Capacity use</CardTitle>
            <CardDescription>Residents vs available beds (active rooms)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col">
            {mixForChart.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                No capacity data yet
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
                  <span>
                    Residents: {h.allocationsCount} / {h.bedCapacityTotal || "—"}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Rooms
          </CardTitle>
          <CardDescription>Hostel inventory for the active school</CardDescription>
        </CardHeader>
        <CardContent>
          {!rooms?.length ? (
            <p className="text-sm text-muted-foreground">No hostel rooms found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead>Block</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Capacity</TableHead>
                  <TableHead className="text-right">Monthly fee</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.room_no}</TableCell>
                    <TableCell>{r.block ?? "—"}</TableCell>
                    <TableCell>{r.floor ?? "—"}</TableCell>
                    <TableCell className="capitalize">{r.type.replace("_", " ")}</TableCell>
                    <TableCell className="text-right">{r.capacity}</TableCell>
                    <TableCell className="text-right">
                      {(typeof r.monthly_fee === "number"
                        ? r.monthly_fee
                        : Number(r.monthly_fee)
                      ).toFixed(2)}
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
  )
}
