import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { KeyRound, Loader2, Search, Send } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getStudentForPortalLoginByAdmissionNo,
  type StudentPortalLoginLookup,
} from "@/features/students/api/students.api"
import {
  canViewPortalCredentials,
  getStudentPortalCredentialsByAdmission,
} from "@/features/students/api/portalCredentials.api"
import { CredentialsBody } from "@/features/students/components/StudentPortalCredentialsPanel"

type Props = {
  schoolId: string
  /** Pre-fill admission number (e.g. from approved list) */
  initialAdmissionNo?: string
  /** When set, Send invite uses this instead of navigating to Students */
  onInvite?: (row: StudentPortalLoginLookup) => void
  compact?: boolean
}

export function AdmissionNumberLoginPanel({
  schoolId,
  initialAdmissionNo = "",
  onInvite,
  compact,
}: Props) {
  const activeRole = useAuth((s) => s.activeRole)
  const showCredentials = canViewPortalCredentials(activeRole)
  const [query, setQuery] = useState(initialAdmissionNo)
  const [searchNo, setSearchNo] = useState(initialAdmissionNo)

  useEffect(() => {
    if (initialAdmissionNo.trim().length >= 3) {
      setQuery(initialAdmissionNo)
      setSearchNo(initialAdmissionNo.trim())
    }
  }, [initialAdmissionNo])

  const { data: student, isFetching, isError, error } = useQuery({
    queryKey: ["student-login-lookup", schoolId, searchNo],
    queryFn: () => getStudentForPortalLoginByAdmissionNo(schoolId, searchNo),
    enabled: !!schoolId && searchNo.trim().length >= 3,
    retry: false,
  })

  const { data: credentials, isFetching: credsLoading } = useQuery({
    queryKey: ["student-portal-credentials-adm", schoolId, searchNo],
    queryFn: () => getStudentPortalCredentialsByAdmission(schoolId, searchNo),
    enabled: showCredentials && !!schoolId && searchNo.trim().length >= 3 && !!student,
    retry: false,
  })

  function runSearch() {
    const trimmed = query.trim()
    if (trimmed.length < 3) return
    setSearchNo(trimmed)
  }

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Lookup by admission no.
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Admission number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <Button type="button" size="icon" variant="outline" onClick={runSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          Send portal login by admission number
        </CardTitle>
        <CardDescription>
          Type or paste the admission number to load student and parent details
          {showCredentials ? " and portal login credentials" : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 max-w-md">
          <Input
            placeholder="e.g. 2600001"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <Button type="button" onClick={runSearch} disabled={query.trim().length < 3}>
            <Search className="h-4 w-4 mr-1.5" />
            Find
          </Button>
        </div>

        {isFetching && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Looking up…
          </p>
        )}

        {isError && searchNo && (
          <p className="text-sm text-destructive">
            {(error as Error)?.message ?? "Student not found"}
          </p>
        )}

        {student && (
          <div className="rounded-md border bg-background p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {student.first_name} {student.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {student.admission_no}
                  {student.classLabel ? ` · ${student.classLabel}` : ""}
                </p>
              </div>
              {student.hasPortalLogin ? (
                <Badge variant="secondary">Portal login active</Badge>
              ) : (
                <Badge variant="outline">Login pending</Badge>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              {!showCredentials && (
                <>
                  <p>
                    <span className="text-muted-foreground">Student email:</span>{" "}
                    {student.email ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Parent email:</span>{" "}
                    {student.parentEmail ?? "—"}
                  </p>
                </>
              )}
              <p>
                <span className="text-muted-foreground">Parent phone:</span>{" "}
                {student.parentPhone ?? "—"}
              </p>
            </div>

            {showCredentials && (
              <div className="pt-2 border-t">
                {credsLoading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading credentials…
                  </p>
                ) : credentials ? (
                  <CredentialsBody data={credentials} />
                ) : null}
              </div>
            )}
            {!student.hasPortalLogin && (
              <div className="flex flex-wrap gap-2">
                {onInvite ? (
                  <Button type="button" size="sm" onClick={() => onInvite(student)}>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Send invite
                  </Button>
                ) : (
                  <Button size="sm" asChild>
                    <Link to={`/students?admissionNo=${encodeURIComponent(student.admission_no)}`}>
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Send invite on Students page
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
