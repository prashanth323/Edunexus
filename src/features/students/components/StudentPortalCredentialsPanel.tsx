import { useQuery } from "@tanstack/react-query"
import { KeyRound, Lock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getStudentPortalCredentials,
  type StudentPortalCredentials,
} from "../api/portalCredentials.api"

function CredentialRow({
  label,
  email,
  active,
  extra,
}: {
  label: string
  email: string | null
  active: boolean
  extra?: string
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2.5 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <Badge variant={active ? "secondary" : "outline"} className="text-[10px]">
          {active ? "Portal active" : "Login pending"}
        </Badge>
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">Login email:</span>{" "}
        <span className="font-mono text-xs sm:text-sm">{email ?? "—"}</span>
      </p>
      {extra ? <p className="text-xs text-muted-foreground">{extra}</p> : null}
    </div>
  )
}

export function StudentPortalCredentialsPanel({
  studentId,
  embedded = false,
}: {
  studentId: string
  embedded?: boolean
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-portal-credentials", studentId],
    queryFn: () => getStudentPortalCredentials(studentId),
    enabled: !!studentId,
  })

  if (isLoading) {
    return embedded ? (
      <Skeleton className="h-24 w-full" />
    ) : (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const body = <CredentialsBody data={data} />

  if (embedded) return body

  return (
    <Card className="border-primary/15">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          Portal login credentials
        </CardTitle>
        <CardDescription>
          Read-only. Users sign in with email and the password they set from the invite link.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}

export function CredentialsBody({ data }: { data: StudentPortalCredentials }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Admission no.</span>
        <span className="font-mono font-semibold">{data.admission_no}</span>
      </div>

      <CredentialRow
        label="Student"
        email={data.student_login_email}
        active={data.student_has_portal_login}
      />

      {data.parents.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Parents / guardians
          </p>
          {data.parents.map((p) => (
            <CredentialRow
              key={p.parent_id}
              label={`${p.first_name} ${p.last_name} (${p.relation})${p.is_primary ? " · Primary" : ""}`}
              email={p.login_email}
              active={p.has_portal_login}
              extra={p.phone ? `Phone: ${p.phone}` : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No parents linked yet.</p>
      )}

      <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
        <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        Passwords are not stored in plain text and cannot be viewed or edited here.
      </p>
    </div>
  )
}
