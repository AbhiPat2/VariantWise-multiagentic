import { useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sliders, Zap, Settings, Heart } from "lucide-react";
import ControlRenderer from "./ControlRenderer";
import { BASIC_CONTROLS, ADVANCED_CONTROLS } from "../controls-config";

const SECTIONS = [
  {
    id: "basics",
    step: "01",
    label: "Basics",
    desc: "Set your budget, body type, fuel, and transmission preferences.",
    icon: Sliders,
    controlIds: ["budget", "body_type", "fuel_type", "transmission"],
    rgb: "133,213,237",
  },
  {
    id: "fit",
    step: "02",
    label: "Fit & Comfort",
    desc: "Define seating needs and performance balance.",
    icon: Heart,
    controlIds: ["seating", "performance"],
    rgb: "80,200,180",
  },
  {
    id: "features",
    step: "03",
    label: "Features",
    desc: "Choose features, include/exclude brands, and optional comparison anchors.",
    icon: Zap,
    controlIds: [
      "features",
      "brand",
      "brand_mode",
      "preferred_brands",
      "blacklisted_brands",
      "comparison_mode",
      "comparison_cars",
      "similar_to_car",
    ],
    rgb: "255,160,50",
  },
  {
    id: "advanced",
    step: "Pro",
    label: "Advanced Tuning",
    desc: "Fine-tune diversity, scoring priorities, and brand rules.",
    icon: Settings,
    controlIds: null,
    rgb: "255,91,53",
  },
];

