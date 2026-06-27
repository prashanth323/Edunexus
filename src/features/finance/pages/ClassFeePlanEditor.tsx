import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router-dom"
import { AlertCircle, Loader2, Plus, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getClassesForSchool } from "@/features/admissions/api/admissions.api"
import {
  createClassFeePlan,
  deleteClassFeePlan,
  deleteFeePlanTerm,
  getClassFeePlans,
  getFeePlanWithTerms,
  submitClassFeePlan,
  upsertFeePlanTerm,
  type FeePlanTerm,
  type FeePlanItemInput,
} from "../api/feePlans.api"
import { FEE_CATEGORIES, feeCategoryLabel, feeItemDisplayName, type FeeCategory } from "../lib/feeCategories"
import { supabase } from "@/lib/supabase"

type TermItemDraft = {
  fee_category: FeeCategory
  custom_label: string
  amount: number
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
    if (!t.due_date.trim()) return `Set a due date for ${t.term_label || "each term"}.`
    const validItems = t.items.filter((i) => i.amount > 0)
    if (!validItems.length) {
      return `Add fee line items with amounts for ${t.term_label || "each term"}.`
    }
    for (const item of validItems) {
      if (item.fee_category === "other" && !item.custom_label.trim()) {
        return `Enter a label for "Other" fee in ${t.term_label}.`
      }
    }
  }
  return null
}

function itemsToInput(items: TermItemDraft[]): FeePlanItemInput[] {
  return items.map((i) => ({
    fee_category: i.fee_category,
    custom_label: i.fee_category === "other" ? i.custom_label : null,
    amount: i.amount,
  }))
}

function mapLoadedItem(item: { fee_category?: string; custom_label?: string | null; name?: string; amount: number }): TermItemDraft {
  const cat = (item.fee_category as FeeCategory) || "tuition"
  return {
    fee_category: cat,
    custom_label: item.custom_label ?? (cat === "other" ? item.name ?? "" : ""),
    amount: Number(item.amount),
  }
}

export function ClassFeePlanEditor() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const qc = useQueryClient()
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [terms, setTerms] = useState<TermDraft[]>([])
  const [newClassId, setNewClassId] = useState("")

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

  const filteredPlans = useMemo(() => {
    switch (activeTab) {
      case "pending":
        return plans.filter((p) => p.status === "pending_vp")
      case "approved":
        return plans.filter((p) => p.status === "approved" || p.status === "superseded")
      default:
        return plans.filter((p) => p.status === "draft" || p.status === "rejected")
    }
  }, [plans, activeTab])

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  )

  useQuery({
    queryKey: ["fee-plan-detail", selectedPlanId],
    queryFn: async () => {
      const { terms: loaded } = await getFeePlanWithTerms(selectedPlanId!)
      setTerms(
        loaded.map((t: FeePlanTerm) => ({
          id: t.id,
          term_order: t.term_order,
          term_label: t.term_label,
          due_date: t.due_date ?? "",
          items: (t.items ?? []).map(mapLoadedItem),
        })),
      )
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
          items: [{ fee_category: "tuition", custom_label: "", amount: 0 }],
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

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selectedPlanId) return
      for (const t of terms) {
        await upsertFeePlanTerm(
          selectedPlanId,
          {
            id: t.id,
            term_order: t.term_order,
            term_label: t.term_label,
            due_date: t.due_date || null,
          },
          itemsToInput(t.items.filter((i) => i.amount > 0 || i.fee_category)),
        )
      }
    },
    onSuccess: () => {
      toast.success("Plan saved")
      qc.invalidateQueries({ queryKey: ["class-fee-plans", activeSchoolId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submitMut = useMutation({
    mutationFn: async () => {
      const err = validateTermsForSubmit(terms)
      if (err) throw new Error(err)
      if (!selectedPlanId) throw new Error("Select a plan")
      for (const t of terms) {
        await upsertFeePlanTerm(
          selectedPlanId,
          {
            id: t.id,
            term_order: t.term_order,
            term_label: t.term_label,
            due_date: t.due_date || null,
          },
          itemsToInput(t.items.filter((i) => i.amount > 0)),
        )
      }
      await submitClassFeePlan(selectedPlanId)
    },
    onSuccess: () => {
      toast.success("Submitted to VP for approval")
      qc.invalidateQueries({ queryKey: ["class-fee-plans", activeSchoolId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const total = terms.reduce(
    (sum, t) => sum + t.items.reduce((s, i) => s + (Number(i.amount) || 0), 0),
    0,
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
              ? "1. Pick class → 2. Add terms & fee lines → 3. Save draft → 4. Submit to VP"
              : "View term-wise class fee plans for this school."}
          </p>
        </div>
        {canSeeVpApprovals && (
          <Button variant="outline" asChild>
            <Link to="/finance/fee-approvals">VP approvals</Link>
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
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["drafts", "Drafts"],
                  ["pending", "Pending VP"],
                  ["approved", "Approved"],
                ] as const
              ).map(([tab, label]) => (
                <Button
                  key={tab}
                  type="button"
                  size="sm"
                  variant={activeTab === tab ? "default" : "outline"}
                  onClick={() => setTab(tab)}
                >
                  {label}
                </Button>
              ))}
            </div>
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
                          onClick={() => {
                            if (window.confirm("Delete this draft fee plan?")) {
                              deletePlanMut.mutate(p.id)
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
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
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  This plan is {selectedPlan?.status} and cannot be edited.
                </p>
                {terms.map((term, ti) => (
                  <div key={ti} className="border rounded-lg p-3 text-sm space-y-1">
                    <p className="font-medium">
                      {term.term_label}
                      {term.due_date ? ` · due ${term.due_date}` : ""}
                    </p>
                    <ul className="text-muted-foreground">
                      {term.items.map((item, ii) => (
                        <li key={ii}>
                          {feeItemDisplayName(item)}: ₹{Number(item.amount).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
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
                        <Label className="text-xs">Due date</Label>
                        <Input
                          type="date"
                          value={term.due_date}
                          onChange={(e) => {
                            const next = [...terms]
                            next[ti] = { ...next[ti], due_date: e.target.value }
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
                      <div key={ii} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
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
                              const next = [...terms]
                              next[ti].items[ii] = {
                                ...next[ti].items[ii],
                                amount: Number(e.target.value) || 0,
                              }
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
                        next[ti].items.push({ fee_category: "tuition", custom_label: "", amount: 0 })
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
                        items: [{ fee_category: "tuition", custom_label: "", amount: 0 }],
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
      </div>
    </div>
  )
}
