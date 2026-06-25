/**
 * Single source for which roles see which routes (sidebar + RequireRole).
 */

import type { LucideIcon } from "lucide-react"
import { hasClassTeacherCapabilities } from "@/features/auth/lib/schoolRoles"
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
  ClipboardList,
  FileText,
  IdCard,
  MessagesSquare,
  ClipboardCheck,
  User,
} from "lucide-react"

export type NavLink = {
  title: string
  href: string
  icon: LucideIcon
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

const PRINCIPAL_LIKE: readonly string[] = ["principal", "vice_principal", "operations_admin"]

const ADMIN_STUDENTS: readonly string[] = [
  ...PRINCIPAL_LIKE,
  "school_admin",
]

const FINANCE_ROLES: readonly string[] = [
  ...PRINCIPAL_LIKE,
  "head_accountant",
  "accountant",
  "finance_admin",
]

const ALL_REGISTERED_USER_ROLES: readonly string[] = [
  "super_admin",
  ...PRINCIPAL_LIKE,
  "school_admin",
  "teacher",
  "class_teacher",
  "student",
  "parent",
  "counselor",
  "head_accountant",
  "accountant",
  "admission_manager",
  "hostel_manager",
  "hr_manager",
  "librarian",
  "transport_manager",
  "receptionist",
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
    roles: [...ADMIN_STUDENTS, "class_teacher", "accountant", "receptionist"],
  },
  {
    title: "Admissions",
    href: "/admissions",
    icon: ClipboardCheck,
    roles: [
      ...PRINCIPAL_LIKE,
      "school_admin",
      "admission_manager",
      "receptionist",
    ],
  },
  {
    title: "Staff",
    href: "/staff",
    icon: UserSquare2,
    roles: [...PRINCIPAL_LIKE, "hr_manager", "receptionist"],
  },
  {
    title: "Classes",
    href: "/classes",
    icon: GraduationCap,
    roles: [...PRINCIPAL_LIKE, "school_admin"],
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
      "receptionist",
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
    roles: [...FINANCE_ROLES.filter((r) => r !== "head_accountant"), "parent"],
  },
  {
    title: "Fee plans",
    href: "/finance/fee-plans",
    icon: CreditCard,
    roles: ["head_accountant", ...PRINCIPAL_LIKE, "school_admin"],
  },
  {
    title: "Fee approvals",
    href: "/finance/fee-approvals",
    icon: ClipboardCheck,
    roles: ["vice_principal", "principal", "school_admin"],
  },
  {
    title: "Fee structures",
    href: "/finance/fee-structures",
    icon: CreditCard,
    roles: ["accountant", "head_accountant", ...PRINCIPAL_LIKE, "school_admin"],
  },
  {
    title: "Fee dues & notify",
    href: "/finance/dues",
    icon: CreditCard,
    roles: ["accountant", ...PRINCIPAL_LIKE, "school_admin"],
  },
  {
    title: "LMS",
    href: "/lms",
    icon: BookOpen,
    roles: [...PRINCIPAL_LIKE, "school_admin", "teacher", "class_teacher", "student", "librarian"],
  },
  {
    title: "Homework",
    href: "/homework",
    icon: FileText,
    roles: [...PRINCIPAL_LIKE, "school_admin", "teacher", "class_teacher", "student", "parent"],
  },
  {
    title: "Student ID Card",
    href: "/student-id-card",
    icon: IdCard,
    roles: ["student", "parent"],
  },
  {
    title: "My profile",
    href: "/my-profile",
    icon: User,
    roles: ["student", "parent"],
  },
  {
    title: "Exams",
    href: "/exams",
    icon: ClipboardList,
    roles: [...PRINCIPAL_LIKE, "school_admin", "teacher", "class_teacher", "student", "parent"],
  },
  {
    title: "CRM",
    href: "/crm",
    roles: [...PRINCIPAL_LIKE, "admission_manager", "counselor"],
    icon: Users,
  },
  {
    title: "Transport",
    href: "/transport",
    icon: Bus,
    roles: ["vice_principal", "transport_manager", "principal"],
  },
  {
    title: "Hostel",
    href: "/hostel",
    icon: Home,
    roles: ["vice_principal", "hostel_manager", "principal"],
  },
  {
    title: "Messages",
    href: "/messages",
    icon: MessagesSquare,
    roles: [
      "principal",
      "school_admin",
      "teacher",
      "class_teacher",
      "parent",
    ],
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
      "receptionist",
      "hostel_manager",
      "transport_manager",
      "head_accountant",
      "accountant",
      "librarian",
      "hr_manager",
      "admission_manager",
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

/** Union of nav links visible when the user holds any of the given school roles. */
export function navLinksForRoles(
  schoolRoles: readonly string[],
  platformRole?: string | null,
  activeRole?: string | null,
): NavLink[] {
  const effective = platformRole ? [platformRole] : [...schoolRoles]
  if (!effective.length) return []
  const links = SIDEBAR_LINKS.filter((link) => effective.some((r) => link.roles.includes(r)))
  return links.map((link) => {
    if (
      link.href === "/students" &&
      activeRole === "class_teacher" &&
      hasClassTeacherCapabilities(schoolRoles)
    ) {
      return { ...link, title: "My class" }
    }
    return link
  })
}

export function pathAllowedForRoles(
  allowed: readonly string[] | null,
  schoolRoles: readonly string[],
  platformRole?: string | null,
): boolean {
  if (!allowed) return true
  const effective = platformRole ? [platformRole] : schoolRoles
  if (!effective.length) return false
  return effective.some((r) => allowed.includes(r))
}

const SUPER_ADMIN_ONLY_PATH_PREFIXES = ["/insights", "/announcements"] as const
const ROLES_SUPER_ADMIN_ONLY = ["super_admin"] as const satisfies readonly string[]

export function getRolesAllowedForPath(pathname: string): readonly string[] | null {
  const normalized =
    pathname === "" || pathname === undefined ? "/" : pathname.startsWith("/") ? pathname : `/${pathname}`

  if (/\/exams\/[^/]+\/marks/.test(normalized)) {
    return ["principal", "vice_principal", "operations_admin", "school_admin", "teacher", "class_teacher"]
  }

  if (/\/staff\/[^/]+\/edit/.test(normalized)) {
    return ["principal", "vice_principal", "school_admin", "hr_manager"]
  }

  for (const prefix of SUPER_ADMIN_ONLY_PATH_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return ROLES_SUPER_ADMIN_ONLY
    }
  }

  if (normalized === "/finance/fee-approvals" || normalized.startsWith("/finance/fee-approvals/")) {
    return ["principal", "vice_principal", "school_admin"]
  }

  if (normalized === "/finance/fee-structures" || normalized.startsWith("/finance/fee-structures/")) {
    return ["principal", "vice_principal", "operations_admin", "school_admin", "head_accountant", "accountant"]
  }

  if (normalized === "/finance/pending-dues" || normalized.startsWith("/finance/pending-dues/")) {
    return ["principal", "vice_principal", "operations_admin", "school_admin", "accountant", "finance_admin"]
  }

  const matches = SIDEBAR_LINKS.filter(
    (l) => l.href === normalized || (l.href !== "/" && normalized.startsWith(`${l.href}/`)),
  )
  if (matches.length === 0) {
    const exact = SIDEBAR_LINKS.find((l) => l.href === normalized)
    return exact?.roles ?? null
  }
  const link = matches.sort((a, b) => b.href.length - a.href.length)[0]
  return link?.roles ?? null
}
