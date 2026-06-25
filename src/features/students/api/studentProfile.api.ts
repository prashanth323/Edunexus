import { supabase } from "@/lib/supabase"

const STUDENT_DOCUMENTS_BUCKET = "student-documents"

/** Pull object path (`school/id/photo.jpg`) from a Supabase Storage URL for this bucket (public or signed). */
export function parseStudentDocumentsPathFromUrl(rawUrl: string): string | null {
  const t = rawUrl.trim()
  if (!t) return null
  try {
    const u = new URL(t)
    const m = u.pathname.match(/\/student-documents\/(.+)$/i)
    const path = m?.[1]
    return path ? decodeURIComponent(path) : null
  } catch {
    return null
  }
}

/** Use for display when the bucket is private: replaces "public" object URLs with a time-limited signed URL. */
export async function getSignedStudentDocumentsUrl(
  url: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const t = url?.trim()
  if (!t) return null

  const path = parseStudentDocumentsPathFromUrl(t)
  // Not our bucket path — assume already readable (legacy external URLs, etc.).
  if (!path) return /^https?:\/\//i.test(t) ? t : null

  const { data, error } = await supabase.storage.from(STUDENT_DOCUMENTS_BUCKET).createSignedUrl(path, expiresInSeconds)
  if (error) {
    console.warn("[student-documents] createSignedUrl failed", error.message)
    return null
  }
  return data.signedUrl
}

