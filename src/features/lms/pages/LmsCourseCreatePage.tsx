import { useMutation, useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Navigate, useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { fetchMyStaffTeachingSubjectRow } from "@/features/settings/api/teacher-subject.api"
import { cn } from "@/lib/utils"
import {
  createCourse,
  getStaffIdForProfile,
  listAcademicYears,
  listSectionsForSchool,
  getSubjects,
} from "../api/lms.api"

const schema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(4000).optional(),
  subject_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  section_id: z.string().uuid().optional().nullable(),
})

type FormValues = z.infer<typeof schema>

export function LmsCourseCreatePage() {
  const navigate = useNavigate()
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const profileId = useAuth((s) => s.user?.id)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      subject_id: "",
      academic_year_id: "",
      section_id: null,
    },
  })

  const ayId = form.watch("academic_year_id")

  const { data: subjects = [], isLoading: lsub } = useQuery({
    queryKey: ["lms-subjects", activeSchoolId],
    queryFn: () => getSubjects(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: years = [], isLoading: ly } = useQuery({
    queryKey: ["lms-years", activeSchoolId],
    queryFn: () => listAcademicYears(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: sections = [], isLoading: lsec } = useQuery({
    queryKey: ["lms-sections", activeSchoolId],
    queryFn: () => listSectionsForSchool(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: staffTeachingRow } = useQuery({
    queryKey: ["my-staff-teaching-subject", activeSchoolId, profileId],
    queryFn: () => fetchMyStaffTeachingSubjectRow(activeSchoolId!, profileId!),
    enabled: !!activeSchoolId && !!profileId,
  })

  const profileDefaultSubjectId = staffTeachingRow?.primarySubjectId

  useEffect(() => {
    if (!profileDefaultSubjectId) return
    const cur = form.getValues("subject_id")
    if (cur) return
    const exists = subjects.some((s) => s.id === profileDefaultSubjectId)
    if (exists) form.setValue("subject_id", profileDefaultSubjectId)
  }, [profileDefaultSubjectId, form, subjects])

  const filteredSections = sections.filter((s: { academic_year_id?: string }) => !ayId || s.academic_year_id === ayId)

  const mut = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!activeSchoolId || !profileId) throw new Error("Missing school or profile")

      let classId: string | null = null
      let sectionId: string | null = values.section_id ?? null
      if (sectionId) {
        const hit = sections.find((x: { id: string }) => x.id === sectionId) as { class_id?: string } | undefined
        classId = hit?.class_id ?? null
      }

      const teacherId = await getStaffIdForProfile(profileId, activeSchoolId)

      const row = await createCourse({
        school_id: activeSchoolId,
        subject_id: values.subject_id,
        academic_year_id: values.academic_year_id,
        class_id: classId,
        section_id: sectionId,
        teacher_id: teacherId,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        is_published: false,
      })

      return row.id as string
    },
    onSuccess: (id) => {
      toast.success("Course created.")
      navigate(`/lms/courses/${id}/edit`, { replace: true })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not create"),
  })

  const loading = lsub || ly || lsec

  if (activeRole === "student") {
    return <Navigate to="/lms" replace />
  }

  if (!activeSchoolId) {
    return <p className="text-muted-foreground text-sm p-4">Select a school.</p>
  }

  return (
    <div className="max-w-xl mx-auto py-6 animate-in fade-in duration-500">
      <Card>
        <CardHeader>
          <CardTitle>New course</CardTitle>
          <CardDescription>Set subject and academic year. Leave section empty for school-wide open enrollment.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4 py-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
              <Skeleton className="h-10 w-full max-w-xs mx-auto" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <textarea
                          {...field}
                          className={cn(
                            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          )}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subject_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        >
                          <option value="">Select…</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="academic_year_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Academic year</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        >
                          <option value="">Select…</option>
                          {years.map((y: { id: string; name: string }) => (
                            <option key={y.id} value={y.id}>
                              {y.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="section_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restrict to section (optional)</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        >
                          <option value="">Open to whole school</option>
                          {filteredSections.map((sec: { id: string; name: string; classes?: { name?: string }[] | { name?: string } }) => {
                            const cls = Array.isArray(sec.classes) ? sec.classes[0] : sec.classes
                            const cn = cls && typeof cls === "object" && "name" in cls ? String(cls.name) : ""
                            return (
                              <option key={sec.id} value={sec.id}>
                                {cn ? `${cn} — ${sec.name}` : sec.name}
                              </option>
                            )
                          })}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={mut.isPending}>
                  {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & configure"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
