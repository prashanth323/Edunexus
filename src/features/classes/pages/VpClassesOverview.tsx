import { useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { GraduationCap, Loader2, Users, CalendarCheck } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getClassSectionOverview } from "../api/classesOverview.api"
import { ClassTeacherAssigner } from "@/features/timetable/components/ClassTeacherAssigner"
import { getSectionsWithClassTeachers } from "@/features/timetable/api/timetable.api"

export function VpClassesOverview() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["class-section-overview", activeSchoolId],
    queryFn: () => getClassSectionOverview(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: sections = [] } = useQuery({
    queryKey: ["sections-with-class-teachers", activeSchoolId],
    queryFn: () => getSectionsWithClassTeachers(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const sectionMap = useMemo(
    () => new Map(sections.map((s) => [s.section_id, s])),
    [sections],
  )

  function onTeacherSaved() {
    qc.invalidateQueries({ queryKey: ["class-section-overview", activeSchoolId] })
    qc.invalidateQueries({ queryKey: ["sections-with-class-teachers", activeSchoolId] })
  }

  if (!activeSchoolId) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-8 w-8" />
          Classes
        </h1>
        <p className="text-muted-foreground mt-1">
          Class teachers, enrollment, attendance, and exam performance by section.
        </p>
        <Button variant="outline" size="sm" className="mt-3 gap-2" asChild>
          <Link to="/attendance">
            <CalendarCheck className="h-4 w-4" />
            Today&apos;s absent by class
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Teaching roles guide</CardTitle>
          <CardDescription>How subject teacher vs class teacher works</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">1. Set role type</strong> — Staff → Edit details → Teaching roles:
            subject teacher, class teacher, or both.
          </p>
          <p>
            <strong className="text-foreground">2. Assign homeroom</strong> — Pick the class teacher for each section
            below. They can mark daily attendance and edit student profiles for that section.
          </p>
          <p>
            <strong className="text-foreground">3. Assign subjects</strong> — Use Timetable to assign subject teaching
            periods. Subject teachers use LMS, homework, and exams for those classes.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No sections found for the current academic year. Add classes under Students → Manage classes.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All sections</CardTitle>
            <CardDescription>{rows.length} section(s) this year</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Attendance %</TableHead>
                  <TableHead>Avg exam %</TableHead>
                  <TableHead className="min-w-[280px]">Class teacher</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const section = sectionMap.get(row.section_id)
                  return (
                    <TableRow key={row.section_id}>
                      <TableCell className="font-medium">{row.class_name}</TableCell>
                      <TableCell>{row.section_name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {row.student_count}
                        </span>
                      </TableCell>
                      <TableCell>{row.attendance_pct}%</TableCell>
                      <TableCell>{row.avg_exam_pct}%</TableCell>
                      <TableCell>
                        {section ? (
                          <ClassTeacherAssigner
                            schoolId={activeSchoolId}
                            section={section}
                            onSaved={onTeacherSaved}
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {row.class_teacher_name ?? "No class teacher"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
