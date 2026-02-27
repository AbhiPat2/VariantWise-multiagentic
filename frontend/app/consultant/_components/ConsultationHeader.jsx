import { motion, useReducedMotion } from "framer-motion";
import { Bot, Sliders, RotateCcw } from "lucide-react";

export default function ConsultationHeader({
  mode,
  setMode,
  appliedCount,
  onReset,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mb-8"
    >
      <div className="flex items-center justify-between gap-4 py-5">
        {/* Left: Title + Toggle */}
        <div className="flex items-center gap-6">
          <div>
            <h1 className="font-headline text-[1.75rem] tracking-[-0.03em] text-white leading-tight">
              Consultation
            </h1>
            <p className="text-[11px] text-[rgba(255,255,255,0.3)] mt-0.5 tracking-wide">AI-powered car intelligence</p>
          </div>

          {/* Mode Toggle — pill style */}
          <div
            className="relative flex rounded-2xl p-1.5 backdrop-blur-xl"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {[
              { id: "chat", label: "Chat", icon: Bot, rgb: "133,213,237" },
              { id: "form", label: "Preferences", icon: Sliders, rgb: "255,91,53" },
            ].map((tab) => {
              const isActive = mode === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setMode(tab.id)}
                  className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-250"
                  style={{
                    color: isActive ? `rgb(${tab.rgb})` : "rgba(255,255,255,0.4)",
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="headerModeIndicator"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: `rgba(${tab.rgb}, 0.12)`,
                        border: `1px solid rgba(${tab.rgb}, 0.25)`,
                        boxShadow: `0 0 20px rgba(${tab.rgb}, 0.08), inset 0 1px 0 rgba(255,255,255,0.05)`,
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon size={14} />
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Status + Reset */}
        <div className="flex items-center gap-3">
          {appliedCount > 0 && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl"
              style={{
                background: "rgba(133,213,237,0.08)",
                border: "1px solid rgba(133,213,237,0.18)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
              }}
            >
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  background: "rgb(133,213,237)",
                  boxShadow: "0 0 8px rgba(133,213,237,0.6)",
                }}
              />
              <span className="text-[11px] font-bold tabular-nums" style={{ color: "rgb(133,213,237)" }}>
                {appliedCount} active
              </span>
            </motion.div>
          )}

          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[rgba(255,255,255,0.35)] hover:text-white transition-all duration-200 px-3 py-2 rounded-xl hover:bg-[rgba(255,255,255,0.06)] border border-transparent hover:border-[rgba(255,255,255,0.08)]"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      </div>

      {/* Separator with accent glow */}
      <div
        className="h-px w-full"
        style={{
          background: "linear-gradient(90deg, transparent 5%, rgba(133,213,237,0.15) 30%, rgba(255,91,53,0.12) 70%, transparent 95%)",
        }}
      />
    </motion.div>
  );
}
