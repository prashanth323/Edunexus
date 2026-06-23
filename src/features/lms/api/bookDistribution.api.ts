import { supabase } from "@/lib/supabase"

export type Textbook = {
  id: string
  title: string
  class_name: string | null
  isbn: string | null
  publisher: string | null
}

export type BookDistribution = {
  id: string
  student_id: string
  textbook_id: string
  issued_at: string
  returned_at: string | null
  textbooks?: { title: string } | null
  students?: { admission_no: string; profiles: { full_name: string } | null } | null
}

export async function getTextbooks(schoolId: string) {
  const { data, error } = await supabase
    .from("textbooks")
    .select("id, title, class_name, isbn, publisher")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("title")
  if (error) throw error
  return (data ?? []) as Textbook[]
}

export async function createTextbook(schoolId: string, input: { title: string; class_name?: string; isbn?: string }) {
  const { data, error } = await supabase
    .from("textbooks")
    .insert({ school_id: schoolId, title: input.title, class_name: input.class_name ?? null, isbn: input.isbn ?? null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getBookDistributions(schoolId: string) {
  const { data, error } = await supabase
    .from("book_distributions")
    .select(`
      id, student_id, textbook_id, issued_at, returned_at,
      textbooks ( title ),
      students ( admission_no, profiles:profile_id ( full_name ) )
    `)
    .eq("school_id", schoolId)
    .order("issued_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => {
    const tb = row.textbooks
    const book = Array.isArray(tb) ? tb[0] : tb
    const st = row.students
    const student = Array.isArray(st) ? st[0] : st
    const prof = student?.profiles
    const profile = Array.isArray(prof) ? prof[0] : prof
    return {
      ...row,
      textbooks: book ?? null,
      students: student ? { admission_no: student.admission_no, profiles: profile ?? null } : null,
    }
  }) as BookDistribution[]
}

export async function issueBook(params: {
  schoolId: string
  studentId: string
  textbookId: string
}) {
  const { data: user } = await supabase.auth.getUser()
  const { error } = await supabase.from("book_distributions").insert({
    school_id: params.schoolId,
    student_id: params.studentId,
    textbook_id: params.textbookId,
    issued_by: user.user?.id,
  })
  if (error) throw error
}

export async function returnBook(distributionId: string) {
  const { error } = await supabase
    .from("book_distributions")
    .update({ returned_at: new Date().toISOString().slice(0, 10) })
    .eq("id", distributionId)
  if (error) throw error
}
