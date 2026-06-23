import type { QueryClient } from "@tanstack/react-query"

type PortalAvatarOpts = {
  schoolId: string
}

type StudentPortraitOpts = {
  schoolId: string
  studentId: string
}

/**
 * Invalidate cached UI that shows portal `profiles.avatar_url` (staff directory, etc.).
 */
export function invalidateAfterPortalAvatarChange(qc: QueryClient, opts: PortalAvatarOpts) {
  const { schoolId } = opts
  void Promise.all([
    qc.invalidateQueries({ queryKey: ["staff-directory", schoolId] }),
    qc.invalidateQueries({ queryKey: ["platform-users"] }),
    qc.invalidateQueries({ queryKey: ["my-staff-professional-details"] }),
  ])
}

/** After name/phone/profile fields save on Settings — keeps staff directory and teaching profile in sync. */
export function invalidateAfterSignedInProfileDetailsSaved(
  qc: QueryClient,
  opts: { schoolId: string | null | undefined },
) {
  const jobs: Promise<unknown>[] = [qc.invalidateQueries({ queryKey: ["my-staff-professional-details"] })]
  if (opts.schoolId) {
    jobs.push(qc.invalidateQueries({ queryKey: ["staff-directory", opts.schoolId] }))
  }
  void Promise.all(jobs)
}

/**
 * Invalidate cached student rows and parent views after `students.photo_url` changes.
 */
export function invalidateAfterStudentPortraitChange(qc: QueryClient, opts: StudentPortraitOpts) {
  const { schoolId, studentId } = opts

  void Promise.all([
    qc.invalidateQueries({ queryKey: ["student-profile", studentId] }),
    qc.invalidateQueries({ queryKey: ["students", schoolId] }),
    qc.invalidateQueries({ queryKey: ["student-self-id-card"] }),
    qc.invalidateQueries({ queryKey: ["children-attendance"] }),
    qc.invalidateQueries({ queryKey: ["children-exams"] }),
    qc.invalidateQueries({ queryKey: ["children-invoices"] }),
    qc.invalidateQueries({ queryKey: ["parent-children-invoices"] }),
    qc.invalidateQueries({ queryKey: ["parent-children"] }),
    qc.invalidateQueries({ queryKey: ["parent-children-id-card"] }),
    qc.invalidateQueries({ queryKey: ["parent-children-finance"] }),
    qc.invalidateQueries({ queryKey: ["parent-children-attendance"] }),
    qc.invalidateQueries({ queryKey: ["lms-parent-children"] }),
  ])
}
