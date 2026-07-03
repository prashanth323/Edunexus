import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getClassYearlyFeePlan,
  getStudentClassYearlyFeePlan,
  type YearlyFeePlan,
  type YearlyFeePlanLine,
} from "../api/feePlans.api"
import { feeCategoryLabel } from "../lib/feeCategories"
import { formatFeeDate } from "../lib/feeDueDisplay"

export type DraftYearlyLine = {
  fee_category: string
  custom_label?: string
  name?: string
  amount: number
  due_date: string
}

export type DraftYearlyTerm = {
  term_label: string
  term_due_date?: string
  items: DraftYearlyLine[]
}

type Props = {
  planId?: string | null
  studentId?: string | null
  draftTerms?: DraftYearlyTerm[]
  showPaymentStatus?: boolean
  compact?: boolean
  embedded?: boolean
  hideDescription?: boolean
  title?: string
}

function lineDisplayName(line: YearlyFeePlanLine | DraftYearlyLine): string {
  if ("name" in line && line.name) return line.name
  return feeCategoryLabel(line.fee_category, line.custom_label)
}

function buildDraftPlan(draftTerms: DraftYearlyTerm[]): YearlyFeePlan {
  const terms = draftTerms.map((t, idx) => ({
    term_order: idx + 1,
    term_label: t.term_label,
    term_due_date: t.term_due_date ?? null,
    items: t.items
      .filter((i) => i.amount > 0)
      .map((i, ii) => ({
        item_id: `draft-${idx}-${ii}`,
        fee_category: i.fee_category,
        custom_label: i.custom_label ?? null,
        name: lineDisplayName(i),
        amount: i.amount,
        due_date: i.due_date || t.term_due_date || null,
      })),
  }))

  const allItems = terms.flatMap((t) => t.items)
  const grand_total = allItems.reduce((s, i) => s + i.amount, 0)
  const total_by_category: Record<string, number> = {}
  for (const i of allItems) {
    total_by_category[i.fee_category] = (total_by_category[i.fee_category] ?? 0) + i.amount
  }

  return {
    plan_id: "draft",
    school_id: "",
    class_id: "",
    class_name: "Draft plan",
    academic_year_id: "",
    academic_year_name: "",
    status: "draft",
    terms,
    grand_total,
    total_by_category,
  }
}

