import { useAuth } from "@/features/auth/hooks/useAuth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlatformOverview } from "./platform/PlatformOverview"
import { SchoolsManager } from "./platform/SchoolsManager"
import { PlatformUsersManager } from "./platform/PlatformUsersManager"
import { GlobalAuditLogs } from "./platform/GlobalAuditLogs"

export function PlatformDashboard() {
  const { activeRole } = useAuth()
  
  const isSuperAdmin = activeRole === "super_admin"

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Administration</h1>
        <p className="text-muted-foreground mt-1">
          Cross-school visibility and administration. Active context:{" "}
          <span className="font-medium text-foreground capitalize">
            {activeRole?.replace(/_/g, " ")}
          </span>
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {isSuperAdmin && (
            <>
              <TabsTrigger value="schools">Schools</TabsTrigger>
              <TabsTrigger value="users">Platform Users</TabsTrigger>
              <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <PlatformOverview />
        </TabsContent>

        {isSuperAdmin && (
          <>
            <TabsContent value="schools" className="mt-0">
              <SchoolsManager />
            </TabsContent>
            <TabsContent value="users" className="mt-0">
              <PlatformUsersManager />
            </TabsContent>
            <TabsContent value="audit" className="mt-0">
              <GlobalAuditLogs />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
