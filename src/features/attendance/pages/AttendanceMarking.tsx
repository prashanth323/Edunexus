import { useState } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth"

import { AttendanceMarkingTeacherView } from "./AttendanceMarkingTeacherView"
import { AttendancePrincipalOverview } from "./AttendancePrincipalOverview"
import { AttendanceParentView } from "./AttendanceParentView"
import { AttendanceStudentView } from "./AttendanceStudentView"
import { StaffAttendanceMarking } from "./StaffAttendanceMarking"

/** Roles that see the principal overview + staff attendance tab. */
const LEADERSHIP_ROLES = new Set([
  "principal",
  "school_admin",
  "vice_principal",
])

/** Roles that can mark student daily attendance. */
const CAN_MARK_STUDENT_ATTENDANCE = new Set([
  "class_teacher",
  "school_admin",
  "principal",
  "vice_principal",
])

/** Roles that can mark staff attendance. */
const CAN_MARK_STAFF_ATTENDANCE = new Set([
  "principal",
  "vice_principal",
])

type AttendanceTab = "students" | "staff"

export function AttendanceMarking() {
  const activeRole = useAuth((s) => s.activeRole)
  const [activeTab, setActiveTab] = useState<AttendanceTab>("students")

  if (activeRole === "parent") {
    return <AttendanceParentView />
  }

  if (activeRole === "student") {
    return <AttendanceStudentView />
  }

  const isLeadership = activeRole && LEADERSHIP_ROLES.has(activeRole)
  const canMarkStudents = activeRole && CAN_MARK_STUDENT_ATTENDANCE.has(activeRole)
  const canMarkStaff = activeRole && CAN_MARK_STAFF_ATTENDANCE.has(activeRole)

  // Teacher (not class_teacher) gets read-only overview
  if (activeRole === "teacher") {
    return <AttendancePrincipalOverview />
  }

  // Leadership roles with staff attendance tab
  if (isLeadership && canMarkStaff) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button
            type="button"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "students"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("students")}
          >
            Student Attendance
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "staff"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("staff")}
          >
            Staff / Employee Attendance
          </button>
        </div>

        {activeTab === "students" ? (
          <AttendancePrincipalOverview />
        ) : (
          <StaffAttendanceMarking />
        )}
      </div>
    )
  }

  // Class teacher can mark student attendance
  if (canMarkStudents) {
    return <AttendanceMarkingTeacherView />
  }

  // Fallback: principal overview (read-only)
  return <AttendancePrincipalOverview />
}

