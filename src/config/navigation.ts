/**
 * Single source for which roles see which routes (sidebar + RequireRole).
 * Includes school_role enum values and platform_role names from DB.
 */

import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Users,
  BookOpen,
  UserSquare2,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  Megaphone,
  Bus,
  Home,
  Settings,
  GraduationCap,
  LineChart,
} from "lucide-react"

export type NavLink = {
  title: string
  href: string
  icon: LucideIcon
  /** Roles that can see this link (school + platform names as stored in DB). */
  roles: readonly string[]
}

export const PLATFORM_ROLES = [
  "super_admin",
  "operations_admin",
  "finance_admin",
  "support_admin",
  "analyst",
] as const

export type PlatformRoleName = (typeof PLATFORM_ROLES)[number]

export function isPlatformRole(role: string | null | undefined): boolean {
  if (!role) return false
  return (PLATFORM_ROLES as readonly string[]).includes(role)
}

/** Same access pattern as principal-level school staff (for platform ops). Super admin excluded — uses a narrow sidebar. */
const PRINCIPAL_LIKE: readonly string[] = ["principal", "vice_principal", "operations_admin"]

const ADMIN_STUDENTS: readonly string[] = [
  ...PRINCIPAL_LIKE,
  "school_admin",
]

const FINANCE_ROLES: readonly string[] = [
  ...PRINCIPAL_LIKE,
  "accountant",
  "finance_admin",
]

/** Roles that get a dashboard; also used for Settings (profile) so header link works for everyone. */
const ALL_REGISTERED_USER_ROLES: readonly string[] = [
  "super_admin",
  ...PRINCIPAL_LIKE,
  "school_admin",
  "teacher",
  "class_teacher",
  "student",
  "parent",
  "counselor",
  "accountant",
  "admission_manager",
  "hr_manager",
  "librarian",
  "transport_manager",
  "finance_admin",
  "support_admin",
  "analyst",
]

export const SIDEBAR_LINKS: NavLink[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    roles: ALL_REGISTERED_USER_ROLES,
  },
  {
    title: "School insights",
    href: "/insights",
    icon: LineChart,
    roles: ["super_admin"],
  },
  {
    title: "Announcements",
    href: "/announcements",
    icon: Megaphone,
    roles: ["super_admin"],
  },
  {
    title: "Students",
    href: "/students",
    icon: GraduationCap,
    roles: [...ADMIN_STUDENTS],
  },
  {
    title: "Staff",
    href: "/staff",
    icon: UserSquare2,
    roles: [...PRINCIPAL_LIKE, "hr_manager"],
  },
  {
    title: "Attendance",
    href: "/attendance",
    icon: CalendarCheck,
    roles: [
      ...PRINCIPAL_LIKE,
      "school_admin",
      "teacher",
      "class_teacher",
      "student",
      "parent",
    ],
  },
  {
    title: "Timetable",
    href: "/timetable",
    icon: CalendarDays,
    roles: [
      ...PRINCIPAL_LIKE,
      "school_admin",
      "teacher",
      "class_teacher",
      "student",
    ],
  },
  {
    title: "ERP",
    href: "/finance",
    icon: CreditCard,
    roles: [...FINANCE_ROLES, "parent"],
  },
  {
    title: "LMS",
    href: "/lms",
    icon: BookOpen,
    roles: [...PRINCIPAL_LIKE, "school_admin", "teacher", "class_teacher", "student", "librarian"],
  },
  {
    title: "CRM",
    href: "/crm",
    icon: Users,
    roles: [...PRINCIPAL_LIKE, "admission_manager", "counselor"],
  },
  {
    title: "Transport",
    href: "/transport",
    icon: Bus,
    roles: [...PRINCIPAL_LIKE, "transport_manager"],
  },
  {
    title: "Hostel",
    href: "/hostel",
    icon: Home,
    roles: [...PRINCIPAL_LIKE],
  },
  {
    title: "Notices",
    href: "/notices",
    icon: Megaphone,
    roles: [
      ...PRINCIPAL_LIKE,
      "school_admin",
      "teacher",
      "class_teacher",
      "student",
      "parent",
      "counselor",
    ],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ALL_REGISTERED_USER_ROLES,
  },
]

export function navLinksForRole(activeRole: string | null): NavLink[] {
  if (!activeRole) return []
  return SIDEBAR_LINKS.filter((link) => link.roles.includes(activeRole))
}

const SUPER_ADMIN_ONLY_PATH_PREFIXES = ["/insights", "/announcements"] as const

/** Stable reference — avoid allocating a new array on every `getRolesAllowedForPath` call (breaks React effect deps). */
const ROLES_SUPER_ADMIN_ONLY = ["super_admin"] as const satisfies readonly string[]

/** Roles allowed to open a path (from SIDEBAR_LINKS super-admin prefixes). Dashboard '/' uses DashboardRouter gate. */
export function getRolesAllowedForPath(pathname: string): readonly string[] | null {
  const normalized =
    pathname === "" || pathname === undefined ? "/" : pathname.startsWith("/") ? pathname : `/${pathname}`

  for (const prefix of SUPER_ADMIN_ONLY_PATH_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return ROLES_SUPER_ADMIN_ONLY
    }
  }

  const link = SIDEBAR_LINKS.find(
    (l) => l.href === normalized || (l.href !== "/" && normalized.startsWith(l.href)),
  )
  return link?.roles ?? null
}
