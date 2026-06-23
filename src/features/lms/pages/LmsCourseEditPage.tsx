import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query"
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, FileText, Folder, Loader2, Plus, Trash2, Search, AlertCircle, Award, Users, HelpCircle, Sparkles, Clock } from "lucide-react"
import { Link, Navigate, useParams } from "react-router-dom"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import type { Dispatch, SetStateAction } from "react"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CoursePlayerPageSkeleton } from "@/components/ui/card-skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { cn } from "@/lib/utils"
import { createAssignment, createCourseLesson, createCourseModule, createStudyMaterial, getCourseDetail, listAssignmentsForCourse, uploadCourseCover, uploadCoursePdf, softDeleteCourseLesson, softDeleteCourseModule, softDeleteStudyMaterial, updateAssignment, updateCourse, updateCourseLesson, updateCourseModule, listSubmissionsForAssignment, gradeSubmission, type ClassSubmissionItem, type AssignmentRow, type CourseLessonRow, type CourseModuleRow, type StudyMaterialRow } from "../api/lms.api"
import { toYoutubeEmbedUrl } from "../utils/youtube"
import { emptyQuizSpec, validateQuizSpec, type QuizQuestionMcq, type QuizSpec } from "../types/quiz-spec"
import { Tree } from "react-arborist"
import { LmsTreeNode, type CourseTreeNode } from "../components/LmsTreeComponents"

