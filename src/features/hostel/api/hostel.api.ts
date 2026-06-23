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

export type HostelPrincipalOverview = {
  roomsTotal: number
  roomsActive: number
  bedCapacityTotal: number
  allocationsCount: number
  occupancyPct: number
}

export const EMPTY_HOSTEL_OVERVIEW: HostelPrincipalOverview = {
  roomsTotal: 0,
  roomsActive: 0,
  bedCapacityTotal: 0,
  allocationsCount: 0,
  occupancyPct: 0,
}

export async function getHostelPrincipalOverview(schoolId: string): Promise<HostelPrincipalOverview> {
  const [roomsTotal, roomsActive, allocationsCount] = await Promise.all([
    safeHeadCount(
      supabase.from("hostel_rooms").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
    ),
    safeHeadCount(
      supabase
        .from("hostel_rooms")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("is_active", true),
    ),
    safeHeadCount(
      supabase
        .from("hostel_allocations")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId),
    ),
  ])

  const { data: roomRows, error: roomErr } = await supabase
    .from("hostel_rooms")
    .select("capacity")
    .eq("school_id", schoolId)
    .eq("is_active", true)

  const bedCapacityTotal = roomErr
    ? 0
    : (roomRows ?? []).reduce((sum, r) => {
        const c = typeof r.capacity === "number" ? r.capacity : Number(r.capacity)
        return sum + (Number.isFinite(c) ? c : 0)
      }, 0)

  const occupancyPct =
    bedCapacityTotal > 0 ? Math.min(100, Math.round((allocationsCount * 100) / bedCapacityTotal)) : 0

  return {
    roomsTotal,
    roomsActive,
    bedCapacityTotal,
    allocationsCount,
    occupancyPct,
  }
}

export type HostelRoomRow = {
  id: string
  school_id: string
  room_no: string
  block: string | null
  floor: number | null
  type: string
  capacity: number
  monthly_fee: number
  is_active: boolean
}

export async function getHostelRooms(schoolId: string) {
  const { data, error } = await supabase
    .from("hostel_rooms")
    .select("id, school_id, room_no, block, floor, type, capacity, monthly_fee, is_active")
    .eq("school_id", schoolId)
    .order("block", { ascending: true })
    .order("room_no", { ascending: true })

  if (error) throw error
  return (data ?? []) as HostelRoomRow[]
}

export async function createHostelRoom(schoolId: string, input: Omit<HostelRoomRow, "id" | "school_id">) {
  const { data, error } = await supabase
    .from("hostel_rooms")
    .insert({ school_id: schoolId, ...input })
    .select()
    .single()
  if (error) throw error
  return data
}

export type HostelAllocationRow = {
  id: string
  student_id: string
  room_id: string
  check_in_date: string
  is_active: boolean
  students?: { admission_no: string; profiles: { full_name: string } | null } | null
  hostel_rooms?: { room_no: string; block: string | null } | null
}

export async function getHostelAllocations(schoolId: string) {
  const { data, error } = await supabase
    .from("hostel_allocations")
    .select(`
      id, student_id, room_id, check_in_date, is_active,
      students ( admission_no, profiles:profile_id ( full_name ) ),
      hostel_rooms ( room_no, block )
    `)
    .eq("school_id", schoolId)
    .eq("is_active", true)
  if (error) throw error
  return (data ?? []).map((row) => {
    const st = row.students
    const student = Array.isArray(st) ? st[0] : st
    const prof = student?.profiles
    const profile = Array.isArray(prof) ? prof[0] : prof
    const room = row.hostel_rooms
    const roomObj = Array.isArray(room) ? room[0] : room
    return {
      ...row,
      students: student ? { admission_no: student.admission_no, profiles: profile ?? null } : null,
      hostel_rooms: roomObj ?? null,
    }
  }) as HostelAllocationRow[]
}

export async function assignHostelRoom(params: {
  schoolId: string
  studentId: string
  roomId: string
  academicYearId: string
}) {
  const { error } = await supabase.from("hostel_allocations").insert({
    school_id: params.schoolId,
    student_id: params.studentId,
    room_id: params.roomId,
    academic_year_id: params.academicYearId,
    check_in_date: new Date().toISOString().slice(0, 10),
    is_active: true,
  })
  if (error) throw error
}

export async function changeHostelRoom(allocationId: string, newRoomId: string) {
  const { error } = await supabase
    .from("hostel_allocations")
    .update({ room_id: newRoomId })
    .eq("id", allocationId)
  if (error) throw error
}
