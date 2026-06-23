import { useQuery } from "@tanstack/react-query"
import { Award, Clock, Loader2, AlertCircle, GraduationCap, ClipboardList } from "lucide-react"
import { useState, useEffect } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getParentChildren } from "../../dashboard/api/dashboard.api"
import { getChildrenHomeworkProgress, type ChildHomeworkProgress } from "@/features/homework/api/homework.api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type ParentChildRow = {
  student_id: string
  student_name: string
  first_name?: string | null
  last_name?: string | null
  class_name: string | null
  section_name: string | null
  attendance_pct_this_month: number | null
  pending_fees: number | null
}

function childAvatarInitials(c: Pick<ParentChildRow, "student_name" | "first_name" | "last_name">): string {
  const fn = (c.first_name ?? "").trim()
  const ln = (c.last_name ?? "").trim()
  if (fn && ln) return `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase()
  const parts = (c.student_name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

function homeworkVenueLines(homework: ChildHomeworkProgress) {
  const place = [homework.class_name, homework.section_name && `Section ${homework.section_name}`].filter(
    Boolean,
  ) as string[]
  return {
    venue: place.length ? place.join(" · ") : null,
  }
}

export function LmsParentHome() {
  const profileId = useAuth((s) => s.user?.id)
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  // 1. Fetch children of the parent
  const { data: children = [], isLoading: loadingChildren } = useQuery<ParentChildRow[]>({
    queryKey: ["lms-parent-children", profileId],
    queryFn: () => getParentChildren(profileId!),
    enabled: !!profileId,
  })

  const [selectedChildId, setSelectedChildId] = useState<string>("")

  // Set default selected child
  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].student_id)
    }
  }, [children, selectedChildId])

  const selectedChild = children.find((c) => c.student_id === selectedChildId)

  // 2. Fetch homework progress for selected child
  const { data: homeworkList = [], isLoading: loadingHomework } = useQuery<ChildHomeworkProgress[]>({
    queryKey: ["student-daily-homework", selectedChildId],
    queryFn: () => getChildrenHomeworkProgress([selectedChildId]),
    enabled: !!selectedChildId,
  })

  if (!profileId || !activeSchoolId) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Please log in and select a school to access the portal.
      </div>
    )
  }

  if (loadingChildren) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-semibold">Loading child accounts...</p>
      </div>
    )
  }

  if (children.length === 0) {
    return (
      <div className="max-w-md mx-auto my-12 text-center border-2 border-dashed rounded-3xl p-8 bg-card shadow-sm space-y-4">
        <GraduationCap className="h-16 w-16 text-muted-foreground/30 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">No Children Linked</h2>
        <p className="text-sm text-muted-foreground leading-normal">
          There are no student accounts linked to your parent profile. Please contact the school registrar to associate your student accounts.
        </p>
      </div>
    )
  }

  // Calculate homework stats for selected child
  const totalHomework = homeworkList.length
  const submittedHomework = homeworkList.filter((h) => h.submission?.status === "submitted" || h.submission?.status === "graded").length
  const pendingHomework = homeworkList.filter((h) => !h.submission || h.submission.status === "not_submitted").length
  
  const gradedList = homeworkList.filter((h) => h.submission?.status === "graded" && h.submission.marks_obtained != null)
  const avgScorePct = gradedList.length > 0
    ? Math.round(
        (gradedList.reduce((acc, h) => acc + (h.submission!.marks_obtained! / h.max_marks), 0) / gradedList.length) * 100
      )
    : null

  // Split homework into tabs or sections
  const incompleteList = homeworkList.filter(
    (h) => !h.submission || h.submission.status === "not_submitted" || h.submission.status === "submitted"
  )
  const gradedResultsList = homeworkList.filter(
    (h) => h.submission?.status === "graded"
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto py-2">
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Learning Hub</h1>
          <p className="text-muted-foreground mt-1.5 font-medium">
            Monitor assignments, submissions, grades, and teacher remarks for your child.
          </p>
        </div>

        {/* Child selector pill menu */}
        {children.length > 1 && (
          <div className="flex bg-muted/60 p-1.5 rounded-2xl border gap-1">
            {children.map((c) => (
              <Button
                key={c.student_id}
                size="sm"
                variant={selectedChildId === c.student_id ? "default" : "ghost"}
                className={`rounded-xl font-bold text-xs h-9 px-4 transition-all`}
                onClick={() => setSelectedChildId(c.student_id)}
              >
                {c.student_name}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Child Identity Banner */}
      {selectedChild && (
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-3xl border border-primary/10 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-xl font-black text-primary-foreground">
                {childAvatarInitials(selectedChild)}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground">{selectedChild.student_name}</h2>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                Class {selectedChild.class_name || "N/A"} · Section {selectedChild.section_name || "N/A"}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Badge variant="outline" className="px-3.5 py-1.5 rounded-xl border-primary/20 bg-background/50 font-bold text-xs">
              Attendance: {selectedChild.attendance_pct_this_month != null ? `${Number(selectedChild.attendance_pct_this_month).toFixed(1)}%` : "—"}
            </Badge>
            {selectedChild.pending_fees != null && selectedChild.pending_fees > 0 && (
              <Badge variant="outline" className="px-3.5 py-1.5 rounded-xl border-rose-500/20 bg-rose-500/5 text-rose-600 font-bold text-xs">
                Dues: ${Number(selectedChild.pending_fees).toLocaleString()}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Loader for homework query */}
      {loadingHomework ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-medium">Loading child academic tracker...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Homework Stats Grid */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Assigned</span>
                <CardTitle className="text-3xl font-black tracking-tight text-primary flex items-baseline gap-1">
                  {totalHomework}
                  <span className="text-xs font-semibold text-muted-foreground">items</span>
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Completed</span>
                <CardTitle className="text-3xl font-black tracking-tight text-emerald-600 flex items-baseline gap-1">
                  {submittedHomework}
                  <span className="text-xs font-semibold text-muted-foreground">submitted</span>
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Pending Items</span>
                <CardTitle className="text-3xl font-black tracking-tight text-amber-500 flex items-baseline gap-1">
                  {pendingHomework}
                  <span className="text-xs font-semibold text-muted-foreground">active</span>
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

          {/* Assignments list divided into segments */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Column 1: Active & Pending Homework */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Active Assignments ({incompleteList.length})
                </h3>
              </div>

              {incompleteList.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-2xl bg-muted/5 space-y-2">
                  <Award className="h-10 w-10 text-emerald-500/20 mx-auto" />
                  <p className="text-sm font-bold text-foreground">All Caught Up!</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Your child has no pending homework assignments at the moment.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {incompleteList.map((homework) => {
                    const isSubmitted = homework.submission?.status === "submitted"
                    const isOverdue = homework.due_date && new Date(homework.due_date) < new Date() && !isSubmitted
                    const venue = homeworkVenueLines(homework).venue

                    return (
                      <Card key={homework.homework_id} className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        {isOverdue && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-destructive" />
                        )}
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
                        <CardContent className="space-y-3">
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

                          {isSubmitted && homework.submission && (
                            <div className="bg-muted/30 border border-dashed rounded-xl p-3 mt-3 text-xs space-y-1">
                              <span className="font-bold text-foreground block">Submitted response:</span>
                              <p className="italic text-muted-foreground">"{homework.submission.content || "No submission notes provided."}"</p>
                              {homework.submission.submitted_at && (
                                <span className="text-[10px] text-muted-foreground/50 block font-medium mt-1">
                                  Filed on {new Date(homework.submission.submitted_at).toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Column 2: Graded Results */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
                  <Award className="h-5 w-5 text-indigo-600" />
                  Graded Homework & Results ({gradedResultsList.length})
                </h3>
              </div>

              {gradedResultsList.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-2xl bg-muted/5 space-y-2">
                  <Award className="h-10 w-10 text-indigo-600/20 mx-auto" />
                  <p className="text-sm font-bold text-foreground">No Graded Results</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    There are no graded assignment results posted for your child yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {gradedResultsList.map((homework) => {
                    const pct = homework.submission?.marks_obtained != null
                      ? Math.round((homework.submission.marks_obtained / homework.max_marks) * 100)
                      : 0
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
                              <span className="block text-[9px] text-muted-foreground/60 font-bold uppercase mt-0.5">{pct}% Score</span>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-3">
                          {/* Student Notes */}
                          {homework.submission?.content && (
                            <div className="bg-muted/30 border border-dashed rounded-xl p-3 text-xs space-y-1">
                              <span className="font-bold text-foreground block">Submission response:</span>
                              <p className="italic text-muted-foreground">"{homework.submission.content}"</p>
                            </div>
                          )}

                          {/* Teacher Remarks Card */}
                          {homework.submission?.feedback ? (
                            <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3.5 text-xs space-y-1.5">
                              <span className="font-bold text-indigo-800 flex items-center gap-1.5 uppercase tracking-widest text-[9px]">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Teacher's Remarks
                              </span>
                              <p className="text-muted-foreground font-medium leading-relaxed">
                                {homework.submission.feedback}
                              </p>
                            </div>
                          ) : (
                            <p className="text-[10px] text-muted-foreground/50 italic font-semibold">No feedback remarks entered by teacher.</p>
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
      )}
    </div>
  )
}
