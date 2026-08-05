import { useAuth } from "@/features/auth/hooks/useAuth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Globe } from "lucide-react"
import { PlatformOverview } from "./platform/PlatformOverview"
import { SchoolsManager } from "./platform/SchoolsManager"
import { PlatformUsersManager } from "./platform/PlatformUsersManager"
import { GlobalAuditLogs } from "./platform/GlobalAuditLogs"

export function PlatformDashboard() {
  const { activeRole } = useAuth()
  
  const isSuperAdmin = activeRole === "super_admin"

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-card">
        <img src="/dashboard_premium_banner.png" alt="Premium Banner" className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent dark:from-background/95 dark:via-background/80 z-0 pointer-events-none" />
        
        <div className="relative space-y-2 z-10">
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3 text-blue-700 dark:text-blue-400">
            <Globe className="h-9 w-9" />
            Platform Administration
          </h1>
          <p className="text-blue-900/70 dark:text-blue-200/70 text-sm sm:text-base max-w-2xl">
            Cross-school visibility and administration. Active context:{" "}
            <span className="font-semibold text-blue-900 dark:text-blue-100 capitalize">
              {activeRole?.replace(/_/g, " ")}
            </span>
          </p>
        </div>
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
