import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { listMessageThreads } from "../api/messages.api"
import { MessageThreadList, MessageThreadPanel } from "./MessageThreadPanel"

/** Read-only oversight for school admins — view all parent–teacher threads in the school. */
export function AdminMessagesOverview() {
  const user = useAuth((s) => s.user)
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["message-threads", activeSchoolId],
    queryFn: () => listMessageThreads(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Parent–teacher messages</h1>
        <p className="text-muted-foreground mt-1">
          School-wide overview of direct parent and teacher conversations.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr] min-h-[480px]">
          <Card className="overflow-hidden flex flex-col">
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-base">All conversations ({threads.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <MessageThreadList
                threads={threads}
                selectedId={selectedThreadId}
                onSelect={setSelectedThreadId}
                viewerIsParent={false}
                emptyHint="No parent–teacher conversations in this school yet."
              />
            </CardContent>
          </Card>

          <div>
            {selectedThread ? (
              <MessageThreadPanel
                thread={selectedThread}
                viewerProfileId={user!.id}
                viewerIsParent={selectedThread.parent_profile_id === user!.id}
              />
            ) : (
              <Card className="h-full flex items-center justify-center text-muted-foreground p-8 text-center min-h-[480px]">
                <p>Select a conversation to review messages.</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
