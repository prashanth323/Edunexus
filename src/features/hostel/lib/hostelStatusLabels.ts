export const HOSTEL_STATUS_LABELS: Record<string, string> = {
  in_hostel: "In hostel",
  joined: "Joined hostel",
  checked_out: "Vacated hostel",
  away_home: "Leave — went home",
  in_hostel_no_class: "Leave — in hostel, no class",
}

export const HOSTEL_LEAVE_STATUSES = new Set(["away_home", "in_hostel_no_class"])

export function hostelStatusLabel(status: string | null | undefined): string {
  if (!status) return "—"
  return HOSTEL_STATUS_LABELS[status] ?? status.replace(/_/g, " ")
}
