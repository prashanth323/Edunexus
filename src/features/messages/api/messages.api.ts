import { supabase } from "@/lib/supabase"

export type MessageThreadRow = {
  id: string
  school_id: string
  student_id: string
  student_name: string
  admission_no: string | null
  parent_profile_id: string
  parent_name: string
  teacher_staff_id: string
  teacher_name: string
  teacher_profile_id: string | null
  subject_id: string | null
  subject_name: string | null
  title: string | null
  last_message_at: string
  last_message_preview: string | null
  parent_last_read_at: string
  teacher_last_read_at: string
  created_at: string
  updated_at: string
}

export type MessageRow = {
  id: string
  school_id: string
  thread_id: string
  sender_profile_id: string
  body: string
  created_at: string
}

export type TeacherContact = {
  staff_id: string
  teacher_name: string
  role_label: string
  subject_id: string | null
  subject_name: string | null
}

export type ParentContact = {
  student_id: string
  student_name: string
  class_name: string | null
  section_name: string | null
  parent_profile_id: string
  parent_name: string
  relation: string
}

export function threadHasUnread(thread: MessageThreadRow, viewerIsParent: boolean): boolean {
  const lastRead = viewerIsParent ? thread.parent_last_read_at : thread.teacher_last_read_at
  return new Date(thread.last_message_at) > new Date(lastRead)
}

export async function listMessageThreads(schoolId: string): Promise<MessageThreadRow[]> {
  const { data, error } = await supabase
    .from("v_message_threads")
    .select("*")
    .eq("school_id", schoolId)
    .order("last_message_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as MessageThreadRow[]
}

export async function listThreadMessages(threadId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, school_id, thread_id, sender_profile_id, body, created_at")
    .eq("thread_id", threadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as MessageRow[]
}

export async function sendThreadMessage(threadId: string, body: string): Promise<string> {
  const { data, error } = await supabase.rpc("send_thread_message", {
    p_thread_id: threadId,
    p_body: body,
  })

  if (error) throw error
  return data as string
}

export async function markThreadRead(threadId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_message_thread_read", {
    p_thread_id: threadId,
  })
  if (error) throw error
}

export async function createParentTeacherThread(params: {
  schoolId: string
  studentId: string
  teacherStaffId: string
  initialMessage: string
  subjectId?: string | null
  title?: string | null
  parentProfileId?: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_parent_teacher_thread", {
    p_school_id: params.schoolId,
    p_student_id: params.studentId,
    p_teacher_staff_id: params.teacherStaffId,
    p_initial_message: params.initialMessage,
    p_subject_id: params.subjectId ?? null,
    p_title: params.title ?? null,
    p_parent_profile_id: params.parentProfileId ?? null,
  })

  if (error) throw error
  return data as string
}

/** Teachers a parent can message for a given child (class teacher + timetable teachers). */
export async function getTeachersForStudent(
  schoolId: string,
  studentId: string,
): Promise<TeacherContact[]> {
  const { data: enrollment, error: enrollErr } = await supabase
    .from("enrollments")
    .select(`
      section_id,
      sections (
        id,
        class_teacher_id,
        classes ( name ),
        name
      )
    `)
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()

  if (enrollErr) throw enrollErr
  if (!enrollment?.section_id) return []

  const section = enrollment.sections as unknown as {
    id: string
    class_teacher_id: string | null
    name: string
    classes: { name: string } | null
  } | null

  const contacts = new Map<string, TeacherContact>()

  if (section?.class_teacher_id) {
    const { data: ct, error } = await supabase
      .from("staff")
      .select("id, designation, profiles ( first_name, last_name )")
      .eq("id", section.class_teacher_id)
      .maybeSingle()

    if (error) throw error
    if (ct) {
      const profile = ct.profiles as unknown as { first_name: string; last_name: string } | null
      const teacherName = profile
        ? `${profile.first_name} ${profile.last_name}`.trim()
        : ct.designation || "Class teacher"
      contacts.set(ct.id, {
        staff_id: ct.id,
        teacher_name: teacherName,
        role_label: "Class teacher",
        subject_id: null,
        subject_name: null,
      })
    }
  }

  const { data: timetableRows, error: ttErr } = await supabase
    .from("timetables")
    .select(`
      staff_id,
      subject_id,
      staff ( id, designation, profiles ( first_name, last_name ) ),
      subjects ( name )
    `)
    .eq("school_id", schoolId)
    .eq("section_id", enrollment.section_id)
    .not("staff_id", "is", null)

  if (ttErr) throw ttErr

  for (const row of timetableRows ?? []) {
    const staff = row.staff as unknown as {
      id: string
      designation: string | null
      profiles: { first_name: string; last_name: string } | null
    } | null
    const subject = row.subjects as unknown as { name: string } | null
    if (!staff?.id) continue
    if (!contacts.has(staff.id)) {
      const teacherName = staff.profiles
        ? `${staff.profiles.first_name} ${staff.profiles.last_name}`.trim()
        : staff.designation || "Subject teacher"
      contacts.set(staff.id, {
        staff_id: staff.id,
        teacher_name: teacherName,
        role_label: subject?.name ? `${subject.name} teacher` : "Subject teacher",
        subject_id: row.subject_id,
        subject_name: subject?.name ?? null,
      })
    }
  }

  return Array.from(contacts.values()).sort((a, b) => a.teacher_name.localeCompare(b.teacher_name))
}

