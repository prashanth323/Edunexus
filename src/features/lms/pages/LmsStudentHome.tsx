import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { BookOpen, GraduationCap } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardGrid, CardHeader, CardTitle } from "@/components/ui/card"
import { CourseCardSkeletonGrid } from "@/components/ui/card-skeleton"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { STUDENT_LOTTIE } from "@/features/student-ui/lottieUrls"
import { StudentLottie } from "@/features/student-ui/StudentLottie"
import {
  getStaggerContainerLoose,
  getStaggerItem,
  getStudentPageVariants,
} from "@/features/student-ui/studentMotion"
import { getCardHoverLiftProps } from "@/lib/ui-motion"
import {
  enrollInCourse,
  getStudentIdForProfile,
  listPublishedCourses,
  listStudentCourseEnrollments,
} from "../api/lms.api"

export function LmsStudentHome() {
  const reduce = useReducedMotion()
  const queryClient = useQueryClient()
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const profileId = useAuth((s) => s.user?.id)

  const pageV = getStudentPageVariants(!!reduce)
  const staggerI = getStaggerItem(!!reduce)
  const hoverLift = getCardHoverLiftProps(!!reduce)

  const { data: studentId, isLoading: loadingSid } = useQuery({
    queryKey: ["lms-student-id", profileId, activeSchoolId],
    queryFn: () => getStudentIdForProfile(profileId!, activeSchoolId!),
    enabled: !!profileId && !!activeSchoolId,
  })

  const { data: catalog = [], isLoading: loadingCat } = useQuery({
    queryKey: ["lms-published-courses", activeSchoolId],
    queryFn: () => listPublishedCourses(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: enrollRows = [], isLoading: loadingEn } = useQuery({
    queryKey: ["lms-my-enrollments", studentId],
    queryFn: () => listStudentCourseEnrollments(studentId!),
    enabled: !!studentId,
  })

  const enrolledSet = new Map(enrollRows.map((r) => [r.course_id, r.status]))

  const enrollMut = useMutation({
    mutationFn: (courseId: string) => enrollInCourse(courseId),
    onSuccess: (_, courseId) => {
      toast.success("You are enrolled.")
      queryClient.invalidateQueries({ queryKey: ["lms-my-enrollments", studentId] })
      queryClient.invalidateQueries({ queryKey: ["lms-course-detail", courseId] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not enroll"),
  })

  const loading = loadingSid || loadingCat || loadingEn

  if (!activeSchoolId) {
    return <p className="text-muted-foreground text-sm">Select a school.</p>
  }

  if (!studentId && !loadingSid) {
    return (
      <motion.div
        className="flex flex-col gap-4 sm:gap-6"
        initial="hidden"
        animate="visible"
        variants={pageV}
      >
        <motion.div
          className="rounded-lg border p-8 text-center text-muted-foreground flex flex-col items-center gap-4"
          variants={staggerI}
        >
          <StudentLottie
            src={STUDENT_LOTTIE.graduationCap}
            height={120}
            fallback={<GraduationCap className="h-24 w-24 text-muted-foreground/40" aria-hidden />}
          />
          <p className="max-w-md">
            LMS catalog is available to student accounts linked to this school.
          </p>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div className="flex flex-col gap-4 sm:gap-6" initial="hidden" animate="visible" variants={pageV}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Course catalog</h1>
        <p className="text-muted-foreground mt-1">
          Enroll in published courses and complete lessons at your pace.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="lms-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="min-h-[400px]"
          >
            <CourseCardSkeletonGrid />
          </motion.div>
        ) : (
          <CardGrid
            key="lms-catalog"
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            staggerVariants={getStaggerContainerLoose(!!reduce)}
            exit={{ opacity: 0 }}
          >
            {catalog.length === 0 ? (
              <motion.div
                variants={staggerI}
                className="col-span-full flex flex-col items-center gap-4 py-12 border border-dashed rounded-lg"
              >
                <StudentLottie
                  src={STUDENT_LOTTIE.emptyCatalog}
                  height={140}
                  fallback={<BookOpen className="h-20 w-20 text-muted-foreground/35" aria-hidden />}
                />
                <p className="text-sm text-muted-foreground text-center px-4">No published courses yet.</p>
              </motion.div>
            ) : (
              catalog.map((c) => {
                const st = enrolledSet.get(c.id)
                const enrolled = st === "active" || st === "completed"
                const restricted = !!c.section_id
                return (
                  <Card
                    key={c.id}
                    variants={staggerI}
                    {...hoverLift}
                    className="flex flex-col justify-between h-full transition-shadow overflow-hidden group"
                  >
                    {c.cover_url ? (
                      <div className="aspect-video w-full overflow-hidden border-b bg-muted">
                        <img
                          src={c.cover_url}
                          alt={c.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src = "https://placehold.co/600x400?text=Course+Image"
                          }}
                        />
                      </div>
                    ) : (
                      <div className="aspect-video w-full flex items-center justify-center bg-muted/30 border-b">
                        <BookOpen className="h-10 w-10 text-muted-foreground/20" />
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex justify-between gap-2 items-start">
                        <Badge variant="outline">{restricted ? "Section" : "Open"}</Badge>
                        <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                      <CardTitle className="text-lg">{c.title}</CardTitle>
                      <CardDescription className="line-clamp-3">{c.description ?? "No description"}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                      {(c as { subjects?: { name?: string } }).subjects?.name ?? ""}
                      {enrolled ? (
                        <span className="block mt-2 font-medium text-foreground capitalize">Status: {st}</span>
                      ) : null}
                    </CardContent>
                    <CardFooter className="flex gap-2 border-t pt-4 mt-auto bg-muted/10">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link to={`/lms/courses/${c.id}`}>{enrolled ? "Continue" : "View"}</Link>
                      </Button>
                      {!enrolled ? (
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={enrollMut.isPending}
                          onClick={() => enrollMut.mutate(c.id)}
                        >
                          Enroll
                        </Button>
                      ) : null}
                    </CardFooter>
                  </Card>
                )
              })
            )}
          </CardGrid>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
