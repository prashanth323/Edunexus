import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BookOpen, Clock, Loader2, Plus, FileText, ClipboardList, Search, AlertCircle, Award, Users, HelpCircle, Sparkles } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  createDailyHomework,
  gradeHomeworkSubmission,
  listDailyHomeworkForGroup,
  listSubmissionsForHomework,
  type HomeworkAssignmentRow,
  type DailyHomeworkClassItem,
} from "@/features/homework/api/homework.api"
import {
  getStaffIdForProfile,
  getSubjects,
  listAcademicYears,
  listSectionsForSchool,
} from "@/features/lms/api/lms.api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type SectionRow = Awaited<ReturnType<typeof listSectionsForSchool>>[number]

function sectionClassDisplayName(sec: SectionRow): string {
  const raw = sec.classes as { name?: string } | { name?: string }[] | null | undefined
  const one = Array.isArray(raw) ? raw[0] : raw
  return one?.name?.trim() || "Class"
}

export function TeacherHomeworkHub() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const profileId = useAuth((s) => s.user?.id)
  const qc = useQueryClient()

  const { data: staffId = null } = useQuery({
    queryKey: ["staff-id-homework", profileId, activeSchoolId],
    queryFn: () => getStaffIdForProfile(profileId!, activeSchoolId!),
    enabled: !!profileId && !!activeSchoolId,
  })

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ["school-subjects", activeSchoolId],
    queryFn: () => getSubjects(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: sections = [], isLoading: loadingSections } = useQuery({
    queryKey: ["school-sections", activeSchoolId],
    queryFn: () => listSectionsForSchool(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: academicYears = [], isLoading: loadingYears } = useQuery({
    queryKey: ["academic-years", activeSchoolId],
    queryFn: () => listAcademicYears(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const currentAcademicYearId = useMemo(() => {
    const cur = academicYears.find((y) => y.is_current)
    const y = cur ?? academicYears[0]
    return (y?.id as string | undefined) ?? null
  }, [academicYears])

  const filteredSections = useMemo(
    () => (currentAcademicYearId ? sections.filter((s) => s.academic_year_id === currentAcademicYearId) : []),
    [sections, currentAcademicYearId],
  )

  const [selectedSubjectId, setSelectedSubjectId] = useState("")
  const [selectedSectionId, setSelectedSectionId] = useState("")

  const selectedSectionRow = useMemo(
    () => filteredSections.find((s) => s.id === selectedSectionId) ?? null,
    [filteredSections, selectedSectionId],
  )

  useEffect(() => {
    if (subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].id)
    }
  }, [subjects, selectedSubjectId])

  useEffect(() => {
    if (filteredSections.length === 0) {
      setSelectedSectionId("")
      return
    }
    if (!selectedSectionId || !filteredSections.some((s) => s.id === selectedSectionId)) {
      setSelectedSectionId(filteredSections[0].id)
    }
  }, [filteredSections, selectedSectionId])

  const rosterKey =
    activeSchoolId && selectedSubjectId && selectedSectionId
      ? `${activeSchoolId}-${selectedSubjectId}-${selectedSectionId}`
      : ""

  const { data: homeworkItems = [], isLoading: loadingHomeworkRows } = useQuery<HomeworkAssignmentRow[]>({
    queryKey: ["daily-homework", rosterKey],
    queryFn: () =>
      listDailyHomeworkForGroup({
        schoolId: activeSchoolId!,
        subjectId: selectedSubjectId,
        sectionId: selectedSectionId,
      }),
    enabled: !!activeSchoolId && !!selectedSubjectId && !!selectedSectionId,
  })

  const selectedSubjectName = subjects.find((s) => s.id === selectedSubjectId)?.name ?? "Subject"

  const [assignTitle, setAssignTitle] = useState("")
  const [assignDesc, setAssignDesc] = useState("")
  const [assignMarks, setAssignMarks] = useState(100)
  const [assignDue, setAssignDue] = useState("")
  const [assignPublished, setAssignPublished] = useState(true)

  const createAssignMut = useMutation({
    mutationFn: async () => {
      if (!activeSchoolId || !profileId || !selectedSubjectId || !selectedSectionRow?.id || !selectedSectionRow.academic_year_id) {
        throw new Error("Select subject and class section before posting homework.")
      }
      const sectionRow = selectedSectionRow as SectionRow & { academic_year_id: string }

      await createDailyHomework({
        school_id: activeSchoolId,
        academic_year_id: sectionRow.academic_year_id,
        section_id: sectionRow.id,
        class_id: sectionRow.class_id ?? null,
        subject_id: selectedSubjectId,
        teacher_id: staffId,
        created_by: profileId,
        title: assignTitle.trim(),
        description: assignDesc,
        max_marks: assignMarks,
        due_date: assignDue ? new Date(assignDue).toISOString() : null,
        is_published: assignPublished,
      })
      return rosterKey
    },
    onSuccess: () => {
      toast.success("Daily homework posted for this class and subject.")
      qc.invalidateQueries({ queryKey: ["daily-homework", rosterKey] })
      qc.invalidateQueries({ queryKey: ["student-daily-homework"] })
      setAssignTitle("")
      setAssignDesc("")
      setAssignMarks(100)
      setAssignDue("")
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Creation failed")
    },
  })

  if (!activeSchoolId) {
    return <p className="text-muted-foreground text-sm p-6 text-center">Select a school to manage homework.</p>
  }

  const isBootLoading = loadingSubjects || loadingSections || loadingYears

  if (isBootLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-semibold">Loading subjects and class sections…</p>
      </div>
    )
  }

  if (subjects.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-3xl bg-card max-w-md mx-auto my-12 p-8 space-y-4">
        <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">No Subjects Available</h2>
        <p className="text-sm text-muted-foreground leading-normal">
          Ask a school administrator to add active subjects before you can post homework by class.
        </p>
      </div>
    )
  }

  if (!currentAcademicYearId) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-3xl bg-card max-w-lg mx-auto my-12 p-8 space-y-4">
        <AlertCircle className="h-12 w-12 text-amber-500/80 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Academic Year Not Configured</h2>
        <p className="text-sm text-muted-foreground leading-normal">
          Configure an academic year for this school to choose class sections.
        </p>
      </div>
    )
  }

  if (filteredSections.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-3xl bg-card max-w-lg mx-auto my-12 p-8 space-y-4">
        <ClipboardList className="h-12 w-12 text-muted-foreground/40 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">No Class Sections Found</h2>
        <p className="text-sm text-muted-foreground leading-normal">
          There are no active sections for the current academic year. Add sections before posting homework.
        </p>
      </div>
    )
  }

  const handleCreateAssignment = () => {
    if (!assignTitle.trim()) return
    if (!selectedSectionRow?.id || !selectedSubjectId) {
      toast.error("Choose both subject and class section.")
      return
    }
    createAssignMut.mutate()
  }

  const canComposeHomework =
    !!selectedSubjectId && !!selectedSectionRow?.id && subjects.length > 0 && filteredSections.length > 0

  const groupBannerTitle = selectedSectionRow
    ? `${sectionClassDisplayName(selectedSectionRow)} · Section ${selectedSectionRow.name} — ${selectedSubjectName}`
    : selectedSubjectName

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto py-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Homework Roster</h1>
          <p className="text-muted-foreground mt-1.5 font-medium">
            Post homework by subject and class. Students inherit tasks when they are rostered into the section through school enrollments.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {selectedSectionRow && (
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 rounded-3xl border border-primary/10">
              <h2 className="text-lg font-bold text-foreground leading-snug">{groupBannerTitle}</h2>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                <span>Subject · {selectedSubjectName}</span>
                <span className="opacity-60" aria-hidden>
                  |
                </span>
                <span>
                  {sectionClassDisplayName(selectedSectionRow)} · Section {selectedSectionRow.name}
                </span>
                <span className="opacity-60">|</span>
                <span className="text-muted-foreground/90 normal-case tracking-normal font-medium">
                  Daily homework roster (school section enrolment)
                </span>
              </p>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-base font-extrabold tracking-tight flex items-center gap-2 border-b pb-3">
              <FileText className="h-4.5 w-4.5 text-primary" />
              Posted homework for this class & subject ({homeworkItems.length} tasks)
            </h3>

            {loadingHomeworkRows ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : homeworkItems.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-2xl bg-muted/5">
                <ClipboardList className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm font-bold text-foreground">No homework yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  Use Post homework on the right to create today&apos;s assignment.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {homeworkItems.map((hw) => (
                  <TeacherHomeworkCard key={hw.id} homework={hw} invalidateRoster={rosterKey} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader className="bg-muted/10 border-b pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Plus className="h-4.5 w-4.5 text-primary" />
                Create homework
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Daily homework is separate from LMS course learning-path quizzes. Rosters follow school section enrolment.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Subject</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm font-medium"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Class &amp; section</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm font-medium"
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                >
                  {filteredSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {sectionClassDisplayName(s)} · Section {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground block mb-1">Target group</span>
                {selectedSectionRow ? (
                  <span>
                    {selectedSubjectName} for {sectionClassDisplayName(selectedSectionRow)} section {selectedSectionRow.name}{" "}
                    — visible to students with an active enrolment in this section and year (not LMS course enrolment).
                  </span>
                ) : (
                  "Select subject and section."
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Title</Label>
                <Input
                  placeholder="e.g. Chapter 3 practice"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Description</Label>
                <textarea
                  placeholder="Instructions, links, or submission requirements…"
                  value={assignDesc}
                  onChange={(e) => setAssignDesc(e.target.value)}
                  className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Maximum marks</Label>
                <Input
                  type="number"
                  value={assignMarks}
                  onChange={(e) => setAssignMarks(Number(e.target.value) || 0)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Due date (optional)</Label>
                <Input type="date" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} className="h-9 text-sm" />
              </div>

              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                <input type="checkbox" checked={assignPublished} onChange={(e) => setAssignPublished(e.target.checked)} />
                Publish immediately
              </label>

              <Button
                className="w-full h-10 text-sm font-semibold mt-2"
                disabled={
                  createAssignMut.isPending || !assignTitle.trim() || !canComposeHomework
                }
                onClick={handleCreateAssignment}
              >
                {createAssignMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Post homework
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function TeacherHomeworkCard({
  homework,
  invalidateRoster,
}: {
  homework: HomeworkAssignmentRow
  invalidateRoster: string
}) {
  const [showSubmissions, setShowSubmissions] = useState(false)

  return (
    <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <Badge variant={homework.is_published ? "default" : "secondary"} className="text-[10px] font-bold uppercase tracking-wider">
            {homework.is_published ? "Published" : "Draft"}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
            {homework.max_marks} pts
          </Badge>
        </div>
        <CardTitle className="text-base font-bold mt-2">{homework.title}</CardTitle>
      </CardHeader>
      
      <CardContent className="pb-4 space-y-3">
        {homework.description && (
          <p className="text-xs text-muted-foreground leading-normal line-clamp-2">
            {homework.description}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t">
          {homework.due_date ? (
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Due: {new Date(homework.due_date).toLocaleDateString()}
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-muted-foreground">No due date</span>
          )}

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs font-bold gap-1.5 rounded-xl hover:bg-primary/5 border-primary/20 hover:border-primary/40 text-primary"
            onClick={() => setShowSubmissions(true)}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Grade submissions
          </Button>
        </div>
      </CardContent>

      {showSubmissions &&
        createPortal(
          <HomeworkGradingModal homework={homework} rosterKey={invalidateRoster} onClose={() => setShowSubmissions(false)} />,
          document.body
        )
      }
    </Card>
  )
}

function HomeworkGradingModal({
  homework,
  rosterKey,
  onClose,
}: {
  homework: HomeworkAssignmentRow
  rosterKey: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const profileId = useAuth((s) => s.user?.id)

  const [searchTerm, setSearchTerm] = useState("")
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "graded" | "missing">("all")

  const { data: submissions = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["daily-homework-submissions", homework.id],
    queryFn: () => listSubmissionsForHomework(homework.id),
  })

  const gradeMut = useMutation({
    mutationFn: (params: { submissionId: string; marksObtained: number; feedback?: string }) =>
      gradeHomeworkSubmission({
        submissionId: params.submissionId,
        marksObtained: params.marksObtained,
        feedback: params.feedback,
        gradedBy: profileId!,
      }),
    onSuccess: () => {
      toast.success("Submission graded successfully!")
      qc.invalidateQueries({ queryKey: ["daily-homework-submissions", homework.id] })
      qc.invalidateQueries({ queryKey: ["daily-homework", rosterKey] })
      qc.invalidateQueries({ queryKey: ["student-daily-homework"] })
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Grading failed")
    },
  })

  // Compute Stats
  const totalEnrolled = submissions.length
  const totalSubmitted = submissions.filter((s) => !!s.submission).length
  const totalGraded = submissions.filter((s) => s.submission?.status === "graded").length
  const totalPending = submissions.filter((s) => !!s.submission && s.submission.status !== "graded").length
  const totalMissing = totalEnrolled - totalSubmitted

  // Filter Submissions
  const filteredSubmissions = submissions.filter((item) => {
    const nameMatch = item.student_name.toLowerCase().includes(searchTerm.toLowerCase())
    const rollMatch = item.roll_no?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false
    const admMatch = item.admission_no?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false
    const matchesSearch = nameMatch || rollMatch || admMatch

    if (!matchesSearch) return false

    if (filterTab === "pending") return !!item.submission && item.submission.status !== "graded"
    if (filterTab === "graded") return item.submission?.status === "graded"
    if (filterTab === "missing") return !item.submission
    return true
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/92 dark:bg-background/96"
      role="dialog"
      aria-modal="true"
      aria-labelledby="homework-submissions-title"
    >
      <Card
        // Disable default card hover/transform so grading UI stays stable and crisply rasterized inside the overlay.
        whileHover={{ y: 0 }}
        whileTap={{ scale: 1 }}
        className="w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col border border-border rounded-3xl overflow-hidden bg-card animate-in fade-in duration-150"
      >
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4 shrink-0 bg-muted/30 px-6 py-5">
          <div className="space-y-1">
            <CardTitle id="homework-submissions-title" className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary shrink-0" aria-hidden />
              {homework.title}
            </CardTitle>
            <CardDescription className="text-sm font-medium text-muted-foreground">
              Section enrolment submissions · Max marks: <span className="text-primary font-bold">{homework.max_marks} pts</span>
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted/80 shrink-0" onClick={onClose} aria-label="Close">
            <Plus className="h-5 w-5 rotate-45" />
          </Button>
        </CardHeader>

        {/* Content body */}
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-semibold">Loading student roster and submissions...</p>
            </div>
          ) : isError ? (
            <div className="text-center py-16 border border-dashed rounded-3xl bg-destructive/5 space-y-4 max-w-md mx-auto my-6 p-6">
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto text-destructive border border-destructive/20">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">Failed to Load Submissions</h3>
                <p className="text-xs text-muted-foreground leading-normal">
                  {error instanceof Error ? error.message : "An unexpected database connection error occurred."}
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-9 text-xs font-semibold mt-2 rounded-xl" onClick={() => refetch()}>
                Retry Fetching
              </Button>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-16 border border-dashed rounded-3xl bg-card max-w-md mx-auto my-6 p-8 space-y-4">
              <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto" />
              <h3 className="text-lg font-bold text-foreground">No enrolled students</h3>
              <p className="text-xs text-muted-foreground leading-normal">
                No active enrolments were found for this homework&apos;s class section for the term.
              </p>
            </div>
          ) : (
            <>
              {/* Stats Ribbon */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                <div className="bg-blue-500/5 border border-blue-500/15 dark:bg-blue-500/10 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Users className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide block">Roster</span>
                    <span className="text-lg font-semibold tabular-nums text-foreground">
                      {totalEnrolled} <span className="text-xs text-muted-foreground font-normal">students</span>
                    </span>
                  </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/15 dark:bg-amber-500/10 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide block">Pending</span>
                    <span className="text-lg font-semibold tabular-nums text-foreground">
                      {totalPending} <span className="text-xs text-muted-foreground font-normal">to review</span>
                    </span>
                  </div>
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/15 dark:bg-emerald-500/10 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Award className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide block">Graded</span>
                    <span className="text-lg font-semibold tabular-nums text-foreground">
                      {totalGraded} <span className="text-xs text-muted-foreground font-normal">evaluated</span>
                    </span>
                  </div>
                </div>

                <div className="bg-rose-500/5 border border-rose-500/15 dark:bg-rose-500/10 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide block">Missing</span>
                    <span className="text-lg font-semibold tabular-nums text-foreground">
                      {totalMissing} <span className="text-xs text-muted-foreground font-normal">not submitted</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Controls Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 dark:bg-muted/10 p-3 rounded-2xl border shrink-0">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by name, roll, admission no…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-sm rounded-xl bg-background border-muted focus-visible:ring-primary focus-visible:ring-1"
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-1 bg-background border p-1 rounded-xl self-start sm:self-auto">
                  {[
                    { id: "all", label: "All", count: totalEnrolled },
                    { id: "pending", label: "Pending", count: totalPending },
                    { id: "graded", label: "Graded", count: totalGraded },
                    { id: "missing", label: "Missing", count: totalMissing },
                  ].map((tab) => (
                    <button
                      type="button"
                      key={tab.id}
                      onClick={() => setFilterTab(tab.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                        filterTab === tab.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {tab.label}
                      <span
                        className={`tabular-nums text-xs px-1.5 py-0.5 rounded-md font-semibold ${
                          filterTab === tab.id
                            ? "bg-primary-foreground/15 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submission Roster List */}
              <div className="space-y-1">
                {filteredSubmissions.length === 0 ? (
                  <div className="text-center py-12 border border-dashed rounded-2xl bg-muted/5">
                    <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs font-bold text-foreground">No matching students found</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
                      Adjust your search keyword or selected status filters.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-card/30">
                    {filteredSubmissions.map((item) => (
                      <StudentSubmissionRow
                        key={item.student_id}
                        item={item}
                        maxMarks={Number(homework.max_marks)}
                        isPending={gradeMut.isPending}
                        onGrade={(marks, feedback) => {
                          if (item.submission) {
                            gradeMut.mutate({
                              submissionId: item.submission.id,
                              marksObtained: marks,
                              feedback,
                            })
                          } else {
                            toast.error("Student has not submitted any work yet.")
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StudentSubmissionRow({
  item,
  maxMarks,
  isPending,
  onGrade,
}: {
  item: DailyHomeworkClassItem
  maxMarks: number
  isPending: boolean
  onGrade: (marks: number, feedback: string) => void
}) {
  const [marks, setMarks] = useState(item.submission?.marks_obtained ?? 0)
  const [feedback, setFeedback] = useState(item.submission?.feedback ?? "")
  const [isEditing, setIsEditing] = useState(false)

  const hasSubmission = !!item.submission
  const isGraded = item.submission?.status === "graded"

  useEffect(() => {
    if (item.submission) {
      setMarks(item.submission.marks_obtained ?? 0)
      setFeedback(item.submission.feedback ?? "")
    }
  }, [item.submission])

  const handleSave = () => {
    if (marks < 0 || marks > maxMarks) {
      toast.error(`Marks must be between 0 and ${maxMarks}`)
      return
    }
    onGrade(marks, feedback)
    setIsEditing(false)
  }

  // Initials and Color
  const initials = getInitials(item.student_name)
  const avatarStyle = getAvatarColor(item.student_name)

  return (
    <div className="py-5 flex flex-col md:flex-row gap-6 md:items-start justify-between hover:bg-muted/30 px-4 bg-background">
      {/* Student Details and submission text */}
      <div className="flex-1 space-y-3.5">
        <div className="flex items-center gap-3">
          {/* Deterministic Colorful Avatar */}
          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 border uppercase shadow-xs ${avatarStyle}`}>
            {initials}
          </div>

          <div>
            <h4 className="font-semibold text-base text-foreground flex items-center gap-2 leading-snug">
              {item.student_name}
            </h4>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground font-medium">
                {item.roll_no ? `Roll: ${item.roll_no}` : `Adm: ${item.admission_no || "N/A"}`}
              </span>
              <span className="text-muted-foreground/50 text-xs" aria-hidden>
                ·
              </span>
              {isGraded ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 text-xs font-medium py-0.5 px-2 rounded-md">
                  Graded
                </Badge>
              ) : hasSubmission ? (
                <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25 text-xs font-medium py-0.5 px-2 rounded-md">
                  Needs grading
                </Badge>
              ) : (
                <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25 text-xs font-medium py-0.5 px-2 rounded-md">
                  Missing
                </Badge>
              )}
            </div>
          </div>
        </div>

        {hasSubmission ? (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary shrink-0" aria-hidden />
              Submission
            </span>
            <div className="bg-muted/60 dark:bg-muted/40 p-4 rounded-xl border border-border text-sm font-normal leading-relaxed text-foreground max-w-2xl whitespace-pre-wrap break-words">
              {item.submission?.content || "No submission text provided."}
            </div>
            {item.submission?.submitted_at && (
              <span className="text-xs text-muted-foreground block font-medium">
                Submitted on {new Date(item.submission.submitted_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short"
                })}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/80 italic pl-1 flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/45" />
            No work has been submitted yet.
          </p>
        )}
      </div>

      {/* Grading controls */}
      <div className="w-full md:w-[300px] shrink-0 border rounded-xl p-4 bg-muted/40 dark:bg-muted/25 space-y-3.5">
        {isGraded && !isEditing ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center gap-2 bg-emerald-500/10 dark:bg-emerald-500/15 p-3 rounded-lg border border-emerald-500/20">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Score</span>
              <span className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                {item.submission?.marks_obtained}
                <span className="text-sm text-muted-foreground font-medium"> / {maxMarks}</span>
              </span>
            </div>
            {item.submission?.feedback && (
              <div className="text-sm bg-card border border-border rounded-lg p-3 text-foreground leading-relaxed">
                <span className="font-semibold text-muted-foreground block mb-2 text-xs">Teacher feedback</span>
                <p className="text-sm text-foreground">{item.submission.feedback}</p>
              </div>
            )}
            {hasSubmission && (
              <Button size="sm" variant="outline" className="w-full h-9 text-sm font-medium rounded-lg" onClick={() => setIsEditing(true)}>
                Edit grade
              </Button>
            )}
          </div>
        ) : hasSubmission ? (
          <div className="space-y-3.5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Marks (out of {maxMarks})</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={maxMarks}
                  value={marks}
                  onChange={(e) => setMarks(Number(e.target.value) || 0)}
                  className="h-10 tabular-nums text-base font-medium bg-background rounded-lg border-border focus-visible:ring-primary focus-visible:ring-2"
                />
                <span className="text-sm font-medium text-muted-foreground shrink-0">/ {maxMarks}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Feedback for student</Label>
              <textarea
                placeholder="Optional comments…"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full min-h-[72px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              {isEditing && (
                <Button size="sm" variant="ghost" className="flex-1 h-9 text-sm font-medium rounded-lg" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              )}
              <Button size="sm" className="flex-1 h-9 text-sm font-semibold rounded-lg" disabled={isPending} onClick={handleSave}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save grade"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-1">
            <p className="text-sm font-semibold text-foreground">Cannot grade yet</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px] mx-auto">
              Grade can only be entered once student submits their assignment notes.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function getInitials(name: string) {
  const parts = name.split(" ")
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    "bg-amber-500/10 text-amber-500 border-amber-500/20",
    "bg-rose-500/10 text-rose-500 border-rose-500/20",
    "bg-sky-500/10 text-sky-500 border-sky-500/20",
    "bg-purple-500/10 text-purple-500 border-purple-500/20",
  ]
  let sum = 0
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i)
  }
  return colors[sum % colors.length]
}
