import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, IdCard as IdCardIcon, Loader2 } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getParentChildren } from "@/features/dashboard/api/dashboard.api"
import { getStudentIdForProfile } from "@/features/lms/api/lms.api"

import { getSchoolDisplayName, getStudentProfile } from "../api/studentProfile.api"
import { IdCardGenerator } from "../components/IdCardGenerator"
import { PhotoUpload } from "../components/PhotoUpload"
import { buildStudentIdCardData } from "../lib/studentIdCardData"
import { invalidateAfterStudentPortraitChange } from "@/lib/invalidateProfilePortraits"

type ParentChildRow = {
  student_id: string
  student_name: string
}

export function StudentIdCardPage() {
  const profileId = useAuth((s) => s.user?.id)
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const qc = useQueryClient()

  const { data: myStudentId, isLoading: loadingMyStudent } = useQuery({
    queryKey: ["student-self-id-card", profileId, activeSchoolId],
    queryFn: () => getStudentIdForProfile(profileId!, activeSchoolId!),
    enabled: !!profileId && !!activeSchoolId && activeRole === "student",
  })

  const { data: parentChildrenRaw = [], isLoading: loadingChildren } = useQuery({
    queryKey: ["parent-children-id-card", profileId],
    queryFn: () => getParentChildren(profileId!),
    enabled: !!profileId && activeRole === "parent",
  })

  const parentChildren = parentChildrenRaw as ParentChildRow[]

  const [selectedChildId, setSelectedChildId] = useState("")

  useEffect(() => {
    if (activeRole !== "parent") return
    if (parentChildren.length > 0 && !selectedChildId) {
      setSelectedChildId(parentChildren[0]!.student_id)
    }
  }, [activeRole, parentChildren, selectedChildId])

  const effectiveStudentId =
    activeRole === "parent" ? selectedChildId || null : activeRole === "student" ? myStudentId ?? null : null

  const { data: student, isLoading: loadingProfile, error: profileError } = useQuery({
    queryKey: ["student-profile", effectiveStudentId],
    queryFn: () => getStudentProfile(effectiveStudentId!),
    enabled: !!effectiveStudentId,
  })

  const { data: schoolName, isLoading: loadingSchool } = useQuery({
    queryKey: ["school-display-name", student?.school_id],
    queryFn: () => getSchoolDisplayName(student!.school_id),
    enabled: !!student?.school_id,
  })

  if (!profileId) {
    return (
      <p className="text-muted-foreground text-sm p-6 text-center">
        Sign in to view your ID card.
      </p>
    )
  }

  if (activeRole === "student" && !activeSchoolId) {
    return (
      <div className="max-w-lg mx-auto my-12 text-center border-2 border-dashed rounded-3xl p-8 bg-card space-y-3">
        <AlertCircle className="h-12 w-12 text-amber-500/80 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Select a school</h2>
        <p className="text-sm text-muted-foreground">
          Choose your school from the header so we can load your student record.
        </p>
      </div>
    )
  }

  if (activeRole === "student" && loadingMyStudent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-semibold">Loading your profile…</p>
      </div>
    )
  }

  if (activeRole === "student" && !myStudentId) {
    return (
      <div className="max-w-lg mx-auto my-12 text-center border-2 border-dashed rounded-3xl p-8 bg-card space-y-3">
        <IdCardIcon className="h-12 w-12 text-muted-foreground/40 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Student record not found</h2>
        <p className="text-sm text-muted-foreground">
          Your account is not linked to a student in this school. Contact the registrar if this is unexpected.
        </p>
      </div>
    )
  }

  if (activeRole === "parent" && loadingChildren) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-semibold">Loading linked students…</p>
      </div>
    )
  }

  if (activeRole === "parent" && parentChildren.length === 0) {
    return (
      <div className="max-w-lg mx-auto my-12 text-center border-2 border-dashed rounded-3xl p-8 bg-card space-y-3">
        <AlertCircle className="h-12 w-12 text-muted-foreground/40 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">No students linked</h2>
        <p className="text-sm text-muted-foreground leading-normal">
          Ask the school to link your parent account to a student profile to view digital ID cards.
        </p>
      </div>
    )
  }

  if ((activeRole === "parent" || activeRole === "student") && loadingProfile && !student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-semibold">Building ID card…</p>
      </div>
    )
  }

  if (profileError || !student) {
    return (
      <div className="max-w-lg mx-auto my-12 text-center border-2 border-dashed rounded-3xl p-8 bg-card space-y-3">
        <AlertCircle className="h-12 w-12 text-destructive/70 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Unable to load student</h2>
        <p className="text-sm text-muted-foreground">
          You might not have access to this record, or data is unavailable. Refresh and try again, or contact the school office.
        </p>
      </div>
    )
  }

  const heading =
    activeRole === "parent" ? "Child's ID Card" : "My ID Card"

  const cardPhotoName =
    [student.first_name, student.last_name].filter(Boolean).join(" ").trim() || "Student"

  const schoolContextMismatch =
    !!activeSchoolId && student.school_id !== activeSchoolId

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2 animate-in fade-in duration-500">
      <div className="border-b pb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2">
          <IdCardIcon className="h-8 w-8 text-primary" />
          Student ID Card
        </h1>
        <p className="text-muted-foreground mt-1">
          Printable identity card — same layout staff use under the student profile.{" "}
          {activeRole === "parent"
            ? "Select a linked child below."
            : "Use print to save as PDF."}
        </p>
      </div>

      {activeRole === "parent" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Student</CardTitle>
            <CardDescription>Choose which linked child&apos;s ID card to show.</CardDescription>
          </CardHeader>
          <CardContent>
            <Label className="text-xs font-semibold text-muted-foreground">Linked student</Label>
            <select
              className="mt-2 flex h-10 w-full max-w-md rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm"
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
            >
              {parentChildren.map((c) => (
                <option key={c.student_id} value={c.student_id}>
                  {c.student_name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      ) : null}

      {schoolContextMismatch ? (
        <div className="flex gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium">School selector mismatch</p>
            <p className="text-muted-foreground dark:text-amber-100/80 mt-0.5">
              Switch your active school in the header to this student&apos;s school — storage checks your current school
              context.
            </p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Student portrait</CardTitle>
          <CardDescription>This photo appears on the printed ID card and in school-facing views.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col lg:flex-row gap-6 lg:items-center">
          {schoolContextMismatch ? (
            <p className="text-sm text-muted-foreground max-w-md">
              Select this student&apos;s school in the header to enable portrait uploads.
            </p>
          ) : (
            <>
              <PhotoUpload
                schoolId={student.school_id}
                studentId={student.id}
                currentPhotoUrl={student.photo_url}
                studentName={cardPhotoName}
                onUploaded={() => {
                  invalidateAfterStudentPortraitChange(qc, {
                    schoolId: student.school_id,
                    studentId: student.id,
                  })
                }}
              />
              <p className="text-sm text-muted-foreground max-w-md">
                {activeRole === "parent"
                  ? "You can refresh your child’s official school portrait when the office allows guardian uploads."
                  : "Upload a clear, front-facing picture. Accepted: JPG, PNG, WebP (max 5 MB)."}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>
            {loadingSchool ? "Loading school name…" : `Official identification for ${schoolName ?? "School"}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IdCardGenerator data={buildStudentIdCardData(student, schoolName ?? "School")} />
        </CardContent>
      </Card>
    </div>
  )
}
