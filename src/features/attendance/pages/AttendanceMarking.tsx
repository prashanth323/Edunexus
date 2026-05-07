import { useAuth } from "@/features/auth/hooks/useAuth"

import { AttendanceMarkingTeacherView } from "./AttendanceMarkingTeacherView"
import { AttendancePrincipalOverview } from "./AttendancePrincipalOverview"
import { AttendanceParentView } from "./AttendanceParentView"
import { AttendanceStudentView } from "./AttendanceStudentView"

/** Leadership: school overview. Teachers: marking UI. Parents: children's read-only history. Students: own read-only history. */
const PRINCIPAL_OVERVIEW_ROLES = new Set([
  "principal",
  "school_admin",
  "vice_principal",
])

export function AttendanceMarking() {
  const activeRole = useAuth((s) => s.activeRole)

  if (activeRole === "parent") {
    return <AttendanceParentView />
  }

  if (activeRole === "student") {
    return <AttendanceStudentView />
  }

  if (activeRole && PRINCIPAL_OVERVIEW_ROLES.has(activeRole)) {
    return <AttendancePrincipalOverview />
  }

  return <AttendanceMarkingTeacherView />
}
