import { supabase } from "@/lib/supabase"

export async function createSchoolSubject(params: { schoolId: string; name: string; code?: string | null }) {
  const name = params.name.trim()
  if (!name) throw new Error("Subject name is required")

  const { error } = await supabase.from("subjects").insert({
    school_id: params.schoolId,
    name,
    code: params.code?.trim() || null,
    is_elective: false,
    is_active: true,
  })

  if (error) throw new Error(error.message)
}

export async function setSchoolSubjectActive(subjectId: string, isActive: boolean) {
  const { error } = await supabase.from("subjects").update({ is_active: isActive }).eq("id", subjectId)
  if (error) throw new Error(error.message)
}
