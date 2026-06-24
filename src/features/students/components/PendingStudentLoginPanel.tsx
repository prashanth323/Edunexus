import { KeyRound, Send } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { StudentPendingPortalLogin } from "../api/students.api"

type Props = {
  pending: StudentPendingPortalLogin[]
  onInvite: (row: StudentPendingPortalLogin) => void
  compact?: boolean
}

export function PendingStudentLoginPanel({ pending, onInvite, compact }: Props) {
  if (pending.length === 0) return null

  if (compact) {
    return (
      <Card className="h-full hover:bg-accent/40 transition-colors">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Students — portal login
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pending.length}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Admitted, waiting for login invite via Students
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          Students waiting for portal login
        </CardTitle>
        <CardDescription>
          These students were added from admissions but have no login yet. Use{" "}
          <strong>Add student</strong> to send Supabase invite emails — same as inviting any new student.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {row.first_name} {row.last_name}
              </p>
              <p className="text-sm text-muted-foreground">
                {row.admission_no}
                {row.classLabel ? ` · ${row.classLabel}` : ""}
                {row.applicationNo ? ` · ${row.applicationNo}` : ""}
              </p>
              {row.parentNeedsLogin && (
                <Badge variant="outline" className="mt-1 text-xs">
                  Parent login also pending
                </Badge>
              )}
            </div>
            <Button size="sm" type="button" onClick={() => onInvite(row)}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send invite
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
