import { useQuery } from "@tanstack/react-query"
import { GraduationCap } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCardSkeletonGrid } from "@/components/ui/card-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { supabase } from "@/lib/supabase"
import { StudentFeePaymentStatus } from "../components/StudentFeePaymentStatus"
import { ClassYearlyFeePlanSummary } from "../components/ClassYearlyFeePlanSummary"

type ParentChild = {
  student_id: string
  student_name: string
}

async function getParentLinkedChildren(profileId: string): Promise<ParentChild[]> {
  const { data, error } = await supabase
    .from("v_parent_children")
    .select("student_id, student_name")
    .eq("profile_id", profileId)

  if (error) throw error
  const map = new Map<string, ParentChild>()
  for (const row of data ?? []) {
    if (!map.has(row.student_id)) {
      map.set(row.student_id, { student_id: row.student_id, student_name: row.student_name })
    }
  }
  return Array.from(map.values())
}

export function FinanceParentView() {
  const user = useAuth((s) => s.user)

  const { data: children = [], isLoading: childrenLoading } = useQuery({
    queryKey: ["parent-children-finance", user?.id],
    queryFn: () => getParentLinkedChildren(user!.id),
    enabled: !!user?.id,
  })

  if (childrenLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fees & Invoices</h1>
          <p className="text-muted-foreground mt-1">View fee status and payment deadlines for your children.</p>
        </div>
        <StatCardSkeletonGrid count={2} columnsClassName="grid gap-4 sm:grid-cols-2" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (children.length === 0) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fees & Invoices</h1>
          <p className="text-muted-foreground mt-1">View fee details for your children.</p>
        </div>
        <div className="py-16 text-center border border-dashed rounded-lg text-muted-foreground">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-foreground">No linked children</p>
          <p className="text-sm mt-1">
            When your school links your account to a student, their fee details will show here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fees & Invoices</h1>
        <p className="text-muted-foreground mt-1">
          VP-approved class fees assigned by the school. Pay on or before the last date shown (green). After the due date, fees show as overdue (red) with any late fine.
        </p>
      </div>

      <Card className="border-muted">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How school fees reach you</CardTitle>
          <CardDescription>
            Head accountant drafts class fees → VP approves → accountant generates invoices for your child&apos;s section → fees appear here on the parent portal.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        {children.map((child) => (
          <div key={child.student_id} className="space-y-4">
            <ClassYearlyFeePlanSummary
              studentId={child.student_id}
              showPaymentStatus
              hideDescription
              title={`${child.student_name} — class yearly fees`}
            />
            <StudentFeePaymentStatus
              studentId={child.student_id}
              parentView
            />
          </div>
        ))}
      </div>
    </div>
  )
}
