import { useAuth } from "@/features/auth/hooks/useAuth"
import { ParentMessagesView } from "../components/ParentMessagesView"
import { TeacherMessagesView } from "../components/TeacherMessagesView"
import { AdminMessagesOverview } from "../components/AdminMessagesOverview"

export function MessagesRouter() {
  const activeRole = useAuth((s) => s.activeRole)

  if (activeRole === "parent") {
    return <ParentMessagesView />
  }

  if (activeRole === "teacher" || activeRole === "class_teacher") {
    return <TeacherMessagesView />
  }

  if (
    activeRole &&
    ["principal", "vice_principal", "school_admin", "operations_admin"].includes(activeRole)
  ) {
    return <AdminMessagesOverview />
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
      <p className="text-muted-foreground">
        Direct messaging is available for parents and teachers. Switch to a supported role to use this feature.
      </p>
    </div>
  )
}
