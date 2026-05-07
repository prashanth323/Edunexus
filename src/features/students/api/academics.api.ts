import { supabase } from "@/lib/supabase"
import { getCurrentAcademicYearId } from "@/features/attendance/api/attendance.api"

export type ClassRow = {
  id: string
  name: string
  numeric_level: number | null
}

export type SectionRow = {
  id: string
  name: string
  class_id: string
  academic_year_id: string
}

export async function listClasses(schoolId: string): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("id,name,numeric_level")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("numeric_level", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })

  if (error) throw error
  return (data ?? []) as ClassRow[]
}

export async function createClass(params: {
  schoolId: string
  name: string
  numericLevel?: number | null
}) {
  const { data, error } = await supabase
    .from("classes")
    .insert({
      school_id: params.schoolId,
      name: params.name.trim(),
      numeric_level: params.numericLevel ?? null,
      is_active: true,
    })
    .select("id,name,numeric_level")
    .single()

  if (error) throw error
  return data as ClassRow
}

export async function listSectionsForYear(
  schoolId: string,
  academicYearId: string,
  classId?: string,
): Promise<(SectionRow & { classes?: { name: string } })[]> {
  let q = supabase
    .from("sections")
    .select("id,name,class_id,academic_year_id, classes ( name )")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .eq("is_active", true)

  if (classId) q = q.eq("class_id", classId)

  q = q.order("name", { ascending: true })

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as (SectionRow & { classes?: { name: string } })[]
}

export async function createSection(params: {
  schoolId: string
  classId: string
  academicYearId: string
  name: string
}) {
  const { data, error } = await supabase
    .from("sections")
    .insert({
      school_id: params.schoolId,
      class_id: params.classId,
      academic_year_id: params.academicYearId,
      name: params.name.trim(),
      is_active: true,
    })
    .select("id,name,class_id,academic_year_id")
    .single()

  if (error) throw error
  return data as SectionRow
}

async function resolveCurrentAcademicYearId(schoolId: string): Promise<string> {
  const id = await getCurrentAcademicYearId(schoolId)
  if (!id) throw new Error("No academic year configured for this school. Create one before adding sections.")
  return id
}

export async function enrollStudentInSection(params: {
  schoolId: string
  studentId: string
  sectionId: string
}) {
  const yearId = await resolveCurrentAcademicYearId(params.schoolId)

  const { data: section, error: secErr } = await supabase
    .from("sections")
    .select("id, school_id, academic_year_id")
    .eq("id", params.sectionId)
    .eq("school_id", params.schoolId)
    .maybeSingle()

  if (secErr) throw secErr
  if (!section) throw new Error("Section not found in this school.")

  if (section.academic_year_id !== yearId) {
    throw new Error("Section belongs to another academic year. Use a section tied to the current year.")
  }

  const { data: existing, error: exErr } = await supabase
    .from("enrollments")
    .select("id")
    .eq("school_id", params.schoolId)
    .eq("student_id", params.studentId)
    .eq("academic_year_id", yearId)
    .maybeSingle()

  if (exErr) throw exErr

  if (existing?.id) {
    const { error: upErr } = await supabase
      .from("enrollments")
      .update({ section_id: params.sectionId, status: "active" })
      .eq("id", existing.id)

    if (upErr) throw upErr
    return
  }

  const { error: insErr } = await supabase.from("enrollments").insert({
    school_id: params.schoolId,
    student_id: params.studentId,
    section_id: params.sectionId,
    academic_year_id: yearId,
    status: "active",
  })

  if (insErr) throw insErr
}

/** Returns null instead of throwing when no current academic year. */
async function tryResolveCurrentAcademicYearId(schoolId: string): Promise<string | null> {
  try {
    return await resolveCurrentAcademicYearId(schoolId)
  } catch {
    return null
  }
}

export async function getCurrentAcademicYearMeta(schoolId: string): Promise<{ id: string | null; label: string }> {
  const id = await tryResolveCurrentAcademicYearId(schoolId)
  if (!id) return { id: null, label: "No academic year configured" }

  const { data } = await supabase.from("academic_years").select("name").eq("id", id).maybeSingle()
  const name = typeof data?.name === "string" ? data.name : ""
  return { id, label: name || "Current year" }
}

export async function flattenSectionOptionsForCurrentYear(schoolId: string) {
  const id = await tryResolveCurrentAcademicYearId(schoolId)
  if (!id) return []
  const rows = await listSectionsForYear(schoolId, id)
  return rows.map((r) => {
    const cl = Array.isArray(r.classes) ? r.classes[0] : r.classes
    const cn = typeof cl?.name === "string" ? cl.name : "Class"
    return {
      id: r.id,
      label: `${cn} · Section ${r.name}`,
    }
  })
}
