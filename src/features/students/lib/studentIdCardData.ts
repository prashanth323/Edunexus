import type { StudentFullProfile } from "../api/studentProfile.api"

/** Props for `IdCardGenerator` — centralized so student profile and self-serve portals stay in sync. */
export type StudentIdCardData = {
  schoolName: string
  schoolLogo?: string | null
  studentName: string
  admissionNo: string
  rollNo?: string | null
  className: string
  sectionName: string
  academicYear: string
  photoUrl?: string | null
  dateOfBirth?: string | null
  bloodGroup?: string | null
  phone?: string | null
  address?: string | null
  emergencyContact?: { name?: string; phone?: string; relation?: string } | null
}

function formatDisplayDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export function buildStudentIdCardData(student: StudentFullProfile, schoolName: string): StudentIdCardData {
  const enrollment = student.enrollment
  const addr = student.address as Record<string, string> | null | undefined
  const emergency = student.emergency_contact as Record<string, string> | null | undefined

  return {
    schoolName,
    studentName: [student.first_name, student.last_name].filter(Boolean).join(" ").trim() || "Student",
    admissionNo: student.admission_no,
    rollNo: enrollment?.roll_no ?? student.roll_no,
    className: enrollment?.section.class?.name ?? "N/A",
    sectionName: enrollment?.section?.name ?? "N/A",
    academicYear: enrollment?.academic_year?.name ?? "Current",
    photoUrl: student.photo_url,
    dateOfBirth: formatDisplayDate(student.date_of_birth),
    bloodGroup: student.blood_group,
    phone: student.phone,
    address: addr
      ? [addr.street, addr.city, addr.state].filter(Boolean).join(", ").trim() || null
      : null,
    emergencyContact:
      emergency && (emergency.phone || emergency.name || emergency.relation)
        ? {
            name: emergency.name,
            phone: emergency.phone,
            relation: emergency.relation,
          }
        : null,
  }
}
