import type { HTMLMotionProps } from "framer-motion"
import type { Variants } from "framer-motion"

/** Page shell: fade + slight rise (disabled when reduced motion). */
export function getPageVariants(reduced: boolean): Variants {
  if (reduced) {
    return { hidden: { opacity: 1 }, visible: { opacity: 1 } }
  }
  return {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
    },
  }
}

export function getStaggerContainer(reduced: boolean): Variants {
  if (reduced) {
    return { hidden: {}, visible: {} }
  }
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.08, delayChildren: 0.04 },
    },
  }
}

export function getStaggerItem(reduced: boolean): Variants {
  if (reduced) {
    return { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
  }
  return {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" },
    },
  }
}

/** Slightly snappier stagger (e.g. LMS catalog). */
export function getStaggerContainerLoose(reduced: boolean): Variants {
  if (reduced) {
    return { hidden: { opacity: 1 }, visible: { opacity: 1 } }
  }
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.04 },
    },
  }
}

export type CardHoverMotionProps = Pick<HTMLMotionProps<"div">, "whileHover" | "whileTap">

export function getCardHoverLiftProps(reduced: boolean): CardHoverMotionProps {
  if (reduced) return {}
  return {
    whileHover: { y: -3, transition: { duration: 0.2 } },
    whileTap: { scale: 0.99 },
  }
}
