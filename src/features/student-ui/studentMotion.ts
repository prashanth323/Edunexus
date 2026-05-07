import {
  getCardHoverLiftProps,
  getPageVariants,
  getStaggerContainer,
  getStaggerContainerLoose,
  getStaggerItem,
} from "@/lib/ui-motion"

export type { CardHoverMotionProps } from "@/lib/ui-motion"

export { getCardHoverLiftProps, getStaggerContainer, getStaggerContainerLoose, getStaggerItem }

/** Alias for student-facing screens; same as `getPageVariants`. */
export function getStudentPageVariants(reduced: boolean) {
  return getPageVariants(reduced)
}
