import { Link } from "react-router-dom"
import { ClipboardList, CreditCard } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getClassFeePlans } from "@/features/finance/api/feePlans.api"

export function HeadAccountantDashboard() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: plans = [] } = useQuery({
    queryKey: ["class-fee-plans", activeSchoolId],
    queryFn: () => getClassFeePlans(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const draft = plans.filter((p) => p.status === "draft" || p.status === "rejected").length
  const pending = plans.filter((p) => p.status === "pending_vp").length
  const approved = plans.filter((p) => p.status === "approved").length
  const superseded = plans.filter((p) => p.status === "superseded").length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Head accountant</h1>
        <p className="text-muted-foreground mt-1">
          Draft term-wise class fee plans (class → category → amount) and submit to VP. Approved plans become fee structures for invoicing.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Draft / rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draft}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/finance/fee-plans?tab=drafts">Edit drafts</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending VP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pending}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/finance/fee-plans?tab=pending">View pending</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approved}</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/finance/fee-plans?tab=approved">View approved</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Superseded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{superseded}</div>
            <p className="text-xs text-muted-foreground">Replaced by newer plans</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg">
          <Link to="/finance/fee-plans">
            <CreditCard className="h-4 w-4 mr-1" /> Manage fee plans
          </Link>
        </Button>
        <Button variant="ghost" asChild className="text-muted-foreground">
          <Link to="/finance/fee-structures">
            <ClipboardList className="h-4 w-4 mr-1" /> View approved structures
          </Link>
        </Button>
      </div>
    </div>
  )
}
