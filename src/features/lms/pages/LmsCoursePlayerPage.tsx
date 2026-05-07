import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, BookOpen, CheckCircle2, FileText, Loader2, Pencil } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { useMemo, useState, useEffect } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CoursePlayerPageSkeleton } from "@/components/ui/card-skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { cn } from "@/lib/utils"
import {
  enrollInCourse,
  getAssignmentSubmission,
  getCourseDetail,
  getLmsEnrollment,
  getLessonProgressSet,
  getStudentIdForProfile,
  listAssignmentsForCourse,
  markLessonCompleteRpc,
  submitAssignmentQuizRpc,
  submitAssignmentManual,
  type AssignmentRow,
  type CourseLessonRow,
} from "../api/lms.api"
import { validateQuizSpec } from "../types/quiz-spec"
import { toYoutubeEmbedUrl } from "../utils/youtube"

function QuizRunner({
  assignment,
  studentId,
  alreadySubmitted,
  score,
}: {
  assignment: AssignmentRow
  studentId: string
  alreadySubmitted: boolean
  score?: number | null
}) {
  const qc = useQueryClient()
  const spec = validateQuizSpec(assignment.quiz_spec)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const mut = useMutation({
    mutationFn: () => submitAssignmentQuizRpc(assignment.id, answers),
    onSuccess: (res) => {
      toast.success(`Graded · Score ${String(res.marks_obtained ?? "")} / ${String(res.max_marks ?? "")}`)
      qc.invalidateQueries({ queryKey: ["lms-assignment-sub", assignment.id, studentId] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Submit failed"),
  })

  if (!spec?.questions.length) {
    return <p className="text-xs text-muted-foreground">Quiz has no questions.</p>
  }

  if (alreadySubmitted) {
    return (
      <p className="text-sm text-muted-foreground">
        Submitted · score <span className="font-medium text-foreground">{score ?? "—"}</span> / {assignment.max_marks}
      </p>
    )
  }

  return (
    <div className="space-y-4 mt-2">
      {spec.questions.map((q) => (
        <div key={q.id} className="rounded-md border p-3 space-y-2">
          <p className="text-sm font-medium">{q.prompt}</p>
          <div className="space-y-1">
            {q.choices.map((c, idx) => (
              <label key={`${q.id}-${idx}`} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === idx}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                />
                {c}
              </label>
            ))}
          </div>
        </div>
      ))}
      <Button size="sm" disabled={mut.isPending} onClick={() => mut.mutate()}>
        {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit quiz"}
      </Button>
    </div>
  )
}

export function LmsCoursePlayerPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const qc = useQueryClient()
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const profileId = useAuth((s) => s.user?.id)

  const previewMode = activeRole !== "student"

  const { data: studentId } = useQuery({
    queryKey: ["lms-student-id", profileId, activeSchoolId],
    queryFn: () => getStudentIdForProfile(profileId!, activeSchoolId!),
    enabled: activeRole === "student" && !!profileId && !!activeSchoolId,
  })

  const { data: enrollment, isFetched: enFetched } = useQuery({
    queryKey: ["lms-enrollment", studentId, courseId],
    queryFn: () => getLmsEnrollment(studentId!, courseId!),
    enabled: !!studentId && !!courseId && activeRole === "student",
  })

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["lms-course-detail", courseId],
    queryFn: () => getCourseDetail(courseId!),
    enabled: !!courseId && (!!previewMode || !!enrollment || activeRole === "student"),
  })


  const lessonIds = detail?.lessons.map((l) => l.id) ?? []
  const lessonIdsKey = lessonIds.slice().sort().join(",")

  const { data: progressReady = new Set<string>() } = useQuery({
    queryKey: ["lms-lesson-progress", studentId, lessonIdsKey],
    queryFn: () => getLessonProgressSet(studentId!, lessonIds),
    enabled: !!studentId && lessonIds.length > 0 && !!enrollment,
  })

  const { data: assignments = [] } = useQuery({
    queryKey: ["lms-assignments", courseId],
    queryFn: () => listAssignmentsForCourse(courseId!),
    enabled: !!courseId && (!!previewMode || !!enrollment || activeRole === "student"),
  })

  const flatLessons = useMemo(() => {
    if (!detail) return []
    const mods = [...detail.modules].sort((a, b) => a.order_no - b.order_no)
    const moduleIds = new Set(mods.map((m) => m.id))
    const out: { moduleTitle: string; lesson: CourseLessonRow }[] = []
    for (const m of mods) {
      const ls = detail.lessons
        .filter((l) => l.module_id === m.id)
        .sort((a, b) => a.order_no - b.order_no)
      for (const lesson of ls) {
        out.push({ moduleTitle: m.title, lesson })
      }
    }
    const orphans = detail.lessons
      .filter((l) => !l.module_id || !moduleIds.has(l.module_id))
      .sort((a, b) => a.order_no - b.order_no)
    for (const lesson of orphans) {
      out.push({ moduleTitle: "General", lesson })
    }
    return out
  }, [detail])

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)

  useEffect(() => {
    if (!flatLessons.length) return
    if (!activeLessonId || !flatLessons.some((x) => x.lesson.id === activeLessonId)) {
      setActiveLessonId(flatLessons[0].lesson.id)
    }
  }, [flatLessons, activeLessonId])

  const enrollMut = useMutation({
    mutationFn: () => enrollInCourse(courseId!),
    onSuccess: () => {
      toast.success("Enrolled.")
      qc.invalidateQueries({ queryKey: ["lms-enrollment", studentId, courseId] })
      qc.invalidateQueries({ queryKey: ["lms-course-detail", courseId] })
      qc.invalidateQueries({ queryKey: ["lms-my-enrollments", studentId] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not enroll"),
  })

  const completeMut = useMutation({
    mutationFn: (lid: string) => markLessonCompleteRpc(lid),
    onSuccess: () => {
      toast.success("Lesson marked complete.")
      qc.invalidateQueries({ queryKey: ["lms-lesson-progress", studentId] })
      qc.invalidateQueries({ queryKey: ["lms-enrollment", studentId, courseId] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save progress"),
  })

  const activeEntry = flatLessons.find((x) => x.lesson.id === activeLessonId)
  const activeLesson = activeEntry?.lesson
  const activeModule =
    activeLesson?.module_id && detail?.modules ? detail.modules.find((m) => m.id === activeLesson.module_id) : undefined
  const moduleVideoEmbed = activeModule?.video_url ? toYoutubeEmbedUrl(activeModule.video_url) : null
  const lessonVideoEmbed = activeLesson?.video_url ? toYoutubeEmbedUrl(activeLesson.video_url) : null
  const mats = detail?.materials.filter((m) => m.lesson_id === activeLesson?.id) ?? []
  const courseDocs =
    detail?.materials.filter((m) => !m.lesson_id && m.course_id === courseId && m.type === "pdf") ?? []

  if (!courseId) return null

  const showEnrollHero = activeRole === "student" && studentId && !enrollment && enFetched && !previewMode

  if (showEnrollHero && detail) {
    const c = detail.course
    const lessonCount = detail.lessons.length
    const moduleCount = detail.modules.length
    const assignmentCount = assignments.filter((a) => a.is_published).length
    const instructor = (c as any).instructor?.profiles
    const instructorName = instructor ? `${instructor.first_name} ${instructor.last_name}` : "School Instructor"

    return (
      <div className="max-w-6xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Button variant="ghost" size="sm" asChild className="mb-6 hover:bg-muted group">
          <Link to="/lms">
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Catalog
          </Link>
        </Button>

        <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
          {/* Main Content */}
          <div className="space-y-10">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-primary/5 text-primary border-primary/20">
                  {(c as { subjects?: { name?: string } }).subjects?.name ?? "Course"}
                </Badge>
                <Badge variant="outline" className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest border-muted-foreground/20">
                  Self-Paced
                </Badge>
              </div>
              
              <div className="space-y-4">
                <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                  {c.title}
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl font-medium">
                  {c.description ?? "Embark on a journey to master this subject with our structured curriculum and professional resources."}
                </p>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-inner">
                  <span className="text-lg font-bold text-primary">{instructorName.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">Instructor</p>
                  <p className="text-base font-semibold">{instructorName}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-8 border-y border-muted/60">
              <div className="space-y-1">
                <p className="text-2xl font-black text-primary tracking-tighter">{lessonCount}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Lessons</p>
              </div>
              <div className="space-y-1 border-l sm:border-x px-4 sm:px-6">
                <p className="text-2xl font-black text-primary tracking-tighter">{moduleCount}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Modules</p>
              </div>
              <div className="space-y-1 sm:pl-6 col-span-2 sm:col-span-1 pt-4 sm:pt-0 border-t sm:border-t-0">
                <p className="text-2xl font-black text-primary tracking-tighter">{assignmentCount}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Assignments</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Course Curriculum</h2>
                <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground">{lessonCount} total lessons</Badge>
              </div>
              
              <div className="space-y-4">
                {detail.modules.sort((a, b) => a.order_no - b.order_no).map((m) => {
                  const moduleLessons = detail.lessons
                    .filter((l) => l.module_id === m.id)
                    .sort((a, b) => a.order_no - b.order_no)
                  
                  if (moduleLessons.length === 0) return null

                  return (
                    <Card key={m.id} className="overflow-hidden border-muted/60 shadow-sm hover:shadow-md transition-shadow">
                      <div className="bg-muted/30 px-5 py-4 border-b flex items-center justify-between">
                        <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-3">
                          <span className="flex-none bg-primary text-primary-foreground w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-sm">
                            {m.order_no}
                          </span>
                          {m.title}
                        </h3>
                        <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-tighter">{moduleLessons.length} units</span>
                      </div>
                      <CardContent className="p-0">
                        <div className="divide-y divide-muted/40">
                          {moduleLessons.map((l, idx) => (
                            <div key={l.id} className="px-6 py-4 flex items-center gap-4 hover:bg-muted/10 transition-colors group/item">
                              <span className="text-xs font-bold text-muted-foreground/30 w-4">{idx + 1}</span>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground/90 group-hover/item:text-primary transition-colors">{l.title}</span>
                                {l.description && <span className="text-xs text-muted-foreground line-clamp-1">{l.description}</span>}
                              </div>
                              {l.duration_min && (
                                <span className="ml-auto text-[10px] font-bold text-muted-foreground/60 bg-muted px-2 py-0.5 rounded uppercase tracking-tighter">{l.duration_min}m</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Sidebar / CTA */}
          <div className="lg:relative">
            <div className="lg:sticky lg:top-24 space-y-6">
              <Card className="overflow-hidden border-2 border-primary/10 shadow-2xl ring-1 ring-primary/5">
                <div className="aspect-video w-full bg-muted relative group">
                  {c.cover_url ? (
                    <img src={c.cover_url} alt={c.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                      <BookOpen className="h-16 w-16 text-primary/10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-black/60 backdrop-blur-md text-white border-none text-[9px] font-black uppercase tracking-widest">Preview</Badge>
                  </div>
                </div>
                
                <CardHeader className="space-y-1 pb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black tracking-tighter text-primary">Free</span>
                  </div>
                  <CardDescription className="text-xs font-bold text-primary/80 uppercase tracking-tight">
                    Full access for all registered students
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <Button 
                    className="w-full h-14 text-lg font-black shadow-xl shadow-primary/30 transition-all hover:scale-[1.03] active:scale-[0.97] bg-primary hover:bg-primary/90 rounded-xl group" 
                    onClick={() => enrollMut.mutate()} 
                    disabled={enrollMut.isPending}
                  >
                    {enrollMut.isPending ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        Enroll Now
                        <ArrowLeft className="ml-2 h-5 w-5 rotate-180 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>
                  
                  <div className="space-y-4 pt-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b pb-2">What's included</p>
                    <ul className="space-y-3">
                      {[
                        "Interactive Video Lessons",
                        "Graded Quizzes & Assignments",
                        "Downloadable Study Materials",
                        "Official Completion Certificate",
                        "Peer Discussion Forum"
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-semibold text-foreground/80">
                          <div className="flex-none h-5 w-5 rounded-full bg-green-500/10 flex items-center justify-center">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          </div>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
              
              <div className="p-6 rounded-2xl bg-muted/40 border border-dashed border-muted-foreground/20 text-center space-y-2">
                <p className="text-sm font-bold tracking-tight">Need help?</p>
                <p className="text-xs text-muted-foreground">Contact your school administrator if you have issues with enrollment.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loadingDetail || (!detail && (!!previewMode || !!enrollment))) {
    return <CoursePlayerPageSkeleton />
  }

  if (!detail) {
    return <p className="p-6 text-muted-foreground">Course not found or you do not have access yet.</p>
  }

  const c = detail.course

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/lms">
            <ArrowLeft className="h-4 w-4 mr-2" />
            LMS home
          </Link>
        </Button>
        {previewMode && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/lms/courses/${courseId}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit course
            </Link>
          </Button>
        )}
      </div>

      <div className="relative h-48 sm:h-64 w-full rounded-xl overflow-hidden border shadow-sm mb-2">
        {c.cover_url ? (
          <img src={c.cover_url} alt={c.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-muted flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
          <div className="flex flex-col gap-1">
            <Badge className="w-fit bg-primary/90 hover:bg-primary border-none text-[10px] uppercase tracking-wider font-bold">
              {(c as { subjects?: { name?: string } }).subjects?.name ?? "Course"}
            </Badge>
            <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight drop-shadow-lg">{c.title}</h1>
            {c.description && (
              <p className="text-white/80 text-sm line-clamp-1 max-w-2xl drop-shadow-sm mt-1">
                {c.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lessons</CardTitle>
            <CardDescription className="text-xs">
              {enrollment?.status === "completed" ? (
                <Badge variant="secondary">Course completed</Badge>
              ) : enrollment ? (
                <Badge variant="outline">Enrolled</Badge>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[60vh] overflow-y-auto text-sm">
            {flatLessons.map(({ moduleTitle, lesson }) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => setActiveLessonId(lesson.id)}
                className={cn(
                  "w-full text-left rounded-md px-2 py-2 hover:bg-muted flex items-start gap-2",
                  lesson.id === activeLessonId && "bg-muted font-medium",
                )}
              >
                {studentId && enrollment && progressReady.has(lesson.id) ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <span>
                  <span className="block text-[10px] uppercase text-muted-foreground">{moduleTitle}</span>
                  {lesson.title}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {courseDocs.length > 0 ? (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Course files
                </CardTitle>
                <CardDescription className="text-xs">PDFs for this whole course.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {courseDocs.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium truncate">{doc.title}</span>
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">Open PDF</span>
                  </a>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {activeLesson ? (
            <Card>
              <CardHeader>
                <CardTitle>{activeLesson.title}</CardTitle>
                <CardDescription>{activeLesson.description ?? ""}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {moduleVideoEmbed ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Module intro</p>
                    <div className="aspect-video max-w-xl rounded-md overflow-hidden border bg-muted">
                      <iframe
                        title="Module intro video"
                        src={moduleVideoEmbed}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : null}
                {lessonVideoEmbed ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Lesson video</p>
                    <div className="aspect-video max-w-xl rounded-md overflow-hidden border bg-muted">
                      <iframe
                        title="Lesson video"
                        src={lessonVideoEmbed}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : null}

                <div className="whitespace-pre-wrap text-sm leading-relaxed">{activeLesson.content ?? "No written content."}</div>

                {mats.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Lesson materials</p>
                    {mats.map((m) => {
                      const embed = toYoutubeEmbedUrl(m.url)
                      return (
                        <div key={m.id} className="rounded-md border p-3 space-y-2">
                          <div className="flex justify-between gap-2 flex-wrap">
                            <span className="text-sm font-medium">{m.title}</span>
                            <Badge variant="outline">{m.type}</Badge>
                          </div>
                          {embed ? (
                            <div className="aspect-video max-w-xl rounded-md overflow-hidden border bg-muted">
                              <iframe
                                title={m.title}
                                src={embed}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                allowFullScreen
                              />
                            </div>
                          ) : (
                            <a href={m.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                              Open link
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                {studentId && enrollment && activeLesson.is_published ? (
                  <Button
                    variant="secondary"
                    disabled={completeMut.isPending || progressReady.has(activeLesson.id)}
                    onClick={() => completeMut.mutate(activeLesson.id)}
                  >
                    {progressReady.has(activeLesson.id) ? "Completed" : completeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark lesson complete"}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assignments</CardTitle>
              <CardDescription>Quizzes and homework for this course.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {assignments.filter((a) => a.is_published).length === 0 ? (
                <p className="text-sm text-muted-foreground">No assignments.</p>
              ) : (
                assignments
                  .filter((a) => a.is_published)
                  .map((a) => (
                    <AssignmentBlock key={a.id} assignment={a} studentId={studentId ?? ""} previewMode={previewMode} />
                  ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function AssignmentBlock({
  assignment,
  studentId,
  previewMode,
}: {
  assignment: AssignmentRow
  studentId: string
  previewMode: boolean
}) {
  const quizLike = assignment.assignment_type === "quiz" || assignment.assignment_type === "mixed"

  const { data: submission } = useQuery({
    queryKey: ["lms-assignment-sub", assignment.id, studentId],
    queryFn: () => getAssignmentSubmission(assignment.id, studentId),
    enabled: !!studentId && !previewMode,
  })

  const score =
    submission && typeof submission === "object" && "marks_obtained" in submission
      ? (submission as { marks_obtained?: number | null }).marks_obtained
      : null

  const alreadySubmitted =
    !!submission &&
    typeof submission === "object" &&
    "status" in submission &&
    String((submission as { status?: string }).status) !== "not_submitted"

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex justify-between gap-2 flex-wrap">
        <div>
          <p className="font-medium">{assignment.title}</p>
          <p className="text-xs text-muted-foreground">
            {assignment.assignment_type.toUpperCase()}
            {assignment.due_date ? ` · Due ${new Date(assignment.due_date).toLocaleDateString()}` : ""}
          </p>
        </div>
        <Badge variant="outline">{assignment.max_marks} pts</Badge>
      </div>
      {assignment.description ? <p className="text-sm text-muted-foreground">{assignment.description}</p> : null}

      {quizLike && !previewMode && studentId ? (
        <QuizRunner assignment={assignment} studentId={studentId} alreadySubmitted={alreadySubmitted} score={score} />
      ) : previewMode ? (
        <p className="text-xs text-muted-foreground">Students take quizzes here after enrolling.</p>
      ) : !quizLike && !previewMode && studentId ? (
        <ManualSubmission 
          assignment={assignment} 
          studentId={studentId} 
          alreadySubmitted={alreadySubmitted} 
          submission={submission as any}
        />
      ) : null}
    </div>
  )
}

function ManualSubmission({
  assignment,
  studentId,
  alreadySubmitted,
  submission,
}: {
  assignment: AssignmentRow
  studentId: string
  alreadySubmitted: boolean
  submission?: any
}) {
  const [text, setText] = useState("")
  const queryClient = useQueryClient()

  const mut = useMutation({
    mutationFn: () => 
      submitAssignmentManual({
        schoolId: assignment.school_id,
        assignmentId: assignment.id,
        studentId,
        content: text
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lms-assignment-sub", assignment.id, studentId] })
      toast.success("Assignment submitted successfully!")
    }
  })

  if (alreadySubmitted) {
    return (
      <div className="bg-muted/30 p-3 rounded-md border border-dashed border-primary/20 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-primary uppercase tracking-wider">Submission received</span>
          <Badge variant="secondary" className="text-[10px]">{submission?.status}</Badge>
        </div>
        <p className="text-sm font-medium italic">"{submission?.content || "No text content"}"</p>
        {submission?.marks_obtained !== null && (
          <p className="text-xs font-bold text-green-600">Grade: {submission?.marks_obtained} / {assignment.max_marks}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      <Textarea 
        placeholder="Enter your submission notes or paste a link here..." 
        value={text}
        onChange={e => setText(e.target.value)}
        className="min-h-[100px] text-sm"
      />
      <Button 
        size="sm" 
        className="w-full" 
        onClick={() => mut.mutate()}
        disabled={mut.isPending || !text.trim()}
      >
        {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Assignment"}
      </Button>
    </div>
  )
}
