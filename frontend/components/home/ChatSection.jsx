"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight, Paperclip, Sparkles, SplitSquareHorizontal } from "lucide-react"

const QUICK_CHIPS = ["Find cars under ₹15L", "Family 5-seater", "Best mileage", "Compare 2 variants"]

const ACTIONS = [
  { id: "upload", label: "Upload context", icon: Paperclip },
  { id: "compare", label: "Compare variants", icon: SplitSquareHorizontal },
  { id: "ask", label: "Ask agent", icon: Sparkles },
]

export function ChatSection() {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={reduceMotion ? false : { opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-10"
    >
      <div className="space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(255,91,53,0.3)] bg-[rgba(255,91,53,0.1)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[rgb(255,91,53)] animate-pulse" />
          <span className="text-xs font-bold tracking-widest text-[rgb(255,91,53)] uppercase">VariantWise AI</span>
        </div>
        
        <h1
          className="text-5xl sm:text-6xl lg:text-[4.5rem] font-normal leading-[0.95] tracking-[-0.02em] text-white"
          style={{
            textShadow: "0 0 40px rgba(255,255,255,0.08), 0 0 80px rgba(133,213,237,0.06)",
          }}
        >
          <span className="font-display">Intent to </span>
          <span
            className="font-headline italic"
            style={{
              color: "rgb(255,91,53)",
              textShadow: "0 0 30px rgba(255,91,53,0.5), 0 0 60px rgba(255,91,53,0.2)",
            }}
          >
            Variant
          </span>
          <br />
          <span className="font-display">in minutes.</span>
        </h1>
        
        <p className="text-[15px] text-[rgba(255,255,255,0.55)] max-w-xl leading-relaxed font-normal tracking-wide">
          The first AI consultant that understands models, trims, and real-world ownership experiences.
        </p>
      </div>

      {/* Hero prompt slab */}
      <div className="relative group">
        <div className="absolute -inset-1 rounded-[32px] bg-gradient-to-r from-[rgba(133,213,237,0.2)] via-transparent to-[rgba(255,91,53,0.1)] opacity-50 blur-xl group-hover:opacity-75 transition duration-1000" />
        
        <div className="vw-glass-hero rounded-[32px] p-8 border border-[rgba(255,255,255,0.1)] relative overflow-hidden">
          {/* Internal Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1 bg-[rgb(133,213,237)] blur-[4px] opacity-50" />
          
          <div className="relative space-y-8">
            {/* Main input area */}
            <div className="relative">
              <input
                type="text"
                placeholder="Tell me your car needs..."
                className="vw-input-hero pl-8 pr-8 shadow-inner"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <button className="p-2 rounded-full bg-[rgba(255,255,255,0.1)] hover:bg-[rgb(255,91,53)] text-white transition-all duration-300">
                  <ArrowUpRight size={20} />
                </button>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.id}
                    type="button"
                    className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)] transition-all group/btn"
                  >
                    <Icon size={18} className="text-[rgb(133,213,237)] group-hover/btn:scale-110 transition-transform" />
                    <span className="text-sm font-medium text-white">{action.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.1)] to-transparent" />

            {/* CTA & Chips */}
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {QUICK_CHIPS.map((chip) => (
                  <Link
                    key={chip}
                    href="/consultant"
                    className="px-4 py-2 rounded-lg text-xs font-medium text-[rgba(255,255,255,0.45)] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(133,213,237,0.3)] hover:text-white transition-colors cursor-pointer"
                  >
                    {chip}
                  </Link>
                ))}
              </div>
              
              <div className="flex flex-wrap gap-4">
                <Link href="/consultant" className="vw-btn-primary shadow-[0_0_30px_-5px_rgba(255,91,53,0.4)]">
                  Start Consultation
                  <ArrowUpRight size={18} />
                </Link>
                <Link href="/dashboard" className="vw-btn-secondary">
                  Browse Showroom
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
