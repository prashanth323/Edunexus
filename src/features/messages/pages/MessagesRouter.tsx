import { useAuth } from "@/features/auth/hooks/useAuth"
import { ParentPrincipalMessagesView } from "../components/ParentPrincipalMessagesView"
import { TeacherPrincipalMessagesView } from "../components/TeacherPrincipalMessagesView"
import { PrincipalMessagesView } from "../components/PrincipalMessagesView"

export function MessagesRouter() {
  const activeRole = useAuth((s) => s.activeRole)

  if (activeRole === "parent") {
    return <ParentPrincipalMessagesView />
  }

  if (activeRole === "teacher" || activeRole === "class_teacher") {
    return <TeacherPrincipalMessagesView />
  }

  if (activeRole === "principal") {
    return <PrincipalMessagesView />
  }

  if (activeRole === "school_admin") {
    return <PrincipalMessagesView />
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
      <p className="text-muted-foreground">
        Messaging is available for parents, teachers, and the principal.
      </p>
    </div>
  )
}
