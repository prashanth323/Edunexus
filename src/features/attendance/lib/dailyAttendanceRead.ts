import { supabase } from "@/lib/supabase"

export type DailyAttendanceRow = {
  id: string
  student_id: string
  date: string
  status: string
  remarks: string | null
}

export async function fetchDailyAttendanceForStudent(
  studentId: string,
  fromDate: string,
  toDate: string,
): Promise<DailyAttendanceRow[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("id, student_id, date, status, remarks")
    .eq("student_id", studentId)
    .gte("date", fromDate)
    .lte("date", toDate)
    .is("subject_id", null)
    .order("date", { ascending: false })

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    student_id: r.student_id,
    date: r.date,
    status: r.status,
    remarks: r.remarks,
  }))
}

export const ATTENDANCE_STATUS_BADGE_CLASSES: Record<string, string> = {
  present: "bg-green-600 hover:bg-green-700",
  absent: "bg-red-600 hover:bg-red-700",
  late: "bg-yellow-500 hover:bg-yellow-600",
  half_day: "bg-orange-500 hover:bg-orange-600",
}
