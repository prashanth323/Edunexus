import { LmsPrincipalOverview } from "../components/LmsPrincipalOverview"
import { LmsTeacherHome } from "./LmsTeacherHome"
import { LmsStudentHome } from "./LmsStudentHome"
import { LmsParentHome } from "./LmsParentHome"
import { useAuth } from "@/features/auth/hooks/useAuth"

const LMS_PRINCIPAL_STYLE = new Set(["principal", "vice_principal", "school_admin"])

export function LmsRoleHome() {
  const activeRole = useAuth((s) => s.activeRole)

  if (LMS_PRINCIPAL_STYLE.has(activeRole ?? "")) {
    return <LmsPrincipalOverview />
  }

  if (activeRole === "student") {
    return <LmsStudentHome />
  }

  if (activeRole === "parent") {
    return <LmsParentHome />
  }

  return <LmsTeacherHome />
}
