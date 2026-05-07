import { supabase } from "@/lib/supabase"

async function safeHeadCount(
  req: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  try {
    const { count, error } = await req
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

export type TransportPrincipalOverview = {
  busesTotal: number
  busesActive: number
  busesInactive: number
  routesTotal: number
  routesActive: number
  fleetSeatCapacity: number
  routeStudentsCount: number
  routeStopsCount: number
}

export const EMPTY_TRANSPORT_OVERVIEW: TransportPrincipalOverview = {
  busesTotal: 0,
  busesActive: 0,
  busesInactive: 0,
  routesTotal: 0,
  routesActive: 0,
  fleetSeatCapacity: 0,
  routeStudentsCount: 0,
  routeStopsCount: 0,
}

export async function getTransportPrincipalOverview(schoolId: string): Promise<TransportPrincipalOverview> {
  const [
    busesTotal,
    busesActive,
    routesTotal,
    routesActive,
    routeStudentsCount,
    routeStopsCount,
  ] = await Promise.all([
    safeHeadCount(supabase.from("buses").select("*", { count: "exact", head: true }).eq("school_id", schoolId)),
    safeHeadCount(
      supabase.from("buses").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("is_active", true),
    ),
    safeHeadCount(supabase.from("routes").select("*", { count: "exact", head: true }).eq("school_id", schoolId)),
    safeHeadCount(
      supabase.from("routes").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("is_active", true),
    ),
    safeHeadCount(
      supabase.from("route_students").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
    ),
    safeHeadCount(
      supabase.from("route_stops").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
    ),
  ])

  const { data: busRows, error: busErr } = await supabase
    .from("buses")
    .select("capacity")
    .eq("school_id", schoolId)

  const fleetSeatCapacity = busErr
    ? 0
    : (busRows ?? []).reduce((sum, b) => sum + (typeof b.capacity === "number" ? b.capacity : Number(b.capacity) || 0), 0)

  return {
    busesTotal,
    busesActive,
    busesInactive: Math.max(0, busesTotal - busesActive),
    routesTotal,
    routesActive,
    fleetSeatCapacity,
    routeStudentsCount,
    routeStopsCount,
  }
}

export type BusRow = {
  id: string
  school_id: string
  registration_no: string
  make_model: string | null
  capacity: number
  is_active: boolean
}

export type RouteRow = {
  id: string
  school_id: string
  name: string
  fare: number
  is_active: boolean
  bus_id: string | null
}

export async function getBuses(schoolId: string) {
  const { data, error } = await supabase
    .from("buses")
    .select("id, school_id, registration_no, make_model, capacity, is_active")
    .eq("school_id", schoolId)
    .order("registration_no", { ascending: true })

  if (error) throw error
  return (data ?? []) as BusRow[]
}

export async function getRoutes(schoolId: string) {
  const { data, error } = await supabase
    .from("routes")
    .select("id, school_id, name, fare, is_active, bus_id")
    .eq("school_id", schoolId)
    .order("name", { ascending: true })

  if (error) throw error
  return (data ?? []) as RouteRow[]
}
