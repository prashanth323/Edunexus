import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Award, Clock, Loader2, AlertCircle, ClipboardList, PenTool } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getStudentIdForProfile } from "@/features/lms/api/lms.api"
import {
  getChildrenHomeworkProgress,
  submitHomeworkManual,
  type ChildHomeworkProgress,
} from "@/features/homework/api/homework.api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

function homeworkVenueLines(homework: ChildHomeworkProgress) {
  const place = [homework.class_name, homework.section_name && `Section ${homework.section_name}`].filter(
    Boolean,
  ) as string[]
  return {
    venue: place.length ? place.join(" · ") : null,
  }
}

export function StudentHomeworkList() {
  const profileId = useAuth((s) => s.user?.id)
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()

  // 1. Fetch student ID
  const { data: studentId, isLoading: loadingSid } = useQuery({
    queryKey: ["lms-student-id", profileId, activeSchoolId],
    queryFn: () => getStudentIdForProfile(profileId!, activeSchoolId!),
    enabled: !!profileId && !!activeSchoolId,
  })

  // 2. Fetch all homework assignments for this student
  const { data: homeworkList = [], isLoading: loadingHomework } = useQuery<ChildHomeworkProgress[]>({
    queryKey: ["student-daily-homework", studentId],
    queryFn: () => getChildrenHomeworkProgress([studentId!]),
    enabled: !!studentId,
  })

  if (!profileId || !activeSchoolId) {
    return <p className="text-muted-foreground text-sm p-6 text-center">Select a school to access homework.</p>
  }

  if (loadingSid || loadingHomework) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-semibold">Loading your homework workspace...</p>
      </div>
    )
  }

  if (!studentId) {
    return (
      <div className="max-w-md mx-auto my-12 text-center border-2 border-dashed rounded-3xl p-8 bg-card shadow-sm space-y-4">
        <PenTool className="h-16 w-16 text-muted-foreground/30 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">No Student Profile Linked</h2>
        <p className="text-sm text-muted-foreground leading-normal">
          This feature is available to student accounts. If you are a student, please contact school administration to link your student record.
        </p>
      </div>
    )
  }

  // Stats calculation
  const totalHomework = homeworkList.length
  const submittedHomework = homeworkList.filter(
    (h) => h.submission?.status === "submitted" || h.submission?.status === "graded"
  ).length
  const pendingHomework = homeworkList.filter(
    (h) => !h.submission || h.submission.status === "not_submitted"
  ).length

  const gradedList = homeworkList.filter(
    (h) => h.submission?.status === "graded" && h.submission.marks_obtained != null
  )
  const avgScorePct = gradedList.length > 0
    ? Math.round(
        (gradedList.reduce((acc, h) => acc + h.submission!.marks_obtained! / h.max_marks, 0) / gradedList.length) * 100
      )
    : null

  // Group items
  const incompleteList = homeworkList.filter(
    (h) => !h.submission || h.submission.status === "not_submitted" || h.submission.status === "submitted"
  )
  const gradedResultsList = homeworkList.filter((h) => h.submission?.status === "graded")

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto py-2">
      {/* Title */}
      <div className="border-b pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">My Homework</h1>
        <p className="text-muted-foreground mt-1.5 font-medium">
          View daily homework tasks for your subjects and classes — separate from LMS course learning paths.
        </p>
      </div>

      {/* Stats Dashboard */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Assigned</span>
            <CardTitle className="text-3xl font-black tracking-tight text-primary flex items-baseline gap-1">
              {totalHomework}
              <span className="text-xs font-semibold text-muted-foreground">tasks</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Completed</span>
            <CardTitle className="text-3xl font-black tracking-tight text-emerald-600 flex items-baseline gap-1">
              {submittedHomework}
              <span className="text-xs font-semibold text-muted-foreground">filed</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Pending / Incomplete</span>
            <CardTitle className="text-3xl font-black tracking-tight text-amber-500 flex items-baseline gap-1">
              {pendingHomework}
              <span className="text-xs font-semibold text-muted-foreground">remaining</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Average Grade</span>
            <CardTitle className="text-3xl font-black tracking-tight text-indigo-600">
              {avgScorePct != null ? `${avgScorePct}%` : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Dual Workspace Column */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Column 1: Active and Pending Homework with submission field */}
        <div className="space-y-4">
          <h3 className="text-lg font-extrabold tracking-tight flex items-center gap-2 border-b pb-3">
            <Clock className="h-5 w-5 text-amber-500" />
            Active Homework ({incompleteList.length})
          </h3>

          {incompleteList.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-2xl bg-muted/5 space-y-2">
              <Award className="h-10 w-10 text-emerald-500/20 mx-auto" />
              <p className="text-sm font-bold text-foreground">You're All Done!</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                No active assignments require submission right now. Great job!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {incompleteList.map((homework) => {
                const isSubmitted = homework.submission?.status === "submitted"
                const isOverdue = !!(homework.due_date && new Date(homework.due_date) < new Date() && !isSubmitted)

                return (
                  <StudentHomeworkCard
                    key={homework.homework_id}
                    homework={homework}
                    studentId={studentId}
                    isSubmitted={isSubmitted}
                    isOverdue={isOverdue}
                    onSuccess={() => qc.invalidateQueries({ queryKey: ["student-daily-homework", studentId] })}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Column 2: Graded Homework Results */}
        <div className="space-y-4">
          <h3 className="text-lg font-extrabold tracking-tight flex items-center gap-2 border-b pb-3">
            <Award className="h-5 w-5 text-indigo-600" />
            Graded Homework Results ({gradedResultsList.length})
          </h3>

          {gradedResultsList.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-2xl bg-muted/5 space-y-2">
              <Award className="h-10 w-10 text-indigo-600/20 mx-auto" />
              <p className="text-sm font-bold text-foreground">No Graded Tasks</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Your graded assignments and scorecard results will appear here once posted by teachers.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {gradedResultsList.map((homework) => {
                const scorePercent = Math.round((homework.submission!.marks_obtained! / homework.max_marks) * 100)
                const venue = homeworkVenueLines(homework).venue

                return (
                  <Card key={homework.homework_id} className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <Badge className="bg-indigo-600/10 text-indigo-600 border-indigo-600/10 text-[10px] font-bold uppercase tracking-wider">
                          {homework.subject_name}
                        </Badge>
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/10 text-[10px] font-bold uppercase tracking-wider">
                          Graded
                        </Badge>
                      </div>

                      <div className="flex justify-between gap-3 items-start mt-2">
                        <div>
                          <CardTitle className="text-base font-bold">{homework.title}</CardTitle>
                          <CardDescription className="text-xs font-semibold text-muted-foreground/80 space-y-0.5">
                            {venue ? <span className="block text-foreground/85">{venue}</span> : null}
                            <span className="block">Course: {homework.course_title}</span>
                          </CardDescription>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-lg font-black text-emerald-600">
                            {homework.submission?.marks_obtained}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground"> / {homework.max_marks}</span>
                          <span className="block text-[9px] text-muted-foreground/60 font-bold uppercase mt-0.5">
                            {scorePercent}% Score
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {homework.submission?.content && (
                        <div className="bg-muted/30 border border-dashed rounded-xl p-3 text-xs space-y-1">
                          <span className="font-bold text-foreground block">Submitted response:</span>
                          <p className="italic text-muted-foreground">"{homework.submission.content}"</p>
                        </div>
                      )}

                      {homework.submission?.feedback ? (
                        <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3.5 text-xs space-y-1.5 animate-in fade-in duration-300">
                          <span className="font-bold text-indigo-800 flex items-center gap-1.5 uppercase tracking-widest text-[9px]">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Teacher's Feedback
                          </span>
                          <p className="text-muted-foreground font-medium leading-relaxed">
                            {homework.submission.feedback}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/50 italic font-semibold">
                          No feedback comments entered.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StudentHomeworkCard({
  homework,
  studentId,
  isSubmitted,
  isOverdue,
  onSuccess,
}: {
  homework: ChildHomeworkProgress
  studentId: string
  isSubmitted: boolean
  isOverdue: boolean | null
  onSuccess: () => void
}) {
  const [text, setText] = useState("")
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const venue = homeworkVenueLines(homework).venue

  const mut = useMutation({
    mutationFn: () =>
      submitHomeworkManual({
        schoolId: activeSchoolId!,
        homeworkAssignmentId: homework.homework_id,
        studentId,
        content: text,
      }),
    onSuccess: () => {
      toast.success("Homework filed successfully!")
      onSuccess()
      setText("")
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Submit failed")
    },
  })

  const handleSubmit = () => {
    if (!text.trim()) return
    mut.mutate()
  }

  return (
    <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      {isOverdue && <div className="absolute top-0 left-0 right-0 h-1 bg-destructive" />}
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
            {homework.subject_name}
          </Badge>
          {isSubmitted ? (
            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/10 text-[10px] font-bold uppercase tracking-wider">
              Submitted
            </Badge>
          ) : isOverdue ? (
            <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider animate-pulse">
              Overdue
            </Badge>
          ) : (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/10 text-[10px] font-bold uppercase tracking-wider">
              Pending
            </Badge>
          )}
        </div>
        <CardTitle className="text-base font-bold mt-2">{homework.title}</CardTitle>
        <CardDescription className="text-xs font-semibold text-muted-foreground/80 space-y-0.5">
          {venue ? <span className="block text-foreground/85">{venue}</span> : null}
          <span className="block">Course: {homework.course_title}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {homework.description && (
          <p className="text-xs text-muted-foreground leading-normal line-clamp-3">
            {homework.description}
          </p>
        )}

        <div className="flex flex-col gap-2 pt-2 border-t text-xs font-semibold text-muted-foreground/80">
          <div className="flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            <span>Maximum Marks: {homework.max_marks} pts</span>
          </div>
          {homework.due_date && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span className={isOverdue ? "text-destructive font-bold" : ""}>
                Due Date: {new Date(homework.due_date).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {isSubmitted && homework.submission ? (
          <div className="bg-muted/30 border border-dashed rounded-xl p-3 mt-3 text-xs space-y-1">
            <span className="font-bold text-foreground block">Your submitted work:</span>
            <p className="italic text-muted-foreground">"{homework.submission.content || "No text content submitted."}"</p>
            {homework.submission.submitted_at && (
              <span className="text-[10px] text-muted-foreground/50 block font-medium mt-1">
                Filed on {new Date(homework.submission.submitted_at).toLocaleString()}
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-3 pt-3 border-t">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Your Submission Response</Label>
            <Textarea
              placeholder="Type your notes, solution summary, or paste assignment links here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[90px] text-xs bg-background"
            />
            <Button
              size="sm"
              className="w-full text-xs font-bold"
              disabled={mut.isPending || !text.trim()}
              onClick={handleSubmit}
            >
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Work"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
