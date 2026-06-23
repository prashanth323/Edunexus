import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BookOpen, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  createTextbook,
  getBookDistributions,
  getTextbooks,
  issueBook,
  returnBook,
} from "../api/bookDistribution.api"
import { supabase } from "@/lib/supabase"

export function BookDistributionPanel() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const qc = useQueryClient()
  const [title, setTitle] = useState("")
  const [studentId, setStudentId] = useState("")
  const [textbookId, setTextbookId] = useState("")

  const canManage = ["principal", "vice_principal", "librarian", "school_admin"].includes(activeRole ?? "")

  const { data: books = [] } = useQuery({
    queryKey: ["textbooks", activeSchoolId],
    queryFn: () => getTextbooks(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: distributions = [] } = useQuery({
    queryKey: ["book-distributions", activeSchoolId],
    queryFn: () => getBookDistributions(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: students = [] } = useQuery({
    queryKey: ["book-students", activeSchoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, admission_no, profiles:profile_id ( full_name )")
        .eq("school_id", activeSchoolId!)
        .limit(80)
      return data ?? []
    },
    enabled: !!activeSchoolId && canManage,
  })

  const addBook = useMutation({
    mutationFn: () => createTextbook(activeSchoolId!, { title }),
    onSuccess: () => {
      toast.success("Textbook added")
      setTitle("")
      qc.invalidateQueries({ queryKey: ["textbooks"] })
    },
  })

  const issue = useMutation({
    mutationFn: () => issueBook({ schoolId: activeSchoolId!, studentId, textbookId }),
    onSuccess: () => {
      toast.success("Book issued")
      qc.invalidateQueries({ queryKey: ["book-distributions"] })
    },
  })

  const ret = useMutation({
    mutationFn: returnBook,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["book-distributions"] }),
  })

  if (!activeSchoolId) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Book distribution</CardTitle>
        <CardDescription>Record textbook issue and return by class/section</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Input placeholder="New textbook title" value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs" />
            <Button size="sm" disabled={!title} onClick={() => addBook.mutate()}><Plus className="h-4 w-4 mr-1" /> Add book</Button>
          </div>
        )}
        {canManage && (
          <div className="flex flex-wrap gap-2 items-end">
            <select className="h-10 rounded-md border px-3 text-sm" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Student</option>
              {students.map((s: { id: string; admission_no: string; profiles: { full_name: string } | { full_name: string }[] | null }) => {
                const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
                return <option key={s.id} value={s.id}>{p?.full_name ?? s.admission_no}</option>
              })}
            </select>
            <select className="h-10 rounded-md border px-3 text-sm" value={textbookId} onChange={(e) => setTextbookId(e.target.value)}>
              <option value="">Textbook</option>
              {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
            <Button size="sm" disabled={!studentId || !textbookId} onClick={() => issue.mutate()}>Issue</Button>
          </div>
        )}
        <div className="text-sm space-y-2 max-h-48 overflow-y-auto">
          {distributions.length === 0 ? (
            <p className="text-muted-foreground">No distributions recorded.</p>
          ) : (
            distributions.map((d) => (
              <div key={d.id} className="flex justify-between items-center border-b pb-2">
                <span>{d.students?.profiles?.full_name ?? "—"} — {d.textbooks?.title}</span>
                {d.returned_at ? (
                  <span className="text-xs text-muted-foreground">Returned {d.returned_at}</span>
                ) : canManage ? (
                  <Button size="sm" variant="outline" onClick={() => ret.mutate(d.id)}>Mark returned</Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
