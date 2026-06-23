import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getParentChildrenForMessaging } from "../api/messages.api"
import {
  listPrincipalMessages,
  listPrincipalThreads,
  parentMessageToPrincipal,
} from "../api/principalMessages.api"

/** Parent → Principal only (no direct teacher messaging). */
export function ParentPrincipalMessagesView() {
  const user = useAuth((s) => s.user)
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [subject, setSubject] = useState("")

  const { data: children = [] } = useQuery({
    queryKey: ["parent-children-msg", user?.id],
    queryFn: () => getParentChildrenForMessaging(user!.id),
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) setSelectedChildId(children[0]!.student_id)
  }, [children, selectedChildId])

  const { data: threads = [] } = useQuery({
    queryKey: ["principal-threads", activeSchoolId],
    queryFn: () => listPrincipalThreads(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const childThreads = threads.filter((t) => t.student_id === selectedChildId)

  const { data: messages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ["principal-messages", selectedThreadId],
    queryFn: () => listPrincipalMessages(selectedThreadId!),
    enabled: !!selectedThreadId,
  })

  const sendMutation = useMutation({
    mutationFn: () =>
      parentMessageToPrincipal({
        schoolId: activeSchoolId!,
        studentId: selectedChildId!,
        body: message,
        subject: subject || undefined,
      }),
    onSuccess: (threadId) => {
      toast.success("Message sent to principal")
      setMessage("")
      qc.invalidateQueries({ queryKey: ["principal-threads"] })
      setSelectedThreadId(threadId)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground mt-1">Contact the principal — messages are relayed to teachers when needed.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr] min-h-[420px]">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Your child</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {children.map((c) => (
              <Button
                key={c.student_id}
                variant={selectedChildId === c.student_id ? "default" : "outline"}
                size="sm"
                className="w-full justify-start"
                onClick={() => { setSelectedChildId(c.student_id); setSelectedThreadId(null) }}
              >
                {(c as { students?: { profiles?: { full_name?: string } } }).students?.profiles?.full_name ?? "Child"}
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Threads</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {childThreads.map((t) => (
                <Button
                  key={t.id}
                  variant={selectedThreadId === t.id ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => setSelectedThreadId(t.id)}
                >
                  {t.subject ?? "Conversation"}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-sm">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3 py-4">
              <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
                {msgsLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                        m.sender_role === "parent" ? "bg-primary text-primary-foreground ml-auto" : "bg-muted"
                      }`}
                    >
                      <p className="text-[10px] opacity-70 mb-0.5 capitalize">{m.sender_role}</p>
                      {m.body}
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-2 border-t pt-3">
                <Input placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Message to principal…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    disabled={!message.trim() || !selectedChildId || sendMutation.isPending}
                    onClick={() => sendMutation.mutate()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
