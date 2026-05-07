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