function DueDateCell({
  dueDate,
  paymentStatus,
  showPaymentStatus,
}: {
  dueDate: string | null
  paymentStatus?: YearlyFeePlanLine["payment_status"]
  showPaymentStatus?: boolean
}) {
  if (!dueDate) return <span className="text-muted-foreground">—</span>

  if (!showPaymentStatus || !paymentStatus || paymentStatus === "not_invoiced") {
    return <span className="text-sm whitespace-nowrap">{formatFeeDate(dueDate)}</span>
  }

  if (paymentStatus === "paid") {
    return (
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        Paid · was {formatFeeDate(dueDate)}
      </span>
    )
  }

  if (paymentStatus === "on_time") {
    return (
      <div className="flex items-start gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          Last date to pay: {formatFeeDate(dueDate)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-1.5">
      <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
      <span className="text-sm font-medium text-destructive whitespace-nowrap">
        Overdue — was {formatFeeDate(dueDate)}
      </span>
    </div>
  )
}

function PaymentBadge({ status }: { status?: YearlyFeePlanLine["payment_status"] }) {
  if (!status || status === "not_invoiced") return null
  switch (status) {
    case "paid":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Paid</Badge>
    case "on_time":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">On time</Badge>
    case "overdue":
      return <Badge variant="destructive">Overdue</Badge>
    default:
      return null
  }
}

function YearlyPlanTable({
  plan,
  showPaymentStatus,
  compact,
}: {
  plan: YearlyFeePlan
  showPaymentStatus?: boolean
  compact?: boolean
}) {
  if (!plan.terms?.length) {
    return <p className="text-sm text-muted-foreground">No fee lines defined.</p>
  }

  return (
    <div className="space-y-4">
      {plan.terms.map((term) => (
        <div key={term.term_order} className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-medium">{term.term_label}</span>
            <span className="text-muted-foreground">
              Subtotal: ₹
              {term.items.reduce((s, i) => s + Number(i.amount), 0).toLocaleString()}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Fee</TableHead>
                {!compact && <TableHead>Last date to pay</TableHead>}
                {showPaymentStatus && <TableHead>Status</TableHead>}
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {term.items.map((item) => (
                <TableRow key={item.item_id}>
                  <TableCell className="text-muted-foreground capitalize text-sm">
                    {feeCategoryLabel(item.fee_category, item.custom_label)}
                  </TableCell>
                  <TableCell className="text-sm">{item.name}</TableCell>
                  {!compact && (
                    <TableCell>
                      <DueDateCell
                        dueDate={item.due_date}
                        paymentStatus={item.payment_status}
                        showPaymentStatus={showPaymentStatus}
                      />
                    </TableCell>
                  )}
                  {showPaymentStatus && (
                    <TableCell>
                      <PaymentBadge status={item.payment_status} />
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">
                    ₹{Number(item.amount).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
      <p className="text-sm font-semibold text-right">
        Grand total: ₹{Number(plan.grand_total).toLocaleString()}
        {plan.academic_year_name ? ` · ${plan.academic_year_name}` : ""}
      </p>
    </div>
  )
}

export function ClassYearlyFeePlanSummary({
  planId,
  studentId,
  draftTerms,
  showPaymentStatus = false,
  compact = false,
  embedded = false,
  hideDescription = false,
  title,
}: Props) {
  const useDraft = !!draftTerms?.length

  const { data: fetchedPlan, isLoading, error } = useQuery({
    queryKey: ["yearly-fee-plan", planId, studentId],
    queryFn: async () => {
      if (studentId) return getStudentClassYearlyFeePlan(studentId)
      if (planId) return getClassYearlyFeePlan(planId)
      return null
    },
    enabled: !useDraft && !!(planId || studentId),
  })

  const plan = useMemo(() => {
    if (useDraft && draftTerms) return buildDraftPlan(draftTerms)
    return fetchedPlan ?? null
  }, [useDraft, draftTerms, fetchedPlan])

  if (!useDraft && isLoading) {
    if (embedded) {
      return (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )
    }
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!useDraft && error) {
    if (embedded) {
      return <p className="text-sm text-destructive py-2">{(error as Error).message}</p>
    }
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-4 text-sm text-destructive">
          {(error as Error).message}
        </CardContent>
      </Card>
    )
  }

  if (!plan || (!plan.plan_id && !useDraft)) {
    if (embedded) {
      return <p className="text-sm text-muted-foreground py-2">No approved yearly fee plan for this class yet.</p>
    }
    return (
      <Card className="border-muted">
        <CardContent className="py-4 text-sm text-muted-foreground">
          No approved yearly fee plan for this class yet.
        </CardContent>
      </Card>
    )
  }

  const heading =
    title ??
    (plan.class_name
      ? `${plan.class_name} — yearly fee structure`
      : "Yearly fee structure")

  const table = (
    <YearlyPlanTable plan={plan} showPaymentStatus={showPaymentStatus} compact={compact} />
  )

  if (embedded) {
    return (
      <div className="space-y-2">
        {title && <p className="text-sm font-medium">{heading}</p>}
        {table}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className={compact ? "pb-2" : undefined}>
        <CardTitle className={compact ? "text-base" : "text-lg"}>{heading}</CardTitle>
        {!compact && !hideDescription && (
          <CardDescription>
            {showPaymentStatus
              ? "VP-approved class fees with payment status per line."
              : "Full yearly breakdown with last date to pay on each fee line."}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>{table}</CardContent>
    </Card>
  )
}
