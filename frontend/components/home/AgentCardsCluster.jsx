"use client"

import { motion, useReducedMotion } from "framer-motion"
import { BrainCircuit, Database, LineChart } from "lucide-react"

const AGENT_CARDS = [
  {
    id: "preference",
    title: "Preference agent",
    summary: "Turns your answers into a clear car profile.",
    pill: "Active",
    icon: BrainCircuit,
    rgb: "255, 91, 53",
    desktopClass: "top-0 left-0",
  },
  {
    id: "rag",
    title: "RAG agent",
    summary: "Grounds answers from indexed reviews and specs.",
    pill: "Grounded",
    icon: Database,
    rgb: "133, 213, 237",
    desktopClass: "top-[220px] right-0",
  },
  {
    id: "ranking",
    title: "Scoring agent",
    summary: "Scores top variants and explains why.",
    pill: "Top 5 ready",
    icon: LineChart,
    rgb: "160, 120, 240",
    desktopClass: "top-[440px] left-0",
  },
]

function AgentCard({ card, index, className = "" }) {
  const reduceMotion = useReducedMotion()
  const Icon = card.icon

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
      animate={reduceMotion ? false : { opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.62,
        ease: [0.16, 1, 0.3, 1],
        delay: index * 0.15,
      }}
      className={`group absolute w-[82%] ${className}`}
    >
      <div
        className="relative overflow-hidden rounded-[28px] p-7 backdrop-blur-3xl border transition-all duration-400 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
        style={{
          background: `linear-gradient(135deg, rgba(${card.rgb}, 0.08) 0%, rgba(22, 20, 32, 0.8) 62%)`,
          borderColor: `rgba(${card.rgb}, 0.2)`,
          boxShadow: `0 12px 40px rgba(0,0,0,0.4), 0 0 24px rgba(${card.rgb}, 0.05)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.08] group-hover:opacity-[0.16] transition-opacity duration-500"
          style={{ background: `linear-gradient(120deg, rgba(${card.rgb}, 1), transparent 58%)` }}
        />
        <div
          className="absolute top-0 left-0 w-full h-[1px] opacity-55"
          style={{ background: `linear-gradient(90deg, transparent 8%, rgba(${card.rgb}, 0.68) 50%, transparent 92%)` }}
        />

        <div className="relative flex items-start justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                className="flex items-center justify-center w-9 h-9 rounded-xl text-white"
                style={{
                  background: `rgba(${card.rgb}, 0.18)`,
                  border: `1px solid rgba(${card.rgb}, 0.32)`,
                  boxShadow: `0 0 12px rgba(${card.rgb}, 0.12)`,
                }}
              >
                <Icon size={17} />
              </span>
              <h3 className="text-xs font-bold tracking-[0.15em] uppercase text-[rgba(255,255,255,0.55)]">
                {card.title}
              </h3>
            </div>
            <p className="text-[17px] font-medium text-white leading-relaxed max-w-[280px]">
              {card.summary}
            </p>
          </div>

          <div
            className="px-3 py-1.5 rounded-full backdrop-blur-md flex-shrink-0"
            style={{
              background: `rgba(${card.rgb}, 0.12)`,
              border: `1px solid rgba(${card.rgb}, 0.25)`,
            }}
          >
            <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: `rgba(${card.rgb}, 1)` }}>
              {card.pill}
            </span>
          </div>
        </div>

        <div className="absolute bottom-5 right-6 opacity-[0.08]">
          <Icon size={60} strokeWidth={0.8} />
        </div>
      </div>
    </motion.div>
  )
}

function DesktopConnectors() {
  const reduceMotion = useReducedMotion()
  const duration = 2.2

  return (
    <svg className="absolute inset-0 h-full w-full pointer-events-none z-10" viewBox="0 0 620 680" preserveAspectRatio="none">
      <defs>
        <marker id="arrowWarm" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="rgba(255,91,53,0.65)" />
        </marker>
        <marker id="arrowCool" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="rgba(133,213,237,0.65)" />
        </marker>
      </defs>

      <motion.path
        d="M210 166 C 220 212, 315 204, 362 248"
        fill="none"
        stroke="rgba(255,91,53,0.58)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="1 12"
        markerEnd="url(#arrowWarm)"
        initial={reduceMotion ? { strokeDashoffset: 0 } : { strokeDashoffset: 0 }}
        animate={reduceMotion ? {} : { strokeDashoffset: [-26, 0] }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      />

      <motion.path
        d="M362 388 C 348 448, 254 442, 208 484"
        fill="none"
        stroke="rgba(133,213,237,0.58)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="1 12"
        markerEnd="url(#arrowCool)"
        initial={reduceMotion ? { strokeDashoffset: 0 } : { strokeDashoffset: 0 }}
        animate={reduceMotion ? {} : { strokeDashoffset: [-26, 0] }}
        transition={{ duration, repeat: Infinity, ease: "linear", delay: 0.25 }}
      />
    </svg>
  )
}

function MobileStack() {
  const reduceMotion = useReducedMotion()

  return (
    <div className="space-y-4 lg:hidden">
      {AGENT_CARDS.map((card, index) => {
        const Icon = card.icon
        const isLast = index === AGENT_CARDS.length - 1
        return (
          <div key={card.id}>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={reduceMotion ? false : { opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: index * 0.1 }}
              className="relative overflow-hidden rounded-2xl p-5 border"
              style={{
                background: `linear-gradient(135deg, rgba(${card.rgb}, 0.08) 0%, rgba(22, 20, 32, 0.8) 62%)`,
                borderColor: `rgba(${card.rgb}, 0.2)`,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `rgba(${card.rgb}, 0.2)` }}>
                      <Icon size={15} />
                    </span>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[rgba(255,255,255,0.55)] font-bold">{card.title}</p>
                  </div>
                  <p className="text-[15px] leading-relaxed text-white/90">{card.summary}</p>
                </div>
                <span className="text-[9px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full" style={{ color: `rgba(${card.rgb}, 1)`, background: `rgba(${card.rgb}, 0.12)` }}>
                  {card.pill}
                </span>
              </div>
            </motion.div>
            {!isLast && (
              <div className="h-8 flex justify-center">
                <motion.div
                  className="w-[1px] h-full"
                  style={{
                    background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(255,255,255,0.55) 2px, transparent 2px, transparent 10px)",
                  }}
                  animate={reduceMotion ? {} : { opacity: [0.25, 0.9, 0.25] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: index * 0.2 }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function AgentCardsCluster() {
  return (
    <div className="relative w-full max-w-xl mx-auto lg:ml-auto">
      <MobileStack />

      <div className="relative hidden lg:block h-[660px]">
        <DesktopConnectors />
        {AGENT_CARDS.map((card, index) => (
          <AgentCard key={card.id} card={card} index={index} className={card.desktopClass} />
        ))}
      </div>
    </div>
  )
}

