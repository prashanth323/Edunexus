import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router-dom"
import { AlertCircle, Loader2, Plus, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getClassesForSchool } from "@/features/admissions/api/admissions.api"
import {
  createClassFeePlan,
  deleteClassFeePlan,
  deleteFeePlanTerm,
  getClassFeePlans,
  getFeePlanWithTerms,
  saveClassFeePlanTerms,
  submitClassFeePlan,
  type FeePlanTerm,
  type FeePlanItemInput,
} from "../api/feePlans.api"
import { FEE_CATEGORIES, feeCategoryLabel, type FeeCategory } from "../lib/feeCategories"
import { ClassYearlyFeePlanSummary, type DraftYearlyTerm } from "../components/ClassYearlyFeePlanSummary"
import { supabase } from "@/lib/supabase"

type TermItemDraft = {
  fee_category: FeeCategory
  custom_label: string
  amount: number
  due_date: string
}

type TermDraft = {
  id?: string
  term_order: number
  term_label: string
  due_date: string
  items: TermItemDraft[]
}

type PlanTab = "drafts" | "pending" | "approved"

function validateTermsForSubmit(terms: TermDraft[]): string | null {
  if (!terms.length) return "Add at least one term before submitting."
  for (const t of terms) {
    const validItems = t.items.filter((i) => i.amount > 0)
    if (!validItems.length) {
      return `Add fee line items with amounts for ${t.term_label || "each term"}.`
    }
    for (const item of validItems) {
      if (item.fee_category === "other" && !item.custom_label.trim()) {
        return `Enter a label for "Other" fee in ${t.term_label}.`
      }
      const lineDue = item.due_date.trim() || t.due_date.trim()
      if (!lineDue) {
        return `Set a due date for each fee line in ${t.term_label || "each term"}.`
      }
    }
  }
  return null
}

function itemsToInput(items: TermItemDraft[], termDueDate: string): FeePlanItemInput[] {
  return items.map((i) => ({
    fee_category: i.fee_category,
    custom_label: i.fee_category === "other" ? i.custom_label : null,
    amount: i.amount,
    due_date: i.due_date.trim() || termDueDate || null,
  }))
}

function mapLoadedItem(item: {
  fee_category?: string
  custom_label?: string | null
  name?: string
  amount: number
  due_date?: string | null
}): TermItemDraft {
  const cat = (item.fee_category as FeeCategory) || "tuition"
  return {
    fee_category: cat,
    custom_label: item.custom_label ?? (cat === "other" ? item.name ?? "" : ""),
    amount: Number(item.amount),
    due_date: item.due_date ?? "",
  }
}

function mapLoadedTermsToDraft(loaded: FeePlanTerm[]): TermDraft[] {
  return loaded.map((t) => ({
    id: t.id,
    term_order: t.term_order,
    term_label: t.term_label,
    due_date: t.due_date ?? "",
    items: (t.items ?? []).map(mapLoadedItem),
  }))
}

function termsToSaveInput(terms: TermDraft[]): Parameters<typeof saveClassFeePlanTerms>[1] {
  return terms.map((t, index) => ({
    id: t.id,
    term_order: index + 1,
    term_label: t.term_label,
    due_date: t.due_date || null,
    items: itemsToInput(
      t.items.filter((i) => i.amount > 0 || i.fee_category),
      t.due_date,
    ),
  }))
}

