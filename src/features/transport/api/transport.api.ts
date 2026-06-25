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
  bus_number: string | null
  make_model: string | null
  capacity: number
  is_active: boolean
  approval_status?: string
  rejection_notes?: string | null
}

export type RouteRow = {
  id: string
  school_id: string
  name: string
  route_code: string | null
  description: string | null
  fare: number
  is_active: boolean
  bus_id: string | null
  approval_status?: string
  rejection_notes?: string | null
}

export type AssignedTransportStudent = {
  route_student_id: string
  student_id: string
  admission_no: string
  student_name: string
  class_name: string | null
  section_name: string | null
  route_id: string
  route_code: string | null
  route_name: string
  bus_registration: string | null
}

export async function getBuses(schoolId: string, opts?: { approvedOnly?: boolean; managerView?: boolean }) {
  let q = supabase
    .from("buses")
    .select("id, school_id, registration_no, bus_number, make_model, capacity, is_active, approval_status, rejection_notes")
    .eq("school_id", schoolId)
    .order("registration_no", { ascending: true })

  if (opts?.approvedOnly) {
    q = q.in("approval_status", ["legacy", "approved"]).eq("is_active", true)
  } else if (!opts?.managerView) {
    q = q.in("approval_status", ["legacy", "approved"])
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as BusRow[]
}

export async function getRoutes(schoolId: string, opts?: { approvedOnly?: boolean; managerView?: boolean }) {
  let q = supabase
    .from("routes")
    .select("id, school_id, name, route_code, description, fare, is_active, bus_id, approval_status, rejection_notes")
    .eq("school_id", schoolId)
    .order("route_code", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })

  if (opts?.approvedOnly) {
    q = q.in("approval_status", ["legacy", "approved"]).eq("is_active", true)
  } else if (!opts?.managerView) {
    q = q.in("approval_status", ["legacy", "approved"])
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as RouteRow[]
}

export async function getPendingBuses(schoolId: string) {
  const { data, error } = await supabase
    .from("buses")
    .select("id, school_id, registration_no, bus_number, make_model, capacity, is_active, approval_status, submitted_at")
    .eq("school_id", schoolId)
    .eq("approval_status", "pending_vp")
    .order("submitted_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as BusRow[]
}

export async function getPendingRoutes(schoolId: string) {
  const { data, error } = await supabase
    .from("routes")
    .select("id, school_id, name, route_code, description, fare, is_active, bus_id, approval_status, submitted_at")
    .eq("school_id", schoolId)
    .eq("approval_status", "pending_vp")
    .order("submitted_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as RouteRow[]
}

export async function createBus(
  schoolId: string,
  input: {
    registration_no: string
    bus_number?: string | null
    make_model?: string | null
    capacity: number
  },
) {
  const { data, error } = await supabase
    .from("buses")
    .insert({
      school_id: schoolId,
      registration_no: input.registration_no,
      bus_number: input.bus_number ?? null,
      make_model: input.make_model ?? null,
      capacity: input.capacity,
      is_active: false,
      approval_status: "draft",
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBus(id: string, patch: Partial<BusRow>) {
  const { error } = await supabase.from("buses").update(patch).eq("id", id)
  if (error) throw error
}

export async function createRoute(
  schoolId: string,
  input: {
    name: string
    route_code?: string | null
    description?: string | null
    fare: number
    bus_id?: string | null
  },
) {
  const { data, error } = await supabase
    .from("routes")
    .insert({
      school_id: schoolId,
      name: input.name,
      route_code: input.route_code ?? null,
      description: input.description ?? null,
      fare: input.fare,
      bus_id: input.bus_id ?? null,
      is_active: false,
      approval_status: "draft",
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function submitBusForApproval(busId: string) {
  const { error } = await supabase.rpc("submit_bus_for_approval", { p_bus_id: busId })
  if (error) throw error
}

export async function submitRouteForApproval(routeId: string) {
  const { error } = await supabase.rpc("submit_route_for_approval", { p_route_id: routeId })
  if (error) throw error
}

export async function reviewBus(busId: string, approve: boolean, notes?: string) {
  const { error } = await supabase.rpc("review_bus", {
    p_bus_id: busId,
    p_approve: approve,
    p_notes: notes ?? null,
  })
  if (error) throw error
}

export async function reviewRoute(routeId: string, approve: boolean, notes?: string) {
  const { error } = await supabase.rpc("review_route", {
    p_route_id: routeId,
    p_approve: approve,
    p_notes: notes ?? null,
  })
  if (error) throw error
}

export async function getAssignedTransportStudents(schoolId: string): Promise<AssignedTransportStudent[]> {
  const { data, error } = await supabase.rpc("get_transport_assigned_students", {
    p_school_id: schoolId,
  })
  if (error) throw error
  return (data ?? []) as AssignedTransportStudent[]
}

export type RouteStudentRow = {
  id: string
  student_id: string
  route_id: string
  academic_year_id: string
  students?: { admission_no: string; profiles: { full_name: string } | null } | null
}

export async function getRouteStudents(schoolId: string) {
  const { data, error } = await supabase
    .from("route_students")
    .select(`
      id, student_id, route_id, academic_year_id,
      students ( admission_no, profiles:profile_id ( full_name ) )
    `)
    .eq("school_id", schoolId)
    .eq("is_active", true)
  if (error) throw error
  return (data ?? []).map((row) => {
    const st = row.students
    const student = Array.isArray(st) ? st[0] : st
    const prof = student?.profiles
    const profile = Array.isArray(prof) ? prof[0] : prof
    return {
      ...row,
      students: student ? { admission_no: student.admission_no, profiles: profile ?? null } : null,
    }
  }) as RouteStudentRow[]
}

export async function assignStudentToRoute(params: {
  schoolId: string
  studentId: string
  routeId: string
  academicYearId: string
}) {
  const { error } = await supabase.from("route_students").insert({
    school_id: params.schoolId,
    student_id: params.studentId,
    route_id: params.routeId,
    academic_year_id: params.academicYearId,
  })
  if (error) throw error
}

export async function changeStudentRoute(routeStudentId: string, newRouteId: string) {
  const { error } = await supabase
    .from("route_students")
    .update({ route_id: newRouteId })
    .eq("id", routeStudentId)
  if (error) throw error
}
