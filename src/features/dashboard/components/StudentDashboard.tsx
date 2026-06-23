import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { BookOpen, CalendarCheck, CalendarDays, CreditCard, GraduationCap, IdCard, Megaphone } from "lucide-react"
import { Link } from "react-router-dom"

import { Card, CardContent, CardDescription, CardFooter, CardGrid, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCardSkeletonGrid } from "@/components/ui/card-skeleton"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getStaggerItem,
  getStudentPageVariants,
} from "@/features/student-ui/studentMotion"
import { getCardHoverLiftProps } from "@/lib/ui-motion"
import { supabase } from "@/lib/supabase"

type StudentEnrollmentInfo = {
  class_name: string | null
  section_name: string | null
  academic_year: string | null
  attendance_pct_this_month: number | null
  pending_fees: number | null
}

async function getStudentDashboardData(
  profileId: string,
  schoolId: string,
): Promise<StudentEnrollmentInfo> {
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", profileId)
    .eq("school_id", schoolId)
    .maybeSingle()

  if (!student?.id) {
    return {
      class_name: null,
      section_name: null,
      academic_year: null,
      attendance_pct_this_month: null,
      pending_fees: null,
    }
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select(`
      sections (
        name,
        classes ( name )
      ),
      academic_years ( name, is_current )
    `)
    .eq("student_id", student.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()

  const secRaw = enrollment?.sections
  const sec = Array.isArray(secRaw) ? secRaw[0] : secRaw
  const secObj = sec && typeof sec === "object" ? (sec as Record<string, unknown>) : null
  const clRaw = secObj && "classes" in secObj ? secObj.classes : null
  const cl = Array.isArray(clRaw) ? clRaw[0] : clRaw
  const ayRaw = enrollment?.academic_years
  const ay = Array.isArray(ayRaw) ? ayRaw[0] : ayRaw

  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("status")
    .eq("student_id", student.id)
    .gte("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))

  let attendancePct: number | null = null
  if (attendanceRows && attendanceRows.length > 0) {
    const present = attendanceRows.filter((r) => r.status === "present" || r.status === "late").length
    attendancePct = Math.round((present / attendanceRows.length) * 1000) / 10
  }

  const { data: feeRows } = await supabase
    .from("student_invoices")
    .select("due_amount")
    .eq("student_id", student.id)
    .in("status", ["pending", "partial", "overdue"])
    .is("deleted_at", null)

  const pendingFees = feeRows?.reduce((sum, r) => sum + Number(r.due_amount ?? 0), 0) ?? 0

  return {
    class_name: cl && typeof cl === "object" && "name" in cl ? String(cl.name) : null,
    section_name: sec && typeof sec === "object" && "name" in sec ? String(sec.name) : null,
    academic_year: ay && typeof ay === "object" && "name" in ay ? String(ay.name) : null,
    attendance_pct_this_month: attendancePct,
    pending_fees: pendingFees,
  }
}

const quickLinks = [
  {
    title: "My Timetable",
    desc: "View your weekly class schedule.",
    href: "/timetable",
    icon: CalendarDays,
  },
  {
    title: "Learning (LMS)",
    desc: "Assignments, subjects, and materials.",
    href: "/lms",
    icon: BookOpen,
  },
  {
    title: "Notices",
    desc: "School announcements and updates.",
    href: "/notices",
    icon: Megaphone,
  },
  {
    title: "Attendance",
    desc: "View your daily attendance history.",
    href: "/attendance",
    icon: CalendarCheck,
  },
  {
    title: "Student ID Card",
    desc: "View and print your school identity card.",
    href: "/student-id-card",
    icon: IdCard,
  },
] as const

export function StudentDashboard() {
  const reduce = useReducedMotion()
  const user = useAuth((s) => s.user)
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: info, isLoading } = useQuery({
    queryKey: ["student-dashboard", user?.id, activeSchoolId],
    queryFn: () => getStudentDashboardData(user!.id, activeSchoolId!),
    enabled: !!user?.id && !!activeSchoolId,
  })

  const pageV = getStudentPageVariants(!!reduce)
  const staggerI = getStaggerItem(!!reduce)
  const hoverLift = getCardHoverLiftProps(!!reduce)

  return (
    <motion.div
      className="flex flex-col gap-4 sm:gap-6"
      initial="hidden"
      animate="visible"
      variants={pageV}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Student home</h1>
          <p className="text-muted-foreground mt-1">
            Your dashboard — classes, attendance, and school communications.
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="min-h-[120px]"
          >
            <StatCardSkeletonGrid count={3} columnsClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
          </motion.div>
        ) : info ? (
          <motion.div key="content" className="min-w-0">
            <CardGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {!info.class_name ? (
                <motion.div
                  variants={staggerI}
                  className="col-span-full sm:col-span-2 lg:col-span-3 flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-6 text-center sm:flex-row sm:text-left"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Not enrolled in a class yet</p>
                    <p className="text-sm text-muted-foreground">
                      When your school assigns you to a class, it will appear on this dashboard.
                    </p>
                  </div>
                </motion.div>
              ) : null}

              <Card variants={staggerI}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">My class</CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {info.class_name
                      ? `${info.class_name}${info.section_name ? ` - ${info.section_name}` : ""}`
                      : "Not enrolled"}
                  </div>
                  {info.academic_year && (
                    <p className="text-xs text-muted-foreground mt-1">{info.academic_year}</p>
                  )}
                </CardContent>
              </Card>

              <Card variants={staggerI}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Attendance (this month)</CardTitle>
                  <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {info.attendance_pct_this_month != null
                      ? `${info.attendance_pct_this_month}%`
                      : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {info.attendance_pct_this_month != null ? "Current month" : "No records yet"}
                  </p>
                </CardContent>
              </Card>

              <Card variants={staggerI}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending fees</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${Number(info.pending_fees ?? 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Number(info.pending_fees ?? 0) > 0 ? "Outstanding balance" : "All clear"}
                  </p>
                </CardContent>
              </Card>
            </CardGrid>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <CardGrid className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map(({ title, desc, href, icon: Icon }) => (
          <Card key={href} variants={staggerI} {...hoverLift} className="flex flex-col h-full transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Icon className="h-5 w-5 text-primary" />
                {title}
              </CardTitle>
              <CardDescription>{desc}</CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto pt-0">
              <Button asChild variant="secondary" className="w-full">
                <Link to={href}>Open</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </CardGrid>
    </motion.div>
  )
}
