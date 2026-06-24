import { supabase } from "@/lib/supabase"

export const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5

export type TimetableSlot = {
  timetable_id: string
  section_id: string
  section_name: string
  class_name: string
  subject_id: string
  subject_name: string
  subject_code: string | null
  staff_id: string | null
  teacher_name: string | null
  day_of_week: number
  period_no: number
  start_time: string | null
  end_time: string | null
  room_no: string | null
}

export type SectionWithClassTeacher = {
  section_id: string
  section_name: string
  class_id: string
  class_name: string
  numeric_level: number | null
  academic_year_id: string
  academic_year: string
  is_current_year: boolean
  room_no: string | null
  capacity: number | null
  class_teacher_id: string | null
  class_teacher_name: string | null
  class_teacher_staff_id: string | null
}

export type UpsertSlotPayload = {
  id?: string
  school_id: string
  section_id: string
  subject_id: string
  staff_id: string | null
  day_of_week: number
  period_no: number
  start_time: string
  end_time: string
  room_no?: string | null
}

// ─── TIMETABLE QUERIES ────────────────────────────────────────

/** Fetch all timetable slots for a section (principal editor) */
export async function getTimetableForSection(sectionId: string) {
  const { data, error } = await supabase
    .from("v_section_timetable")
    .select("*")
    .eq("section_id", sectionId)
    .order("day_of_week")
    .order("period_no")

  if (error) throw error
  return (data ?? []) as TimetableSlot[]
}

/** Fetch teacher's own timetable slots */
export async function getMyTeacherTimetable(profileId: string, schoolId: string) {
  const { data, error } = await supabase
    .from("v_teacher_sections")
    .select("*")
    .eq("profile_id", profileId)
    .eq("school_id", schoolId)
    .order("day_of_week")
    .order("period_no")

  if (error) throw error
  return (data ?? []) as TimetableSlot[]
}

/** Fetch student's section timetable */
export async function getMyStudentTimetable(profileId: string, schoolId: string) {
  const { data, error } = await supabase
    .from("v_student_timetable")
    .select("*")
    .eq("student_profile_id", profileId)
    .eq("school_id", schoolId)
    .order("day_of_week")
    .order("period_no")

  if (error) throw error
  return (data ?? []) as TimetableSlot[]
}

// ─── SECTION & CLASS QUERIES ──────────────────────────────────

/** Fetch sections with class teacher info */
export async function getSectionsWithClassTeachers(schoolId: string): Promise<SectionWithClassTeacher[]> {
  const { data, error } = await supabase.rpc("get_sections_with_class_teachers", {
    p_school_id: schoolId,
  })

  if (error) throw error
  return (data ?? []) as SectionWithClassTeacher[]
}

/** Fetch classes list */
export async function getClasses(schoolId: string) {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, numeric_level, is_active")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("numeric_level", { ascending: true, nullsFirst: false })
    .order("name")

  if (error) throw error
  return data ?? []
}

/** Fetch sections for a class and academic year */
export async function getSections(schoolId: string, classId?: string, academicYearId?: string) {
  let query = supabase
    .from("sections")
    .select("id, name, class_id, academic_year_id, class_teacher_id, room_no, capacity")
    .eq("school_id", schoolId)
    .eq("is_active", true)

  if (classId) query = query.eq("class_id", classId)
  if (academicYearId) query = query.eq("academic_year_id", academicYearId)

  const { data, error } = await query.order("name")
  if (error) throw error
  return data ?? []
}

/** Fetch academic years */
export async function getAcademicYears(schoolId: string) {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, name, is_current, start_date, end_date")
    .eq("school_id", schoolId)
    .order("is_current", { ascending: false })
    .order("start_date", { ascending: false })

  if (error) throw error
  return data ?? []
}

/** Fetch subjects */
export async function getSubjectsForSchool(schoolId: string) {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, code, is_elective, is_active")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("name")

  if (error) throw error
  return data ?? []
}

/** Fetch active staff list */
export async function getStaffForSchool(schoolId: string) {
  const { data, error } = await supabase
    .from("staff")
    .select("id, profile_id, designation, profiles(first_name, last_name)")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("profiles(first_name)")

  if (error) throw error
  return (data ?? []).map((s) => {
    const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
    return {
      id: s.id,
      profile_id: s.profile_id,
      designation: s.designation,
      name:
        profile && typeof profile === "object" && "first_name" in profile
          ? `${profile.first_name} ${profile.last_name}`
          : "Unknown",
    }
  })
}

// ─── TIMETABLE MUTATIONS ──────────────────────────────────────

/** Insert or update a timetable slot */
export async function upsertTimetableSlot(payload: UpsertSlotPayload) {
  const { id, ...rest } = payload

  if (id) {
    const { data, error } = await supabase
      .from("timetables")
      .update({ ...rest })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from("timetables")
      .insert({ ...rest })
      .select()
      .single()
    if (error) throw error
    return data
  }
}

/** Delete a timetable slot */
export async function deleteTimetableSlot(id: string) {
  const { error } = await supabase.from("timetables").delete().eq("id", id)
  if (error) throw error
}

/** Assign (or unassign) class teacher for a section */
export async function assignClassTeacher(sectionId: string, staffId: string | null) {
  const { error } = await supabase.rpc("assign_class_teacher", {
    p_section_id: sectionId,
    p_staff_id: staffId,
  })
  if (error) throw error
}
