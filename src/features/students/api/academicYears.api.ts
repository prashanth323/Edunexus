import { supabase } from "@/lib/supabase"

export type AcademicYearRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
}

/** Default July–June span and label like `2025-26`. */
export function suggestedAcademicYearDefaults(now = new Date()): {
  name: string
  startDate: string
  endDate: string
} {
  const y = now.getFullYear()
  const m = now.getMonth()
  const startY = m >= 6 ? y : y - 1
  const endY = startY + 1
  return {
    name: `${startY}-${String(endY).slice(-2)}`,
    startDate: `${startY}-07-01`,
    endDate: `${endY}-06-30`,
  }
}

async function unsetAllCurrentForSchool(schoolId: string) {
  const { error } = await supabase
    .from("academic_years")
    .update({ is_current: false })
    .eq("school_id", schoolId)
  if (error) throw error
}

/** Mark one year current; clears `is_current` on other rows for this school. */
export async function setAcademicYearAsCurrent(schoolId: string, yearId: string) {
  await unsetAllCurrentForSchool(schoolId)
  const { error } = await supabase
    .from("academic_years")
    .update({ is_current: true })
    .eq("id", yearId)
    .eq("school_id", schoolId)
  if (error) throw error
}

export async function createAcademicYear(params: {
  schoolId: string
  name: string
  startDate: string
  endDate: string
  setAsCurrent: boolean
}): Promise<AcademicYearRow> {
  if (params.setAsCurrent) await unsetAllCurrentForSchool(params.schoolId)

  const { data, error } = await supabase
    .from("academic_years")
    .insert({
      school_id: params.schoolId,
      name: params.name.trim(),
      start_date: params.startDate,
      end_date: params.endDate,
      is_current: params.setAsCurrent,
    })
    .select("id,name,start_date,end_date,is_current")
    .single()

  if (error) throw error
  return data as AcademicYearRow
}

export async function listAcademicYears(schoolId: string): Promise<AcademicYearRow[]> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id,name,start_date,end_date,is_current")
    .eq("school_id", schoolId)
    .order("start_date", { ascending: false })

  if (error) throw error
  return (data ?? []) as AcademicYearRow[]
}
