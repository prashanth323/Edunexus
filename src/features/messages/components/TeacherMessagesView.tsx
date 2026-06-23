import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { supabase } from "@/lib/supabase"
import {
  createParentTeacherThread,
  getParentContactsForTeacher,
  listMessageThreads,
} from "../api/messages.api"
import { ComposeMessageDialog } from "./ComposeMessageDialog"
import { MessageThreadList, MessageThreadPanel } from "./MessageThreadPanel"

export function TeacherMessagesView() {
  const user = useAuth((s) => s.user)
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)

  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ["message-threads", activeSchoolId],
    queryFn: () => listMessageThreads(activeSchoolId!),
    enabled: !!activeSchoolId,
    refetchInterval: 30000,
  })

  const { data: parentContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["parent-contacts-teacher", activeSchoolId, user?.id],
    queryFn: () => getParentContactsForTeacher(activeSchoolId!, user!.id),
    enabled: !!activeSchoolId && !!user?.id,
  })

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  )

  const createMutation = useMutation({
    mutationFn: createParentTeacherThread,
    onSuccess: (threadId) => {
      toast.success("Message sent")
      qc.invalidateQueries({ queryKey: ["message-threads"] })
      setComposeOpen(false)
      setSelectedThreadId(threadId)
    },
    onError: (e: Error) => toast.error(e.message || "Could not send message"),
  })

  const { data: myStaffId } = useQuery({
    queryKey: ["my-staff-id", activeSchoolId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id")
        .eq("school_id", activeSchoolId!)
        .eq("profile_id", user!.id)
        .maybeSingle()
      if (error) throw error
      return data?.id ?? null
    },
    enabled: !!activeSchoolId && !!user?.id,
  })

  function onComposeSubmit(contactId: string, message: string, title?: string) {
    const contact = parentContacts.find((c) => `${c.student_id}:${c.parent_profile_id}` === contactId)
    if (!contact || !activeSchoolId || !myStaffId) return

    createMutation.mutate({
      schoolId: activeSchoolId,
      studentId: contact.student_id,
      teacherStaffId: myStaffId,
      initialMessage: message,
      title: title || null,
      parentProfileId: contact.parent_profile_id,
    })
  }

  const composeContacts = parentContacts.map((c) => ({
    id: `${c.student_id}:${c.parent_profile_id}`,
    name: c.parent_name,
    subtitle: `${c.student_name}${c.class_name ? ` · ${c.class_name}-${c.section_name}` : ""} · ${c.relation}`,
  }))

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground mt-1">
            Communicate with parents of students in your classes.
          </p>
        </div>
        <Button onClick={() => setComposeOpen(true)} disabled={parentContacts.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Message parent
        </Button>
      </div>

      {threadsLoading ? (
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
                threads={threads}
                selectedId={selectedThreadId}
                onSelect={setSelectedThreadId}
                viewerIsParent={false}
                emptyHint="No parent messages yet. Reach out to a student's parent."
              />
            </CardContent>
          </Card>

          <div className={selectedThread ? "block" : "hidden lg:block"}>
            {selectedThread ? (
              <MessageThreadPanel
                thread={selectedThread}
                viewerProfileId={user!.id}
                viewerIsParent={false}
                onBack={() => setSelectedThreadId(null)}
              />
            ) : (
              <Card className="h-full flex items-center justify-center text-muted-foreground p-8 text-center">
                <p>Select a conversation or message a parent.</p>
              </Card>
            )}
          </div>
        </div>
      )}

      <ComposeMessageDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        title="Message a parent"
        description="Choose a parent linked to a student you teach."
        contacts={composeContacts}
        contactsLoading={contactsLoading}
        submitting={createMutation.isPending}
        onSubmit={onComposeSubmit}
      />
    </div>
  )
}
