"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { MessageSquare, Layers, ArrowRight, Zap } from "lucide-react"
import { ChatSection } from "@/components/home/ChatSection"
import { AgentCardsCluster } from "@/components/home/AgentCardsCluster"
import { MotionWrapper, AnimatedCard, AnimatedButton } from "@/components/motion"

const STEP_CARDS = [
  {
    title: "Chat with the AI",
    copy: "Tell the consultant what you need in plain language — budget, fuel, body type, anything.",
    icon: MessageSquare,
    rgb: "133,213,237",
  },
  {
    title: "Get ranked matches",
    copy: "Our agents retrieve, score, and rank real variants based on specs, reviews, and your intent.",
    icon: Layers,
    rgb: "255,91,53",
  },
  {
    title: "Decide with confidence",
    copy: "Shortlist, compare trade-offs, dive into deep reports, and save your choice.",
    icon: Zap,
    rgb: "80,200,180",
  },
]

const FEATURE_CARDS = [
  {
    title: "Variant-level precision",
    copy: "Not just models — every trim, engine, and package variant is individually scored and explained.",
    rgb: "255,91,53",
  },
  {
    title: "Grounded in real reviews",
    copy: "RAG-powered answers cite actual owner reviews, not generic marketing copy.",
    rgb: "133,213,237",
  },
  {
    title: "Transparent scoring",
    copy: "See exactly why each car was ranked — comfort, value, performance — with full reasoning traces.",
    rgb: "160,120,240",
  },
]

