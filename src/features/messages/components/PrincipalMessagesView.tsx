import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getTeachersForStudent } from "../api/messages.api"
import {
  listPrincipalMessages,
  listPrincipalThreads,
  principalForwardToTeacher,
  principalReplyToParent,
  type PrincipalThread,
} from "../api/principalMessages.api"

/** Principal compose hub: relay Parent → Teacher and reply to parents. */
export function PrincipalMessagesView() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState("")
  const [forwardBody, setForwardBody] = useState("")
  const [teacherStaffId, setTeacherStaffId] = useState("")

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["principal-threads", activeSchoolId],
    queryFn: () => listPrincipalThreads(activeSchoolId!),
    enabled: !!activeSchoolId,
    refetchInterval: 30000,
  })

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null

  const { data: messages = [] } = useQuery({
    queryKey: ["principal-messages", selectedThreadId],
    queryFn: () => listPrincipalMessages(selectedThreadId!),
    enabled: !!selectedThreadId,
  })

  const { data: teachers = [] } = useQuery({
    queryKey: ["forward-teachers", activeSchoolId, selectedThread?.student_id],
    queryFn: () => getTeachersForStudent(activeSchoolId!, selectedThread!.student_id),
    enabled: !!activeSchoolId && !!selectedThread?.student_id,
  })

  const replyMutation = useMutation({
    mutationFn: () => principalReplyToParent(selectedThreadId!, replyBody),
    onSuccess: () => {
      toast.success("Reply sent to parent")
      setReplyBody("")
      qc.invalidateQueries({ queryKey: ["principal-messages"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const forwardMutation = useMutation({
    mutationFn: () => principalForwardToTeacher(selectedThreadId!, teacherStaffId, forwardBody),
    onSuccess: () => {
      toast.success("Forwarded to teacher")
      setForwardBody("")
      qc.invalidateQueries({ queryKey: ["principal-threads"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground mt-1">
          Only the principal sends messages to parents and teachers. Relay parent enquiries to staff.
        </p>
      </div>

      {isLoading ? (
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr] min-h-[480px]">
          <Card>
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-base">Inbox ({threads.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y max-h-[520px] overflow-y-auto">
              {threads.map((t) => (
                <ThreadRow key={t.id} thread={t} selected={t.id === selectedThreadId} onSelect={() => setSelectedThreadId(t.id)} />
              ))}
              {threads.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No parent messages yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            {selectedThread ? (
              <>
                <CardHeader className="py-3 border-b">
                  <CardTitle className="text-base">
                    {selectedThread.students?.profiles?.full_name ?? "Student"} — {selectedThread.subject ?? "Message"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4 py-4">
                  <div className="flex-1 overflow-y-auto space-y-2 min-h-[180px]">
                    {messages.map((m) => (
                      <div key={m.id} className={`rounded-lg px-3 py-2 text-sm max-w-[90%] ${
                        m.sender_role === "principal" ? "bg-primary/10 ml-4" :
                        m.sender_role === "teacher" ? "bg-amber-500/10" : "bg-muted"
                      }`}>
                        <p className="text-[10px] uppercase text-muted-foreground">{m.sender_role}</p>
                        {m.body}
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-3 space-y-3">
                    <p className="text-sm font-medium">Reply to parent</p>
                    <div className="flex gap-2">
                      <Textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} rows={2} className="flex-1" />
                      <Button disabled={!replyBody.trim()} onClick={() => replyMutation.mutate()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>

                    <p className="text-sm font-medium">Forward to teacher</p>
                    <select
                      className="flex h-10 w-full rounded-md border border-input px-3 text-sm"
                      value={teacherStaffId}
                      onChange={(e) => setTeacherStaffId(e.target.value)}
                    >
                      <option value="">Select teacher</option>
                      {teachers.map((t) => (
                        <option key={t.staff_id} value={t.staff_id}>{t.teacher_name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <Textarea value={forwardBody} onChange={(e) => setForwardBody(e.target.value)} rows={2} className="flex-1" placeholder="Note for teacher…" />
                      <Button
                        disabled={!forwardBody.trim() || !teacherStaffId}
                        onClick={() => forwardMutation.mutate()}
                      >
                        Forward
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center flex-1 text-muted-foreground">
                Select a conversation
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

function ThreadRow({
  thread,
  selected,
  onSelect,
}: {
  thread: PrincipalThread
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-3 hover:bg-accent transition-colors ${selected ? "bg-accent" : ""}`}
    >
      <p className="font-medium text-sm truncate">{thread.students?.profiles?.full_name ?? "Student"}</p>
      <p className="text-xs text-muted-foreground truncate">{thread.subject ?? "No subject"}</p>
      <p className="text-[10px] text-muted-foreground mt-1 capitalize">{thread.status}</p>
    </button>
  )
}