export function ClassFeePlanEditor() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const qc = useQueryClient()
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [terms, setTerms] = useState<TermDraft[]>([])
  const [newClassId, setNewClassId] = useState("")
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null)
  const [showSupersededHistory, setShowSupersededHistory] = useState(false)

  const canWrite = activeRole === "head_accountant"
  const canSeeVpApprovals =
    activeRole === "vice_principal" || activeRole === "principal" || activeRole === "school_admin"

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["class-fee-plans", activeSchoolId],
    queryFn: () => getClassFeePlans(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: academicYear } = useQuery({
    queryKey: ["current-ay-fee-plans", activeSchoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("academic_years")
        .select("id")
        .eq("school_id", activeSchoolId!)
        .eq("is_current", true)
        .maybeSingle()
      return data
    },
    enabled: !!activeSchoolId,
  })

  const { data: classes = [] } = useQuery({
    queryKey: ["fee-plan-classes", activeSchoolId],
    queryFn: () => getClassesForSchool(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get("tab") as PlanTab) || "drafts"

  const setTab = (tab: PlanTab) => setSearchParams({ tab })

  const tabCounts = useMemo(
    () => ({
      drafts: plans.filter((p) => p.status === "draft" || p.status === "rejected").length,
      pending: plans.filter((p) => p.status === "pending_vp").length,
      approved: plans.filter((p) => p.status === "approved").length,
      superseded: plans.filter((p) => p.status === "superseded").length,
    }),
    [plans],
  )

  const filteredPlans = useMemo(() => {
    switch (activeTab) {
      case "pending":
        return plans.filter((p) => p.status === "pending_vp")
      case "approved":
        return plans.filter((p) => p.status === "approved")
      default:
        return plans.filter((p) => p.status === "draft" || p.status === "rejected")
    }
  }, [plans, activeTab])

  const supersededPlans = useMemo(
    () => plans.filter((p) => p.status === "superseded"),
    [plans],
  )

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  )

  useQuery({
    queryKey: ["fee-plan-detail", selectedPlanId],
    queryFn: async () => {
      const { terms: loaded } = await getFeePlanWithTerms(selectedPlanId!)
      setTerms(mapLoadedTermsToDraft(loaded))
      return loaded
    },
    enabled: !!selectedPlanId,
  })

  const deletePlanMut = useMutation({
    mutationFn: (planId: string) => deleteClassFeePlan(planId),
    onSuccess: () => {
      toast.success("Draft plan deleted")
      setSelectedPlanId(null)
      setTerms([])
      qc.invalidateQueries({ queryKey: ["class-fee-plans", activeSchoolId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const createMut = useMutation({
    mutationFn: async () => {
      if (!activeSchoolId || !academicYear?.id || !newClassId) throw new Error("Select a class")
      const id = await createClassFeePlan(activeSchoolId, academicYear.id, newClassId)
      setTerms([
        {
          term_order: 1,
          term_label: "Term 1",
          due_date: "",
          items: [{ fee_category: "tuition", custom_label: "", amount: 0, due_date: "" }],
        },
      ])
      return id
    },
    onSuccess: (id) => {
      toast.success("Fee plan created")
      setSelectedPlanId(id)
      setNewClassId("")
      qc.invalidateQueries({ queryKey: ["class-fee-plans", activeSchoolId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const reloadTerms = async (planId: string) => {
    const { terms: loaded } = await getFeePlanWithTerms(planId)
    setTerms(mapLoadedTermsToDraft(loaded))
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selectedPlanId) return
      await saveClassFeePlanTerms(selectedPlanId, termsToSaveInput(terms))
    },
    onSuccess: async () => {
      toast.success("Plan saved")
      if (selectedPlanId) await reloadTerms(selectedPlanId)
      qc.invalidateQueries({ queryKey: ["class-fee-plans", activeSchoolId] })
      qc.invalidateQueries({ queryKey: ["fee-plan-detail", selectedPlanId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submitMut = useMutation({
    mutationFn: async () => {
      const err = validateTermsForSubmit(terms)
      if (err) throw new Error(err)
      if (!selectedPlanId) throw new Error("Select a plan")
      await saveClassFeePlanTerms(
        selectedPlanId,
        terms.map((t, index) => ({
          id: t.id,
          term_order: index + 1,
          term_label: t.term_label,
          due_date: t.due_date || null,
          items: itemsToInput(t.items.filter((i) => i.amount > 0), t.due_date),
        })),
      )
      await submitClassFeePlan(selectedPlanId)
    },
    onSuccess: async () => {
      toast.success("Submitted to VP for approval")
      if (selectedPlanId) await reloadTerms(selectedPlanId)
      qc.invalidateQueries({ queryKey: ["class-fee-plans", activeSchoolId] })
      qc.invalidateQueries({ queryKey: ["fee-plan-detail", selectedPlanId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const total = terms.reduce(
    (sum, t) => sum + t.items.reduce((s, i) => s + (Number(i.amount) || 0), 0),
    0,
  )

  const draftYearlyTerms: DraftYearlyTerm[] = useMemo(
    () =>
      terms.map((t) => ({
        term_label: t.term_label,
        term_due_date: t.due_date,
        items: t.items.map((i) => ({
          fee_category: i.fee_category,
          custom_label: i.custom_label,
          amount: i.amount,
          due_date: i.due_date || t.due_date,
        })),
      })),
    [terms],
  )

  const canEditSelected =
    canWrite &&
    selectedPlan &&
    (selectedPlan.status === "draft" || selectedPlan.status === "rejected")

  if (!activeSchoolId) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Class fee plans</h1>
          <p className="text-muted-foreground mt-1">
            {canWrite
              ? "Draft yearly class fees with a due date on every fee line. Submit to VP for approval — approved plans become fee structures for the accountant to send to parents."
              : "View term-wise class fee plans for this school."}
          </p>
        </div>
        {canSeeVpApprovals && (
          <Button variant="outline" asChild>
            <Link
              to={
                activeRole === "vice_principal" || activeRole === "principal"
                  ? "/finance/vp-fee-status"
                  : "/finance/fee-approvals"
              }
            >
              VP fee status
            </Link>
          </Button>
        )}
      </div>

      {!canWrite && (
        <Card className="border-muted">
          <CardContent className="py-3 text-sm text-muted-foreground">
            Only the head accountant can draft and submit fee plans. Approved plans automatically create fee structures.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Plans</CardTitle>
            <CardDescription>Drafts for VP approval — not the same as fee structures</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={activeTab} onValueChange={(v) => setTab(v as PlanTab)}>
              <TabsList className="w-full flex h-auto flex-wrap gap-1">
                <TabsTrigger value="drafts" className="gap-1.5 flex-1 min-w-[100px]">
                  Draft / rejected
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {tabCounts.drafts}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-1.5 flex-1 min-w-[100px]">
                  Pending VP
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {tabCounts.pending}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="approved" className="gap-1.5 flex-1 min-w-[100px]">
                  Approved
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {tabCounts.approved}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {canWrite && activeTab === "drafts" && (
              <div className="flex gap-2">
                <select
                  className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                >
                  <option value="">New plan for class…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Button size="sm" disabled={!newClassId || createMut.isPending} onClick={() => createMut.mutate()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : filteredPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No plans in this tab.</p>
            ) : (
              <ul className="space-y-1">
                {filteredPlans.map((p) => {
                  const cls = p.classes as { name?: string } | null
                  return (
                    <li key={p.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        className={`flex-1 text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted ${
                          selectedPlanId === p.id ? "bg-muted font-medium" : ""
                        }`}
                        onClick={() => setSelectedPlanId(p.id)}
                      >
                        {cls?.name ?? "Class"} —{" "}
                        <Badge variant="outline" className="ml-1 text-xs">
                          {p.status}
                        </Badge>
                      </button>
                      {canWrite && (p.status === "draft" || p.status === "rejected") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive shrink-0"
                          disabled={deletePlanMut.isPending}
                          onClick={() => setDeletePlanId(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {activeTab === "approved" && tabCounts.superseded > 0 && (
              <div className="border-t pt-3 space-y-2">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground w-full text-left"
                  onClick={() => setShowSupersededHistory((v) => !v)}
                >
                  {showSupersededHistory ? "Hide" : "Show"} history — superseded ({tabCounts.superseded})
                </button>
                <p className="text-xs text-muted-foreground">
                  Replaced when VP approved a newer plan for the same class and year.
                </p>
                {showSupersededHistory && (
                  <ul className="space-y-1">
                    {supersededPlans.map((p) => {
                      const cls = p.classes as { name?: string } | null
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            className={`w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted text-muted-foreground ${
                              selectedPlanId === p.id ? "bg-muted font-medium text-foreground" : ""
                            }`}
                            onClick={() => setSelectedPlanId(p.id)}
                          >
                            {cls?.name ?? "Class"} —{" "}
                            <Badge variant="outline" className="ml-1 text-xs">
                              superseded
                            </Badge>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedPlan
                ? `${(selectedPlan.classes as { name?: string } | null)?.name ?? "Class"} fee breakdown`
                : "Select or create a plan"}
            </CardTitle>
            {selectedPlan && (
              <CardDescription>
                Status: {selectedPlan.status} · Total across terms: ₹{total.toLocaleString()}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedPlan?.status === "rejected" && selectedPlan.rejection_notes && (
              <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Rejected by VP</p>
                  <p className="text-muted-foreground mt-1">{selectedPlan.rejection_notes}</p>
                </div>
              </div>
            )}

            {!selectedPlanId ? (
              <p className="text-muted-foreground text-sm">Choose a plan from the list or create one.</p>
            ) : !canEditSelected ? (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  This plan is {selectedPlan?.status} and cannot be edited.
                </p>
                {selectedPlanId && (
                  <ClassYearlyFeePlanSummary planId={selectedPlanId} />
                )}
              </div>
            ) : (
              <>
                {terms.map((term, ti) => (
                  <div key={term.id ?? ti} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="grid sm:grid-cols-3 gap-2 flex-1">
                      <div>
                        <Label className="text-xs">Term</Label>
                        <Input
                          value={term.term_label}
                          onChange={(e) => {
                            const next = [...terms]
                            next[ti] = { ...next[ti], term_label: e.target.value }
                            setTerms(next)
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Default due date</Label>
                        <Input
                          type="date"
                          value={term.due_date}
                          onChange={(e) => {
                            const val = e.target.value
                            const next = [...terms]
                            next[ti] = {
                              ...next[ti],
                              due_date: val,
                              items: next[ti].items.map((item) =>
                                item.amount > 0 && !item.due_date ? { ...item, due_date: val } : item,
                              ),
                            }
                            setTerms(next)
                          }}
                        />
                      </div>
                      </div>
                      {terms.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive shrink-0"
                          onClick={async () => {
                            if (term.id) {
                              try {
                                await deleteFeePlanTerm(term.id)
                              } catch (e: unknown) {
                                toast.error(e instanceof Error ? e.message : "Could not delete term")
                                return
                              }
                            }
                            setTerms(terms.filter((_, i) => i !== ti))
                            qc.invalidateQueries({ queryKey: ["fee-plan-detail", selectedPlanId] })
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {term.items.map((item, ii) => (
                      <div key={ii} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-end">
                        <div>
                          <Label className="text-xs">Category</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            value={item.fee_category}
                            onChange={(e) => {
                              const next = [...terms]
                              next[ti].items[ii] = {
                                ...next[ti].items[ii],
                                fee_category: e.target.value as FeeCategory,
                              }
                              setTerms(next)
                            }}
                          >
                            {FEE_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {item.fee_category === "other" ? (
                          <div>
                            <Label className="text-xs">Label</Label>
                            <Input
                              placeholder="Describe fee"
                              value={item.custom_label}
                              onChange={(e) => {
                                const next = [...terms]
                                next[ti].items[ii] = { ...next[ti].items[ii], custom_label: e.target.value }
                                setTerms(next)
                              }}
                            />
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground pb-2">
                            {feeCategoryLabel(item.fee_category)}
                          </div>
                        )}
                        <div>
                          <Label className="text-xs">Amount</Label>
                          <Input
                            type="number"
                            placeholder="Amount"
                            value={item.amount || ""}
                            onChange={(e) => {
                              const amount = Number(e.target.value) || 0
                              const next = [...terms]
                              next[ti].items[ii] = {
                                ...next[ti].items[ii],
                                amount,
                                due_date:
                                  amount > 0 && !next[ti].items[ii].due_date
                                    ? term.due_date
                                    : next[ti].items[ii].due_date,
                              }
                              setTerms(next)
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Due date</Label>
                          <Input
                            type="date"
                            value={item.due_date}
                            onChange={(e) => {
                              const next = [...terms]
                              next[ti].items[ii] = { ...next[ti].items[ii], due_date: e.target.value }
                              setTerms(next)
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive"
                          disabled={term.items.length <= 1}
                          onClick={() => {
                            const next = [...terms]
                            next[ti].items = next[ti].items.filter((_, i) => i !== ii)
                            setTerms(next)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = [...terms]
                        next[ti].items.push({
                          fee_category: "tuition",
                          custom_label: "",
                          amount: 0,
                          due_date: term.due_date,
                        })
                        setTerms(next)
                      }}
                    >
                      Add line item
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setTerms([
                      ...terms,
                      {
                        term_order: terms.length + 1,
                        term_label: `Term ${terms.length + 1}`,
                        due_date: "",
                        items: [{ fee_category: "tuition", custom_label: "", amount: 0, due_date: "" }],
                      },
                    ])
                  }
                >
                  Add term
                </Button>
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                    {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Save draft
                  </Button>
                  <Button variant="default" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
                    <Send className="h-4 w-4 mr-1" /> Submit to VP
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {selectedPlanId && terms.length > 0 && (
          <Card className="lg:col-span-3">
            <ClassYearlyFeePlanSummary
              planId={canEditSelected ? undefined : selectedPlanId}
              draftTerms={canEditSelected ? draftYearlyTerms : undefined}
              title="Yearly summary"
            />
          </Card>
        )}
      </div>

      <Dialog open={!!deletePlanId} onOpenChange={(open) => !open && setDeletePlanId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete draft fee plan?</DialogTitle>
            <DialogDescription>
              This permanently removes the draft and all its terms. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePlanId(null)} disabled={deletePlanMut.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletePlanMut.isPending}
              onClick={() => {
                if (deletePlanId) {
                  deletePlanMut.mutate(deletePlanId, {
                    onSettled: () => setDeletePlanId(null),
                  })
                }
              }}
            >
              {deletePlanMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
