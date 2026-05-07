import { useEffect, useMemo } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { getRolesAllowedForPath } from "@/config/navigation"
import { useAuth } from "@/features/auth/hooks/useAuth"

export function RequireRole({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const activeRole = useAuth((s) => s.activeRole)
  const isLoading = useAuth((s) => s.isLoading)

  const allowed = useMemo(
    () => getRolesAllowedForPath(location.pathname),
    [location.pathname],
  )

  useEffect(() => {
    if (isLoading) return
    if (!activeRole) {
      toast.error("Your account has no assigned role. Please contact an administrator.")
      navigate("/", { replace: true })
      return
    }
    if (allowed && !allowed.includes(activeRole)) {
      toast.error("You do not have access to that page.")
      navigate("/", { replace: true })
    }
  }, [activeRole, allowed, isLoading, navigate, location.pathname])

  if (isLoading || !activeRole || (allowed && !allowed.includes(activeRole))) {
    return null
  }

  return <>{children}</>
}
