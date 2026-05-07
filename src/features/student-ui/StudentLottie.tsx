import { useReducedMotion } from "framer-motion"
import { useLottie } from "lottie-react"
import { useEffect, useState, type ReactNode } from "react"

type StudentLottieProps = {
  /** Absolute or site-root path, e.g. `/lottie/student/foo.json` */
  src: string
  className?: string
  /** Pixel height; width follows animation aspect via lottie-react */
  height?: number
  loop?: boolean
  /** Shown while loading JSON or when `prefers-reduced-motion` is on */
  fallback?: ReactNode
}

export function StudentLottie({
  src,
  className,
  height = 128,
  loop = true,
  fallback = null,
}: StudentLottieProps) {
  const reduceMotion = useReducedMotion()
  const [data, setData] = useState<object | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(src)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [src])

  const options = {
    animationData: data,
    loop: loop,
    autoplay: true,
  }

  const { View } = useLottie(options, { height: "100%", width: "100%" })

  if (reduceMotion) return <>{fallback}</>
  if (!data) return <>{fallback}</>

  return (
    <div className={className} style={{ height, width: height * 1.15 }}>
      {View}
    </div>
  )
}
