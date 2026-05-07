import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query"
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, FileText, Folder, Loader2, Plus, Trash2 } from "lucide-react"
import { Link, Navigate, useParams } from "react-router-dom"
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
import { createAssignment, createCourseLesson, createCourseModule, createStudyMaterial, getCourseDetail, listAssignmentsForCourse, uploadCourseCover, uploadCoursePdf, softDeleteCourseLesson, softDeleteCourseModule, softDeleteStudyMaterial, updateAssignment, updateCourse, updateCourseLesson, updateCourseModule, type AssignmentRow, type CourseLessonRow, type CourseModuleRow, type StudyMaterialRow } from "../api/lms.api"
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
                          <AssignmentRowEditor key={a.id} assignment={a} readOnly={readOnly} guardRead={guardRead} toggleAssignPublishMut={toggleAssignPublishMut} />
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
  readOnly,
  guardRead,
  toggleAssignPublishMut,
}: {
  assignment: AssignmentRow
  readOnly: boolean
  guardRead: () => boolean
  toggleAssignPublishMut: Pick<
    UseMutationResult<unknown, unknown, { id: string; is_published: boolean }, unknown>,
    "mutate" | "isPending"
  >
}) {
  return (
    <div className="flex flex-wrap justify-between gap-3 border rounded-md px-3 py-2 items-center">
      <div>
        <p className="font-medium text-sm">{assignment.title}</p>
        <p className="text-xs text-muted-foreground">
          {assignment.assignment_type.toUpperCase()}
          {assignment.due_date ? ` · Due ${new Date(assignment.due_date).toLocaleDateString()}` : ""}
        </p>
      </div>
      <label className="flex items-center gap-2 text-xs">
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
  )
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


