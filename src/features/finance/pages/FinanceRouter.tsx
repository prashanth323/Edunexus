import { useAuth } from "@/features/auth/hooks/useAuth"
import { FinanceOverview } from "./FinanceOverview"
import { FinanceParentView } from "./FinanceParentView"

/** Routes parent users to their scoped fee view; all other roles see the full ERP. */
export function FinanceRouter() {
  const activeRole = useAuth((s) => s.activeRole)

  if (activeRole === "parent") {
    return <FinanceParentView />
  }

  return <FinanceOverview />
}
