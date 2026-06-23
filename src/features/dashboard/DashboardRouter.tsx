import { useAuth } from "@/features/auth/hooks/useAuth"
import { PrincipalDashboard } from "./components/PrincipalDashboard"
import { TeacherDashboard } from "./components/TeacherDashboard"
import { ParentDashboard } from "./components/ParentDashboard"
import { PlatformDashboard } from "./components/PlatformDashboard"
import { StudentDashboard } from "./components/StudentDashboard"
import { CounselorHomeDashboard } from "./components/CounselorHomeDashboard"
import { TransportManagerDashboard } from "./components/TransportManagerDashboard"
import { CrmManagerDashboard } from "./components/CrmManagerDashboard"
import { FinanceOverview } from "@/features/finance/pages/FinanceOverview"
import { StatCardSkeletonGrid } from "@/components/ui/card-skeleton"

export function DashboardRouter() {
  const { activeRole, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-3xl mx-auto">
        <div className="h-10 w-48 bg-muted animate-pulse rounded-md" />
        <StatCardSkeletonGrid count={3} columnsClassName="grid gap-4 md:grid-cols-3" />
      </div>
    )
  }

  switch (activeRole) {
    case "super_admin":
    case "operations_admin":
    case "support_admin":
    case "analyst":
      return <PlatformDashboard />
    case "finance_admin":
    case "accountant":
      return <FinanceOverview embedded />
    case "principal":
    case "school_admin":
    case "vice_principal":
      return <PrincipalDashboard />
    case "crm_manager":
      return <CrmManagerDashboard />
    case "admission_manager":
    case "counselor":
      return <CounselorHomeDashboard />
    case "teacher":
    case "class_teacher":
      return <TeacherDashboard />
    case "librarian":
      return <TeacherDashboard />
    case "hr_manager":
      return <PrincipalDashboard />
    case "transport_manager":
      return <TransportManagerDashboard />
    case "parent":
      return <ParentDashboard />
    case "student":
      return <StudentDashboard />
    case "receptionist":
      return <PrincipalDashboard />
    default:
      return (
        <div className="flex flex-col items-center justify-center h-[400px] text-center gap-4">
          <h2 className="text-2xl font-bold">Welcome to EduNexus</h2>
          <p className="text-muted-foreground">
            Please contact your administrator to assign a role.
          </p>
        </div>
      )
  }
}