/** Parents of students the logged-in teacher teaches. */
export async function getParentContactsForTeacher(
  schoolId: string,
  profileId: string,
): Promise<ParentContact[]> {
  const { data: staffRow, error: staffErr } = await supabase
    .from("staff")
    .select("id")
    .eq("school_id", schoolId)
    .eq("profile_id", profileId)
    .maybeSingle()

  if (staffErr) throw staffErr
  if (!staffRow?.id) return []

  const staffId = staffRow.id

  const { data: timetableSections, error: tsErr } = await supabase
    .from("timetables")
    .select("section_id")
    .eq("school_id", schoolId)
    .eq("staff_id", staffId)

  if (tsErr) throw tsErr

  const { data: classTeacherSections, error: ctErr } = await supabase
    .from("sections")
    .select("id")
    .eq("school_id", schoolId)
    .eq("class_teacher_id", staffId)

  if (ctErr) throw ctErr

  const sectionIds = [
    ...new Set([
      ...(timetableSections ?? []).map((r) => r.section_id),
      ...(classTeacherSections ?? []).map((r) => r.id),
    ]),
  ]

  if (sectionIds.length === 0) return []

  const { data: enrollments, error: enErr } = await supabase
    .from("enrollments")
    .select(`
      student_id,
      students ( id, first_name, last_name ),
      sections ( name, classes ( name ) )
    `)
    .eq("school_id", schoolId)
    .in("section_id", sectionIds)
    .eq("status", "active")

  if (enErr) throw enErr

  const studentIds = [...new Set((enrollments ?? []).map((e) => e.student_id))]
  if (studentIds.length === 0) return []

  const { data: links, error: linkErr } = await supabase
    .from("student_parents")
    .select(`
      student_id,
      relation,
      parents ( profile_id, first_name, last_name )
    `)
    .eq("school_id", schoolId)
    .in("student_id", studentIds)

  if (linkErr) throw linkErr

  const results: ParentContact[] = []

  for (const link of links ?? []) {
    const parent = link.parents as unknown as {
      profile_id: string | null
      first_name: string
      last_name: string
    } | null
    if (!parent?.profile_id) continue

    const enrollment = (enrollments ?? []).find((e) => e.student_id === link.student_id)
    const student = enrollment?.students as unknown as { first_name: string; last_name: string } | null
    const section = enrollment?.sections as unknown as {
      name: string
      classes: { name: string } | null
    } | null

    results.push({
      student_id: link.student_id,
      student_name: student ? `${student.first_name} ${student.last_name}`.trim() : "Student",
      class_name: section?.classes?.name ?? null,
      section_name: section?.name ?? null,
      parent_profile_id: parent.profile_id,
      parent_name: `${parent.first_name} ${parent.last_name}`.trim(),
      relation: link.relation,
    })
  }

  return results.sort((a, b) => {
    const byStudent = a.student_name.localeCompare(b.student_name)
    if (byStudent !== 0) return byStudent
    return a.parent_name.localeCompare(b.parent_name)
  })
}

export async function getParentChildrenForMessaging(profileId: string) {
  const { data, error } = await supabase
    .from("v_parent_children")
    .select("student_id, student_name, class_name, section_name")
    .eq("profile_id", profileId)

  if (error) throw error

  const map = new Map<string, { student_id: string; student_name: string; class_name: string | null; section_name: string | null }>()
  for (const row of data ?? []) {
    if (!map.has(row.student_id)) {
      map.set(row.student_id, row)
    }
  }
  return Array.from(map.values())
}
