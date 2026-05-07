/**
 * Public Lottie assets under /public/lottie/student/
 *
 * Placeholder animations were created for EduNexus (simple shapes + motion). You may replace
 * these JSON files with https://lottiefiles.com/ assets that match your license; update paths
 * only if filenames change.
 */
export const STUDENT_LOTTIE = {
  educationHero: "/lottie/student/education-hero.json",
  emptyCatalog: "/lottie/student/empty-catalog.json",
  calendarAttendance: "/lottie/student/calendar-attendance.json",
  graduationCap: "/lottie/student/graduation-cap.json",
} as const

export type StudentLottieKey = keyof typeof STUDENT_LOTTIE
