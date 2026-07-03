import { useAuth } from "@/features/auth/hooks/useAuth"
import { ApprovedYearlyFeePlansPanel } from "@/features/finance/components/ApprovedYearlyFeePlansPanel"

export function AdmissionsFeeCatalog() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  if (!activeSchoolId) {
    return <p className="text-muted-foreground">Loading fee catalog…</p>
  }

  return (
    <ApprovedYearlyFeePlansPanel
      schoolId={activeSchoolId}
      showPaymentStatus={false}
      title="Approved fee structure by class"
      description="Share with parents during admission — all terms, lines, and due dates."
    />
  )
}