export default function LandingPage() {
  const reduceMotion = useReducedMotion()

  return (
    <div className="relative min-h-screen overflow-x-hidden text-[rgb(var(--vw-text-strong))]">
      {/* ── Animated gradient orbs ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,91,53,0.12) 0%, transparent 70%)",
            filter: "blur(80px)",
            top: "-5%",
            left: "-10%",
          }}
          animate={reduceMotion ? {} : {
            x: [0, 80, 30, 0],
            y: [0, 50, -20, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(133,213,237,0.1) 0%, transparent 70%)",
            filter: "blur(80px)",
            top: "10%",
            right: "-8%",
          }}
          animate={reduceMotion ? {} : {
            x: [0, -60, -20, 0],
            y: [0, 70, 20, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(160,120,240,0.08) 0%, transparent 70%)",
            filter: "blur(80px)",
            bottom: "15%",
            left: "20%",
          }}
          animate={reduceMotion ? {} : {
            x: [0, 50, -40, 0],
            y: [0, -40, 30, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[350px] h-[350px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(80,200,180,0.07) 0%, transparent 70%)",
            filter: "blur(70px)",
            bottom: "5%",
            right: "10%",
          }}
          animate={reduceMotion ? {} : {
            x: [0, -30, 40, 0],
            y: [0, 50, -30, 0],
            scale: [0.95, 1.05, 1, 0.95],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,91,53,0.06) 0%, transparent 70%)",
            filter: "blur(60px)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
          animate={reduceMotion ? {} : {
            x: [0, 60, -50, 0],
            y: [0, -30, 50, 0],
            opacity: [0.6, 1, 0.7, 0.6],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <main className="relative z-10 pb-6">

        {/* HERO SECTION */}
        <section className="mx-auto max-w-7xl px-4 pb-32 pt-[7.2rem] sm:pb-40 lg:pt-[8rem]">
          <div className="grid items-start gap-20 lg:grid-cols-[1.1fr_0.9fr]">
            <ChatSection />
            <MotionWrapper delay={0.2} className="lg:pt-12">
              <AgentCardsCluster />
            </MotionWrapper>
          </div>
        </section>

        {/* Animated gradient divider between hero and process */}
        <div className="mx-auto max-w-7xl px-4 -mt-8 mb-16">
          <motion.div
            className="h-px w-full overflow-hidden rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,91,53,0.3), rgba(133,213,237,0.3), rgba(160,120,240,0.2), transparent)",
              backgroundSize: "200% 100%",
            }}
            animate={reduceMotion ? {} : { backgroundPosition: ["0% 0%", "200% 0%"] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* PROCESS SECTION */}
        <section className="mx-auto max-w-7xl px-4 pb-32 sm:pb-40">
          <MotionWrapper>
            <div className="vw-glass-elevated rounded-[40px] p-8 sm:p-14 border border-[rgba(255,255,255,0.05)] relative overflow-hidden">
              {/* Animated background glow */}
              <motion.div
                className="absolute top-0 right-0 w-[500px] h-[500px] pointer-events-none"
                style={{
                  background: "radial-gradient(circle, rgba(133,213,237,0.06), transparent 70%)",
                }}
                animate={reduceMotion ? {} : {
                  x: [0, 30, -20, 0],
                  y: [0, -20, 30, 0],
                  scale: [1, 1.15, 0.95, 1],
                }}
                transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
              />
              
              <div className="mb-12 flex flex-wrap items-end justify-between gap-6 relative z-10">
                <div>
                  <p className="text-xs font-bold tracking-[0.2em] text-[rgb(255,91,53)] uppercase mb-3">Our process</p>
                  <h2 className="font-headline text-3xl sm:text-4xl text-white tracking-[-0.015em]">Fast. Guided. <br/>Explainable.</h2>
                </div>
                <span className="vw-pill px-5 py-2.5 text-xs font-bold bg-[rgba(var(--sky-blue),0.1)] text-[rgb(var(--sky-blue))] border-[rgba(var(--sky-blue),0.2)]">
                  ~3 minutes to shortlist
                </span>
              </div>

              <div className="grid gap-6 md:grid-cols-3 relative z-10">
                {STEP_CARDS.map((item, i) => (
                  <AnimatedCard
                    key={item.title}
                    className="vw-card-lift rounded-[28px] p-8 relative overflow-hidden group/step"
                    delay={i * 0.1}
                    style={{
                      background: `linear-gradient(135deg, rgba(${item.rgb},0.08) 0%, rgba(20,20,22,0.6) 50%, rgba(${item.rgb},0.04) 100%)`,
                      border: `1px solid rgba(${item.rgb},0.2)`,
                      boxShadow: `0 0 30px -8px rgba(${item.rgb},0.2), inset 0 1px 0 rgba(255,255,255,0.06)`,
                      backdropFilter: "blur(20px) saturate(160%)",
                      WebkitBackdropFilter: "blur(20px) saturate(160%)",
                    }}
                  >
                    {/* Subtle corner glow */}
                    <div
                      className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none opacity-60 group-hover/step:opacity-100 transition-opacity duration-500"
                      style={{
                        background: `radial-gradient(circle, rgba(${item.rgb},0.2), transparent 70%)`,
                        filter: "blur(20px)",
                      }}
                    />
                    <div className="relative z-10">
                      <div
                        className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-6"
                        style={{
                          background: `rgba(${item.rgb},0.12)`,
                          border: `1px solid rgba(${item.rgb},0.25)`,
                          boxShadow: `0 0 16px -4px rgba(${item.rgb},0.3)`,
                        }}
                      >
                        <item.icon size={24} strokeWidth={1.5} style={{ color: `rgb(${item.rgb})` }} />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2.5">
                        {item.title}
                      </h3>
                      <p className="text-[14px] leading-relaxed text-[rgba(255,255,255,0.55)]">{item.copy}</p>
                    </div>
                  </AnimatedCard>
                ))}
              </div>
            </div>
          </MotionWrapper>
        </section>

        {/* Animated divider */}
        <div className="mx-auto max-w-7xl px-4 -mt-8 mb-16">
          <motion.div
            className="h-px w-full overflow-hidden rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(160,120,240,0.25), rgba(80,200,180,0.2), rgba(133,213,237,0.25), transparent)",
              backgroundSize: "200% 100%",
            }}
            animate={reduceMotion ? {} : { backgroundPosition: ["200% 0%", "0% 0%"] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* FEATURES SECTION */}
        <section className="mx-auto max-w-7xl px-4 pb-32 sm:pb-40 relative">
          {/* Floating feature glow */}
          <motion.div
            className="absolute -top-20 left-1/2 w-[400px] h-[300px] pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(160,120,240,0.06), transparent 70%)",
              filter: "blur(60px)",
              transform: "translateX(-50%)",
            }}
            animate={reduceMotion ? {} : {
              y: [0, 20, -10, 0],
              scale: [1, 1.1, 0.95, 1],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <MotionWrapper>
            <div className="grid gap-6 md:grid-cols-3 relative z-10">
              {FEATURE_CARDS.map((card, idx) => (
                <AnimatedCard
                  key={card.title}
                  className="vw-card-lift rounded-[28px] p-10 relative overflow-hidden group/feat"
                  delay={idx * 0.1}
                  style={{
                    background: `linear-gradient(145deg, rgba(${card.rgb},0.07) 0%, rgba(18,18,22,0.6) 60%, rgba(${card.rgb},0.03) 100%)`,
                    border: `1px solid rgba(${card.rgb},0.18)`,
                    boxShadow: `0 0 28px -8px rgba(${card.rgb},0.18), inset 0 1px 0 rgba(255,255,255,0.05)`,
                    backdropFilter: "blur(20px) saturate(150%)",
                    WebkitBackdropFilter: "blur(20px) saturate(150%)",
                  }}
                >
                  {/* Top-left glow blob */}
                  <div
                    className="absolute -top-10 -left-10 w-28 h-28 rounded-full pointer-events-none opacity-50 group-hover/feat:opacity-90 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(circle, rgba(${card.rgb},0.2), transparent 70%)`,
                      filter: "blur(18px)",
                    }}
                  />
                  <div className="relative z-10">
                    <p
                      className="text-xs font-bold uppercase tracking-[0.24em] mb-4"
                      style={{ color: `rgb(${card.rgb})`, opacity: 0.9 }}
                    >
                      0{idx + 1}
                    </p>
                    <h3 className="font-headline text-[1.35rem] text-white mb-3">
                      {card.title}
                    </h3>
                    <p className="text-[14px] leading-relaxed text-[rgba(255,255,255,0.55)]">{card.copy}</p>
                  </div>
                </AnimatedCard>
              ))}
            </div>
          </MotionWrapper>
        </section>

        {/* CTA SECTION */}
        <section className="mx-auto max-w-5xl px-4 pb-40 sm:pb-48">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
            whileInView={reduceMotion ? {} : { opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[48px] p-12 text-center sm:p-24"
            style={{
              background: "linear-gradient(135deg, rgba(160,120,240,0.08) 0%, rgba(12,12,14,0.7) 50%, rgba(133,213,237,0.05) 100%)",
              border: "1px solid rgba(160,120,240,0.18)",
              boxShadow: "0 0 50px -12px rgba(160,120,240,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
              backdropFilter: "blur(24px) saturate(160%)",
              WebkitBackdropFilter: "blur(24px) saturate(160%)",
            }}
          >
            {/* Animated ambient light */}
            <motion.span
              className="pointer-events-none absolute inset-x-0 bottom-0 h-full"
              style={{
                background: "radial-gradient(circle at 50% 120%, rgba(133,213,237,0.15), transparent 70%)",
              }}
              animate={reduceMotion ? {} : {
                opacity: [0.7, 1, 0.7],
                scale: [1, 1.05, 1],
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.span
              className="pointer-events-none absolute w-[300px] h-[300px] rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(255,91,53,0.08), transparent 70%)",
                filter: "blur(40px)",
                top: "10%",
                right: "10%",
              }}
              animate={reduceMotion ? {} : {
                x: [0, -30, 20, 0],
                y: [0, 20, -10, 0],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            
            <div className="relative z-10">
              <p className="text-xs font-bold tracking-[0.2em] text-[rgb(255,91,53)] uppercase mb-6">Ready to find your match?</p>
              <h2 className="font-headline text-3xl sm:text-4xl tracking-[-0.015em] text-white mb-6">
                Start the consultation.
              </h2>
              <p className="mx-auto mb-10 max-w-xl text-[15px] leading-relaxed text-[rgba(255,255,255,0.55)]">
                Get your shortlist, then open the full report. No login required to start.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/consultant" className="inline-flex">
                  <AnimatedButton className="vw-btn-primary px-10 py-4 text-base shadow-[0_20px_40px_-10px_rgba(var(--portland-orange),0.5)]">
                    Begin now
                    <ArrowRight size={20} />
                  </AnimatedButton>
                </Link>
                <Link href="/dashboard" className="inline-flex">
                  <AnimatedButton className="vw-btn-secondary px-10 py-4 text-base">
                    Explore variants
                  </AnimatedButton>
                </Link>
              </div>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  )
}
