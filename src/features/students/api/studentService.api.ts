import { supabase } from "@/lib/supabase"

export type PendingServiceStudent = {
  student_id: string
  school_id: string
  admission_no: string
  first_name: string
  last_name: string
  transport_mode: string
  class_name: string | null
  section_name: string | null
  parent_phone: string | null
  parent_email: string | null
}

export type StudentServiceLookup = PendingServiceStudent & {
  id: string
  email: string | null
  hostel_room: string | null
  route_name: string | null
  has_hostel_allocation: boolean
  has_route_assignment: boolean
}

export async function getPendingHostelStudents(schoolId: string) {
  const { data, error } = await supabase
    .from("v_students_pending_hostel")
    .select("*")
    .eq("school_id", schoolId)
    .order("admission_no")

  if (error) throw error
  return (data ?? []) as PendingServiceStudent[]
}

export async function getPendingTransportStudents(schoolId: string) {
  const { data, error } = await supabase
    .from("v_students_pending_transport")
    .select("*")
    .eq("school_id", schoolId)
    .order("admission_no")

  if (error) throw error
  return (data ?? []) as PendingServiceStudent[]
}

export async function getStudentServiceByAdmissionNo(
  schoolId: string,
  admissionNo: string,
): Promise<StudentServiceLookup> {
  const { data: student, error } = await supabase
    .from("students")
    .select(`
      id,
      school_id,
      admission_no,
      first_name,
      last_name,
      email,
      transport_mode,
      enrollments (
        status,
        academic_years ( is_current ),
        sections ( name, classes ( name ) )
      ),
      student_parents (
        is_primary,
        parents ( phone, email )
      ),
      hostel_allocations (
        is_active,
        academic_years ( is_current ),
        hostel_rooms ( room_no, block )
      ),
      route_students (
        is_active,
        academic_years ( is_current ),
        routes ( name )
      )
    `)
    .eq("school_id", schoolId)
    .eq("admission_no", admissionNo.trim())
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw error
  if (!student) throw new Error("No student found with this admission number")

  const enrollments = Array.isArray(student.enrollments) ? student.enrollments : []
  const activeEnr =
    enrollments.find((e: { status?: string; academic_years?: { is_current?: boolean } | { is_current?: boolean }[] }) => {
      const ay = Array.isArray(e.academic_years) ? e.academic_years[0] : e.academic_years
      return e.status === "active" && ay?.is_current
    }) ?? enrollments[0]

  const secRaw =
    activeEnr && typeof activeEnr === "object" && "sections" in activeEnr
      ? (activeEnr as { sections?: unknown }).sections
      : null
  const sec = Array.isArray(secRaw) ? secRaw[0] : secRaw
  const secObj = sec && typeof sec === "object" ? (sec as Record<string, unknown>) : null
  const clRaw = secObj?.classes
  const cl = Array.isArray(clRaw) ? clRaw[0] : clRaw

  const parentLinks = Array.isArray(student.student_parents) ? student.student_parents : []
  const primary =
    parentLinks.find((l: { is_primary?: boolean }) => l.is_primary) ?? parentLinks[0]
  const parRaw =
    primary && typeof primary === "object" && "parents" in primary
      ? (primary as { parents?: unknown }).parents
      : null
  const par = Array.isArray(parRaw) ? parRaw[0] : parRaw

  const hostelLinks = Array.isArray(student.hostel_allocations) ? student.hostel_allocations : []
  const activeHostel = hostelLinks.find(
    (h: { is_active?: boolean; academic_years?: { is_current?: boolean } | { is_current?: boolean }[] }) => {
      const ay = Array.isArray(h.academic_years) ? h.academic_years[0] : h.academic_years
      return h.is_active && ay?.is_current
    },
  )
  const roomRaw =
    activeHostel && typeof activeHostel === "object" && "hostel_rooms" in activeHostel
      ? (activeHostel as { hostel_rooms?: unknown }).hostel_rooms
      : null
  const room = Array.isArray(roomRaw) ? roomRaw[0] : roomRaw

  const routeLinks = Array.isArray(student.route_students) ? student.route_students : []
  const activeRoute = routeLinks.find(
    (r: { is_active?: boolean; academic_years?: { is_current?: boolean } | { is_current?: boolean }[] }) => {
      const ay = Array.isArray(r.academic_years) ? r.academic_years[0] : r.academic_years
      return r.is_active && ay?.is_current
    },
  )
  const routeRaw =
    activeRoute && typeof activeRoute === "object" && "routes" in activeRoute
      ? (activeRoute as { routes?: unknown }).routes
      : null
  const route = Array.isArray(routeRaw) ? routeRaw[0] : routeRaw

  const roomObj = room && typeof room === "object" ? (room as Record<string, unknown>) : null
  const routeObj = route && typeof route === "object" ? (route as Record<string, unknown>) : null
  const parObj = par && typeof par === "object" ? (par as Record<string, unknown>) : null

  return {
    id: student.id as string,
    student_id: student.id as string,
    school_id: student.school_id as string,
    admission_no: student.admission_no as string,
    first_name: student.first_name as string,
    last_name: student.last_name as string,
    email: (student.email as string | null) ?? null,
    transport_mode: (student.transport_mode as string) ?? "self",
    class_name: cl && typeof cl === "object" && "name" in cl ? String(cl.name) : null,
    section_name: secObj?.name ? String(secObj.name) : null,
    parent_phone: parObj?.phone ? String(parObj.phone) : null,
    parent_email: parObj?.email ? String(parObj.email) : null,
    hostel_room: roomObj
      ? `${roomObj.block ? `${roomObj.block} - ` : ""}${roomObj.room_no}`
      : null,
    route_name: routeObj?.name ? String(routeObj.name) : null,
    has_hostel_allocation: !!activeHostel,
    has_route_assignment: !!activeRoute,
  }
}

export async function updateStudentServicePreference(
  studentId: string,
  transportMode: "self" | "school_bus" | "hostel",
) {
  const { error } = await supabase.rpc("update_student_service_preference", {
    p_student_id: studentId,
    p_transport_mode: transportMode,
  })
  if (error) throw error
}

export type ClassTeacherInfo = {
  class_teacher_staff_id: string | null
  class_teacher_name: string | null
  class_teacher_phone: string | null
  class_teacher_email: string | null
}

export async function getStudentClassTeacher(studentId: string): Promise<ClassTeacherInfo | null> {
  const { data, error } = await supabase.rpc("get_student_class_teacher", {
    p_student_id: studentId,
  })
  if (error) throw error
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  return {
    class_teacher_staff_id: d.class_teacher_staff_id ? String(d.class_teacher_staff_id) : null,
    class_teacher_name: d.class_teacher_name ? String(d.class_teacher_name) : null,
    class_teacher_phone: d.class_teacher_phone ? String(d.class_teacher_phone) : null,
    class_teacher_email: d.class_teacher_email ? String(d.class_teacher_email) : null,
  }
}
