import { supabase } from "@/lib/supabase"

export type ClassSectionOverviewRow = {
  section_id: string
  class_id: string
  class_name: string
  section_name: string
  class_teacher_id: string | null
  class_teacher_name: string | null
  class_teacher_phone: string | null
  student_count: number
  attendance_pct: number
  avg_exam_pct: number
}

export async function getClassSectionOverview(schoolId: string): Promise<ClassSectionOverviewRow[]> {
  const { data, error } = await supabase.rpc("get_class_section_overview", {
    p_school_id: schoolId,
  })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    section_id: String(row.section_id),
    class_id: String(row.class_id),
    class_name: String(row.class_name),
    section_name: String(row.section_name),
    class_teacher_id: row.class_teacher_id ? String(row.class_teacher_id) : null,
    class_teacher_name: row.class_teacher_name ? String(row.class_teacher_name) : null,
    class_teacher_phone: row.class_teacher_phone ? String(row.class_teacher_phone) : null,
    student_count: Number(row.student_count ?? 0),
    attendance_pct: Number(row.attendance_pct ?? 0),
    avg_exam_pct: Number(row.avg_exam_pct ?? 0),
  }))
}
