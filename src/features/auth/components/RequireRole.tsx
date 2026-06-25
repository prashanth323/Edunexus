import { useEffect, useMemo } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { getRolesAllowedForPath, pathAllowedForRoles } from "@/config/navigation"
import { useAuth } from "@/features/auth/hooks/useAuth"

export function RequireRole({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const activeRole = useAuth((s) => s.activeRole)
  const schoolRoles = useAuth((s) => s.schoolRoles)
  const platformRole = useAuth((s) => s.platformRole)
  const isLoading = useAuth((s) => s.isLoading)

  const allowed = useMemo(
    () => getRolesAllowedForPath(location.pathname),
    [location.pathname],
  )

  const hasAccess = pathAllowedForRoles(allowed, schoolRoles, platformRole)

  useEffect(() => {
    if (isLoading) return
    if (!activeRole && !platformRole) {
      toast.error("Your account has no assigned role. Please contact an administrator.")
      navigate("/", { replace: true })
      return
    }
    if (allowed && !hasAccess) {
      toast.error("You do not have access to that page.")
      navigate("/", { replace: true })
    }
  }, [activeRole, platformRole, allowed, hasAccess, isLoading, navigate, location.pathname])

  if (isLoading || (!activeRole && !platformRole) || (allowed && !hasAccess)) {
    return null
  }

  return <>{children}</>
}
