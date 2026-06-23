import { useQuery } from "@tanstack/react-query"
import { motion, useReducedMotion } from "framer-motion"
import {
  BookOpen,
  Calendar,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Megaphone,
  PlusCircle,
  Users,
} from "lucide-react"
import { Link } from "react-router-dom"

import { Card, CardContent, CardDescription, CardGrid, CardHeader, CardTitle } from "@/components/ui/card"
import { GenericCardSkeleton, StatCardSkeletonGrid } from "@/components/ui/card-skeleton"
import { getTeacherDashboard } from "../api/dashboard.api"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getStaggerItem } from "@/features/student-ui/studentMotion"
import { cn } from "@/lib/utils"
import { getCardHoverLiftProps } from "@/lib/ui-motion"

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const TEACHER_QUICK_LINKS = [
  {
    to: "/attendance",
    title: "Take attendance",
    description: "Open the attendance screen for your teaching sections.",
    icon: ClipboardCheck,
  },
  {
    to: "/exams",
    title: "Create test / Enter marks",
    description: "Create exams, enter student marks, and view results.",
    icon: ClipboardList,
  },
  {
    to: "/timetable",
    title: "My timetable",
    description: "View your full weekly teaching schedule.",
    icon: CalendarDays,
  },
  {
    to: "/lms",
    title: "LMS / Homework",
    description: "Upload homework, course materials, assignments, and quizzes.",
    icon: BookOpen,
  },
  {
    to: "/lms/courses/create",
    title: "New course",
    description: "Create a course and add modules, lessons, and assignments.",
    icon: PlusCircle,
  },
  {
    to: "/notices",
    title: "Send notice",
    description: "Post announcements to students, parents, or entire school.",
    icon: Megaphone,
  },
] as const

export function TeacherDashboard() {
  const reduce = useReducedMotion()
  const { user, activeSchoolId } = useAuth()
  const staggerI = getStaggerItem(!!reduce)
  const hoverLift = getCardHoverLiftProps(!!reduce)

  const { data: sections, isLoading } = useQuery({
    queryKey: ["teacher-sections", activeSchoolId, user?.id],
    queryFn: () => getTeacherDashboard(user!.id, activeSchoolId!),
    enabled: !!user?.id && !!activeSchoolId,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your classes, students, and assignments.</p>
        </div>
        <StatCardSkeletonGrid count={4} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-4">
          <GenericCardSkeleton className="lg:col-span-4" rows={4} />
          <GenericCardSkeleton className="lg:col-span-3" rows={3} />
        </div>
      </div>
    )
  }

  const rows = sections ?? []
  const totalClasses = new Set(rows.map((s: { section_id: string }) => s.section_id)).size
  const totalStudents = rows.reduce((acc: number, sec: { student_count?: number | null }) => {
    return acc + (sec.student_count ?? 0)
  }, 0)

  const scheduleRows = rows.slice(0, 8)

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Teacher Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage your classes, students, and assignments.</p>
      </div>

      <CardGrid className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variants={staggerI}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClasses}</div>
            <p className="text-xs text-muted-foreground mt-1">Distinct sections in timetable</p>
          </CardContent>
        </Card>

        <Card variants={staggerI}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students in sections</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">Sum of enrollments (may overlap)</p>
          </CardContent>
        </Card>

        <Card variants={staggerI}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Timetable slots</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rows.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active entries this term</p>
          </CardContent>
        </Card>

        <Card variants={staggerI}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rows.filter((r: { attendance_marked_today?: boolean }) => r.attendance_marked_today).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Sections with attendance marked</p>
          </CardContent>
        </Card>
      </CardGrid>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-4">
        <Card className="lg:col-span-4" variants={staggerI}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Schedule (from timetable)</CardTitle>
                <CardDescription>Your upcoming teaching blocks</CardDescription>
              </div>
              <Link
                to="/timetable"
                className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
              >
                Full timetable <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {scheduleRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                No timetable data yet. Once periods are assigned, they will appear here.
              </p>
            ) : (
              <div className="space-y-3">
                {scheduleRows.map((slot: any, i: number) => (
                  <div
                    key={`${slot.timetable_id ?? slot.section_id}-${i}`}
                    className="flex items-center gap-4 rounded-lg border p-3.5 bg-card"
                  >
                    <div className="w-20 shrink-0 text-center font-bold text-primary border-r pr-4 text-sm">
                      {slot.start_time && slot.end_time
                        ? `${String(slot.start_time).slice(0, 5)} – ${String(slot.end_time).slice(0, 5)}`
                        : "—"}
                      <div className="text-xs font-normal text-muted-foreground">
                        {slot.day_of_week != null ? (DAY_SHORT[slot.day_of_week] ?? "—") : "—"}
                        {slot.period_no != null && ` · P${slot.period_no}`}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">
                        {slot.class_name ?? "Class"} — {slot.section_name ?? "Section"}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {slot.subject_name ?? "Subject"} · {slot.student_count ?? 0} students
                        {slot.room_no ? ` · ${slot.room_no}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 overflow-hidden border-muted/80 bg-gradient-to-b from-card to-muted/20" variants={staggerI}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick actions</CardTitle>
            <CardDescription>Jump to common tasks (same routes as the sidebar).</CardDescription>
          </CardHeader>
          <CardContent>
            <CardGrid className="grid gap-3 sm:grid-cols-2">
              {TEACHER_QUICK_LINKS.map(({ to, title, description, icon: Icon }) => (
                <motion.div key={to} variants={staggerI} {...hoverLift} className="min-w-0">
                  <Link
                    to={to}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl border bg-background/80 p-3.5 shadow-sm outline-none transition-colors",
                      "hover:border-primary/35 hover:bg-accent/40 hover:shadow-md",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary transition-colors group-hover:bg-primary/18">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 font-semibold text-sm leading-tight">
                        {title}
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground leading-snug">{description}</span>
                    </span>
                  </Link>
                </motion.div>
              ))}
            </CardGrid>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
