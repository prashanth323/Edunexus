import { useQuery } from "@tanstack/react-query"
import { BookOpen, FileText, UploadCloud, Plus, Calendar, FileDown } from "lucide-react"
import { format } from "date-fns"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CourseOrNoticeCardSkeleton } from "@/components/ui/card-skeleton"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getSubjects, getAssignments, getCourseMaterials, type Assignment, type Subject } from "../api/lms.api"

export function LmsCatalogView() {
  const activeSchoolId = useAuth((state) => state.activeSchoolId)

  const { data: subjects, isLoading: loadingSubjects } = useQuery({
    queryKey: ["lms-subjects", activeSchoolId],
    queryFn: () => getSubjects(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: assignments, isLoading: loadingAssignments } = useQuery({
    queryKey: ["lms-assignments", activeSchoolId],
    queryFn: () => getAssignments(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: materials, isLoading: loadingMaterials } = useQuery({
    queryKey: ["lms-materials", activeSchoolId],
    queryFn: () => getCourseMaterials(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const isLoading = loadingSubjects || loadingAssignments || loadingMaterials

  const listSubjects = subjects ?? []
  const listAssignments = assignments ?? []
  const listMaterials = materials ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Learning Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage LMS catalog subjects, learning-path assignments inside courses, and materials.
            </p>
          </div>
        </div>
        <div className="flex gap-2 h-10 bg-muted/50 rounded-md border w-full max-w-md animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <CourseOrNoticeCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Learning Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage LMS catalog subjects, learning-path assignments inside courses, and materials. Daily homework is posted
            from the Homework area (section roster), not here.
          </p>
        </div>
      </div>

      <Tabs defaultValue="assignments" className="space-y-6">
        <TabsList className="bg-muted/50 border">
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="assignments">Course assignments</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Learning-path assignments</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Tasks tied to LMS courses — not daily class homework.</p>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Create Assignment
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {listAssignments.length === 0 ? (
              <p className="col-span-full text-center text-sm text-muted-foreground py-12 border border-dashed rounded-lg">
                No assignments yet.
              </p>
            ) : (
              listAssignments.map((assignment: Assignment) => {
                const due = assignment.due_date
                const isOverdue = due ? new Date(due) < new Date() : false
                const marks = assignment.total_marks
                return (
                  <Card key={assignment.id} className="flex flex-col justify-between hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="text-xs font-normal">
                          {assignment.subject?.name || "Subject"}
                        </Badge>
                        <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-xs">
                          {isOverdue ? "Overdue" : "Active"}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg leading-tight">{assignment.title}</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {assignment.course?.title ?? "Course"} • {marks ?? "—"} Marks
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="pt-0 flex justify-between items-center text-xs text-muted-foreground border-t p-4 mt-2 bg-muted/20">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className={isOverdue ? "text-destructive font-medium" : ""}>
                          {due ? `Due: ${format(new Date(due), "MMM d, yyyy")}` : "No deadline"}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 px-2">
                        View Submissions
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Course Materials</h2>
            <Button className="gap-2">
              <UploadCloud className="h-4 w-4" /> Upload Material
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {listMaterials.length === 0 ? (
              <p className="col-span-full text-center text-sm text-muted-foreground py-12 border border-dashed rounded-lg">
                No materials uploaded yet.
              </p>
            ) : (
              listMaterials.map((material: { id: string; title: string; material_type: string; subject?: { name: string } }) => (
                <Card key={material.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="mb-2 text-primary bg-primary/10 w-fit p-2 rounded-lg">
                      <FileText className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{material.title}</CardTitle>
                    <CardDescription className="text-xs">{material.subject?.name || "Subject"}</CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-2 flex justify-between items-center border-t mt-4 p-3 bg-muted/20">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {material.material_type}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {listSubjects.length === 0 ? (
              <p className="col-span-full text-center text-sm text-muted-foreground py-12 border border-dashed rounded-lg">
                No subjects configured for this school yet.
              </p>
            ) : (
              listSubjects.map((subject: Subject) => (
                <Card key={subject.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{subject.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{subject.code}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {subject.description ?? "No description provided."}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
