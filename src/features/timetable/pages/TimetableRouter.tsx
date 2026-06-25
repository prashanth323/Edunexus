import { useAuth } from "@/features/auth/hooks/useAuth"
import { hasAnyTeachingRole } from "@/features/auth/lib/schoolRoles"
import { PrincipalTimetablePage } from "./PrincipalTimetablePage"
import { TeacherTimetablePage } from "./TeacherTimetablePage"
import { StudentTimetablePage } from "./StudentTimetablePage"

export function TimetableRouter() {
  const { activeRole, schoolRoles } = useAuth()

  if (activeRole === "principal" || activeRole === "vice_principal" || activeRole === "school_admin") {
    return <PrincipalTimetablePage />
  }
  if (hasAnyTeachingRole(schoolRoles)) {
    return <TeacherTimetablePage />
  }
  if (activeRole === "student") {
    return <StudentTimetablePage />
  }

  return (
    <div className="flex flex-col items-center justify-center h-[400px] text-center gap-4">
      <h2 className="text-xl font-semibold">Timetable</h2>
      <p className="text-muted-foreground">Timetable is not available for your current role.</p>
    </div>
  )
}
