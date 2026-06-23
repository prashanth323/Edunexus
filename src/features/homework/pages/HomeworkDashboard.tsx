import { useAuth } from "@/features/auth/hooks/useAuth"
import { LmsParentHome } from "@/features/lms/pages/LmsParentHome"
import { StudentHomeworkList } from "../components/StudentHomeworkList"
import { TeacherHomeworkHub } from "../components/TeacherHomeworkHub"
import { AdminHomeworkOverview } from "../components/AdminHomeworkOverview"

const PRINCIPAL_LIKE_ROLES = new Set(["principal", "vice_principal", "school_admin"])

export function HomeworkDashboard() {
  const activeRole = useAuth((s) => s.activeRole)

  if (activeRole === "parent") {
    return <LmsParentHome />
  }

  if (activeRole === "student") {
    return <StudentHomeworkList />
  }

  if (activeRole === "teacher" || activeRole === "class_teacher") {
    return <TeacherHomeworkHub />
  }

  if (activeRole && PRINCIPAL_LIKE_ROLES.has(activeRole)) {
    return <AdminHomeworkOverview />
  }

  return (
    <div className="p-6 text-center text-sm text-muted-foreground border rounded-2xl bg-card shadow-sm max-w-md mx-auto my-12">
      You do not have a role configured to view structured homework assignments. Please contact school administration.
    </div>
  )
}