function QuizSpecEditor({
  spec,
  onChange,
  disabled,
}: {
  spec: QuizSpec
  onChange: (s: QuizSpec) => void
  disabled?: boolean
}) {
  const patchQuestion = (id: string, patch: Partial<QuizQuestionMcq>) => {
    onChange({
      ...spec,
      questions: spec.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    })
  }

  const addQuestion = () => {
    const id = crypto.randomUUID()
    onChange({
      ...spec,
      questions: [...spec.questions, { id, type: "mcq", prompt: "", choices: ["", ""], correctIndex: 0 }],
    })
  }

  const removeQuestion = (id: string) => {
    onChange({ ...spec, questions: spec.questions.filter((q) => q.id !== id) })
  }

  const addChoice = (qid: string, choices: string[]) => {
    patchQuestion(qid, { choices: [...choices, ""] })
  }

  const setChoice = (qid: string, choices: string[], idx: number, val: string) => {
    const next = [...choices]
    next[idx] = val
    patchQuestion(qid, { choices: next })
  }

  return (
    <div className="space-y-4 rounded-md border p-3 bg-muted/30">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <p className="text-sm font-medium">Quiz questions (MCQ)</p>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={addQuestion}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add question
        </Button>
      </div>
      {spec.questions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No questions yet.</p>
      ) : (
        spec.questions.map((q, qi) => (
          <div key={q.id} className="rounded-md border bg-background p-3 space-y-2">
            <div className="flex justify-between gap-2">
              <span className="text-xs text-muted-foreground">Question {qi + 1}</span>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={disabled} onClick={() => removeQuestion(q.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prompt</Label>
              <Input value={q.prompt} disabled={disabled} onChange={(e) => patchQuestion(q.id, { prompt: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Choices</Label>
              {q.choices.map((c, ci) => (
                <div key={`${q.id}-c-${ci}`} className="flex gap-2 items-center">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={q.correctIndex === ci}
                    disabled={disabled}
                    onChange={() => patchQuestion(q.id, { correctIndex: ci })}
                    className="shrink-0"
                  />
                  <Input value={c} disabled={disabled} onChange={(e) => setChoice(q.id, q.choices, ci, e.target.value)} placeholder={`Choice ${ci + 1}`} />
                </div>
              ))}
              <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => addChoice(q.id, q.choices)}>
                Add choice
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export function LmsCourseEditPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const qc = useQueryClient()
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const profileId = useAuth((s) => s.user?.id)

  const readOnly = activeRole === "librarian"

  const [courseTitle, setCourseTitle] = useState("")
  const [courseDesc, setCourseDesc] = useState("")
  const [coverUrl, setCoverUrl] = useState("")
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coursePublished, setCoursePublished] = useState(false)

  const [newModuleTitle, setNewModuleTitle] = useState("")

  const [assignTitle, setAssignTitle] = useState("")
  const [assignDesc, setAssignDesc] = useState("")
  const [assignType, setAssignType] = useState<"file" | "quiz" | "mixed">("file")
  const [assignMarks, setAssignMarks] = useState(100)
  const [assignDue, setAssignDue] = useState("")
  const [assignPublished, setAssignPublished] = useState(false)
  const [quizDraft, setQuizDraft] = useState<QuizSpec>(() => emptyQuizSpec())

  const [pdfDocTitle, setPdfDocTitle] = useState("")
  const [pdfDocUrl, setPdfDocUrl] = useState("")
  const [pdfDocFile, setPdfDocFile] = useState<File | null>(null)

  const [matTitles, setMatTitles] = useState<Record<string, string>>({})
  const [matUrls, setMatUrls] = useState<Record<string, string>>({})
  const [matTypes, setMatTypes] = useState<Record<string, "link" | "video" | "image">>({})

  const [selectedNodeId, setSelectedNodeId] = useState<string>("course-root")

  const detailQuery = useQuery({
    queryKey: ["lms-course-detail", courseId],
    queryFn: () => getCourseDetail(courseId!),
    enabled: !!courseId,
  })

  const assignmentsQuery = useQuery({
    queryKey: ["lms-assignments", courseId],
    queryFn: () => listAssignmentsForCourse(courseId!),
    enabled: !!courseId,
  })

  useEffect(() => {
    const d = detailQuery.data
    if (!d) return
    setCourseTitle(d.course.title)
    setCourseDesc(d.course.description ?? "")
    setCoverUrl(d.course.cover_url ?? "")
    setCoursePublished(d.course.is_published)
  }, [detailQuery.data?.course.id, detailQuery.data?.course.updated_at])

  const modulesSorted = useMemo(() => {
    const d = detailQuery.data
    if (!d) return []
    return [...d.modules].sort((a, b) => a.order_no - b.order_no)
  }, [detailQuery.data])

  const treeData = useMemo<CourseTreeNode[]>(() => {
    const d = detailQuery.data
    if (!d) return []

    const root: CourseTreeNode = {
      id: "course-root",
      name: d.course.title,
      type: "course",
      children: [],
    }

    const modules: CourseTreeNode[] = modulesSorted.map((m) => ({
      id: m.id,
      name: m.title,
      type: "module" as const,
      children: d.lessons
        .filter((l) => l.module_id === m.id && !l.deleted_at)
        .sort((a, b) => a.order_no - b.order_no)
        .map((l) => ({
          id: l.id,
          name: l.title,
          type: "lesson" as const,
          isPublished: l.is_published,
        })),
    }))

    const unassignedLessons = d.lessons
      .filter((l) => !l.module_id && !l.deleted_at)
      .sort((a, b) => a.order_no - b.order_no)
      .map((l) => ({
        id: l.id,
        name: l.title,
        type: "lesson" as const,
        isPublished: l.is_published,
      }))

    if (unassignedLessons.length > 0) {
      modules.push({
        id: "unassigned-folder",
        name: "Lessons without module",
        type: "folder" as const,
        children: unassignedLessons,
      })
    }

    return [root, ...modules]
  }, [detailQuery.data, modulesSorted])

  const invalidateCourse = () => {
    qc.invalidateQueries({ queryKey: ["lms-course-detail", courseId] })
    qc.invalidateQueries({ queryKey: ["lms-staff-courses", activeSchoolId] })
  }

  const saveCourseMut = useMutation({
    mutationFn: async () => {
      let finalUrl = coverUrl.trim() || null
      if (coverFile && activeSchoolId && courseId) {
        finalUrl = await uploadCourseCover({ schoolId: activeSchoolId, courseId, file: coverFile })
        setCoverUrl(finalUrl)
        setCoverFile(null)
      }
      await updateCourse(courseId!, {
        title: courseTitle.trim(),
        description: courseDesc.trim() || null,
        cover_url: finalUrl,
        is_published: coursePublished,
      })
    },
    onSuccess: () => {
      toast.success("Course saved.")
      invalidateCourse()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"),
  })

  const addModuleMut = useMutation({
    mutationFn: async () => {
      if (!activeSchoolId || !courseId) throw new Error("Missing context")
      const nextOrder = modulesSorted.length ? Math.max(...modulesSorted.map((m) => m.order_no)) + 1 : 0
      await createCourseModule({
        school_id: activeSchoolId,
        course_id: courseId,
        title: newModuleTitle.trim() || "Untitled module",
        order_no: nextOrder,
      })
    },
    onSuccess: () => {
      toast.success("Module added.")
      setNewModuleTitle("")
      invalidateCourse()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not add module"),
  })

  const deleteModuleMut = useMutation({
    mutationFn: (mid: string) => softDeleteCourseModule(mid),
    onSuccess: () => {
      toast.success("Module removed.")
      setSelectedNodeId("course-root")
      invalidateCourse()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not remove module"),
  })

  const saveModuleMut = useMutation({
    mutationFn: async ({ id, title, video_url }: { id: string; title: string; video_url: string }) => {
      const v = video_url.trim()
      if (v.length > 0 && !toYoutubeEmbedUrl(v)) {
        throw new Error("Use a YouTube watch, Shorts, or youtu.be link for the module video.")
      }
      await updateCourseModule(id, {
        title: title.trim(),
        video_url: v.length > 0 ? v : null,
      })
    },
    onSuccess: () => {
      toast.success("Module saved.")
      invalidateCourse()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
  })

  const addLessonMut = useMutation({
    mutationFn: async (moduleId: string | null) => {
      if (!activeSchoolId || !courseId || !detailQuery.data) throw new Error("Missing context")
      const inMod = lessonsForModule(moduleId)
      const nextOrder = inMod.length ? Math.max(...inMod.map((l) => l.order_no)) + 1 : 0
      await createCourseLesson({
        school_id: activeSchoolId,
        course_id: courseId,
        module_id: moduleId,
        title: "New lesson",
        order_no: nextOrder,
        is_published: false,
      })
    },
    onSuccess: () => {
      toast.success("Lesson added.")
      invalidateCourse()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not add lesson"),
  })

  function lessonsForModule(moduleId: string | null): CourseLessonRow[] {
    const d = detailQuery.data
    if (!d) return []
    return d.lessons
      .filter((l) => l.module_id === moduleId)
      .filter((l) => !l.deleted_at)
      .sort((a, b) => a.order_no - b.order_no)
  }

  const saveLessonMut = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<CourseLessonRow, "title" | "description" | "content" | "module_id" | "is_published" | "order_no" | "video_url">>
    }) => {
      await updateCourseLesson(id, patch)
    },
    onSuccess: () => {
      toast.success("Lesson saved.")
      invalidateCourse()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"),
  })

  const deleteLessonMut = useMutation({
    mutationFn: (id: string) => softDeleteCourseLesson(id),
    onSuccess: () => {
      toast.success("Lesson removed.")
      setSelectedNodeId("course-root")
      invalidateCourse()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not remove lesson"),
  })

  const swapLessonsMut = useMutation({
    mutationFn: async ({ a, b }: { a: CourseLessonRow; b: CourseLessonRow }) => {
      await updateCourseLesson(a.id, { order_no: b.order_no })
      await updateCourseLesson(b.id, { order_no: a.order_no })
    },
    onSuccess: () => invalidateCourse(),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Reorder failed"),
  })

  const moveNodeMut = useMutation({
    mutationFn: async ({ dragIds, parentId, index }: { dragIds: string[]; parentId: string | null; index: number }) => {
      const d = detailQuery.data
      if (!d) return

      for (const id of dragIds) {
        const lesson = d.lessons.find((l) => l.id === id)
        if (lesson) {
          const newModuleId = parentId === "course-root" || parentId === "unassigned-folder" ? null : parentId
          await updateCourseLesson(id, { module_id: newModuleId, order_no: index })
        } else {
          const mod = d.modules.find((m) => m.id === id)
          if (mod) {
            await updateCourseModule(id, { order_no: index })
          }
        }
      }
    },
    onSuccess: () => invalidateCourse(),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Move failed"),
  })

  const addCoursePdfMut = useMutation({
    mutationFn: async () => {
      if (!activeSchoolId || !courseId || !profileId) throw new Error("Missing context")
      let url: string
      if (pdfDocFile) {
        url = await uploadCoursePdf({ schoolId: activeSchoolId, courseId, file: pdfDocFile })
      } else if (pdfDocUrl.trim()) {
        url = pdfDocUrl.trim()
      } else {
        throw new Error("Upload a PDF file or paste a link to a PDF.")
      }
      await createStudyMaterial({
        school_id: activeSchoolId,
        course_id: courseId,
        lesson_id: null,
        title: pdfDocTitle.trim() || "Course document",
        type: "pdf",
        url,
        uploaded_by: profileId,
      })
    },
    onSuccess: () => {
      toast.success("PDF added to course.")
      setPdfDocTitle("")
      setPdfDocUrl("")
      setPdfDocFile(null)
      invalidateCourse()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not add PDF"),
  })

  const addMaterialMut = useMutation({
    mutationFn: async ({ lessonId, title, url, type }: { lessonId: string; title: string; url: string; type: "link" | "video" | "image" }) => {
      if (!activeSchoolId || !courseId || !profileId) throw new Error("Missing school or profile")
      await createStudyMaterial({
        school_id: activeSchoolId,
        course_id: null,
        lesson_id: lessonId,
        title: title.trim() || "Material",
        type,
        url: url.trim(),
        uploaded_by: profileId,
      })
    },
    onSuccess: () => {
      toast.success("Material added.")
      invalidateCourse()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not add material"),
  })

  const deleteMaterialMut = useMutation({
    mutationFn: (id: string) => softDeleteStudyMaterial(id),
    onSuccess: () => {
      toast.success("Material removed.")
      invalidateCourse()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Remove failed"),
  })

  const createAssignMut = useMutation({
    mutationFn: async () => {
      if (!activeSchoolId || !courseId || !profileId) throw new Error("Missing context")
      let quiz_spec: QuizSpec | null = null
      if (assignType === "quiz" || assignType === "mixed") {
        const valid = validateQuizSpec(quizDraft)
        if (!valid?.questions.length) throw new Error("Add at least one valid quiz question.")
        quiz_spec = valid
      }
      await createAssignment({
        school_id: activeSchoolId,
        course_id: courseId,
        created_by: profileId,
        title: assignTitle.trim(),
        description: assignDesc.trim() || null,
        max_marks: assignMarks,
        due_date: assignDue ? new Date(assignDue).toISOString() : null,
        assignment_type: assignType,
        quiz_spec,
        is_published: assignPublished,
      })
    },
    onSuccess: () => {
      toast.success("Assignment created.")
      setAssignTitle("")
      setAssignDesc("")
      setAssignType("file")
      setAssignMarks(100)
      setAssignDue("")
      setAssignPublished(false)
      setQuizDraft(emptyQuizSpec())
      qc.invalidateQueries({ queryKey: ["lms-assignments", courseId] })
      invalidateCourse()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not create assignment"),
  })

  const toggleAssignPublishMut = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      await updateAssignment(id, { is_published })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms-assignments", courseId] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
  })

  if (!courseId) return null

  if (activeRole === "student") {
    return <Navigate to={`/lms/courses/${courseId}`} replace />
  }

  if (detailQuery.isLoading) {
    return <CoursePlayerPageSkeleton />
  }

  const detail = detailQuery.data
  if (!detail) {
    return <p className="p-6 text-sm text-muted-foreground">Course not found.</p>
  }

  const coursePdfMaterials = detail.materials.filter(
    (m) => !m.lesson_id && m.course_id === courseId && m.type === "pdf",
  )

  const guardRead = () => {
    if (readOnly) {
      toast.message("Read-only", { description: "Librarian accounts cannot edit courses." })
      return true
    }
    return false
  }

  const selectedLesson = detail.lessons.find((l) => l.id === selectedNodeId)
  const selectedModule = detail.modules.find((m) => m.id === selectedNodeId)

  return (
    <div className="max-w-[1400px] mx-auto py-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap gap-3 items-center justify-between px-4">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/lms">
            <ArrowLeft className="h-4 w-4" />
            LMS home
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/lms/courses/${courseId}`}>Preview course</Link>
          </Button>
          {readOnly ? <Badge variant="secondary">Read-only</Badge> : null}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 min-h-[700px]">
        {/* Tree Sidebar */}
        <aside className="w-full lg:w-80 flex flex-col gap-4">
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex flex-col h-full min-h-[500px]">
            <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Course Structure</h3>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title="Add Module"
                  disabled={readOnly}
                  onClick={() => !guardRead() && addModuleMut.mutate()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-2">
              <Tree
                data={treeData}
                width="100%"
                height={600}
                indent={16}
                rowHeight={36}
                openByDefault={true}
                onSelect={(nodes) => nodes[0] && setSelectedNodeId(nodes[0].id)}
                onMove={({ dragIds, parentId, index }) => moveNodeMut.mutate({ dragIds, parentId, index })}
              >
                {LmsTreeNode}
              </Tree>
            </div>

            <div className="p-3 border-t bg-muted/10">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Quick module name..."
                  className="h-8 text-xs"
                  disabled={readOnly}
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                />
                <Button size="sm" className="h-8 px-2 text-xs" disabled={readOnly} onClick={() => !guardRead() && addModuleMut.mutate()}>
                  Add
                </Button>
              </div>
            </div>
          </div>
          
          <Card className="bg-primary/5 border-primary/10">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Assignments</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {(assignmentsQuery.data ?? []).length === 0 ? (
                <p className="text-[11px] text-muted-foreground">None created.</p>
              ) : (
                (assignmentsQuery.data ?? []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs py-1 group">
                    <span className="truncate flex-1 pr-2">{a.title}</span>
                    <Badge variant={a.is_published ? "outline" : "secondary"} className="scale-75 origin-right">
                      {a.is_published ? "Live" : "Draft"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {selectedNodeId === "course-root" ? (
            <div className="space-y-6">
              <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-card to-muted/20">
                <CardHeader className="border-b bg-muted/10">
                  <CardTitle>Course settings</CardTitle>
                  <CardDescription>Overall course identity and configuration.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Title</Label>
                      <Input value={courseTitle} disabled={readOnly} onChange={(e) => setCourseTitle(e.target.value)} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Description</Label>
                      <textarea
                        value={courseDesc}
                        disabled={readOnly}
                        onChange={(e) => setCourseDesc(e.target.value)}
                        className={cn(
                          "flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      />
                    </div>
                    <div className="space-y-4 sm:col-span-2 border rounded-lg p-4 bg-muted/10">
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="w-full md:w-1/3 aspect-video rounded-lg border bg-background overflow-hidden relative group">
                          {coverUrl ? (
                            <img 
                              src={coverUrl} 
                              alt="Cover preview" 
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://placehold.co/600x400?text=Invalid+Image+URL"
                              }}
                            />
                          ) : (
                            <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                              <BookOpen className="h-8 w-8 opacity-20" />
                              <span className="text-xs">No cover image</span>
                            </div>
                          )}
                          {readOnly ? null : (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Label htmlFor="cover-upload" className="cursor-pointer text-white text-xs font-medium bg-primary/80 px-3 py-1.5 rounded-full hover:bg-primary">
                                Change Image
                              </Label>
                              <input 
                                id="cover-upload"
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cover image</Label>
                            <div className="flex gap-2">
                              <Input 
                                value={coverUrl} 
                                disabled={readOnly} 
                                onChange={(e) => {
                                  setCoverUrl(e.target.value)
                                  setCoverFile(null)
                                }} 
                                placeholder="Paste image URL here..." 
                              />
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="shrink-0"
                                onClick={() => document.getElementById("cover-upload")?.click()}
                              >
                                Upload
                              </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {coverFile ? `Selected: ${coverFile.name}` : "Paste a URL or upload a file. Recommended: 16:9 ratio."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                      <div className="space-y-0.5">
                        <Label className="text-base">Published Status</Label>
                        <p className="text-sm text-muted-foreground">Make this course visible to students.</p>
                      </div>
                      <input 
                        type="checkbox" 
                        className="h-5 w-5 rounded border-primary"
                        checked={coursePublished} 
                        disabled={readOnly} 
                        onChange={(e) => setCoursePublished(e.target.checked)} 
                      />
                    </div>
                  </div>
                  <Button size="lg" className="w-full sm:w-auto" disabled={readOnly || saveCourseMut.isPending} onClick={() => !guardRead() && saveCourseMut.mutate()}>
                    {saveCourseMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Save Course Changes"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardHeader className="border-b bg-muted/10">
                  <CardTitle>Course documents (PDF)</CardTitle>
                  <CardDescription>Syllabus, resources, and shared documents.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Display name</Label>
                      <Input
                        placeholder="e.g. Course syllabus"
                        disabled={readOnly}
                        value={pdfDocTitle}
                        onChange={(e) => setPdfDocTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Upload PDF</Label>
                      <Input
                        type="file"
                        accept="application/pdf,.pdf"
                        disabled={readOnly}
                        className="cursor-pointer"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null
                          setPdfDocFile(f)
                          if (f && !pdfDocTitle.trim()) setPdfDocTitle(f.name.replace(/\.pdf$/i, ""))
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Or PDF URL</Label>
                      <Input
                        placeholder="https://…/document.pdf"
                        disabled={readOnly}
                        value={pdfDocUrl}
                        onChange={(e) => setPdfDocUrl(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={readOnly || addCoursePdfMut.isPending || (!pdfDocFile && !pdfDocUrl.trim())}
                    onClick={() => !guardRead() && addCoursePdfMut.mutate()}
                  >
                    {addCoursePdfMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                    Add document
                  </Button>
                  <ul className="space-y-2 pt-2">
                    {coursePdfMaterials.length === 0 ? (
                      <li className="text-xs text-muted-foreground p-4 text-center border-2 border-dashed rounded-lg">No PDFs attached yet.</li>
                    ) : (
                      coursePdfMaterials.map((m) => (
                        <li key={m.id} className="flex justify-between items-center gap-2 border rounded-xl px-4 py-3 bg-muted/10 group transition-all hover:bg-muted/20">
                          <span className="flex items-start gap-3 min-w-0">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <span className="min-w-0">
                              <span className="font-medium text-sm block">{m.title}</span>
                              <span className="text-[10px] text-muted-foreground truncate block opacity-70">{m.url}</span>
                            </span>
                          </span>
                          {!readOnly ? (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => deleteMaterialMut.mutate(m.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </li>
                      ))
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md overflow-hidden">
                <CardHeader className="border-b bg-muted/10">
                  <CardTitle>Assignments</CardTitle>
                  <CardDescription>Manage homework, quizzes, and projects.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="rounded-xl border p-5 bg-muted/10 space-y-4">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" />
                      Create New Assignment
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Title</Label>
                        <Input disabled={readOnly} value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Description</Label>
                        <textarea
                          disabled={readOnly}
                          value={assignDesc}
                          onChange={(e) => setAssignDesc(e.target.value)}
                          className={cn(
                            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          disabled={readOnly}
                          value={assignType}
                          onChange={(e) => setAssignType(e.target.value as typeof assignType)}
                        >
                          <option value="file">File Submission</option>
                          <option value="quiz">Online Quiz</option>
                          <option value="mixed">Mixed (File + Quiz)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max marks</Label>
                        <Input
                          type="number"
                          disabled={readOnly}
                          value={assignMarks}
                          onChange={(e) => setAssignMarks(Number(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Due date (optional)</Label>
                        <Input type="date" disabled={readOnly} value={assignDue} onChange={(e) => setAssignDue(e.target.value)} />
                      </div>
                      <label className="flex items-center gap-2 text-sm sm:col-span-2 cursor-pointer">
                        <input type="checkbox" checked={assignPublished} disabled={readOnly} onChange={(e) => setAssignPublished(e.target.checked)} />
                        Publish immediately
                      </label>
                    </div>
                    {assignType === "quiz" || assignType === "mixed" ? (
                      <QuizSpecEditor spec={quizDraft} disabled={readOnly} onChange={setQuizDraft} />
                    ) : null}
                    <Button
                      className="w-full sm:w-auto"
                      disabled={readOnly || createAssignMut.isPending || !assignTitle.trim()}
                      onClick={() => !guardRead() && createAssignMut.mutate()}
                    >
                      {createAssignMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Create Assignment"}
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Existing Assignments</p>
                    {(assignmentsQuery.data ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No assignments created yet.</p>
                    ) : (
                      <div className="grid gap-3">
                        {(assignmentsQuery.data ?? []).map((a) => (
                          <AssignmentRowEditor key={a.id} assignment={a} courseId={courseId!} readOnly={readOnly} guardRead={guardRead} toggleAssignPublishMut={toggleAssignPublishMut} />
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : selectedModule ? (
            <div className="space-y-6">
               <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-card to-blue-50/10 dark:to-blue-900/5">
                <CardHeader className="border-b bg-blue-500/5 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Module: {selectedModule.title}</CardTitle>
                    <CardDescription>Manage module identity and associated content.</CardDescription>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-8"
                    disabled={readOnly} 
                    onClick={() => !guardRead() && deleteModuleMut.mutate(selectedModule.id)}
                  >
                    Delete Module
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <ModuleEditorContent
                    mod={selectedModule}
                    readOnly={readOnly}
                    guardRead={guardRead}
                    saveModuleMut={saveModuleMut}
                    addLessonMut={addLessonMut}
                  />
                </CardContent>
              </Card>
            </div>
          ) : selectedLesson ? (
            <div className="space-y-6">
              <Card className="border-none shadow-md">
                <CardHeader className="border-b bg-primary/5 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Lesson: {selectedLesson.title}</CardTitle>
                    <CardDescription>Edit lesson content, video, and materials.</CardDescription>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-8"
                    disabled={readOnly} 
                    onClick={() => !guardRead() && deleteLessonMut.mutate(selectedLesson.id)}
                  >
                    Delete Lesson
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <LessonEditorCard
                    lesson={selectedLesson}
                    modulesSorted={modulesSorted}
                    ls={lessonsForModule(selectedLesson.module_id)}
                    readOnly={readOnly}
                    guardRead={guardRead}
                    saveLessonMut={saveLessonMut}
                    deleteLessonMut={deleteLessonMut}
                    swapLessonsMut={swapLessonsMut}
                    matTitles={matTitles}
                    setMatTitles={setMatTitles}
                    matUrls={matUrls}
                    setMatUrls={setMatUrls}
                    matTypes={matTypes}
                    setMatTypes={setMatTypes}
                    addMaterialMut={addMaterialMut}
                    deleteMaterialMut={deleteMaterialMut}
                    lessonMaterials={detail.materials.filter((m) => m.lesson_id === selectedLesson.id)}
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-12 bg-muted/10 border-2 border-dashed rounded-2xl">
              <div className="text-center space-y-2">
                <Folder className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <p className="text-muted-foreground font-medium">Select a module or lesson from the structure to begin editing.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function ModuleEditorContent({
  mod,
  readOnly,
  guardRead,
  saveModuleMut,
  addLessonMut,
}: {
  mod: CourseModuleRow
  readOnly: boolean
  guardRead: () => boolean
  saveModuleMut: any
  addLessonMut: any
}) {
  const [modTitle, setModTitle] = useState(mod.title)
  const [modVideoUrl, setModVideoUrl] = useState(mod.video_url ?? "")

  useEffect(() => {
    setModTitle(mod.title)
    setModVideoUrl(mod.video_url ?? "")
  }, [mod.id, mod.updated_at])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Module Title</Label>
          <Input disabled={readOnly} value={modTitle} onChange={(e) => setModTitle(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Intro Video (YouTube URL)</Label>
          <Input
            placeholder="https://www.youtube.com/watch?v=…"
            disabled={readOnly}
            value={modVideoUrl}
            onChange={(e) => setModVideoUrl(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex flex-wrap gap-3">
        <Button
          className="flex-1 sm:flex-none"
          disabled={readOnly || saveModuleMut.isPending}
          onClick={() => !guardRead() && saveModuleMut.mutate({ id: mod.id, title: modTitle, video_url: modVideoUrl })}
        >
          Save Module Details
        </Button>
        <Button
          variant="outline"
          className="flex-1 sm:flex-none"
          disabled={readOnly}
          onClick={() => !guardRead() && addLessonMut.mutate(mod.id)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Lesson
        </Button>
      </div>
    </div>
  )
}

function AssignmentRowEditor({
  assignment,
  courseId,
  readOnly,
  guardRead,
  toggleAssignPublishMut,
}: {
  assignment: AssignmentRow
  courseId: string
  readOnly: boolean
  guardRead: () => boolean
  toggleAssignPublishMut: Pick<
    UseMutationResult<unknown, unknown, { id: string; is_published: boolean }, unknown>,
    "mutate" | "isPending"
  >
}) {
  const [showSubmissions, setShowSubmissions] = useState(false)

  return (
    <div className="flex flex-wrap justify-between gap-3 border rounded-md px-3 py-2 items-center">
      <div>
        <p className="font-medium text-sm">{assignment.title}</p>
        <p className="text-xs text-muted-foreground">
          {assignment.assignment_type.toUpperCase()}
          {assignment.due_date ? ` · Due ${new Date(assignment.due_date).toLocaleDateString()}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          className="h-8 text-xs font-semibold gap-1.5"
          onClick={() => setShowSubmissions(true)}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Submissions
        </Button>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={assignment.is_published}
            disabled={readOnly || toggleAssignPublishMut.isPending}
            onChange={(e) => {
              if (guardRead()) return
              toggleAssignPublishMut.mutate({ id: assignment.id, is_published: e.target.checked })
            }}
          />
          Published
        </label>
      </div>

      {showSubmissions &&
        createPortal(
          <AssignmentSubmissionsModal
            assignment={assignment}
            courseId={courseId}
            onClose={() => setShowSubmissions(false)}
          />,
          document.body
        )
      }
    </div>
  )
}

function AssignmentSubmissionsModal({
  assignment,
  courseId,
  onClose,
}: {
  assignment: AssignmentRow
  courseId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const profileId = useAuth((s) => s.user?.id)

  const [searchTerm, setSearchTerm] = useState("")
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "graded" | "missing">("all")

  const { data: submissions = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["lms-assignment-submissions", assignment.id, courseId],
    queryFn: () => listSubmissionsForAssignment(assignment.id, courseId),
  })

  const gradeMut = useMutation({
    mutationFn: (params: { submissionId: string; marksObtained: number; feedback?: string }) =>
      gradeSubmission({
        submissionId: params.submissionId,
        marksObtained: params.marksObtained,
        feedback: params.feedback,
        gradedBy: profileId!,
      }),
    onSuccess: () => {
      toast.success("Submission graded successfully!")
      qc.invalidateQueries({ queryKey: ["lms-assignment-submissions", assignment.id, courseId] })
      qc.invalidateQueries({ queryKey: ["lms-assignments", courseId] })
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col border border-border/80 animate-in zoom-in-95 duration-200 rounded-3xl overflow-hidden">
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4 shrink-0 bg-muted/20 px-6 py-5">
          <div className="space-y-1">
            <CardTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              {assignment.title}
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-muted-foreground">
              Class submissions & grading dashboard · Max marks: <span className="text-primary font-bold">{assignment.max_marks} pts</span>
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted/80 shrink-0" onClick={onClose}>
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
              <h3 className="text-lg font-bold text-foreground">No Students Enrolled</h3>
              <p className="text-xs text-muted-foreground leading-normal">
                There are currently no active student enrollments assigned to this LMS course.
              </p>
            </div>
          ) : (
            <>
              {/* Stats Ribbon */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                <div className="bg-blue-500/5 border border-blue-500/10 dark:bg-blue-500/10 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                    <Users className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider block">Roster</span>
                    <span className="text-lg font-black text-foreground">{totalEnrolled} <span className="text-[10px] text-muted-foreground font-medium">Students</span></span>
                  </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/10 dark:bg-amber-500/10 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider block">Pending</span>
                    <span className="text-lg font-black text-foreground">{totalPending} <span className="text-[10px] text-muted-foreground font-medium">Review</span></span>
                  </div>
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/10 dark:bg-emerald-500/10 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                    <Award className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider block">Graded</span>
                    <span className="text-lg font-black text-foreground">{totalGraded} <span className="text-[10px] text-muted-foreground font-medium">Evaluated</span></span>
                  </div>
                </div>

                <div className="bg-rose-500/5 border border-rose-500/10 dark:bg-rose-500/10 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider block">Missing</span>
                    <span className="text-lg font-black text-foreground">{totalMissing} <span className="text-[10px] text-muted-foreground font-medium">Unsubmitted</span></span>
                  </div>
                </div>
              </div>

              {/* Controls Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 dark:bg-muted/10 p-3 rounded-2xl border shrink-0">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/80" />
                  <Input
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-8.5 text-xs rounded-xl bg-background border-muted focus-visible:ring-primary focus-visible:ring-1"
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-1 bg-background border p-1 rounded-xl shadow-xs self-start sm:self-auto">
                  {[
                    { id: "all", label: "All", count: totalEnrolled },
                    { id: "pending", label: "Pending", count: totalPending },
                    { id: "graded", label: "Graded", count: totalGraded },
                    { id: "missing", label: "Missing", count: totalMissing },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterTab(tab.id as any)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        filterTab === tab.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {tab.label}
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded-md font-extrabold ${
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
                    <p className="text-[10px] text-muted-foreground mt-0.5 max-w-xs mx-auto">
                      Adjust your search keyword or selected status filters.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {filteredSubmissions.map((item) => (
                      <StudentSubmissionRow
                        key={item.student_id}
                        item={item}
                        maxMarks={assignment.max_marks}
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
  item: ClassSubmissionItem
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
    <div className="py-5 flex flex-col md:flex-row gap-6 md:items-start justify-between border-b last:border-b-0 hover:bg-muted/5 px-2 rounded-2xl transition-all duration-150">
      {/* Student Details and submission text */}
      <div className="flex-1 space-y-3.5">
        <div className="flex items-center gap-3">
          {/* Deterministic Colorful Avatar */}
          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 border uppercase shadow-xs ${avatarStyle}`}>
            {initials}
          </div>

          <div>
            <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2">
              {item.student_name}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground font-semibold">
                {item.roll_no ? `Roll: ${item.roll_no}` : `Adm: ${item.admission_no || "N/A"}`}
              </span>
              <span className="text-muted-foreground/30 text-[10px] font-bold">·</span>
              {isGraded ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 border-emerald-500/20 text-[9px] font-black uppercase tracking-wider py-0.2 px-2.5 rounded-lg">Graded</Badge>
              ) : hasSubmission ? (
                <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/15 border-blue-500/20 text-[9px] font-black uppercase tracking-wider py-0.2 px-2.5 rounded-lg animate-pulse">Needs Grading</Badge>
              ) : (
                <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 border-rose-500/20 text-[9px] font-black uppercase tracking-wider py-0.2 px-2.5 rounded-lg">Missing</Badge>
              )}
            </div>
          </div>
        </div>

        {hasSubmission ? (
          <div className="space-y-2 pl-1">
            <span className="text-[10px] text-muted-foreground/75 uppercase tracking-widest font-black flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-primary" />
              Student Submission Notes
            </span>
            <div className="bg-muted/40 p-4 rounded-2xl border border-border/40 text-xs font-semibold leading-relaxed italic text-foreground/90 max-w-2xl shadow-xs relative">
              <span className="absolute top-2 left-2 text-2xl font-serif text-muted-foreground/20 leading-none">“</span>
              <div className="pl-3 pr-2">
                {item.submission?.content || "No submission text provided."}
              </div>
              <span className="absolute bottom-1 right-3 text-2xl font-serif text-muted-foreground/20 leading-none">”</span>
            </div>
            {item.submission?.submitted_at && (
              <span className="text-[10px] text-muted-foreground/50 block font-bold pl-3">
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
      <div className="w-full md:w-[280px] shrink-0 border rounded-2xl p-4 bg-muted/10 dark:bg-muted/5 space-y-3.5">
        {isGraded && !isEditing ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-emerald-500/5 dark:bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/10">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Score Awarded</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {item.submission?.marks_obtained} 
                <span className="text-[11px] text-muted-foreground font-semibold"> / {maxMarks}</span>
              </span>
            </div>
            {item.submission?.feedback && (
              <div className="text-xs bg-background/70 border border-muted/80 rounded-xl p-3 text-muted-foreground leading-relaxed shadow-3xs">
                <span className="font-extrabold text-foreground block mb-1 uppercase text-[9px] tracking-wider text-muted-foreground/80">Feedback Remarks</span>
                <p className="font-medium text-xs text-foreground/90">{item.submission.feedback}</p>
              </div>
            )}
            {hasSubmission && (
              <Button size="sm" variant="outline" className="w-full h-8.5 text-[10px] font-bold uppercase tracking-wider rounded-xl border-muted hover:bg-muted/80" onClick={() => setIsEditing(true)}>
                Edit Grade
              </Button>
            )}
          </div>
        ) : hasSubmission ? (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground/90 tracking-wider">Marks Obtained</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={maxMarks}
                  value={marks}
                  onChange={(e) => setMarks(Number(e.target.value) || 0)}
                  className="h-8.5 font-bold text-sm bg-background rounded-xl border-muted focus-visible:ring-primary focus-visible:ring-1"
                />
                <span className="text-xs font-bold text-muted-foreground shrink-0">/ {maxMarks}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground/90 tracking-wider">Feedback Remarks</Label>
              <textarea
                placeholder="Write helpful feedback..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full min-h-[60px] rounded-xl border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
              />
            </div>
            <div className="flex gap-2">
              {isEditing && (
                <Button size="sm" variant="ghost" className="flex-1 h-8.5 text-xs font-bold rounded-xl" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              )}
              <Button size="sm" className="flex-1 h-8.5 text-xs font-black tracking-wide rounded-xl" disabled={isPending} onClick={handleSave}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Grade"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-1">
            <p className="text-xs font-extrabold text-muted-foreground flex items-center justify-center gap-1">
              Grading Blocked
            </p>
            <p className="text-[10px] text-muted-foreground/60 leading-normal max-w-[200px] mx-auto font-medium">
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


function LessonMaterialsEditor({
  lessonId,
  mats,
  readOnly,
  guardRead,
  matTitles,
  setMatTitles,
  matUrls,
  setMatUrls,
  matTypes,
  setMatTypes,
  addMaterialMut,
  deleteMaterialMut,
}: {
  lessonId: string
  mats: StudyMaterialRow[]
  readOnly: boolean
  guardRead: () => boolean
  matTitles: Record<string, string>
  setMatTitles: Dispatch<SetStateAction<Record<string, string>>>
  matUrls: Record<string, string>
  setMatUrls: Dispatch<SetStateAction<Record<string, string>>>
  matTypes: Record<string, "link" | "video" | "image">
  setMatTypes: Dispatch<SetStateAction<Record<string, "link" | "video" | "image">>>
  addMaterialMut: Pick<
    UseMutationResult<
      unknown,
      unknown,
      { lessonId: string; title: string; url: string; type: "link" | "video" | "image" },
      unknown
    >,
    "mutate"
  >
  deleteMaterialMut: Pick<UseMutationResult<unknown, unknown, string, unknown>, "mutate">
}) {
  const key = `lesson-${lessonId}`
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Materials</p>
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-[140px]"
          placeholder="Title"
          disabled={readOnly}
          value={matTitles[key] ?? ""}
          onChange={(e) => setMatTitles((s) => ({ ...s, [key]: e.target.value }))}
        />
        <Input
          className="flex-1 min-w-[160px]"
          placeholder="URL"
          disabled={readOnly}
          value={matUrls[key] ?? ""}
          onChange={(e) => setMatUrls((s) => ({ ...s, [key]: e.target.value }))}
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          disabled={readOnly}
          value={matTypes[key] ?? "link"}
          onChange={(e) => setMatTypes((s) => ({ ...s, [key]: e.target.value as "link" | "video" | "image" }))}
        >
          <option value="link">Link</option>
          <option value="video">Video</option>
          <option value="image">Image</option>
        </select>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={readOnly}
          onClick={() => {
            if (guardRead()) return
            addMaterialMut.mutate({
              lessonId,
              title: matTitles[key] ?? "",
              url: matUrls[key] ?? "",
              type: matTypes[key] ?? "link",
            })
          }}
        >
          Add
        </Button>
      </div>
      <ul className="space-y-1">
        {mats.map((m) => (
          <li key={m.id} className="flex justify-between gap-2 text-xs border rounded px-2 py-1">
            <span className="truncate">
              {m.title} · {m.type}
            </span>
            {!readOnly ? (
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => deleteMaterialMut.mutate(m.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function LessonEditorCard({
  lesson,
  modulesSorted,
  ls,
  readOnly,
  guardRead,
  saveLessonMut,
  deleteLessonMut,
  swapLessonsMut,
  matTitles,
  setMatTitles,
  matUrls,
  setMatUrls,
  matTypes,
  setMatTypes,
  addMaterialMut,
  deleteMaterialMut,
  lessonMaterials,
}: {
  lesson: CourseLessonRow
  modulesSorted: CourseModuleRow[]
  ls: CourseLessonRow[]
  readOnly: boolean
  guardRead: () => boolean
  saveLessonMut: Pick<
    UseMutationResult<
      unknown,
      unknown,
      { id: string; patch: Partial<Pick<CourseLessonRow, "title" | "description" | "content" | "module_id" | "is_published" | "order_no" | "video_url">> },
      unknown
    >,
    "mutate" | "isPending"
  >
  deleteLessonMut: Pick<UseMutationResult<unknown, unknown, string, unknown>, "mutate">
  swapLessonsMut: Pick<UseMutationResult<unknown, unknown, { a: CourseLessonRow; b: CourseLessonRow }, unknown>, "mutate">
  matTitles: Record<string, string>
  setMatTitles: Dispatch<SetStateAction<Record<string, string>>>
  matUrls: Record<string, string>
  setMatUrls: Dispatch<SetStateAction<Record<string, string>>>
  matTypes: Record<string, "link" | "video" | "image">
  setMatTypes: Dispatch<SetStateAction<Record<string, "link" | "video" | "image">>>
  addMaterialMut: Pick<
    UseMutationResult<
      unknown,
      unknown,
      { lessonId: string; title: string; url: string; type: "link" | "video" | "image" },
      unknown
    >,
    "mutate"
  >
  deleteMaterialMut: Pick<UseMutationResult<unknown, unknown, string, unknown>, "mutate">
  lessonMaterials: StudyMaterialRow[]
}) {
  const idx = ls.findIndex((x) => x.id === lesson.id)
  const [title, setTitle] = useState(lesson.title)
  const [description, setDescription] = useState(lesson.description ?? "")
  const [content, setContent] = useState(lesson.content ?? "")
  const [moduleId, setModuleId] = useState<string>(lesson.module_id ?? "")
  const [published, setPublished] = useState(lesson.is_published)
  const [lessonVideoUrl, setLessonVideoUrl] = useState(lesson.video_url ?? "")

  useEffect(() => {
    setTitle(lesson.title)
    setDescription(lesson.description ?? "")
    setContent(lesson.content ?? "")
    setModuleId(lesson.module_id ?? "")
    setPublished(lesson.is_published)
    setLessonVideoUrl(lesson.video_url ?? "")
  }, [lesson.id, lesson.updated_at])

  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      <div className="flex flex-wrap gap-2 justify-between">
        <Input className="max-w-md font-medium" disabled={readOnly} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={readOnly || idx <= 0}
            onClick={() => idx > 0 && swapLessonsMut.mutate({ a: lesson, b: ls[idx - 1] })}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={readOnly || idx >= ls.length - 1}
            onClick={() => idx < ls.length - 1 && swapLessonsMut.mutate({ a: lesson, b: ls[idx + 1] })}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          {!readOnly ? (
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteLessonMut.mutate(lesson.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Module</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            disabled={readOnly}
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
          >
            <option value="">None</option>
            {modulesSorted.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm mt-6">
          <input type="checkbox" checked={published} disabled={readOnly} onChange={(e) => setPublished(e.target.checked)} />
          Lesson published
        </label>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Summary</Label>
        <Input disabled={readOnly} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Lesson video (optional YouTube)</Label>
        <Input
          placeholder="https://www.youtube.com/watch?v=…"
          disabled={readOnly}
          value={lessonVideoUrl}
          onChange={(e) => setLessonVideoUrl(e.target.value)}
        />
        {lessonVideoUrl.trim().length > 0 && !toYoutubeEmbedUrl(lessonVideoUrl) ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">Paste a valid YouTube watch or youtu.be link.</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Content</Label>
        <textarea
          disabled={readOnly}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={cn(
            "flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        />
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={readOnly || saveLessonMut.isPending}
        onClick={() => {
          if (guardRead()) return
          const vv = lessonVideoUrl.trim()
          if (vv.length > 0 && !toYoutubeEmbedUrl(vv)) {
            toast.error("Use a YouTube watch, Shorts, or youtu.be link for the lesson video.")
            return
          }
          saveLessonMut.mutate({
            id: lesson.id,
            patch: {
              title: title.trim(),
              description: description.trim() || null,
              content: content.trim() || null,
              module_id: moduleId || null,
              is_published: published,
              video_url: vv.length > 0 ? vv : null,
            },
          })
        }}
      >
        Save lesson
      </Button>

      <details className="rounded-md border bg-muted/20 px-2 py-1">
        <summary className="text-xs font-medium text-muted-foreground cursor-pointer select-none py-1 px-1">
          Extra links (optional)
        </summary>
        <div className="pt-2 pb-1">
          <LessonMaterialsEditor
            lessonId={lesson.id}
            mats={lessonMaterials}
            readOnly={readOnly}
            guardRead={guardRead}
            matTitles={matTitles}
            setMatTitles={setMatTitles}
            matUrls={matUrls}
            setMatUrls={setMatUrls}
            matTypes={matTypes}
            setMatTypes={setMatTypes}
            addMaterialMut={addMaterialMut}
            deleteMaterialMut={deleteMaterialMut}
          />
        </div>
      </details>
    </div>
  )
}


