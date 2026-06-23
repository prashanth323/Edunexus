import { supabase } from "@/lib/supabase"

export type StaffAttendanceStatus = "present" | "absent" | "late" | "half_day"

export type StaffAttendanceUpsertRow = {
  school_id: string
  staff_id: string
  academic_year_id: string
  date: string
  status: StaffAttendanceStatus
  marked_by?: string
  remarks?: string | null
}

export type StaffRow = {
  id: string
  profile_id: string | null
  designation: string
  first_name: string
  last_name: string
  employee_code: string | null
  is_active: boolean
}

/**
 * Get all active staff members for a school (for the attendance marking list).
 */
export async function getActiveStaffForSchool(schoolId: string): Promise<StaffRow[]> {
  const { data, error } = await supabase
    .from("staff")
    .select(`
      id,
      profile_id,
      designation,
      employee_code,
      is_active,
      profiles (
        first_name,
        last_name
      )
    `)
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("employee_code", { ascending: true, nullsFirst: false })

  if (error) throw error

  return (data as any[]).map((row) => {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      id: row.id as string,
      profile_id: row.profile_id as string | null,
      designation: row.designation as string,
      employee_code: (row.employee_code as string | null) ?? null,
      is_active: row.is_active as boolean,
      first_name: (p?.first_name as string) ?? "Unknown",
      last_name: (p?.last_name as string) ?? "",
    } satisfies StaffRow
  })
}

/**
 * Get existing staff attendance records for a specific date.
 */
export async function getStaffAttendanceForDate(
  schoolId: string,
  date: string,
): Promise<{ staff_id: string; status: string; remarks: string | null }[]> {
  const { data, error } = await supabase
    .from("staff_attendance")
    .select("staff_id, status, remarks")
    .eq("school_id", schoolId)
    .eq("date", date)

  if (error) throw error
  return data as { staff_id: string; status: string; remarks: string | null }[]
}

/**
 * Upsert daily staff attendance records (one per staff member per day).
 */
export async function upsertStaffAttendanceBatch(rows: StaffAttendanceUpsertRow[]) {
  for (const row of rows) {
    const { data: existing, error: selErr } = await supabase
      .from("staff_attendance")
      .select("id")
      .eq("school_id", row.school_id)
      .eq("staff_id", row.staff_id)
      .eq("date", row.date)
      .maybeSingle()

    if (selErr) throw selErr

    if (existing?.id) {
      const { error: upErr } = await supabase
        .from("staff_attendance")
        .update({
          status: row.status,
          academic_year_id: row.academic_year_id,
          marked_by: row.marked_by ?? null,
          remarks: row.remarks ?? null,
        })
        .eq("id", existing.id)

      if (upErr) throw upErr
    } else {
      const { error: insErr } = await supabase.from("staff_attendance").insert({
        school_id: row.school_id,
        staff_id: row.staff_id,
        academic_year_id: row.academic_year_id,
        date: row.date,
        status: row.status,
        marked_by: row.marked_by ?? null,
        remarks: row.remarks ?? null,
      })

      if (insErr) throw insErr
    }
  }
}
