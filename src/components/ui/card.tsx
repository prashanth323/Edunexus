import * as React from "react"

import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from "framer-motion"

import { cn } from "@/lib/utils"
import { getStaggerContainer } from "@/lib/ui-motion"

const Card = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, whileHover: whileHoverProp, whileTap: whileTapProp, ...props }, ref) => {
    const reduce = useReducedMotion()
    const whileHover = reduce ? undefined : (whileHoverProp ?? { y: -2, transition: { duration: 0.2 } })
    const whileTap = reduce ? undefined : (whileTapProp ?? { scale: 0.99 })

    return (
      <motion.div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          className,
        )}
        whileHover={whileHover}
        whileTap={whileTap}
        {...props}
      />
    )
  },
)
Card.displayName = "Card"

type CardGridProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children: React.ReactNode
  /** Override default stagger container variants (`getStaggerContainer` shape or e.g. `getStaggerContainerLoose`). */
  staggerVariants?: Variants
}

const CardGrid = React.forwardRef<HTMLDivElement, CardGridProps>(
  (
    {
      className,
      initial = "hidden",
      animate = "visible",
      variants,
      staggerVariants,
      children,
      ...props
    },
    ref,
  ) => {
    const reduce = useReducedMotion()
    const containerVariants =
      variants ?? staggerVariants ?? getStaggerContainer(!!reduce)

    return (
      <motion.div
        ref={ref}
        className={cn(className)}
        variants={containerVariants}
        initial={initial}
        animate={animate}
        {...props}
      >
        {children}
      </motion.div>
    )
  },
)
CardGrid.displayName = "CardGrid"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardGrid,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
