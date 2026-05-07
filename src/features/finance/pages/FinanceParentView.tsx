import { useQuery } from "@tanstack/react-query"
import { CreditCard, GraduationCap } from "lucide-react"
import { format } from "date-fns"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCardSkeletonGrid, TableSkeletonRows } from "@/components/ui/card-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { supabase } from "@/lib/supabase"

type ParentChild = {
  student_id: string
  student_name: string
}

type ChildInvoice = {
  id: string
  invoice_no: string
  description: string | null
  amount: number
  paid_amount: number
  due_amount: number
  status: string
  due_date: string
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

async function getChildrenInvoices(studentIds: string[]): Promise<ChildInvoice[]> {
  if (!studentIds.length) return []

  const { data, error } = await supabase
    .from("student_invoices")
    .select(`
      id,
      invoice_no,
      description,
      amount,
      paid_amount,
      due_amount,
      status,
      due_date,
      student_id,
      students ( first_name, last_name )
    `)
    .in("student_id", studentIds)
    .is("deleted_at", null)
    .order("due_date", { ascending: false })

  if (error) throw error

  return (data as any[]).map((row) => {
    const st = Array.isArray(row.students) ? row.students[0] : row.students
    return {
      id: row.id,
      invoice_no: row.invoice_no,
      description: row.description,
      amount: Number(row.amount),
      paid_amount: Number(row.paid_amount),
      due_amount: Number(row.due_amount),
      status: row.status,
      due_date: row.due_date,
      student_id: row.student_id,
      student_name: st ? `${st.first_name} ${st.last_name}` : "—",
    }
  })
}

const STATUS_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  paid: "default",
  overdue: "destructive",
  partial: "secondary",
  pending: "outline",
}

export function FinanceParentView() {
  const user = useAuth((s) => s.user)

  const { data: children = [], isLoading: childrenLoading } = useQuery({
    queryKey: ["parent-children-finance", user?.id],
    queryFn: () => getParentLinkedChildren(user!.id),
    enabled: !!user?.id,
  })

  const studentIds = children.map((c) => c.student_id)

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["parent-children-invoices", studentIds],
    queryFn: () => getChildrenInvoices(studentIds),
    enabled: studentIds.length > 0,
  })

  const isLoading = childrenLoading || invoicesLoading

  const totalDue = invoices
    .filter((inv) => inv.status !== "paid")
    .reduce((sum, inv) => sum + inv.due_amount, 0)

  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paid_amount, 0)

  const openInvoices = invoices.filter((inv) => inv.due_amount > 0)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fees & Invoices</h1>
          <p className="text-muted-foreground mt-1">View outstanding and paid invoices for your children.</p>
        </div>
        <StatCardSkeletonGrid count={4} columnsClassName="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <TableSkeletonRows rows={5} cols={4} />
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
          View outstanding and paid invoices for your children.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total due</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              ${totalDue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Outstanding balance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total paid</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
              ${totalPaid.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openInvoices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">With balance due</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Children</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{children.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {children.map((c) => c.student_name).join(", ")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Open invoices */}
      {openInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Outstanding invoices</CardTitle>
            <CardDescription>Invoices with a remaining balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-3 font-medium">Invoice</th>
                    <th className="p-3 font-medium">Child</th>
                    <th className="p-3 font-medium">Due date</th>
                    <th className="p-3 font-medium text-right">Amount</th>
                    <th className="p-3 font-medium text-right">Due</th>
                    <th className="p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {openInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="p-3 font-mono text-xs">{inv.invoice_no}</td>
                      <td className="p-3">{inv.student_name}</td>
                      <td className="p-3 whitespace-nowrap">
                        {format(new Date(inv.due_date), "MMM d, yyyy")}
                      </td>
                      <td className="p-3 text-right">${inv.amount.toLocaleString()}</td>
                      <td className="p-3 text-right font-semibold text-destructive">
                        ${inv.due_amount.toLocaleString()}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={STATUS_VARIANT[inv.status] ?? "outline"}
                          className="capitalize"
                        >
                          {inv.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment history */}
      <Card>
        <CardHeader>
          <CardTitle>All invoices</CardTitle>
          <CardDescription>Complete invoice history for your children</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-lg">
              No invoices found for your children.
            </p>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-3 font-medium">Invoice</th>
                    <th className="p-3 font-medium">Child</th>
                    <th className="p-3 font-medium">Description</th>
                    <th className="p-3 font-medium">Due date</th>
                    <th className="p-3 font-medium text-right">Amount</th>
                    <th className="p-3 font-medium text-right">Paid</th>
                    <th className="p-3 font-medium text-right">Due</th>
                    <th className="p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="p-3 font-mono text-xs">{inv.invoice_no}</td>
                      <td className="p-3">{inv.student_name}</td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate">
                        {inv.description || "—"}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {format(new Date(inv.due_date), "MMM d, yyyy")}
                      </td>
                      <td className="p-3 text-right">${inv.amount.toLocaleString()}</td>
                      <td className="p-3 text-right text-green-600 dark:text-green-500">
                        ${inv.paid_amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        ${inv.due_amount.toLocaleString()}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={STATUS_VARIANT[inv.status] ?? "outline"}
                          className="capitalize"
                        >
                          {inv.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
