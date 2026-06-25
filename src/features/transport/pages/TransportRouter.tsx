import { useAuth } from "@/features/auth/hooks/useAuth"
import { TransportManagerWorkspace } from "./TransportManagerWorkspace"
import { TransportVpWorkspace } from "./TransportVpWorkspace"
import { TransportReadOnlyOverview } from "./TransportReadOnlyOverview"

export function TransportRouter() {
  const activeRole = useAuth((s) => s.activeRole)

  if (activeRole === "transport_manager") {
    return <TransportManagerWorkspace />
  }

  if (activeRole === "vice_principal") {
    return <TransportVpWorkspace />
  }

  return <TransportReadOnlyOverview />
}
