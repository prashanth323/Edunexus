import { supabase } from "@/lib/supabase"
import { defaultLmsTeacherProfile, normalizeLmsTeacherProfile, type LmsTeacherProfile } from "@/features/settings/lib/lmsTeacherProfile"

export type Qualification = {
  degree: string
  institute: string
  year: string
}

export type StaffProfessionalDetails = {
  staffId: string | null
  primarySubjectId: string | null
  experienceYears: number | null
  specialization: string | null
  biography: string | null
  qualifications: Qualification[]
  lmsTeacherProfile: LmsTeacherProfile
}

/** Staff row + professional details for current school. */
export async function fetchMyStaffProfessionalDetails(
  schoolId: string,
  profileId: string,
): Promise<StaffProfessionalDetails> {
  const { data, error } = await supabase
    .from("staff")
    .select(
      "id, primary_subject_id, experience_years, specialization, biography, qualifications, lms_teacher_profile",
    )
    .eq("school_id", schoolId)
    .eq("profile_id", profileId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    return {
      staffId: null,
      primarySubjectId: null,
      experienceYears: null,
      specialization: null,
      biography: null,
      qualifications: [],
      lmsTeacherProfile: defaultLmsTeacherProfile(),
    }
  }

  return {
    staffId: data.id,
    primarySubjectId: data.primary_subject_id ?? null,
    experienceYears: data.experience_years ?? null,
    specialization: data.specialization ?? null,
    biography: data.biography ?? null,
    qualifications: (data.qualifications as Qualification[]) ?? [],
    lmsTeacherProfile: normalizeLmsTeacherProfile(data.lms_teacher_profile),
  }
}

export async function updateMyStaffProfessionalDetails(
  schoolId: string,
  _profileId: string,
  details: Partial<Omit<StaffProfessionalDetails, "staffId">> & { lmsTeacherProfile?: LmsTeacherProfile },
): Promise<void> {
  const { error } = await supabase.rpc("update_my_staff_professional_profile", {
    p_school_id: schoolId,
    p_primary_subject_id: details.primarySubjectId ?? null,
    p_experience_years: details.experienceYears ?? null,
    p_specialization: details.specialization ?? null,
    p_biography: details.biography ?? null,
    p_qualifications: details.qualifications ?? [],
    p_lms_teacher_profile: details.lmsTeacherProfile ?? defaultLmsTeacherProfile(),
  })

  if (error) throw new Error(error.message)
}

/** Primary teaching subject from the current user's staff row (LMS defaults). */
export async function fetchMyStaffTeachingSubjectRow(
  schoolId: string,
  profileId: string,
): Promise<{ primarySubjectId: string | null }> {
  const d = await fetchMyStaffProfessionalDetails(schoolId, profileId)
  return { primarySubjectId: d.primarySubjectId }
}

export async function setMyPrimaryTeachingSubject(schoolId: string, subjectId: string | null): Promise<void> {
  const { error } = await supabase.rpc("set_my_primary_teaching_subject", {
    p_school_id: schoolId,
    p_subject_id: subjectId,
  })
  if (error) throw new Error(error.message)
}