export default function FormPanel({ prefs, userControls, updatePrefs, updateControls }) {
  const reduceMotion = useReducedMotion();
  const [activeSection, setActiveSection] = useState("basics");

  const allControls = useMemo(
    () => Object.fromEntries([...BASIC_CONTROLS, ...ADVANCED_CONTROLS].map((c) => [c.id, c])),
    []
  );
  const basicControlIds = useMemo(
    () => new Set(BASIC_CONTROLS.map((c) => c.id)),
    []
  );

  const activeData = SECTIONS.find((s) => s.id === activeSection);
  const isAdvanced = activeData?.controlIds === null;
  const controls = (isAdvanced
    ? ADVANCED_CONTROLS.filter((ctrl) => {
        if (ctrl.id === "comparison_cars" || ctrl.id === "similar_to_car") {
          return !!userControls.comparison_mode;
        }
        return true;
      })
    : (activeData?.controlIds || []).map((id) => allControls[id]).filter(Boolean)).filter((ctrl) => {
      if (!ctrl) return false;
      if ((ctrl.id === "comparison_cars" || ctrl.id === "similar_to_car") && !userControls.comparison_mode) {
        return false;
      }
      return true;
    });

  const activeRgb = activeData?.rgb || "133,213,237";

  return (
    <div className="space-y-6">
      {/* ── Step Cards ── horizontal process bar ── */}
      <div className="grid grid-cols-4 gap-3.5">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          const Icon = section.icon;
          const rgb = section.rgb;

          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className="relative group text-left rounded-2xl overflow-hidden transition-all duration-300 border cursor-pointer backdrop-blur-sm"
              style={{
                background: isActive
                  ? `linear-gradient(170deg, rgba(${rgb}, 0.14) 0%, rgba(18, 16, 28, 0.92) 65%)`
                  : "rgba(255, 255, 255, 0.025)",
                borderColor: isActive
                  ? `rgba(${rgb}, 0.35)`
                  : "rgba(255, 255, 255, 0.06)",
                boxShadow: isActive
                  ? `0 6px 28px rgba(0,0,0,0.45), 0 0 36px rgba(${rgb}, 0.06), inset 0 1px 0 rgba(255,255,255,0.04)`
                  : "0 2px 10px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.02)",
              }}
            >
              {/* Large faded step number */}
              <div
                className="absolute -top-1 -right-1 text-[3.5rem] font-black leading-none pointer-events-none select-none"
                style={{
                  color: isActive ? `rgba(${rgb}, 0.12)` : "rgba(255,255,255,0.03)",
                  fontFamily: '"DM Serif Display", Georgia, serif',
                }}
              >
                {section.step}
              </div>

              <div className="relative p-4 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
                    style={{
                      background: isActive ? `rgba(${rgb}, 0.2)` : "rgba(255,255,255,0.06)",
                      border: `1px solid ${isActive ? `rgba(${rgb}, 0.35)` : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    <Icon
                      size={15}
                      style={{ color: isActive ? `rgb(${rgb})` : "rgba(255,255,255,0.4)" }}
                    />
                  </span>
                  <span
                    className="text-[12px] font-bold tracking-tight transition-colors"
                    style={{ color: isActive ? "white" : "rgba(255,255,255,0.5)" }}
                  >
                    {section.label}
                  </span>
                </div>

                <p
                  className="text-[10px] leading-relaxed transition-colors"
                  style={{ color: isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)" }}
                >
                  {section.desc}
                </p>
              </div>

              {/* Bottom accent bar */}
              {isActive && (
                <motion.div
                  layoutId="formStepAccent"
                  className="h-[2px] w-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, rgba(${rgb}, 0.7), transparent)`,
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Active Section Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? false : { opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border overflow-hidden"
          style={{
            background: `linear-gradient(175deg, rgba(${activeRgb}, 0.06) 0%, rgba(18, 16, 28, 0.85) 40%)`,
            borderColor: `rgba(${activeRgb}, 0.15)`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 40px rgba(${activeRgb}, 0.04), inset 0 1px 0 rgba(255,255,255,0.03)`,
          }}
        >
          {/* Section header inside content */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{
              borderBottom: `1px solid rgba(${activeRgb}, 0.1)`,
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="text-[11px] font-bold uppercase tracking-[0.15em]"
                style={{ color: `rgb(${activeRgb})` }}
              >
                {activeData?.label}
              </span>
              {isAdvanced && (
                <span
                  className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                  style={{
                    background: `rgba(${activeRgb}, 0.18)`,
                    color: `rgb(${activeRgb})`,
                    border: `1px solid rgba(${activeRgb}, 0.35)`,
                  }}
                >
                  Pro
                </span>
              )}
            </div>
            <span className="text-[10px] text-[rgba(255,255,255,0.3)]">
              {controls.length} {controls.length === 1 ? "control" : "controls"}
            </span>
          </div>

          {/* Controls grid */}
          <div className="p-6 grid grid-cols-1 gap-7">
            {controls.map((ctrl) => (
              <ControlRenderer
                key={ctrl.id}
                control={ctrl}
                value={basicControlIds.has(ctrl.id) ? prefs[ctrl.id] : userControls[ctrl.id]}
                onChange={basicControlIds.has(ctrl.id) ? updatePrefs : updateControls}
                prefs={prefs}
                accentRgb={activeRgb}
                controlsContext={userControls}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Summary Bar ── quick view of current selections ── */}
      <SummaryBar prefs={prefs} accentRgb={activeRgb} />
    </div>
  );
}

/* ── Compact summary of current selections ── */
function SummaryBar({ prefs, accentRgb }) {
  const formatPrice = (price) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  const pills = [
    { label: "Budget", value: `${formatPrice(prefs.min_budget)} – ${formatPrice(prefs.max_budget)}` },
    prefs.body_type !== "Any" && { label: "Body", value: prefs.body_type },
    prefs.fuel_type !== "Any" && { label: "Fuel", value: prefs.fuel_type },
    prefs.transmission !== "Any" && { label: "Trans", value: prefs.transmission },
    prefs.seating !== 5 && { label: "Seats", value: `${prefs.seating}+` },
    prefs.features?.length > 0 && { label: "Features", value: `${prefs.features.length} selected` },
    prefs.brand && prefs.brand !== "Any" && { label: "Brand", value: prefs.brand },
  ].filter(Boolean);

  if (pills.length <= 1) return null;

  return (
    <div
      className="rounded-xl border px-5 py-3.5 flex flex-wrap items-center gap-2.5"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[rgba(255,255,255,0.3)] mr-1">
        Active
      </span>
      {pills.map((pill, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold"
          style={{
            background: `rgba(${accentRgb}, 0.08)`,
            border: `1px solid rgba(${accentRgb}, 0.18)`,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <span className="text-[rgba(255,255,255,0.4)]">{pill.label}</span>
          <span className="text-white">{pill.value}</span>
        </span>
      ))}
    </div>
  );
}
