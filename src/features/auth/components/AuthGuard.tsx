import { useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "../hooks/useAuth"

/** Bootstrapping runs via `onAuthStateChange` + explicit login — do not call `initialize()` here or post-login `getSession()` can hang with `isLoading` stuck true. */

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!isLoading && !session) {
      // Redirect to login if not authenticated
      navigate("/login", { state: { from: location.pathname }, replace: true })
    }
  }, [isLoading, session, navigate, location])

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-2">
            <Skeleton className="h-7 w-40 mx-auto" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-full max-w-[200px] mx-auto" />
          </CardContent>
        </Card>
        <p className="mt-6 text-sm text-muted-foreground">Loading EduNexus…</p>
      </div>
    )
  }

  if (!session) {
    return null // Will redirect in useEffect
  }

  return <>{children}</>
}
