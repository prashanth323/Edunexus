import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Plus,
  ClipboardList,
  Calendar,
  GraduationCap,
  BarChart3,
  Trash2,
  Loader2,
  BookOpen,
  Clock,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getExams,
  createExam,
  deleteExam,
  getSubjects,
  getSectionsForSchool,
  type ExamFormValues,
} from "../api/exams.api"

const EXAM_TYPES = [
  { value: "unit_test", label: "Unit Test" },
  { value: "mid_term", label: "Mid Term" },
  { value: "final", label: "Final Exam" },
  { value: "practical", label: "Practical" },
  { value: "online", label: "Online Exam" },
  { value: "mock", label: "Mock Exam" },
]

export function ExamManagement() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const user = useAuth((s) => s.user)
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)

  const canManage = !!(activeRole && new Set(["principal", "school_admin", "teacher", "class_teacher"]).has(activeRole))

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exams", activeSchoolId],
    queryFn: () => getExams(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ["subjects", activeSchoolId],
    queryFn: () => getSubjects(activeSchoolId!),
    enabled: !!activeSchoolId && creating && canManage,
  })

  const { data: sections = [] } = useQuery<any[]>({
    queryKey: ["sections-exam", activeSchoolId],
    queryFn: () => getSectionsForSchool(activeSchoolId!),
    enabled: !!activeSchoolId && creating && canManage,
  })

  // Form state
  const [form, setForm] = useState<ExamFormValues>({
    name: "",
    exam_type: "unit_test",
    subject_id: "",
    section_id: "",
    date: "",
    start_time: "",
    end_time: "",
    max_marks: 100,
    passing_marks: 35,
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!activeSchoolId || !user?.id) return
    if (!form.name.trim()) { toast.error("Exam name is required"); return }
    if (!form.section_id) { toast.error("Please select a class/section"); return }

    setSubmitting(true)
    try {
      await createExam(activeSchoolId, form, user.id)
      toast.success("Exam created successfully")
      qc.invalidateQueries({ queryKey: ["exams", activeSchoolId] })
      setCreating(false)
      setForm({ name: "", exam_type: "unit_test", subject_id: "", section_id: "", date: "", start_time: "", end_time: "", max_marks: 100, passing_marks: 35 })
    } catch (err: any) {
      toast.error(err.message || "Failed to create exam")
    } finally {
      setSubmitting(false)
    }
  }

  const { mutate: handleDelete, isPending: deleting } = useMutation({
    mutationFn: deleteExam,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams", activeSchoolId] })
      toast.success("Exam deleted")
    },
    onError: () => toast.error("Failed to delete exam"),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Examinations</h1>
          <p className="text-muted-foreground mt-1">Create, manage, and analyze exams.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Examinations</h1>
          <p className="text-muted-foreground mt-1">Create tests, enter marks, and view results with analytics.</p>
        </div>
        {canManage && (
          <Button className="gap-2" onClick={() => setCreating(!creating)}>
            <Plus className="h-4 w-4" /> Create Exam
          </Button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <Card className="border-primary/30 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              New Examination
            </CardTitle>
            <CardDescription>Define the exam details — you can add marks after creation.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
                  <Label>Exam Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Unit Test 1 - Mathematics"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Exam Type</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.exam_type}
                    onChange={(e) => setForm({ ...form, exam_type: e.target.value })}
                  >
                    {EXAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Class / Section</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.section_id}
                    onChange={(e) => setForm({ ...form, section_id: e.target.value })}
                    required
                  >
                    <option value="">Select class/section…</option>
                    {sections.map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.subject_id}
                    onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                  >
                    <option value="">Select subject…</option>
                    {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Start Time</Label>
                  <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Time</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Marks</Label>
                  <Input type="number" min={1} value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Passing Marks</Label>
                  <Input type="number" min={0} value={form.passing_marks} onChange={(e) => setForm({ ...form, passing_marks: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Exam
                </Button>
                <Button type="button" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Exam list */}
      {exams.length === 0 && !creating ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          <ClipboardList className="h-14 w-14 opacity-30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No examinations yet</h3>
          <p className="text-sm mt-1 max-w-md text-center">
            Click "Create Exam" to define a test. You can then enter marks and view analytics.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => {
            const sec = Array.isArray(exam.sections) ? exam.sections[0] : exam.sections
            const secObj = sec && typeof sec === "object" ? sec as Record<string, any> : null
            const cls = secObj?.classes
            const clsObj = Array.isArray(cls) ? cls[0] : cls
            const subj = Array.isArray(exam.subjects) ? exam.subjects[0] : exam.subjects

            return (
              <Card key={exam.id} className="flex flex-col hover:border-primary/40 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg leading-tight">{exam.name}</CardTitle>
                    <Badge variant="outline" className="capitalize text-[10px] shrink-0">
                      {exam.exam_type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <GraduationCap className="h-3.5 w-3.5" />
                    {clsObj?.name || "?"} — {secObj?.name || "?"}
                    {subj?.name && <span className="text-primary">· {subj.name}</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
                  {exam.date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{format(new Date(exam.date), "MMM d, yyyy")}</span>
                    </div>
                  )}
                  {(exam.start_time || exam.end_time) && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{exam.start_time?.slice(0, 5) || "?"} — {exam.end_time?.slice(0, 5) || "?"}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Max: {exam.max_marks} · Pass: {exam.passing_marks ?? "N/A"}</span>
                  </div>
                </CardContent>
                 <CardFooter className="border-t pt-3 flex flex-wrap gap-2">
                  {canManage && (
                    <Button asChild variant="outline" size="sm" className="gap-1.5 flex-1">
                      <Link to={`/exams/${exam.id}/marks`}>
                        <ClipboardList className="h-3.5 w-3.5" /> Marks
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm" className="gap-1.5 flex-1">
                    <Link to={`/exams/${exam.id}/results`}>
                      <BarChart3 className="h-3.5 w-3.5" /> Results
                    </Link>
                  </Button>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      disabled={deleting}
                      onClick={() => handleDelete(exam.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
