import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/hooks/useAuth"
import { getParentChildren } from "@/features/dashboard/api/dashboard.api"
import { getStudentIdForProfile } from "@/features/lms/api/lms.api"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { StudentProfile } from "./StudentProfile"

export function MyStudentProfile() {
  const { studentId: routeStudentId } = useParams<{ studentId?: string }>()
  const profileId = useAuth((s) => s.user?.id)
  const activeRole = useAuth((s) => s.activeRole)
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const [selectedChildId, setSelectedChildId] = useState(routeStudentId ?? "")

  const { data: myStudentId, isLoading: loadingSelf } = useQuery({
    queryKey: ["portal-my-student-id", profileId, activeSchoolId],
    queryFn: () => getStudentIdForProfile(profileId!, activeSchoolId!),
    enabled: !!profileId && !!activeSchoolId && activeRole === "student",
  })

  const { data: children = [], isLoading: loadingChildren } = useQuery({
    queryKey: ["parent-children-profile", profileId],
    queryFn: () => getParentChildren(profileId!),
    enabled: !!profileId && activeRole === "parent",
  })

  useEffect(() => {
    if (activeRole !== "parent") return
    if (routeStudentId) {
      setSelectedChildId(routeStudentId)
      return
    }
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0]!.student_id as string)
    }
  }, [activeRole, routeStudentId, children, selectedChildId])

  if (!profileId || !activeRole) {
    return <p className="text-sm text-muted-foreground p-6">Sign in to view your profile.</p>
  }

  if (activeRole !== "student" && activeRole !== "parent") {
    return <p className="text-sm text-muted-foreground p-6">This page is for students and parents.</p>
  }

  const isLoading = activeRole === "student" ? loadingSelf : loadingChildren

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 p-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  const effectiveStudentId =
    activeRole === "student" ? myStudentId : selectedChildId || null

  if (activeRole === "student" && !effectiveStudentId) {
    return (
      <p className="text-sm text-muted-foreground p-6 text-center">
        No student record is linked to your account yet.
      </p>
    )
  }

  if (activeRole === "parent" && children.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-6 text-center">
        No children are linked to your parent account yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {activeRole === "parent" && children.length > 1 && (
        <div className="max-w-xs">
          <Label className="text-xs text-muted-foreground">Child</Label>
          <select
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
          >
            {children.map((c: { student_id: string; student_name?: string }) => (
              <option key={c.student_id} value={c.student_id}>
                {c.student_name ?? c.student_id}
              </option>
            ))}
          </select>
        </div>
      )}
      {effectiveStudentId ? (
        <StudentProfile portalMode studentIdOverride={effectiveStudentId} />
      ) : null}
    </div>
  )
}
