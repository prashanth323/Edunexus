import { useAuth } from "@/features/auth/hooks/useAuth"
import { HostelManagerWorkspace } from "./HostelManagerWorkspace"
import { HostelVpWorkspace } from "./HostelVpWorkspace"
import { HostelReadOnlyOverview } from "./HostelReadOnlyOverview"

export function HostelRouter() {
  const activeRole = useAuth((s) => s.activeRole)

  if (activeRole === "hostel_manager") {
    return <HostelManagerWorkspace />
  }

  if (activeRole === "vice_principal") {
    return <HostelVpWorkspace />
  }

  return <HostelReadOnlyOverview />
}
