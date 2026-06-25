import { useState } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  hasAnySchoolRole,
  hasClassTeacherCapabilities,
  hasSubjectTeacherCapabilities,
} from "@/features/auth/lib/schoolRoles"

import { AttendanceMarkingTeacherView } from "./AttendanceMarkingTeacherView"
import { AttendancePrincipalOverview } from "./AttendancePrincipalOverview"
import { AttendanceParentView } from "./AttendanceParentView"
import { AttendanceStudentView } from "./AttendanceStudentView"
import { StaffAttendanceMarking } from "./StaffAttendanceMarking"
import { ReceptionistAttendancePanel } from "../components/ReceptionistAttendancePanel"

/** Roles that see the principal overview + staff attendance tab. */
const LEADERSHIP_ROLES = new Set([
  "principal",
  "school_admin",
  "vice_principal",
])

/** Roles that can mark staff attendance. */
const CAN_MARK_STAFF_ATTENDANCE = new Set([
  "principal",
  "vice_principal",
])

type AttendanceTab = "students" | "staff" | "mark"

export function AttendanceMarking() {
  const activeRole = useAuth((s) => s.activeRole)
  const schoolRoles = useAuth((s) => s.schoolRoles)
  const isVpWithClassTeacher =
    activeRole === "vice_principal" && hasClassTeacherCapabilities(schoolRoles)
  const [activeTab, setActiveTab] = useState<AttendanceTab>(
    isVpWithClassTeacher ? "mark" : "students",
  )

  if (activeRole === "parent") {
    return <AttendanceParentView />
  }

  if (activeRole === "student") {
    return <AttendanceStudentView />
  }

  if (activeRole === "receptionist") {
    return <ReceptionistAttendancePanel />
  }

  const isLeadership = activeRole && LEADERSHIP_ROLES.has(activeRole)
  const canMarkStudents =
    hasClassTeacherCapabilities(schoolRoles) ||
    hasAnySchoolRole(schoolRoles, ["school_admin", "principal", "vice_principal"])
  const canMarkStaff = activeRole && CAN_MARK_STAFF_ATTENDANCE.has(activeRole)

  if (isVpWithClassTeacher) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button
            type="button"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "mark"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("mark")}
          >
            Mark attendance
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "students"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("students")}
          >
            School overview
          </button>
          {canMarkStaff && (
            <button
              type="button"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "staff"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("staff")}
            >
              Staff attendance
            </button>
          )}
        </div>
        {activeTab === "mark" ? (
          <AttendanceMarkingTeacherView />
        ) : activeTab === "staff" ? (
          <StaffAttendanceMarking />
        ) : (
          <AttendancePrincipalOverview />
        )}
      </div>
    )
  }

  // Subject teacher only (no class teacher role) gets read-only overview
  if (hasSubjectTeacherCapabilities(schoolRoles) && !hasClassTeacherCapabilities(schoolRoles)) {
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

