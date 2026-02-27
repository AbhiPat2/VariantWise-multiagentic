"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Database,
  Gauge,
  GitBranch,
  ListChecks,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react"

const AGENT_ACTIVATION_ORDER = [
  "preference_extraction",
  "variant_pruning",
  "car_matchmaker",
  "tradeoff_negotiator",
  "advanced_reasoning",
  "validation",
  "scoring_engine",
  "context_awareness",
  "explanation",
]

const AGENT_WORKFLOW_NODES = [
  {
    id: "preference_extraction",
    title: "Preference Extraction",
    subtitle: "PreferenceExtractionAgent",
    description: "Intent -> hard and soft constraints.",
    status: "Active",
    icon: BrainCircuit,
    accent: "255,91,53",
    row: 0,
    col: 0,
    activity: [
      "Parsing strict and soft constraints...",
      "Resolving include/exclude brand rules...",
      "Committing user control priorities...",
    ],
  },
  {
    id: "variant_pruning",
    title: "Variant Pruning",
    subtitle: "VariantPruningAgent",
    description: "Removes low-fit candidates early.",
    status: "Filtering",
    icon: ListChecks,
    accent: "255,91,53",
    row: 0,
    col: 1,
    activity: [
      "Applying strict filter constraints...",
      "Preserving compromise candidates...",
      "Re-checking candidate validity...",
    ],
  },
  {
    id: "car_matchmaker",
    title: "Car Matchmaker",
    subtitle: "CarMatchmakerAgent",
    description: "Builds graph-path candidate sets.",
    status: "Matching",
    icon: Target,
    accent: "133,213,237",
    row: 0,
    col: 2,
    activity: [
      "Scoring graph-path matches...",
      "Selecting final candidate pool...",
      "Tracing nearest alternatives...",
    ],
  },
  {
    id: "tradeoff_negotiator",
    title: "Trade-off Negotiator",
    subtitle: "TradeOffNegotiatorAgent",
    description: "Surfaces compromise logic.",
    status: "Negotiating",
    icon: GitBranch,
    accent: "133,213,237",
    row: 0,
    col: 3,
    activity: [
      "Preparing why-not alternatives...",
      "Computing comfort-cost deltas...",
      "Highlighting conflict resolution...",
    ],
  },
  {
    id: "advanced_reasoning",
    title: "Advanced Reasoning",
    subtitle: "AdvancedReasoningAgent",
    description: "Runs critique and confidence checks.",
    status: "Reasoning",
    icon: Sparkles,
    accent: "160,120,240",
    row: 1,
    col: 0,
    activity: [
      "Running consensus critique...",
      "Publishing uncertainty flags...",
      "Scoring rationale stability...",
    ],
  },
  {
    id: "validation",
    title: "Validation & Sanity",
    subtitle: "ValidationAndSanityAgent",
    description: "Enforces output quality barriers.",
    status: "Validated",
    icon: ShieldCheck,
    accent: "160,120,240",
    row: 1,
    col: 1,
    activity: [
      "Dropping unstable outputs...",
      "Balancing quality thresholds...",
      "Applying hard sanity checks...",
    ],
  },
  {
    id: "scoring_engine",
    title: "Scoring Engine",
    subtitle: "Semantic + Path + Diversity",
    description: "Blends weighted fit and controls.",
    status: "Re-ranking",
    icon: Gauge,
    accent: "80,200,180",
    row: 1,
    col: 2,
    activity: [
      "Re-ranking after trade-off updates...",
      "Applying strict control penalties...",
      "Stabilizing shortlist confidence...",
    ],
  },
  {
    id: "context_awareness",
    title: "Context Awareness",
    subtitle: "ContextAwarenessAgent",
    description: "Injects history and rejection memory.",
    status: "Contextual",
    icon: Database,
    accent: "133,213,237",
    row: 1,
    col: 3,
    activity: [
      "Applying rejection-memory signals...",
      "Adjusting context-aware penalties...",
      "Tracking recent user behavior...",
    ],
  },
  {
    id: "explanation",
    title: "Explanation",
    subtitle: "ExplanationAgent",
    description: "Generates why and why-not traces.",
    status: "Explaining",
    icon: Workflow,
    accent: "160,120,240",
    row: 2,
    col: "center",
    activity: [
      "Attaching graph paths to scores...",
      "Building grounded explanation traces...",
      "Finalizing transparent reasoning...",
    ],
  },
]

const AGENT_WORKFLOW_EDGES = [
  { from: "preference_extraction", to: "variant_pruning", accent: "255,91,53", order: 0, duration: 2.8, delay: 0 },
  { from: "variant_pruning", to: "car_matchmaker", accent: "133,213,237", order: 1, duration: 2.8, delay: 0.14 },
  { from: "car_matchmaker", to: "tradeoff_negotiator", accent: "133,213,237", order: 2, duration: 2.9, delay: 0.22 },
  { from: "tradeoff_negotiator", to: "advanced_reasoning", accent: "160,120,240", order: 3, duration: 3.3, delay: 0.3 },
  { from: "advanced_reasoning", to: "validation", accent: "160,120,240", order: 4, duration: 2.8, delay: 0.38 },
  { from: "validation", to: "scoring_engine", accent: "80,200,180", order: 5, duration: 2.8, delay: 0.46 },
  { from: "scoring_engine", to: "context_awareness", accent: "133,213,237", order: 6, duration: 2.8, delay: 0.54 },
  { from: "context_awareness", to: "explanation", accent: "160,120,240", order: 7, duration: 3.1, delay: 0.62 },
  { from: "preference_extraction", to: "advanced_reasoning", accent: "255,91,53", secondary: true },
  { from: "variant_pruning", to: "validation", accent: "160,120,240", secondary: true },
  { from: "car_matchmaker", to: "scoring_engine", accent: "80,200,180", secondary: true },
  { from: "tradeoff_negotiator", to: "context_awareness", accent: "133,213,237", secondary: true },
  { from: "scoring_engine", to: "explanation", accent: "80,200,180", secondary: true },
]

const FLOW_STEPS = [
  { id: "chat", title: "Intent captured", copy: "Preference extraction", icon: Sparkles },
  { id: "scan", title: "Review scan", copy: "RAG retrieval", icon: Database },
  { id: "weight", title: "Constraint weighting", copy: "Priority balancing", icon: Workflow },
  { id: "score", title: "Variant scoring", copy: "Fit + confidence", icon: Gauge },
  { id: "ready", title: "Shortlist ready", copy: "Decision support", icon: Target },
]


