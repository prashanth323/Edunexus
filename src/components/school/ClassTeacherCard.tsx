import { UserRound } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  classTeacherName?: string | null
  classTeacherPhone?: string | null
  classTeacherEmail?: string | null
  compact?: boolean
}

export function ClassTeacherCard({
  classTeacherName,
  classTeacherPhone,
  classTeacherEmail,
  compact,
}: Props) {
  const hasTeacher = Boolean(classTeacherName?.trim())

  if (compact) {
    return (
      <div className="text-sm">
        <p className="font-medium flex items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
          Class teacher
        </p>
        {hasTeacher ? (
          <p className="text-muted-foreground mt-0.5">
            {classTeacherName}
            {classTeacherPhone ? ` · ${classTeacherPhone}` : ""}
          </p>
        ) : (
          <p className="text-muted-foreground mt-0.5 italic">
            Class teacher details will be updated shortly.
          </p>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <UserRound className="h-4 w-4" />
          Class teacher
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        {hasTeacher ? (
          <>
            <p className="font-medium">{classTeacherName}</p>
            {classTeacherPhone && (
              <p>
                <span className="text-muted-foreground">Phone:</span> {classTeacherPhone}
              </p>
            )}
            {classTeacherEmail && (
              <p>
                <span className="text-muted-foreground">Email:</span> {classTeacherEmail}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground italic">
            Class teacher details will be updated shortly.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