// ── Photo Upload ────────────────────────────────────────
export async function uploadStudentPhoto(schoolId: string, studentId: string, file: File) {
  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `${schoolId}/${studentId}/photo.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(STUDENT_DOCUMENTS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from(STUDENT_DOCUMENTS_BUCKET).getPublicUrl(path)
  const photoUrl = urlData.publicUrl

  const { error: rpcError } = await supabase.rpc("set_student_profile_photo", {
    p_student_id: studentId,
    p_photo_url: photoUrl,
  })
  if (rpcError) throw rpcError

  return photoUrl
}

// ── Document Upload ─────────────────────────────────────
export async function uploadStudentDocument(
  schoolId: string,
  studentId: string,
  file: File,
  label: string,
) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const path = `${schoolId}/${studentId}/docs/${Date.now()}_${safeName}`

  const { error: uploadError } = await supabase.storage
    .from(STUDENT_DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from(STUDENT_DOCUMENTS_BUCKET).getPublicUrl(path)

  // Append to student's documents JSONB array
  const { data: student } = await supabase
    .from("students")
    .select("documents")
    .eq("id", studentId)
    .single()

  const docs = Array.isArray(student?.documents) ? student.documents : []
  docs.push({
    label,
    filename: file.name,
    url: urlData.publicUrl,
    size: file.size,
    type: file.type,
    uploaded_at: new Date().toISOString(),
  })

  const { error: updateError } = await supabase
    .from("students")
    .update({ documents: docs })
    .eq("id", studentId)
  if (updateError) throw updateError

  return urlData.publicUrl
}

export async function deleteStudentDocument(studentId: string, docIndex: number) {
  const { data: student } = await supabase
    .from("students")
    .select("documents")
    .eq("id", studentId)
    .single()

  const docs = Array.isArray(student?.documents) ? [...student.documents] : []
  if (docIndex >= 0 && docIndex < docs.length) {
    docs.splice(docIndex, 1)
  }

  const { error } = await supabase
    .from("students")
    .update({ documents: docs })
    .eq("id", studentId)
  if (error) throw error
}

// ── Student Full Profile ────────────────────────────────
export type StudentFullProfile = {
  id: string
  school_id: string
  admission_no: string
  roll_no: string | null
  first_name: string
  last_name: string
  gender: string | null
  date_of_birth: string | null
  blood_group: string | null
  nationality: string | null
  religion: string | null
  category: string | null
  phone: string | null
  email: string | null
  photo_url: string | null
  address: Record<string, string> | null
  permanent_address: Record<string, string> | null
  emergency_contact: Record<string, string> | null
  medical_info: Record<string, string> | null
  documents: Array<{
    label: string
    filename: string
    url: string
    size: number
    type: string
    uploaded_at: string
  }>
  admission_date: string | null
  is_active: boolean
  created_at: string
  // Joined
  parents: Array<{
    id: string
    parent_id: string
    relation: string
    is_primary: boolean
    parent: {
      id: string
      first_name: string
      last_name: string
      phone: string
      email: string | null
      occupation: string | null
    }
  }>
  enrollment: {
    id: string
    section_id: string
    academic_year_id: string
    roll_no: string | null
    status: string
    section: { name: string; class: { name: string } }
    academic_year: { name: string }
  } | null
  invoices: Array<{
    id: string
    invoice_no: string
    amount: number
    discount: number
    fine: number
    total_amount: number
    paid_amount: number
    due_amount: number
    status: string
    due_date: string
    description: string | null
  }>
}

export async function getStudentProfile(studentId: string): Promise<StudentFullProfile> {
  const { data: student, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .single()
  if (error) throw error

  // Parents
  const { data: parentLinks } = await supabase
    .from("student_parents")
    .select(`
      id,
      parent_id,
      relation,
      is_primary,
      parents (id, first_name, last_name, phone, email, occupation)
    `)
    .eq("student_id", studentId)

  const parents = (parentLinks ?? []).map((link: any) => ({
    id: link.id,
    parent_id: link.parent_id,
    relation: link.relation,
    is_primary: link.is_primary,
    parent: Array.isArray(link.parents) ? link.parents[0] : link.parents,
  }))

  // Active enrollment
  const { data: enrollmentRaw } = await supabase
    .from("enrollments")
    .select(`
      id, section_id, academic_year_id, roll_no, status,
      sections (name, classes (name)),
      academic_years (name)
    `)
    .eq("student_id", studentId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()

  let enrollment = null
  if (enrollmentRaw) {
    const sec = Array.isArray(enrollmentRaw.sections)
      ? enrollmentRaw.sections[0]
      : enrollmentRaw.sections
    const secObj = sec && typeof sec === "object" ? (sec as Record<string, unknown>) : null
    const cls = secObj?.classes
    const clsObj = Array.isArray(cls) ? cls[0] : cls
    const ay = Array.isArray(enrollmentRaw.academic_years)
      ? enrollmentRaw.academic_years[0]
      : enrollmentRaw.academic_years

    enrollment = {
      id: enrollmentRaw.id,
      section_id: enrollmentRaw.section_id,
      academic_year_id: enrollmentRaw.academic_year_id,
      roll_no: enrollmentRaw.roll_no,
      status: enrollmentRaw.status,
      section: {
        name: secObj?.name ? String(secObj.name) : "N/A",
        class: { name: clsObj && typeof clsObj === "object" && "name" in clsObj ? String(clsObj.name) : "N/A" },
      },
      academic_year: {
        name: ay && typeof ay === "object" && "name" in ay ? String(ay.name) : "N/A",
      },
    }
  }

  // Invoices
  const { data: invoices } = await supabase
    .from("student_invoices")
    .select("id, invoice_no, amount, discount, fine, total_amount, paid_amount, due_amount, status, due_date, description")
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .order("due_date", { ascending: false })
    .limit(20)

  return {
    ...student,
    documents: Array.isArray(student.documents) ? student.documents : [],
    parents,
    enrollment,
    invoices: invoices ?? [],
  }
}

// ── Transfer Section ────────────────────────────────────
export async function transferStudentSection(
  studentId: string,
  schoolId: string,
  currentEnrollmentId: string,
  newSectionId: string,
  academicYearId: string,
) {
  // Mark old enrollment as transferred
  const { error: updateErr } = await supabase
    .from("enrollments")
    .update({ status: "transferred" })
    .eq("id", currentEnrollmentId)

  if (updateErr) throw updateErr

  // Create new enrollment
  const { error: insertErr } = await supabase.from("enrollments").insert({
    school_id: schoolId,
    student_id: studentId,
    section_id: newSectionId,
    academic_year_id: academicYearId,
    status: "active",
    transferred_from: schoolId,
  })
  if (insertErr) throw insertErr
}

// ── Generate Roll Number ────────────────────────────────
export async function generateRollNumber(sectionId: string): Promise<string> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("roll_no")
    .eq("section_id", sectionId)
    .eq("status", "active")
    .order("roll_no", { ascending: false })
    .limit(1)

  const lastRoll = enrollments?.[0]?.roll_no
  const next = lastRoll ? parseInt(lastRoll, 10) + 1 : 1
  return String(next).padStart(3, "0")
}

export async function assignRollNumber(enrollmentId: string, rollNo: string) {
  const { error } = await supabase
    .from("enrollments")
    .update({ roll_no: rollNo })
    .eq("id", enrollmentId)
  if (error) throw error
}

// ── Update Student Details ──────────────────────────────
export async function updateStudentProfile(studentId: string, updates: Record<string, unknown>) {
  const { error } = await supabase.rpc("update_linked_student_details", {
    p_student_id: studentId,
    p_updates: updates,
  })
  if (error) throw error
}

/** Resolved school name for ID card and portals (falls back when RLS hides the row). */
export async function getSchoolDisplayName(schoolId: string): Promise<string> {
  const { data, error } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle()
  if (error) throw error
  const n = data?.name?.trim()
  return n || "School"
}
