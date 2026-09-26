import { useEffect, useRef, type ReactNode } from "react"
import { motion, useScroll, useSpring, useTransform } from "motion/react"
import { cn } from "@/lib/utils"

// The controls column. Themed scrollbar, plus a garnet progress line and a soft
// fade along the top that only appear once you have scrolled.
export function ScrollPanel({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress, scrollY } = useScroll({ container: ref })
  const progress = useSpring(scrollYProgress, { stiffness: 260, damping: 32, restDelta: 0.001 })
  const topFade = useTransform(scrollY, [0, 24], [0, 1])

  // Set as an attribute, not state, so scrolling never re-renders the controls.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let timer: number | undefined
    const onScroll = () => {
      el.setAttribute("data-scrolling", "")
      window.clearTimeout(timer)
      timer = window.setTimeout(() => el.removeAttribute("data-scrolling"), 700)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      el.removeEventListener("scroll", onScroll)
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 origin-left rounded-full bg-primary"
        style={{ scaleX: progress, opacity: topFade }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-background to-transparent"
        style={{ opacity: topFade }}
      />
      <div ref={ref} className={cn("themed-scroll", className)}>
        {children}
      </div>
    </div>
  )
}
