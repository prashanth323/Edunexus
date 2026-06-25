import { supabase } from "@/lib/supabase"
import { hostelStatusLabel } from "../lib/hostelStatusLabels"

export type HostelStatusEvent = {
  event_id: string
  status: string
  status_label: string
  notes: string | null
  recorded_at: string
}

export type StudentHostelStatusInfo = {
  student_id: string
  admission_no: string
  student_name: string
  current_status: string | null
  current_status_label: string | null
  room_no: string | null
  block: string | null
  status_updated_at: string | null
  events: HostelStatusEvent[]
}

export type WardHostelStatusRow = {
  student_id: string
  admission_no: string
  student_name: string
  resident_status: string
  status_label: string
  status_updated_at: string
  room_label: string | null
}

function mapHostelStatusInfo(raw: Record<string, unknown>): StudentHostelStatusInfo {
  const events = Array.isArray(raw.events) ? raw.events : []
  return {
    student_id: String(raw.student_id ?? ""),
    admission_no: String(raw.admission_no ?? ""),
    student_name: String(raw.student_name ?? ""),
    current_status: raw.current_status ? String(raw.current_status) : null,
    current_status_label: raw.current_status_label ? String(raw.current_status_label) : null,
    room_no: raw.room_no ? String(raw.room_no) : null,
    block: raw.block ? String(raw.block) : null,
    status_updated_at: raw.status_updated_at ? String(raw.status_updated_at) : null,
    events: events.map((e) => {
      const row = e as Record<string, unknown>
      const status = String(row.status ?? "")
      return {
        event_id: String(row.event_id ?? ""),
        status,
        status_label: String(row.status_label ?? hostelStatusLabel(status)),
        notes: row.notes ? String(row.notes) : null,
        recorded_at: String(row.recorded_at ?? ""),
      }
    }),
  }
}

export async function getStudentHostelStatusInfo(
  studentId: string,
): Promise<StudentHostelStatusInfo | null> {
  const { data, error } = await supabase.rpc("get_student_hostel_status_info", {
    p_student_id: studentId,
  })
  if (error) {
    if (error.message?.toLowerCase().includes("not authorized")) return null
    throw error
  }
  if (!data || typeof data !== "object") return null
  return mapHostelStatusInfo(data as Record<string, unknown>)
}

export async function getMyWardHostelStatus(): Promise<WardHostelStatusRow[]> {
  const { data, error } = await supabase.rpc("get_my_ward_hostel_status")
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    student_id: String(row.student_id),
    admission_no: String(row.admission_no ?? ""),
    student_name: String(row.student_name ?? ""),
    resident_status: String(row.resident_status ?? ""),
    status_label: String(row.status_label ?? hostelStatusLabel(String(row.resident_status ?? ""))),
    status_updated_at: String(row.status_updated_at ?? ""),
    room_label: row.room_label ? String(row.room_label) : null,
  }))
}