const VARIANT_POOL = [
  {
    name: "Hyundai Creta SX (O) Turbo AT",
    score: 92,
    confidence: "88%",
    readiness: "Decision-ready",
    tradeoff: "Trade-off: mileage lower than Fronx.",
  },
  {
    name: "Skoda Kushaq Prestige AT",
    score: 89,
    confidence: "81%",
    readiness: "Review trade-offs",
    tradeoff: "Trade-off: tighter rear space than Creta.",
  },
  {
    name: "Honda Elevate ZX CVT",
    score: 87,
    confidence: "79%",
    readiness: "Needs clarification",
    tradeoff: "Trade-off: fewer premium features than Creta.",
  },
]

const WEIGHT_BREAKDOWN = [
  { label: "Comfort", value: 32, accent: "133,213,237" },
  { label: "Mileage", value: 24, accent: "80,200,180" },
  { label: "Budget", value: 18, accent: "255,91,53" },
  { label: "Safety", value: 26, accent: "160,120,240" },
]


const ELIMINATION_STREAM = [
  { id: "s1", label: "Reject Sonet", detail: "Rear-seat comfort below weighted threshold", accent: "255,91,53" },
  { id: "s2", label: "Drop Brezza", detail: "Strict transmission rule failed", accent: "255,91,53" },
  { id: "s3", label: "Re-score Kushaq", detail: "Higher dynamics with rear-space compromise", accent: "160,120,240" },
  { id: "s4", label: "Promote Creta", detail: "Highest weighted fit after recalculation", accent: "245,245,245" },
]

const BACKGROUND_PARTICLES = [
  { left: "9%", top: "17%", size: 2.2, duration: 18 },
  { left: "24%", top: "41%", size: 1.8, duration: 15 },
  { left: "36%", top: "68%", size: 2.4, duration: 20 },
  { left: "52%", top: "24%", size: 1.8, duration: 16 },
  { left: "63%", top: "58%", size: 2.3, duration: 19 },
  { left: "76%", top: "33%", size: 1.7, duration: 17 },
  { left: "84%", top: "74%", size: 2.2, duration: 22 },
  { left: "92%", top: "47%", size: 1.6, duration: 14 },
]

function useLoopIndex(length, delayMs, reduceMotion) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduceMotion || length <= 1) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % length)
    }, delayMs)
    return () => clearInterval(timer)
  }, [delayMs, length, reduceMotion])

  return index
}

function useOnceThrough(length, delayMs, reduceMotion) {
  const [index, setIndex] = useState(0)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (reduceMotion) {
      setIndex(length - 1)
      setCompleted(true)
      return
    }
    if (completed || length <= 1) return
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = prev + 1
        if (next >= length) {
          setCompleted(true)
          return length - 1
        }
        return next
      })
    }, delayMs)
    return () => clearInterval(timer)
  }, [delayMs, length, reduceMotion, completed])

  return { index, completed }
}

function useSectionFocus(heroRef, agentsRef, flowRef, proofRef) {
  const [focusZone, setFocusZone] = useState("hero")
  const visibilityRef = useRef({ hero: 0, agents: 0, flow: 0, proof: 0 })

  useEffect(() => {
    const tracked = [
      { id: "hero", node: heroRef.current },
      { id: "agents", node: agentsRef.current },
      { id: "flow", node: flowRef.current },
      { id: "proof", node: proofRef.current },
    ].filter((entry) => entry.node)

    if (!tracked.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const zone = entry.target.getAttribute("data-zone")
          if (!zone) return
          visibilityRef.current[zone] = entry.isIntersecting ? entry.intersectionRatio : 0
        })

        let bestZone = "hero"
        let bestRatio = 0

        Object.entries(visibilityRef.current).forEach(([zone, ratio]) => {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestZone = zone
          }
        })

        if (bestRatio > 0.08) {
          setFocusZone(bestZone)
        }
      },
      {
        threshold: [0, 0.1, 0.24, 0.4, 0.56, 0.72, 0.88],
      },
    )

    tracked.forEach((entry) => {
      entry.node.setAttribute("data-zone", entry.id)
      observer.observe(entry.node)
    })

    return () => observer.disconnect()
  }, [heroRef, agentsRef, flowRef, proofRef])

  return focusZone
}

function useFlowScrollStage(sectionRef, stepsLength, reduceMotion) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (reduceMotion) {
      setStage(stepsLength - 1)
      return
    }

    let raf = 0

    const update = () => {
      const node = sectionRef.current
      if (!node) return

      const rect = node.getBoundingClientRect()
      const viewportHeight = window.innerHeight || 1

      const start = viewportHeight * 0.2
      const end = viewportHeight * 0.82
      const travel = Math.max(1, rect.height - (end - start))
      const raw = (start - rect.top) / travel
      const clamped = Math.min(1, Math.max(0, raw))
      const nextStage = Math.min(stepsLength - 1, Math.floor(clamped * stepsLength))

      setStage((prev) => (prev === nextStage ? prev : nextStage))
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [reduceMotion, sectionRef, stepsLength])

  return stage
}

