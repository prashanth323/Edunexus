export const FEE_CATEGORIES = [
  { value: "tuition", label: "Tuition" },
  { value: "hostel", label: "Hostel" },
  { value: "books", label: "Books" },
  { value: "miscellaneous", label: "Miscellaneous" },
  { value: "other", label: "Other" },
] as const

export type FeeCategory = (typeof FEE_CATEGORIES)[number]["value"]

export function feeCategoryLabel(
  category: string | null | undefined,
  customLabel?: string | null,
): string {
  if (category === "other") return customLabel?.trim() || "Other"
  const found = FEE_CATEGORIES.find((c) => c.value === category)
  return found?.label ?? category ?? "Fee"
}

export function feeItemDisplayName(item: {
  fee_category?: string
  custom_label?: string | null
  name?: string
}): string {
  if (item.fee_category) return feeCategoryLabel(item.fee_category, item.custom_label)
  return item.name?.trim() || "Fee"
}
