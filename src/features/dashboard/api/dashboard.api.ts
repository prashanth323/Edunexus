import { supabase } from "@/lib/supabase"
import { fetchMonthlyCollectionChartSeries } from "@/lib/monthly-collection-chart"

export async function getPrincipalDashboard(schoolId: string) {
  const { data, error } = await supabase
    .from('v_principal_dashboard')
    .select('*')
    .eq('school_id', schoolId)
    .single()
    
  if (error && error.code !== 'PGRST116') throw error // Ignore no rows error
  return data
}

export async function getMonthlyCollections(schoolId: string) {
  return fetchMonthlyCollectionChartSeries(schoolId)
}

export async function getTeacherDashboard(profileId: string, schoolId: string) {
  const { data, error } = await supabase
    .from("v_teacher_sections")
    .select("*")
    .eq("profile_id", profileId)
    .eq("school_id", schoolId)

  if (error) throw error
  return data
}

export async function getParentChildren(profileId: string) {
  const { data, error } = await supabase
    .from('v_parent_children')
    .select('*')
    .eq('profile_id', profileId)
    
  if (error) throw error
  return data
}

export async function getCounselorPerformance() {
  const { data, error } = await supabase
    .from('v_counselor_performance')
    .select('*')
    .single()
    
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export type StudentUpdates = {
  first_name?: string
  last_name?: string
  gender?: string | null
  date_of_birth?: string | null
  blood_group?: string | null
  nationality?: string | null
  religion?: string | null
  category?: string | null
  phone?: string | null
  email?: string | null
  address?: any
  permanent_address?: any
  medical_info?: any
}

export async function updateStudentDetails(studentId: string, updates: StudentUpdates) {
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', studentId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getTransportDashboard(schoolId: string) {
  const { data, error } = await supabase
    .from('v_transport_dashboard')
    .select('*')
    .eq('school_id', schoolId)
    .single()
    
  if (error && error.code !== 'PGRST116') throw error
  return data
}
