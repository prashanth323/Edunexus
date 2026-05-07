import { supabase } from "@/lib/supabase"

export type DailyAttendanceStatus = "present" | "absent" | "late" | "half_day"

export type AttendanceUpsertRow = {
  school_id: string
  student_id: string
  section_id: string
  academic_year_id: string
  date: string
  status: DailyAttendanceStatus
  marked_by?: string
  remarks?: string | null
}

export type SectionOption = {
  id: string
  name: string
  class_id: string
  class_name: string
}

export type EnrolledStudentRow = {
  id: string
  first_name: string
  last_name: string
  roll_number: string | null
}

export async function getCurrentAcademicYearId(schoolId: string): Promise<string | null> {
  const { data: current, error: curErr } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle()

  if (curErr) throw curErr
  if (current?.id) return current.id

  const { data: latest, error: latestErr } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestErr) throw latestErr
  return latest?.id ?? null
}

export async function getSectionsForYear(schoolId: string, academicYearId: string) {
  const { data, error } = await supabase
    .from("sections")
    .select(
      `
      id,
      name,
      class_id,
      classes ( id, name )
    `,
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) throw error
  return (data as any[]).map((row) => {
    const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes
    return {
      id: row.id as string,
      name: row.name as string,
      class_id: row.class_id as string,
      class_name: (cls?.name as string) ?? "Class",
    } satisfies SectionOption
  })
}

export async function getEnrolledStudentsForSection(
  schoolId: string,
  sectionId: string,
  academicYearId: string,
): Promise<EnrolledStudentRow[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `
      roll_no,
      students (
        id,
        first_name,
        last_name
      )
    `,
    )
    .eq("school_id", schoolId)
    .eq("section_id", sectionId)
    .eq("academic_year_id", academicYearId)
    .eq("status", "active")
    .order("roll_no", { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data as any[])
    .map((row) => {
      const st = Array.isArray(row.students) ? row.students[0] : row.students
      if (!st?.id) return null
      return {
        id: st.id as string,
        first_name: st.first_name as string,
        last_name: st.last_name as string,
        roll_number: (row.roll_no as string | null) ?? null,
      } satisfies EnrolledStudentRow
    })
    .filter(Boolean) as EnrolledStudentRow[]
}

export async function getDailyAttendanceForSectionDate(
  schoolId: string,
  sectionId: string,
  date: string,
) {
  const { data, error } = await supabase
    .from("attendance")
    .select("student_id, status")
    .eq("school_id", schoolId)
    .eq("section_id", sectionId)
    .eq("date", date)
    .is("subject_id", null)

  if (error) throw error
  return data as { student_id: string; status: string }[]
}

export async function upsertDailyAttendanceBatch(rows: AttendanceUpsertRow[]) {
  for (const row of rows) {
    const { data: existing, error: selErr } = await supabase
      .from("attendance")
      .select("id")
      .eq("school_id", row.school_id)
      .eq("student_id", row.student_id)
      .eq("date", row.date)
      .is("subject_id", null)
      .maybeSingle()

    if (selErr) throw selErr

    if (existing?.id) {
      const { error: upErr } = await supabase
        .from("attendance")
        .update({
          status: row.status,
          section_id: row.section_id,
          academic_year_id: row.academic_year_id,
          marked_by: row.marked_by ?? null,
          remarks: row.remarks ?? null,
        })
        .eq("id", existing.id)

      if (upErr) throw upErr
    } else {
      const { error: insErr } = await supabase.from("attendance").insert({
        school_id: row.school_id,
        student_id: row.student_id,
        section_id: row.section_id,
        academic_year_id: row.academic_year_id,
        date: row.date,
        status: row.status,
        marked_by: row.marked_by ?? null,
        subject_id: null,
        remarks: row.remarks ?? null,
      })

      if (insErr) throw insErr
    }
  }
}

// --- Principal attendance overview (see migration get_principal_attendance_stats) ---

export type PrincipalAttendanceToday = {
  total: number
  present: number
  absent: number
  late: number
  half_day: number
  other: number
  rate_pct: number
}

export type PrincipalAttendanceDayPoint = {
  date: string
  total: number
  present: number
  rate_pct: number
}

export type PrincipalAttendanceStats = {
  today: PrincipalAttendanceToday
  by_day: PrincipalAttendanceDayPoint[]
  status_breakdown: Record<string, number>
  period_days: number
}

export const EMPTY_PRINCIPAL_ATTENDANCE_STATS: PrincipalAttendanceStats = {
  today: {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    half_day: 0,
    other: 0,
    rate_pct: 0,
  },
  by_day: [],
  status_breakdown: {},
  period_days: 14,
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function mapPrincipalAttendanceRpc(raw: unknown): PrincipalAttendanceStats | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const t = r.today
  const today: PrincipalAttendanceToday =
    t && typeof t === "object" && !Array.isArray(t)
      ? {
          total: num((t as Record<string, unknown>).total),
          present: num((t as Record<string, unknown>).present),
          absent: num((t as Record<string, unknown>).absent),
          late: num((t as Record<string, unknown>).late),
          half_day: num((t as Record<string, unknown>).half_day),
          other: num((t as Record<string, unknown>).other),
          rate_pct: num((t as Record<string, unknown>).rate_pct),
        }
      : EMPTY_PRINCIPAL_ATTENDANCE_STATS.today

  let by_day: PrincipalAttendanceDayPoint[] = []
  const bd = r.by_day
  if (Array.isArray(bd)) {
    by_day = bd.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return { date: "", total: 0, present: 0, rate_pct: 0 }
      }
      const o = row as Record<string, unknown>
      return {
        date: String(o.date ?? ""),
        total: num(o.total),
        present: num(o.present),
        rate_pct: num(o.rate_pct),
      }
    })
  }

  let status_breakdown: Record<string, number> = {}
  const sb = r.status_breakdown
  if (sb && typeof sb === "object" && !Array.isArray(sb)) {
    for (const [k, v] of Object.entries(sb as Record<string, unknown>)) {
      status_breakdown[k] = num(v)
    }
  }

  return {
    today,
    by_day,
    status_breakdown,
    period_days: num(r.period_days) || 14,
  }
}

/** School-wide daily attendance stats (subject_id IS NULL rows only). Safe fallback if RPC is missing. */
export async function getPrincipalAttendanceStats(
  schoolId: string,
  periodDays = 14,
): Promise<PrincipalAttendanceStats> {
  try {
    const { data, error } = await supabase.rpc("get_principal_attendance_stats", {
      p_school_id: schoolId,
      p_days: periodDays,
    })
    if (!error && data != null) {
      const mapped = mapPrincipalAttendanceRpc(data)
      if (mapped) return mapped
    }
  } catch {
    /* function not deployed or network */
  }
  return { ...EMPTY_PRINCIPAL_ATTENDANCE_STATS, period_days: periodDays }
}
