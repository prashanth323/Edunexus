import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns"
import { Loader2, MessageSquare, Send } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  listThreadMessages,
  markThreadRead,
  sendThreadMessage,
  type MessageRow,
  type MessageThreadRow,
} from "../api/messages.api"

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

function formatMessageTime(iso: string) {
  const d = new Date(iso)
  if (isToday(d)) return format(d, "h:mm a")
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`
  return format(d, "MMM d, h:mm a")
}

type Props = {
  thread: MessageThreadRow
  viewerProfileId: string
  viewerIsParent: boolean
  onBack?: () => void
}

export function MessageThreadPanel({ thread, viewerProfileId, viewerIsParent, onBack }: Props) {
  const qc = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState("")

  const counterpartyName = viewerIsParent ? thread.teacher_name : thread.parent_name

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["thread-messages", thread.id],
    queryFn: () => listThreadMessages(thread.id),
    enabled: !!thread.id,
    refetchInterval: 15000,
  })

  useEffect(() => {
    void markThreadRead(thread.id).then(() => {
      qc.invalidateQueries({ queryKey: ["message-threads"] })
    })
  }, [thread.id, qc])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendThreadMessage(thread.id, body),
    onSuccess: () => {
      setDraft("")
      qc.invalidateQueries({ queryKey: ["thread-messages", thread.id] })
      qc.invalidateQueries({ queryKey: ["message-threads"] })
    },
    onError: (e: Error) => toast.error(e.message || "Failed to send message"),
  })

  function handleSend() {
    const body = draft.trim()
    if (!body || sendMutation.isPending) return
    sendMutation.mutate(body)
  }

  return (
    <Card className="flex flex-col h-[min(72vh,720px)] overflow-hidden">
      <CardHeader className="border-b py-4 shrink-0">
        <div className="flex items-start gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" className="md:hidden -ml-2" onClick={onBack}>
              Back
            </Button>
          )}
          <Avatar className="h-10 w-10">
            <AvatarFallback>{initials(counterpartyName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg truncate">{counterpartyName}</CardTitle>
            <p className="text-sm text-muted-foreground truncate">
              Re: {thread.student_name}
              {thread.subject_name ? ` · ${thread.subject_name}` : ""}
            </p>
            {thread.title && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{thread.title}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-2 opacity-40" />
            <p>No messages yet. Start the conversation below.</p>
          </div>
        ) : (
          messages.map((msg: MessageRow) => {
            const mine = msg.sender_profile_id === viewerProfileId
            return (
              <div key={msg.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  <p
                    className={cn(
                      "text-[10px] mt-1 opacity-70",
                      mine ? "text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {formatMessageTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </CardContent>

      <div className="border-t p-4 shrink-0 bg-background">
        <div className="flex gap-2 items-end">
          <Textarea
            placeholder={`Message ${counterpartyName}…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="min-h-[44px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            size="icon"
            className="shrink-0 h-10 w-10"
            disabled={!draft.trim() || sendMutation.isPending}
            onClick={handleSend}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for a new line.
        </p>
      </div>
    </Card>
  )
}

type ThreadListProps = {
  threads: MessageThreadRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  viewerIsParent: boolean
  emptyHint?: string
}

export function MessageThreadList({
  threads,
  selectedId,
  onSelect,
  viewerIsParent,
  emptyHint = "No conversations yet.",
}: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground px-4">
        <MessageSquare className="h-10 w-10 mb-2 opacity-40" />
        <p>{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {threads.map((thread) => {
        const counterparty = viewerIsParent ? thread.teacher_name : thread.parent_name
        const unread =
          new Date(thread.last_message_at) >
          new Date(viewerIsParent ? thread.parent_last_read_at : thread.teacher_last_read_at)

        return (
          <button
            key={thread.id}
            type="button"
            onClick={() => onSelect(thread.id)}
            className={cn(
              "w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors flex gap-3 items-start",
              selectedId === thread.id && "bg-muted",
            )}
          >
            <Avatar className="h-9 w-9 shrink-0 mt-0.5">
              <AvatarFallback className="text-xs">{initials(counterparty)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("font-medium truncate", unread && "text-foreground")}>
                  {counterparty}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{thread.student_name}</p>
              {thread.last_message_preview && (
                <p className={cn("text-sm truncate mt-0.5", unread ? "font-medium" : "text-muted-foreground")}>
                  {thread.last_message_preview}
                </p>
              )}
            </div>
            {unread && <Badge className="shrink-0 mt-1">New</Badge>}
          </button>
        )
      })}
    </div>
  )
}
