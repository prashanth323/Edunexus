import { useQuery } from "@tanstack/react-query"
import { BookOpen, Pencil, Plus } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CourseCardSkeletonGrid } from "@/components/ui/card-skeleton"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { listStaffCourses } from "../api/lms.api"

export function LmsTeacherHome() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const readOnly = activeRole === "librarian"

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["lms-staff-courses", activeSchoolId],
    queryFn: () => listStaffCourses(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  if (!activeSchoolId) {
    return <p className="text-muted-foreground text-sm">Select a school to manage LMS courses.</p>
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Learning Management</h1>
            <p className="text-muted-foreground mt-1">
              {readOnly ? "Browse courses and materials (read-only)." : "Create structured courses, lessons, materials, and quizzes."}
            </p>
          </div>
          {!readOnly ? (
            <div className="h-10 w-40 rounded-md bg-muted/80 animate-pulse shrink-0" aria-hidden />
          ) : null}
        </div>
        <CourseCardSkeletonGrid />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Learning Management</h1>
          <p className="text-muted-foreground mt-1">
            {readOnly ? "Browse courses and materials (read-only)." : "Create structured courses, lessons, materials, and quizzes."}
          </p>
        </div>
        {!readOnly && (
          <Button asChild className="gap-2">
            <Link to="/lms/courses/create">
              <Plus className="h-4 w-4" />
              New course
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.length === 0 ? (
          <p className="col-span-full text-center text-sm text-muted-foreground py-16 border border-dashed rounded-lg">
            No courses yet. {!readOnly && "Create one to get started."}
          </p>
        ) : (
          courses.map((c) => (
            <Card key={c.id} className="flex flex-col justify-between hover:border-primary/40 transition-colors overflow-hidden group">
              {c.cover_url ? (
                <div className="aspect-video w-full overflow-hidden border-b bg-muted">
                  <img 
                    src={c.cover_url} 
                    alt={c.title} 
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://placehold.co/600x400?text=Course+Image"
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
                  <Badge variant={c.is_published ? "default" : "secondary"}>{c.is_published ? "Published" : "Draft"}</Badge>
                  <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
                <CardTitle className="text-lg leading-tight">{c.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {(c as { subjects?: { name?: string } }).subjects?.name ?? "Subject"}
                  {c.section_id ? " · Section restricted" : " · Open enrollment"}
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex gap-2 border-t pt-4 mt-auto bg-muted/10">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link to={`/lms/courses/${c.id}`}>Open</Link>
                </Button>
                {!readOnly && (
                  <Button variant="secondary" size="sm" className="flex-1 gap-1" asChild>
                    <Link to={`/lms/courses/${c.id}/edit`}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
