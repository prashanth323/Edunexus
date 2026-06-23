import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  createParentTeacherThread,
  getParentChildrenForMessaging,
  getTeachersForStudent,
  listMessageThreads,
  type TeacherContact,
} from "../api/messages.api"
import { ComposeMessageDialog } from "./ComposeMessageDialog"
import { MessageThreadList, MessageThreadPanel } from "./MessageThreadPanel"

export function ParentMessagesView() {
  const user = useAuth((s) => s.user)
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)

  const { data: children = [], isLoading: childrenLoading } = useQuery({
    queryKey: ["parent-children-messages", user?.id],
    queryFn: () => getParentChildrenForMessaging(user!.id),
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0]!.student_id)
    }
  }, [children, selectedChildId])

  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ["message-threads", activeSchoolId],
    queryFn: () => listMessageThreads(activeSchoolId!),
    enabled: !!activeSchoolId,
    refetchInterval: 30000,
  })

  const { data: teachers = [], isLoading: teachersLoading } = useQuery({
    queryKey: ["teachers-for-student", activeSchoolId, selectedChildId],
    queryFn: () => getTeachersForStudent(activeSchoolId!, selectedChildId!),
    enabled: !!activeSchoolId && !!selectedChildId,
  })

  const childThreads = useMemo(
    () => (selectedChildId ? threads.filter((t) => t.student_id === selectedChildId) : threads),
    [threads, selectedChildId],
  )

  const selectedThread = childThreads.find((t) => t.id === selectedThreadId) ?? null

  const createMutation = useMutation({
    mutationFn: createParentTeacherThread,
    onSuccess: (threadId) => {
      toast.success("Conversation started")
      qc.invalidateQueries({ queryKey: ["message-threads"] })
      setComposeOpen(false)
      setSelectedThreadId(threadId)
    },
    onError: (e: Error) => toast.error(e.message || "Could not start conversation"),
  })

  function handleCompose(teacher: TeacherContact, message: string, title?: string) {
    if (!activeSchoolId || !selectedChildId || !user?.id) return
    createMutation.mutate({
      schoolId: activeSchoolId,
      studentId: selectedChildId,
      teacherStaffId: teacher.staff_id,
      initialMessage: message,
      subjectId: teacher.subject_id,
      title: title || null,
      parentProfileId: user.id,
    })
  }

  const loading = childrenLoading || threadsLoading

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground mt-1">
            Direct conversations with your child&apos;s teachers.
          </p>
        </div>
        <Button onClick={() => setComposeOpen(true)} disabled={!selectedChildId || teachers.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          New message
        </Button>
      </div>

      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((child) => (
            <Button
              key={child.student_id}
              variant={selectedChildId === child.student_id ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedChildId(child.student_id)
                setSelectedThreadId(null)
              }}
            >
              {child.student_name}
              {child.class_name && child.section_name
                ? ` · ${child.class_name}-${child.section_name}`
                : ""}
            </Button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr] min-h-[480px]">
          <Card className="overflow-hidden flex flex-col">
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-base">Conversations</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <MessageThreadList
                threads={childThreads}
                selectedId={selectedThreadId}
                onSelect={setSelectedThreadId}
                viewerIsParent
                emptyHint="No conversations yet. Message a teacher to get started."
              />
            </CardContent>
          </Card>

          <div className={selectedThread ? "block" : "hidden lg:block"}>
            {selectedThread ? (
              <MessageThreadPanel
                thread={selectedThread}
                viewerProfileId={user!.id}
                viewerIsParent
                onBack={() => setSelectedThreadId(null)}
              />
            ) : (
              <Card className="h-full flex items-center justify-center text-muted-foreground p-8 text-center">
                <p>Select a conversation or start a new message with a teacher.</p>
              </Card>
            )}
          </div>
        </div>
      )}

      <ComposeMessageDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        title="Message a teacher"
        description={
          selectedChildId
            ? `Choose a teacher for ${children.find((c) => c.student_id === selectedChildId)?.student_name ?? "your child"}.`
            : undefined
        }
        contacts={teachers.map((t) => ({
          id: t.staff_id,
          name: t.teacher_name,
          subtitle: t.role_label + (t.subject_name ? ` · ${t.subject_name}` : ""),
        }))}
        contactsLoading={teachersLoading}
        submitting={createMutation.isPending}
        onSubmit={(contactId, message, subject) => {
          const teacher = teachers.find((t) => t.staff_id === contactId)
          if (teacher) handleCompose(teacher, message, subject)
        }}
      />
    </div>
  )
}