function AtmosphericBackground({ reduceMotion, focusZone }) {
  const focusMap = {
    hero: "18%",
    agents: "42%",
    flow: "66%",
    proof: "84%",
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute inset-[-18%]"
        style={{
          background:
            "radial-gradient(ellipse 76% 58% at 12% 10%, rgba(255,91,53,0.17), transparent 66%), radial-gradient(ellipse 74% 56% at 88% 12%, rgba(133,213,237,0.16), transparent 64%), radial-gradient(ellipse 72% 58% at 50% 100%, rgba(160,120,240,0.14), transparent 65%), linear-gradient(180deg, rgba(7,9,14,0.98), rgba(7,9,14,1))",
        }}
        animate={
          reduceMotion
            ? {}
            : {
                backgroundPosition: ["0% 0%", "6% 4%", "0% 0%"],
              }
        }
        transition={{ duration: 36, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute left-1/2 z-[1] h-[520px] w-[920px] -translate-x-1/2 rounded-full"
        style={{
          top: focusMap[focusZone],
          background: "radial-gradient(circle, rgba(245,245,245,0.14) 0%, rgba(245,245,245,0.04) 44%, transparent 76%)",
          filter: "blur(80px)",
        }}
        animate={
          reduceMotion
            ? {}
            : {
                top: focusMap[focusZone],
                opacity: [0.42, 0.64, 0.42],
              }
        }
        transition={{
          top: { duration: 1.15, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 7, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      <div
        className="absolute inset-0 z-[1] opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "62px 62px",
        }}
      />

      <div
        className="absolute inset-0 z-[1] opacity-[0.28]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(133,213,237,0.32) 1px, transparent 1.2px)",
          backgroundSize: "30px 30px",
        }}
      />

      <motion.div
        className="absolute inset-0 z-[1] opacity-[0.16]"
        style={{
          background:
            "linear-gradient(120deg, transparent 10%, rgba(133,213,237,0.22) 45%, transparent 82%), linear-gradient(56deg, transparent 24%, rgba(255,91,53,0.16) 58%, transparent 84%)",
        }}
        animate={reduceMotion ? {} : { x: ["-4%", "4%", "-4%"], y: ["0%", "2%", "0%"] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />

      {!reduceMotion &&
        BACKGROUND_PARTICLES.map((particle, index) => (
          <motion.span
            key={`particle-${index}`}
            className="absolute z-[2] rounded-full bg-[rgba(245,245,245,0.64)]"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              filter: "blur(0.2px)",
            }}
            animate={{ y: [0, -14, 0], opacity: [0.2, 0.75, 0.2] }}
            transition={{ duration: particle.duration, repeat: Infinity, ease: "easeInOut", delay: index * 0.2 }}
          />
        ))}

      <div className="absolute inset-0 z-[3] bg-[linear-gradient(180deg,rgba(7,9,14,0.35)_0%,rgba(7,9,14,0.16)_10%,rgba(7,9,14,0)_24%,rgba(7,9,14,0)_78%,rgba(7,9,14,0.48)_90%,rgba(7,9,14,0.86)_100%)]" />
      <div className="absolute inset-0 z-[3] bg-[linear-gradient(90deg,rgba(7,9,14,0.72)_0%,rgba(7,9,14,0.16)_11%,rgba(7,9,14,0)_24%,rgba(7,9,14,0)_76%,rgba(7,9,14,0.16)_89%,rgba(7,9,14,0.72)_100%)]" />
    </div>
  )
}

function HeroSection({ reduceMotion, sectionRef }) {
  return (
    <section ref={sectionRef} className="mx-auto max-w-7xl px-4 pb-24 pt-[176px]">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 28, filter: "blur(8px)" }}
        animate={reduceMotion ? false : { opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-4xl text-center"
      >
        <motion.div
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(133,213,237,0.24)] bg-[rgba(133,213,237,0.08)] px-3 py-1"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={reduceMotion ? false : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[rgb(133,213,237)]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(133,213,237)]">
            AI consultant for car buying
          </span>
        </motion.div>

        <motion.h1
          className="font-headline mt-6 text-5xl leading-[0.92] tracking-[-0.04em] text-white sm:text-6xl md:text-7xl"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={reduceMotion ? false : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          The intelligence layer for car buying.
        </motion.h1>

        <motion.p
          className="mx-auto mt-5 max-w-xl text-center text-[17px] leading-relaxed text-[rgba(255,255,255,0.6)]"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={reduceMotion ? false : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          Decisions for car buying. Computed, not suggested.
        </motion.p>

        <motion.div
          className="mt-7 flex flex-wrap items-center justify-center gap-4"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={reduceMotion ? false : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href="/consultant" className="vw-btn-primary px-7">
            Start Consultation
            <ArrowRight size={16} />
          </Link>
          <Link href="/dashboard" className="vw-btn-secondary">
            View Example Outputs
            <ArrowUpRight size={15} />
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 40, scale: 0.97 }}
        animate={reduceMotion ? false : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mt-20 max-w-[1060px]"
      >
        <ProductDemoWindow reduceMotion={reduceMotion} />
      </motion.div>
    </section>
  )
}

const DEMO_CHAT_FLOW = [
  { role: "user", text: "I need a comfortable SUV for city driving under ₹18 lakh. Family of 4, automatic only." },
  { role: "system", text: "Extracting preferences...", tag: "Preference Agent", accent: "255,91,53" },
  { role: "bot", text: "Got it. Looking for: Automatic SUV, budget ≤₹18L, priority comfort + city drive. Strict: auto transmission. Flexible: brand, fuel type." },
  { role: "system", text: "Scanning 38,412 review fragments...", tag: "RAG Agent", accent: "133,213,237" },
  { role: "bot", text: "3 variants match your profile. Running trade-off analysis now..." },
  { role: "system", text: "Scoring & ranking candidates...", tag: "Scoring Engine", accent: "80,200,180" },
  {
    role: "result",
    variants: [
      { name: "Hyundai Creta SX(O) Turbo AT", score: 92, reason: "Best city comfort + strong resale" },
      { name: "Skoda Kushaq Prestige AT", score: 89, reason: "Superior dynamics, tighter rear" },
      { name: "Honda Elevate ZX CVT", score: 87, reason: "Great ride, fewer features" },
    ],
  },
  { role: "bot", text: "Creta leads with 92 — best weighted match for city comfort within your budget. Kushaq trades rear space for driving feel. Want me to explain the trade-offs?" },
]

function ProductDemoWindow({ reduceMotion }) {
  const [visibleMessages, setVisibleMessages] = useState(0)
  const [demoComplete, setDemoComplete] = useState(false)
  const chatEndRef = useRef(null)
  const chatContainerRef = useRef(null)

  useEffect(() => {
    if (reduceMotion) {
      setVisibleMessages(DEMO_CHAT_FLOW.length)
      setDemoComplete(true)
      return
    }

    if (visibleMessages >= DEMO_CHAT_FLOW.length) {
      setDemoComplete(true)
      return
    }

    const msg = DEMO_CHAT_FLOW[visibleMessages]
    const delay = msg.role === "user" ? 1800 : msg.role === "system" ? 1200 : msg.role === "result" ? 2200 : 1600

    const timer = setTimeout(() => {
      setVisibleMessages((prev) => prev + 1)
    }, delay)

    return () => clearTimeout(timer)
  }, [visibleMessages, reduceMotion])

  useEffect(() => {
    const container = chatContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
    }
  }, [visibleMessages])

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        background: "linear-gradient(160deg, rgba(14,16,24,0.95), rgba(8,10,16,0.98))",
        borderColor: "rgba(255,255,255,0.12)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      {/* macOS title bar */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{
          background: "linear-gradient(180deg, rgba(30,32,42,0.95), rgba(22,24,34,0.95))",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[rgb(255,95,87)]" />
          <span className="h-3 w-3 rounded-full bg-[rgb(255,189,46)]" />
          <span className="h-3 w-3 rounded-full bg-[rgb(39,201,63)]" />
        </div>
        <div className="flex-1 text-center">
          <span className="text-[11px] font-medium text-[rgba(255,255,255,0.45)]">VariantWise Consultant</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[rgb(80,200,180)]" />
          <span className="text-[10px] font-semibold text-[rgb(80,200,180)]">Live</span>
        </div>
      </div>

      {/* Chat area */}
      <div ref={chatContainerRef} className="relative h-[520px] overflow-y-auto custom-scrollbar px-4 py-5 sm:px-6" style={{ scrollBehavior: "smooth", overscrollBehavior: "contain" }}>
        <div className="space-y-4">
          {DEMO_CHAT_FLOW.slice(0, visibleMessages).map((msg, idx) => (
            <motion.div
              key={idx}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {msg.role === "user" && (
                <div className="flex justify-end">
                  <div
                    className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-3"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,91,53,0.2), rgba(255,91,53,0.08))",
                      border: "1px solid rgba(255,91,53,0.25)",
                    }}
                  >
                    <p className="text-[13px] leading-relaxed text-white">{msg.text}</p>
                  </div>
                </div>
              )}

              {msg.role === "system" && (
                <div className="flex items-center gap-2 py-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full animate-pulse"
                    style={{ background: `rgb(${msg.accent})` }}
                  />
                  <span className="text-[11px] font-medium" style={{ color: `rgb(${msg.accent})` }}>{msg.tag}</span>
                  <span className="text-[11px] text-[rgba(255,255,255,0.45)]">{msg.text}</span>
                </div>
              )}

              {msg.role === "bot" && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-2.5 max-w-[85%]">
                    <span className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border border-[rgba(133,213,237,0.3)] bg-[rgba(133,213,237,0.12)]">
                      <Sparkles size={12} className="text-[rgb(133,213,237)]" />
                    </span>
                    <div
                      className="rounded-2xl rounded-bl-md px-4 py-3"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <p className="text-[13px] leading-relaxed text-[rgba(255,255,255,0.85)]">{msg.text}</p>
                    </div>
                  </div>
                </div>
              )}

              {msg.role === "result" && (
                <div className="ml-8 space-y-2">
                  {msg.variants.map((v) => (
                    <motion.div
                      key={v.name}
                      className="rounded-xl border px-3.5 py-2.5"
                      style={{
                        background: "linear-gradient(135deg, rgba(133,213,237,0.06), rgba(255,255,255,0.02))",
                        borderColor: "rgba(133,213,237,0.18)",
                      }}
                      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold text-white">{v.name}</p>
                        <span className="text-sm font-bold text-[rgb(133,213,237)]">{v.score}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.55)]">{v.reason}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}

          {!demoComplete && visibleMessages < DEMO_CHAT_FLOW.length && (
            <motion.div
              className="flex items-center gap-1.5 py-2"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[rgba(255,255,255,0.5)]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[rgba(255,255,255,0.4)]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[rgba(255,255,255,0.3)]" />
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div
        className="flex items-center gap-3 border-t px-4 py-3 sm:px-6"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background: "rgba(14,16,24,0.8)",
        }}
      >
        <MessageSquare size={16} className="flex-shrink-0 text-[rgba(255,255,255,0.3)]" />
        <div className="flex-1 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-2">
          <p className="text-[12px] text-[rgba(255,255,255,0.3)]">Tell me your car needs...</p>
        </div>
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(255,91,53,0.8)]">
          <Send size={14} className="text-white" />
        </span>
      </div>
    </div>
  )
}


function AgentWorkflowCanvas({ reduceMotion, activityIndex, sectionRef }) {
  const stageMap = useMemo(
    () =>
      AGENT_ACTIVATION_ORDER.reduce((acc, id, index) => {
        acc[id] = index
        return acc
      }, {}),
    [],
  )

  const nodesById = useMemo(
    () =>
      AGENT_WORKFLOW_NODES.reduce((acc, node) => {
        acc[node.id] = node
        return acc
      }, {}),
    [],
  )

  const { index: sequentialIndex, completed: flowCompleted } = useOnceThrough(AGENT_ACTIVATION_ORDER.length, 1200, reduceMotion)

  const CARD_W = 240
  const CARD_H = 210
  const GAP_X = 40
  const GAP_Y = 56
  const COLS = 4
  const gridWidth = COLS * CARD_W + (COLS - 1) * GAP_X
  const row0Y = 0
  const row1Y = CARD_H + GAP_Y
  const row2Y = 2 * (CARD_H + GAP_Y)
  const totalHeight = row2Y + CARD_H

  const edgesWithPath = useMemo(
    () => {
      const getCenter = (node) => {
        const cy = (node.row === 0 ? row0Y : node.row === 1 ? row1Y : row2Y) + CARD_H / 2
        if (node.col === "center") return { cx: gridWidth / 2, cy }
        return { cx: node.col * (CARD_W + GAP_X) + CARD_W / 2, cy }
      }

      return AGENT_WORKFLOW_EDGES.map((edge) => {
        const from = nodesById[edge.from]
        const to = nodesById[edge.to]
        if (!from || !to) return null

        const f = getCenter(from)
        const t = getCenter(to)

        const dx = t.cx - f.cx
        const dy = t.cy - f.cy
        const isHorizontal = Math.abs(dx) > Math.abs(dy)

        let path
        if (from.row === to.row) {
          const midX = (f.cx + t.cx) / 2
          path = `M ${f.cx} ${f.cy} C ${midX} ${f.cy - 30}, ${midX} ${t.cy - 30}, ${t.cx} ${t.cy}`
        } else if (from.row === 0 && to.row === 1 && from.col === to.col) {
          path = `M ${f.cx} ${f.cy + CARD_H / 2} C ${f.cx} ${f.cy + CARD_H / 2 + 40}, ${t.cx} ${t.cy - CARD_H / 2 - 40}, ${t.cx} ${t.cy - CARD_H / 2}`
        } else if (to.col === "center") {
          const midY = (f.cy + t.cy) / 2
          path = `M ${f.cx} ${f.cy + CARD_H / 2} C ${f.cx} ${midY + 20}, ${t.cx} ${midY - 20}, ${t.cx} ${t.cy - CARD_H / 2}`
        } else if (from.col === 3 && to.row > from.row && to.col === 0) {
          const dropY = f.cy + CARD_H / 2 + 16
          const riseY = t.cy - CARD_H / 2 - 16
          path = `M ${f.cx} ${f.cy + CARD_H / 2} C ${f.cx + 60} ${dropY + 50}, ${t.cx - 60} ${riseY - 50}, ${t.cx} ${t.cy - CARD_H / 2}`
        } else {
          const midX = (f.cx + t.cx) / 2
          const midY = (f.cy + t.cy) / 2
          const c1 = isHorizontal ? `${midX} ${f.cy}` : `${f.cx} ${midY}`
          const c2 = isHorizontal ? `${midX} ${t.cy}` : `${t.cx} ${midY}`
          path = `M ${f.cx} ${f.cy} C ${c1}, ${c2}, ${t.cx} ${t.cy}`
        }

        return { ...edge, from, to, path, fromCenter: f, toCenter: t }
      }).filter(Boolean)
    },
    [nodesById],
  )

  return (
    <section ref={sectionRef} data-zone="agents" className="relative mx-auto mt-36 max-w-[1200px] px-4 pb-28">
      <motion.div
        className="mb-10 max-w-3xl"
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.5)]">System Layer</p>
        <h2 className="font-headline mt-2 text-3xl text-white sm:text-[2.2rem]">Complete agent workflow. One decision loop.</h2>
        <p className="mt-2 text-sm text-[rgba(255,255,255,0.62)]">9 decision modules connected as a live pipeline.</p>
      </motion.div>

      {/* Desktop: CSS Grid layout */}
      <div className="relative mx-auto mt-8 hidden lg:block" style={{ height: totalHeight, maxWidth: gridWidth }}>
        <svg
          viewBox={`0 0 ${gridWidth} ${totalHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 z-0 h-full w-full"
          style={{ overflow: "visible" }}
        >
          <defs>
            {AGENT_WORKFLOW_EDGES.filter((e) => !e.secondary).map((edge) => (
              <linearGradient
                key={`grad-${edge.from}-${edge.to}`}
                id={`grad-${edge.from}-${edge.to}`}
                x1="0%" y1="0%" x2="100%" y2="0%"
              >
                <stop offset="0%" stopColor={`rgba(${nodesById[edge.from]?.accent || edge.accent},0.7)`} />
                <stop offset="100%" stopColor={`rgba(${nodesById[edge.to]?.accent || edge.accent},0.7)`} />
              </linearGradient>
            ))}
          </defs>

          {edgesWithPath.map((edge) => {
            const fromStage = stageMap[edge.from.id] ?? 0
            const toStage = stageMap[edge.to.id] ?? fromStage
            const isEnabled = flowCompleted ? true : edge.secondary
              ? fromStage <= sequentialIndex || toStage <= sequentialIndex
              : (edge.order ?? 0) <= sequentialIndex

            return (
              <motion.path
                key={`${edge.from.id}-${edge.to.id}`}
                d={edge.path}
                fill="none"
                stroke={
                  isEnabled
                    ? edge.secondary
                      ? `rgba(${edge.accent},0.15)`
                      : `url(#grad-${edge.from.id}-${edge.to.id})`
                    : `rgba(${edge.accent},0.08)`
                }
                strokeWidth={edge.secondary ? 1 : 1.5}
                strokeLinecap="round"
                strokeDasharray={edge.secondary ? "4 10" : "6 8"}
                animate={
                  reduceMotion
                    ? {}
                    : {
                        strokeDashoffset: [0, -28],
                        opacity: isEnabled ? [0.3, 0.65, 0.3] : [0.08, 0.15, 0.08],
                      }
                }
                transition={{ duration: edge.secondary ? 8 : 4, ease: "linear", repeat: Infinity, delay: edge.delay || 0 }}
              />
            )
          })}

          {!reduceMotion &&
            edgesWithPath
              .filter((edge) => !edge.secondary)
              .map((edge) => {
                const isEnabled = flowCompleted || (edge.order ?? 0) <= sequentialIndex
                if (!isEnabled) return null

                return (
                  <motion.circle
                    key={`dot-${edge.from.id}-${edge.to.id}`}
                    r="4"
                    fill={`rgba(${edge.accent},0.95)`}
                    style={{
                      filter: `drop-shadow(0 0 6px rgba(${edge.accent},0.8))`,
                    }}
                  >
                    <animateMotion
                      dur={`${(edge.duration || 2.8) + 1.5}s`}
                      repeatCount="indefinite"
                      begin={`${edge.delay || 0}s`}
                      path={edge.path}
                    />
                  </motion.circle>
                )
              })}
        </svg>

        {AGENT_WORKFLOW_NODES.map((node, index) => {
          const Icon = node.icon
          const stageIndex = stageMap[node.id] ?? AGENT_ACTIVATION_ORDER.length - 1
          const isActive = reduceMotion || flowCompleted ? true : stageIndex <= sequentialIndex
          const isCurrent = reduceMotion ? false : flowCompleted ? false : stageIndex === sequentialIndex
          const activityText = node.activity[(activityIndex + index) % node.activity.length]

          const top = node.row === 0 ? row0Y : node.row === 1 ? row1Y : row2Y
          const left = node.col === "center"
            ? (gridWidth - CARD_W) / 2
            : node.col * (CARD_W + GAP_X)

          return (
            <motion.article
              key={node.id}
              className="absolute z-[2] flex flex-col rounded-2xl border px-4 py-3.5"
              style={{
                width: CARD_W,
                height: CARD_H,
                left,
                top,
                background: isCurrent
                  ? `linear-gradient(145deg, rgba(${node.accent},0.18), rgba(13,15,22,0.7) 60%)`
                  : `linear-gradient(145deg, rgba(${node.accent},${isActive ? 0.09 : 0.03}), rgba(13,15,22,0.58) 64%)`,
                borderColor: isCurrent
                  ? `rgba(${node.accent},0.72)`
                  : isActive
                    ? `rgba(${node.accent},0.28)`
                    : "rgba(255,255,255,0.1)",
                boxShadow: isCurrent
                  ? `0 16px 40px rgba(0,0,0,0.35), 0 0 40px rgba(${node.accent},0.25), inset 0 1px 0 rgba(${node.accent},0.2)`
                  : isActive
                    ? `0 10px 22px rgba(0,0,0,0.3), 0 0 16px rgba(${node.accent},0.08), inset 0 1px 0 rgba(255,255,255,0.06)`
                    : "0 8px 18px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.04)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }}
              initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
              whileInView={reduceMotion ? {} : { opacity: isActive ? 1 : 0.5, y: isCurrent ? -3 : 0, scale: isCurrent ? 1.02 : 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 }}
            >
              {isCurrent && (
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(${node.accent},0.12), transparent 70%)`,
                  }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
              )}

              <div className="relative mb-3 flex items-center justify-between gap-2">
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border"
                  style={{
                    borderColor: `rgba(${node.accent},0.45)`,
                    background: `rgba(${node.accent},${isCurrent ? 0.28 : isActive ? 0.18 : 0.1})`,
                    boxShadow: isCurrent ? `0 0 12px rgba(${node.accent},0.3)` : "none",
                  }}
                >
                  <Icon size={13} style={{ color: isCurrent ? `rgb(${node.accent})` : "white" }} />
                </span>
                <span
                  className="rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.13em]"
                  style={{
                    color: `rgb(${node.accent})`,
                    borderColor: `rgba(${node.accent},0.34)`,
                    background: `rgba(${node.accent},0.12)`,
                  }}
                >
                  {node.status}
                </span>
              </div>

              <p className="relative text-[14px] font-semibold leading-tight tracking-[-0.01em] text-white">{node.title}</p>
              <p className="relative mt-1 text-[10px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.35)]">{node.subtitle}</p>
              <p className="relative mt-2 text-[11px] leading-relaxed text-[rgba(255,255,255,0.68)]">{node.description}</p>

              <div
                className="relative mt-auto rounded-lg border px-2.5 py-2"
                style={{
                  borderColor: isCurrent ? `rgba(${node.accent},0.2)` : "rgba(255,255,255,0.1)",
                  background: isCurrent ? `rgba(${node.accent},0.06)` : "rgba(255,255,255,0.03)",
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`${node.id}-${activityText}`}
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={reduceMotion ? false : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? {} : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="text-[10px]"
                    style={{ color: isCurrent ? `rgba(${node.accent},0.9)` : "rgba(255,255,255,0.72)" }}
                  >
                    {activityText}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.article>
          )
        })}
      </div>

      {/* Tablet: grid layout */}
      <div className="relative mt-6 hidden sm:block lg:hidden">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {AGENT_WORKFLOW_NODES.map((node, index) => {
            const Icon = node.icon
            const stageIndex = stageMap[node.id] ?? AGENT_ACTIVATION_ORDER.length - 1
            const isActive = reduceMotion || flowCompleted ? true : stageIndex <= sequentialIndex
            const isCurrent = !reduceMotion && !flowCompleted && stageIndex === sequentialIndex

            const activityText = node.activity[(activityIndex + index) % node.activity.length]

            return (
              <motion.div
                key={`tablet-${node.id}`}
                className="rounded-xl border p-3"
                style={{
                  background: isCurrent
                    ? `linear-gradient(145deg, rgba(${node.accent},0.16), rgba(14,16,22,0.7) 66%)`
                    : `linear-gradient(145deg, rgba(${node.accent},${isActive ? 0.08 : 0.04}), rgba(14,16,22,0.58) 66%)`,
                  borderColor: isCurrent ? `rgba(${node.accent},0.6)` : `rgba(${node.accent},${isActive ? 0.28 : 0.14})`,
                  boxShadow: isCurrent ? `0 0 24px rgba(${node.accent},0.2)` : "none",
                }}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                whileInView={reduceMotion ? {} : { opacity: isActive ? 1 : 0.6, y: isCurrent ? -2 : 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border"
                    style={{ borderColor: `rgba(${node.accent},0.38)`, background: `rgba(${node.accent},0.16)` }}
                  >
                    <Icon size={12} style={{ color: isCurrent ? `rgb(${node.accent})` : "white" }} />
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: `rgb(${node.accent})` }}>
                    {node.status}
                  </span>
                </div>
                <p className="text-[12px] font-semibold text-white">{node.title}</p>
                <p className="mt-1 text-[10px]" style={{ color: isCurrent ? `rgba(${node.accent},0.85)` : "rgba(255,255,255,0.62)" }}>
                  {activityText}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Mobile: timeline layout */}
      <div className="relative mt-6 space-y-3 sm:hidden">
        <div className="pointer-events-none absolute bottom-3 left-[11px] top-3 w-px bg-[linear-gradient(180deg,rgba(255,255,255,0.3),rgba(255,255,255,0.06))]" />
        {!reduceMotion && (
          <motion.div
            className="pointer-events-none absolute left-[7px] z-[2] h-2.5 w-2.5 rounded-full"
            style={{
              background: `rgba(${AGENT_WORKFLOW_NODES[sequentialIndex % AGENT_WORKFLOW_NODES.length].accent},0.95)`,
              boxShadow: `0 0 12px rgba(${AGENT_WORKFLOW_NODES[sequentialIndex % AGENT_WORKFLOW_NODES.length].accent},0.8)`,
            }}
            animate={{ top: ["2%", "98%"] }}
            transition={{ duration: 7.2, ease: "easeInOut", repeat: Infinity }}
          />
        )}

        {AGENT_ACTIVATION_ORDER.map((id, index) => {
          const node = nodesById[id]
          const Icon = node.icon
          const isActive = reduceMotion || flowCompleted ? true : index <= sequentialIndex
          const isCurrent = !reduceMotion && !flowCompleted && index === sequentialIndex
          const activityText = node.activity[(activityIndex + index) % node.activity.length]

          return (
            <motion.div
              key={`mobile-${node.id}`}
              className="relative pl-8"
              initial={reduceMotion ? false : { opacity: 0, x: -12 }}
              whileInView={reduceMotion ? {} : { opacity: isActive ? 1 : 0.65, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: index * 0.04 }}
            >
              <span
                className="absolute left-[4px] top-3.5 z-[1] inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border"
                style={{
                  borderColor: isCurrent ? `rgba(${node.accent},0.82)` : `rgba(${node.accent},${isActive ? 0.48 : 0.2})`,
                  background: isCurrent ? `rgba(${node.accent},0.35)` : `rgba(${node.accent},${isActive ? 0.24 : 0.08})`,
                  boxShadow: isCurrent ? `0 0 10px rgba(${node.accent},0.6)` : "none",
                }}
              />
              <div
                className="rounded-xl border p-3"
                style={{
                  background: isCurrent
                    ? `linear-gradient(145deg, rgba(${node.accent},0.15), rgba(16,18,26,0.6) 66%)`
                    : `linear-gradient(145deg, rgba(${node.accent},${isActive ? 0.1 : 0.04}), rgba(16,18,26,0.5) 66%)`,
                  borderColor: isCurrent ? `rgba(${node.accent},0.6)` : `rgba(${node.accent},${isActive ? 0.28 : 0.14})`,
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border"
                      style={{ borderColor: `rgba(${node.accent},0.38)`, background: `rgba(${node.accent},0.18)` }}
                    >
                      <Icon size={12} style={{ color: isCurrent ? `rgb(${node.accent})` : "white" }} />
                    </span>
                    <p className="text-[12px] font-semibold text-white">{node.title}</p>
                  </div>
                  <span className="text-[9px] uppercase tracking-[0.12em]" style={{ color: `rgb(${node.accent})` }}>
                    {node.status}
                  </span>
                </div>
                <p className="text-[10px]" style={{ color: isCurrent ? `rgba(${node.accent},0.85)` : "rgba(255,255,255,0.64)" }}>
                  {activityText}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

const FLOW_STEP_ACCENTS = [
  "255,91,53",
  "133,213,237",
  "160,120,240",
  "80,200,180",
  "133,213,237",
]

function FlowSection({ reduceMotion, sectionRef }) {
  const flowStage = useFlowScrollStage(sectionRef, FLOW_STEPS.length, reduceMotion)

  const railRowHeight = 114
  const railGap = 16
  const railOffset = 4
  const railTop = railOffset + flowStage * (railRowHeight + railGap) + railRowHeight / 2
  const currentAccent = FLOW_STEP_ACCENTS[flowStage] || "133,213,237"

  return (
    <section ref={sectionRef} data-zone="flow" className="mx-auto mt-36 max-w-7xl px-4 pb-24">
      <motion.div
        className="max-w-3xl pb-7"
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.5)]">How VariantWise Works</p>
        <h2 className="font-headline mt-3 text-3xl text-white sm:text-[2.15rem]">Chat {"->"} Shortlist {"->"} Reasoning {"->"} Decision</h2>
      </motion.div>

      <motion.div
        className="relative overflow-hidden rounded-3xl border p-5 sm:p-7"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: "linear-gradient(160deg, rgba(15,17,25,0.84), rgba(9,11,17,0.92))",
          borderColor: "rgba(255,255,255,0.12)",
          boxShadow: "0 22px 48px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_84px]">
          <div className="space-y-4">
            {FLOW_STEPS.map((step, index) => {
              const Icon = step.icon
              const isActive = index <= flowStage
              const isFocused = index === flowStage
              const accent = FLOW_STEP_ACCENTS[index] || "133,213,237"

              return (
                <motion.div
                  key={step.id}
                  className="relative h-[114px] overflow-hidden rounded-2xl border px-4 py-3.5 sm:px-5"
                  animate={
                    reduceMotion
                      ? {}
                      : {
                          opacity: isActive ? 1 : 0.65,
                          y: isFocused ? -3 : 0,
                          scale: isFocused ? 1.01 : 1,
                        }
                  }
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    borderColor: isFocused
                      ? `rgba(${accent},0.65)`
                      : isActive
                        ? `rgba(${accent},0.22)`
                        : "rgba(255,255,255,0.1)",
                    background: isFocused
                      ? `linear-gradient(128deg, rgba(${accent},0.12), rgba(255,255,255,0.02))`
                      : "rgba(255,255,255,0.03)",
                    boxShadow: isFocused
                      ? `0 14px 30px rgba(0,0,0,0.28), 0 0 28px rgba(${accent},0.2), inset 0 1px 0 rgba(${accent},0.15)`
                      : "0 8px 18px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  {isFocused && (
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
                      style={{ background: `linear-gradient(90deg, transparent 10%, rgba(${accent},0.6) 50%, transparent 90%)` }}
                    />
                  )}
                  <div className="relative mb-2.5 flex items-center justify-between">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                      style={{
                        borderColor: isFocused ? `rgba(${accent},0.6)` : isActive ? `rgba(${accent},0.32)` : "rgba(255,255,255,0.18)",
                        background: isFocused ? `rgba(${accent},0.2)` : isActive ? `rgba(${accent},0.1)` : "rgba(255,255,255,0.05)",
                        boxShadow: isFocused ? `0 0 12px rgba(${accent},0.25)` : "none",
                      }}
                    >
                      <Icon
                        size={15}
                        style={{ color: isFocused ? `rgb(${accent})` : isActive ? "white" : "rgba(255,255,255,0.56)" }}
                      />
                    </span>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{ color: isFocused ? `rgba(${accent},0.8)` : "rgba(255,255,255,0.45)" }}
                    >
                      0{index + 1}
                    </span>
                  </div>
                  <p
                    className="relative text-base font-semibold"
                    style={{ color: isFocused ? `rgb(${accent})` : isActive ? "white" : "rgba(255,255,255,0.7)" }}
                  >
                    {step.title}
                  </p>
                  <p className="relative text-xs text-[rgba(255,255,255,0.56)]">{step.copy}</p>
                </motion.div>
              )
            })}
          </div>

          <div className="relative hidden lg:block">
            <div className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.24),rgba(255,255,255,0.1))]" />
            <div className="flex h-full flex-col gap-4 py-1">
              {FLOW_STEPS.map((step, index) => {
                const isFocused = index === flowStage
                const isActive = index <= flowStage
                const accent = FLOW_STEP_ACCENTS[index] || "133,213,237"

                return (
                  <div key={`rail-${step.id}`} className="relative h-[114px]">
                    <span
                      className="absolute left-1/2 top-1/2 block h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                      style={{
                        borderColor: isFocused ? `rgba(${accent},0.85)` : isActive ? `rgba(${accent},0.4)` : "rgba(255,255,255,0.28)",
                        background: isFocused ? `rgba(${accent},0.5)` : isActive ? `rgba(${accent},0.18)` : "rgba(255,255,255,0.1)",
                        boxShadow: isFocused ? `0 0 14px rgba(${accent},0.65)` : "none",
                      }}
                    />
                  </div>
                )
              })}
            </div>

            <motion.span
              className="absolute left-1/2 h-[86px] w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                top: railTop,
                background: `linear-gradient(180deg, rgba(${currentAccent},0.15), rgba(${currentAccent},0.85), rgba(${currentAccent},0.15))`,
                boxShadow: `0 0 18px rgba(${currentAccent},0.6)`,
              }}
              animate={reduceMotion ? {} : { top: railTop }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </motion.div>
    </section>
  )
}

function ProductProof({ reduceMotion, sectionRef }) {
  return (
    <section ref={sectionRef} data-zone="proof" className="mx-auto mt-36 max-w-7xl px-4 pb-24">
      <motion.div
        className="mb-7 max-w-3xl"
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.5)]">Product Proof</p>
        <h2 className="font-headline mt-2 text-[2.2rem] leading-[1.05] tracking-[-0.03em] text-white sm:text-[2.65rem]">
          Decision telemetry. Not marketing claims.
        </h2>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.84, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[30px] border p-5 sm:p-7"
        style={{
          background: "linear-gradient(160deg, rgba(13,15,23,0.86), rgba(8,10,16,0.94))",
          borderColor: "rgba(255,255,255,0.12)",
          boxShadow: "0 22px 52px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div className="pointer-events-none absolute -left-16 top-0 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(255,91,53,0.18),transparent_70%)] blur-[46px]" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(133,213,237,0.18),transparent_70%)] blur-[44px]" />

        <div className="relative grid gap-4 xl:grid-cols-[1fr_1.3fr_1fr]">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <ListChecks size={15} className="text-white" />
              <p className="text-sm font-semibold text-white">Ranked outputs</p>
            </div>
            <div className="space-y-2.5">
              {VARIANT_POOL.map((item) => (
                <div key={item.name} className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-white">{item.name}</p>
                    <span className="text-sm font-semibold text-[rgb(133,213,237)]">{item.score}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.62)]">{item.tradeoff}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <GitBranch size={15} className="text-white" />
              <p className="text-sm font-semibold text-white">Decision engine console</p>
            </div>

            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[rgba(255,255,255,0.5)]">Constraint elimination timeline</p>
              <div className="mt-2 space-y-2.5">
                {ELIMINATION_STREAM.map((event, index) => (
                  <div key={event.id} className="relative pl-3.5">
                    <span
                      className="absolute left-0 top-[6px] h-1.5 w-1.5 rounded-full"
                      style={{ background: `rgba(${event.accent},0.95)`, boxShadow: `0 0 10px rgba(${event.accent},0.55)` }}
                    />
                    {index !== ELIMINATION_STREAM.length - 1 && (
                      <span className="absolute left-[2px] top-[10px] h-6 w-px bg-[rgba(255,255,255,0.2)]" />
                    )}
                    <p className="text-[11px] font-semibold text-white">{event.label}</p>
                    <p className="text-[10px] text-[rgba(255,255,255,0.58)]">{event.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[rgba(255,255,255,0.5)]">Reasoning snapshot</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <span className="rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[10px] text-[rgba(255,255,255,0.72)]">
                  Why-not generated for Sonet
                </span>
                <span className="rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[10px] text-[rgba(255,255,255,0.72)]">
                  Confidence stable after exclusions
                </span>
                <span className="rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[10px] text-[rgba(255,255,255,0.72)]">
                  Trade-off accepted: mileage vs comfort
                </span>
                <span className="rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[10px] text-[rgba(255,255,255,0.72)]">
                  Re-ranking completed in 1.6s
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Gauge size={15} className="text-white" />
              <p className="text-sm font-semibold text-white">Confidence resolution</p>
            </div>

            <div className="space-y-2.5">
              {WEIGHT_BREAKDOWN.map((item, index) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[rgba(255,255,255,0.66)]">{item.label}</span>
                    <span className="text-white">{item.value}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.1)]">
                    <motion.div
                      className="h-1.5 rounded-full"
                      style={{ background: `rgba(${item.accent},0.9)` }}
                      animate={reduceMotion ? { width: `${item.value}%` } : { width: [`${Math.max(8, item.value - 7)}%`, `${item.value}%`] }}
                      transition={{ duration: 1.1 + index * 0.14, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[rgba(255,255,255,0.5)]">Decision confidence</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">0.86</p>
              <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.62)]">Highest weighted match remains stable after conflict resolution.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

const TRUST_ITEMS = [
  { icon: ShieldCheck, accent: "133,213,237", title: "Variant-level precision", desc: "Trim and variant level decisioning." },
  { icon: Database, accent: "255,91,53", title: "Grounded in reviews", desc: "Answers tied to indexed specs and owner feedback." },
  { icon: Workflow, accent: "160,120,240", title: "Transparent scoring", desc: "Every shortlist ships with why and why-not traces." },
]

function TrustAndCTA({ reduceMotion }) {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          {TRUST_ITEMS.map((item, index) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.title}
                className="rounded-2xl border p-5"
                style={{
                  background: `linear-gradient(145deg, rgba(${item.accent},0.06), rgba(16,18,24,0.8))`,
                  borderColor: `rgba(${item.accent},0.16)`,
                }}
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                whileHover={reduceMotion ? {} : { y: -4, borderColor: `rgba(${item.accent},0.35)` }}
              >
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"
                  style={{
                    borderColor: `rgba(${item.accent},0.3)`,
                    background: `rgba(${item.accent},0.12)`,
                  }}
                >
                  <Icon size={17} style={{ color: `rgb(${item.accent})` }} />
                </span>
                <p className="mt-3 text-base font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-sm text-[rgba(255,255,255,0.6)]">{item.desc}</p>
              </motion.div>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-24">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.98 }}
          whileInView={reduceMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl border border-[rgba(255,91,53,0.18)] bg-[linear-gradient(145deg,rgba(18,20,28,0.9),rgba(9,11,16,0.94))] p-8 text-center sm:p-10"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-[linear-gradient(90deg,transparent_10%,rgba(255,91,53,0.4)_50%,transparent_90%)]" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(255,91,53,0.7)]">AI consultant for car buying</p>
          <h3 className="font-headline mx-auto mt-3 max-w-2xl text-3xl text-white sm:text-[2.15rem]">Start consultation. No signup barrier.</h3>
          <div className="mt-6 flex justify-center">
            <Link href="/consultant" className="vw-btn-primary px-7">
              Start Consultation
              <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>
      </section>
    </>
  )
}

export default function LandingPage() {
  const reduceMotion = useReducedMotion()

  const heroRef = useRef(null)
  const agentsRef = useRef(null)
  const flowRef = useRef(null)
  const proofRef = useRef(null)

  const agentActivityIndex = useLoopIndex(AGENT_WORKFLOW_NODES.length, 2400, reduceMotion)

  const focusZone = useSectionFocus(heroRef, agentsRef, flowRef, proofRef)

  return (
    <div className="relative min-h-screen overflow-x-hidden text-[rgb(var(--vw-text-strong))]">
      <AtmosphericBackground reduceMotion={reduceMotion} focusZone={focusZone} />

      <main className="relative z-10">
        <HeroSection reduceMotion={reduceMotion} sectionRef={heroRef} />
        <AgentWorkflowCanvas reduceMotion={reduceMotion} activityIndex={agentActivityIndex} sectionRef={agentsRef} />
        <FlowSection reduceMotion={reduceMotion} sectionRef={flowRef} />
        <ProductProof reduceMotion={reduceMotion} sectionRef={proofRef} />
        <TrustAndCTA reduceMotion={reduceMotion} />
      </main>
    </div>
  )
}
