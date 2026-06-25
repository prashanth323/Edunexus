import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { Search, Bell, CalendarClock, User } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { CourseOrNoticeCardSkeleton } from "@/components/ui/card-skeleton"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getNotices, hasFullNoticeAccess, type Notice } from "../api/notices.api"
import { CreateNoticeDialog } from "../components/CreateNoticeDialog"

export function NoticesBoard() {
  const activeSchoolId = useAuth((state) => state.activeSchoolId)
  const activeRole = useAuth((state) => state.activeRole)
  const [searchQuery, setSearchQuery] = useState("")

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ["notices", activeSchoolId, activeRole],
    queryFn: () => getNotices(activeSchoolId!, activeRole),
    enabled: !!activeSchoolId && !!activeRole,
  })

  const filteredNotices = useMemo(
    () =>
      notices.filter(
        (n) =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.body.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [notices, searchQuery],
  )

  const getAudienceBadgeVariant = (a: Notice["audience"]) => {
    if (a === "all") return "bg-primary/10 text-primary border-primary/20"
    if (a === "students" || a === "parents") return "bg-blue-500/10 text-blue-600 border-blue-200 dark:text-blue-400"
    return "bg-muted text-muted-foreground"
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notices & communication</h1>
            <p className="text-muted-foreground mt-1">Announcements for the school selected in the header.</p>
          </div>
        </div>
        <div className="h-10 max-w-md rounded-md bg-muted animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <CourseOrNoticeCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  const canManageNotices =
    activeRole &&
    ["super_admin", "principal", "school_admin", "vice_principal"].includes(activeRole)

  const showAdminTabs = hasFullNoticeAccess(activeRole)

  function formatWhen(n: Notice) {
    const d = n.published_at ?? n.created_at
    try {
      return format(new Date(d), "MMM d, yyyy")
    } catch {
      return "—"
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notices & communication</h1>
          <p className="text-muted-foreground mt-1">Announcements for the school selected in the header.</p>
        </div>
        {canManageNotices && activeSchoolId ? <CreateNoticeDialog schoolId={activeSchoolId} /> : null}
      </div>

      <div className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search notices..."
            className="pl-8 bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {!activeSchoolId ? (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed p-6 text-center">
          No active school selected. Choose a school from the menu above to load notices.
        </p>
      ) : showAdminTabs ? (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="focused">Audience-specific</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            <NoticeGrid notices={filteredNotices} formatWhen={formatWhen} badgeFn={getAudienceBadgeVariant} />
          </TabsContent>

          <TabsContent value="focused" className="space-y-4 mt-4">
            <NoticeGrid
              notices={filteredNotices.filter((n) => n.audience !== "all")}
              formatWhen={formatWhen}
              badgeFn={getAudienceBadgeVariant}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <NoticeGrid notices={filteredNotices} formatWhen={formatWhen} badgeFn={getAudienceBadgeVariant} />
      )}
    </div>
  )
}

function NoticeGrid({
  notices,
  formatWhen,
  badgeFn,
}: {
  notices: Notice[]
  formatWhen: (n: Notice) => string
  badgeFn: (a: Notice["audience"]) => string
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {notices.map((notice) => (
        <Card key={notice.id} className="flex flex-col hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start mb-2 gap-2 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className={`capitalize text-[10px] ${badgeFn(notice.audience)}`}>
                  {notice.audience}
                </Badge>
                {!notice.is_published && (
                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-500/10">
                    Draft
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                <CalendarClock className="h-3.5 w-3.5" />
                <span>{formatWhen(notice)}</span>
              </div>
            </div>
            <CardTitle className="text-lg leading-tight flex items-start gap-2">
              {notice.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground flex-1">
            <p className="line-clamp-4 whitespace-pre-wrap">{notice.body}</p>
          </CardContent>
          <CardFooter className="pt-4 border-t bg-muted/10 flex justify-between items-center text-xs text-muted-foreground mt-auto gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="bg-primary/10 p-1 rounded-full text-primary shrink-0">
                <User className="h-3 w-3" />
              </div>
              <span className="truncate">
                {notice.author?.first_name} {notice.author?.last_name}
                {!notice.author?.first_name && !notice.author?.last_name ? "Staff" : ""}
              </span>
            </div>
          </CardFooter>
        </Card>
      ))}

      {notices.length === 0 ? (
        <div className="col-span-full py-12 flex flex-col items-center justify-center text-center border-2 border-dashed rounded-lg bg-muted/10">
          <Bell className="h-10 w-10 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-medium">No notices</h3>
          <p className="text-muted-foreground mt-1">Nothing published yet, or refine your search.</p>
        </div>
      ) : null}
    </div>
  )
}
