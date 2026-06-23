import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  listPrincipalMessages,
  listPrincipalThreads,
  teacherRemarkToPrincipal,
} from "../api/principalMessages.api"

/** Teacher remarks only — forwarded via principal to parents. */
export function TeacherPrincipalMessagesView() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [remark, setRemark] = useState("")

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["principal-threads-teacher", activeSchoolId],
    queryFn: async () => {
      const all = await listPrincipalThreads(activeSchoolId!)
      return all.filter((t) => t.status === "forwarded" && t.teacher_staff_id)
    },
    enabled: !!activeSchoolId,
  })

  const { data: messages = [] } = useQuery({
    queryKey: ["principal-messages", selectedThreadId],
    queryFn: () => listPrincipalMessages(selectedThreadId!),
    enabled: !!selectedThreadId,
  })

  const remarkMutation = useMutation({
    mutationFn: () => teacherRemarkToPrincipal(selectedThreadId!, remark),
    onSuccess: () => {
      toast.success("Remark sent to principal")
      setRemark("")
      qc.invalidateQueries({ queryKey: ["principal-messages"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground mt-1">
          View items forwarded by the principal and send remarks back — parents are not contacted directly.
        </p>
      </div>

      {isLoading ? (
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr] min-h-[400px]">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Forwarded ({threads.length})</CardTitle></CardHeader>
            <CardContent className="p-0 divide-y">
              {threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`w-full text-left p-3 hover:bg-accent ${selectedThreadId === t.id ? "bg-accent" : ""}`}
                  onClick={() => setSelectedThreadId(t.id)}
                >
                  <p className="text-sm font-medium">{t.students?.profiles?.full_name ?? "Student"}</p>
                </button>
              ))}
              {threads.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">Nothing forwarded yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 space-y-3">
              {selectedThreadId ? (
                <>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {messages.map((m) => (
                      <div key={m.id} className="rounded-lg bg-muted px-3 py-2 text-sm">
                        <span className="text-[10px] uppercase text-muted-foreground">{m.sender_role}</span>
                        <p>{m.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 border-t pt-3">
                    <Textarea
                      placeholder="Remark for principal…"
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      rows={2}
                      className="flex-1"
                    />
                    <Button disabled={!remark.trim()} onClick={() => remarkMutation.mutate()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-12">Select a forwarded message</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
