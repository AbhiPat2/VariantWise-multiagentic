import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Star,
  BarChart3,
  GitBranch,
  FileText,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Shield,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

const computeComfort = (car) => {
  const scores = [
    car?.front_seat_comfort_score,
    car?.rear_seat_comfort_score,
    car?.bump_absorption_score,
    car?.material_quality_score,
  ].filter((s) => s != null && !isNaN(s));
  if (scores.length === 0) return "N/A";
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
};

const calculateOwnership = (priceStr, fuelType) => {
  const price = parseInt(String(priceStr).replace(/[^\d]/g, "")) || 0;
  if (price === 0) return null;
  const onRoad = Math.round(price * 1.15);
  let mileage = 15, fuelCost = 100;
  const ft = (fuelType || "").toLowerCase();
  if (ft.includes("diesel")) { mileage = 18; fuelCost = 90; }
  else if (ft.includes("cng")) { mileage = 25; fuelCost = 80; }
  else if (ft.includes("electric")) { mileage = 10; fuelCost = 10; }
  const monthly = Math.round((1000 / mileage) * fuelCost);
  const fmt = (v) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
  return { onRoad: fmt(onRoad), monthly: fmt(monthly) };
};

const formatLabel = (key) =>
  String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const normalizeVariantKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

const formatValue = (value) => {
  if (Array.isArray(value)) {
    if (value.length === 2 && value.every((v) => typeof v === "number")) {
      return `₹${value[0].toLocaleString("en-IN")} to ₹${value[1].toLocaleString("en-IN")}`;
    }
    return value.map((item) => String(item)).join(", ");
  }
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value == null || value === "") return "N/A";
  return String(value);
};

const isNonEmpty = (value) => {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};

const getExplanationContextForVariant = (contexts, variantName) => {
  if (!Array.isArray(contexts) || !variantName) return null;
  const normalizedVariant = normalizeVariantKey(variantName);
  return (
    contexts.find((ctx) => normalizeVariantKey(ctx?.variant_name) === normalizedVariant) ||
    contexts.find((ctx) => normalizeVariantKey(ctx?.variant_id) === `variant_${normalizedVariant}`) ||
    null
  );
};

const EXCLUDED_SCORE_KEYS = new Set([
  "rule_component",
  "semantic_component",
  "semantic_weight",
  "rule_weight",
  "hybrid_combined_score",
  "post_path_combined_score",
  "post_context_combined_score",
]);

const TABS = [
  { key: "highlights", label: "Highlights", icon: Star },
  { key: "breakdown", label: "Scoring", icon: BarChart3 },
  { key: "reasoning", label: "Reasoning", icon: GitBranch },
  { key: "review", label: "Review", icon: FileText },
];

export default function RecommendationCard({
  match,
  idx,
  topScore,
  isShortlisted,
  toggleShortlist,
  reviews,
  sentiments,
  explanationContexts,
  onExploreVariants,
}) {
  const reduceMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("highlights");

  const car = match.car;
  const variant = car?.variant;
  const costs = calculateOwnership(car?.price, car?.["Fuel Type"]);

  const explanationContext = useMemo(
    () => getExplanationContextForVariant(explanationContexts, variant),
    [explanationContexts, variant]
  );

  const matchedPreferences = explanationContext?.matched_preferences || [];
  const tradeoffs = explanationContext?.tradeoffs || [];
  const violations = explanationContext?.violations || [];

  const reasoningPaths = useMemo(() => {
    const candidates = [match.reasoning_paths, explanationContext?.reasoning_paths, explanationContext?.paths];
    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate;
      }
    }
    return [];
  }, [match.reasoning_paths, explanationContext]);

  const scoreEntries = useMemo(() => {
    const breakdown = match.score_breakdown || {};
    return Object.entries(breakdown)
      .filter(([key, value]) => !EXCLUDED_SCORE_KEYS.has(key) && typeof value === "number" && Number.isFinite(value))
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  }, [match.score_breakdown]);

  const highlightItems = useMemo(() => {
    const items = [];
    const details = match.details || {};
    Object.values(details).forEach((value) => {
      if (isNonEmpty(value)) items.push(String(value));
    });

    if (isNonEmpty(explanationContext?.verdict)) {
      items.push(`Verdict: ${explanationContext.verdict}`);
    }
    if (isNonEmpty(explanationContext?.price_status)) {
      items.push(`Price fit: ${explanationContext.price_status}`);
    }
    if (isNonEmpty(explanationContext?.seating_status)) {
      items.push(`Seating fit: ${explanationContext.seating_status}`);
    }
    if (isNonEmpty(explanationContext?.performance_info)) {
      items.push(`Performance note: ${explanationContext.performance_info}`);
    }
    if (isNonEmpty(explanationContext?.features_matched)) {
      items.push(`Feature coverage: ${explanationContext.features_matched}`);
    }
    if (typeof explanationContext?.graph_confidence === "number") {
      items.push(`Graph confidence: ${(explanationContext.graph_confidence * 100).toFixed(0)}%`);
    }
    if (matchedPreferences.length > 0) {
      const mustHaves = matchedPreferences.filter((pref) => pref?.is_must_have).length;
      items.push(`Matched ${matchedPreferences.length} preference signals (${mustHaves} must-have).`);
    }
    if (tradeoffs.length > 0) {
      items.push(`${tradeoffs.length} trade-off${tradeoffs.length > 1 ? "s" : ""} identified.`);
    }
    if (violations.length > 0) {
      items.push(`${violations.length} soft constraint warning${violations.length > 1 ? "s" : ""}.`);
    }

    return Array.from(new Set(items));
  }, [match.details, explanationContext, matchedPreferences, tradeoffs.length, violations.length]);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative overflow-hidden rounded-2xl transition-all duration-300 border backdrop-blur-md ${
        isExpanded
          ? "border-[rgba(255,91,53,0.18)] shadow-[0_12px_48px_rgba(0,0,0,0.35),0_0_32px_rgba(255,91,53,0.04)] z-10"
          : "border-[rgba(255,255,255,0.06)] z-0 hover:border-[rgba(255,255,255,0.12)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.25)]"
      }`}
    >
      {/* Glass background */}
      <div className={`absolute inset-0 transition-all duration-300 ${
        isExpanded
          ? "bg-gradient-to-br from-[rgba(255,91,53,0.04)] via-[rgba(18,16,28,0.80)] to-[rgba(133,213,237,0.03)]"
          : "bg-[rgba(18,16,28,0.55)] group-hover:bg-[rgba(20,18,30,0.65)]"
      }`} />
      <div className="absolute inset-0 backdrop-blur-xl pointer-events-none" />

      {/* Left accent strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] transition-all duration-300 ${
        isExpanded
          ? "bg-gradient-to-b from-[rgba(255,91,53,0.7)] to-[rgba(255,140,60,0.4)] shadow-[1px_0_12px_rgba(255,91,53,0.15)]"
          : "bg-gradient-to-b from-[rgba(255,255,255,0.10)] to-transparent group-hover:from-[rgba(255,91,53,0.5)] group-hover:to-[rgba(255,140,60,0.2)]"
      }`} />

      {/* Header */}
      <div
        className="relative p-5 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        aria-expanded={isExpanded}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="text-[10px] font-extrabold tabular-nums px-2.5 py-1 rounded-lg bg-[rgba(255,91,53,0.10)] text-[rgba(255,91,53,0.85)] border border-[rgba(255,91,53,0.18)]">
                #{idx + 1}
              </span>
              <h3 className="text-[16px] font-bold leading-tight text-white truncate">
                {variant}
              </h3>
              {match.low_confidence && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(255,160,50,0.10)] text-[rgba(255,160,50,0.8)] font-bold border border-[rgba(255,160,50,0.20)]">
                  LOW CONFIDENCE
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[rgba(255,255,255,0.04)] backdrop-blur-sm border border-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.55)]">{car?.["Fuel Type"]}</span>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[rgba(255,255,255,0.04)] backdrop-blur-sm border border-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.55)]">{car?.["Transmission Type"]}</span>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[rgba(255,255,255,0.04)] backdrop-blur-sm border border-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.55)]">{car?.["Seating Capacity"]} seats</span>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[rgba(255,160,50,0.08)] border border-[rgba(255,160,50,0.15)] text-[rgba(255,160,50,0.8)]">
                ★ {computeComfort(car)}
              </span>
              {match.graph_confidence > 0 && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[rgba(133,213,237,0.08)] border border-[rgba(133,213,237,0.15)] text-[rgba(133,213,237,0.8)] flex items-center gap-1">
                  <Shield size={9} /> {(match.graph_confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex items-center gap-3">
              <p className="text-lg font-bold text-white tracking-tight">{car?.price}</p>
              <motion.button
                onClick={(e) => { e.stopPropagation(); toggleShortlist(variant); }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className={`p-2.5 rounded-xl transition-all duration-200 backdrop-blur-md ${
                  isShortlisted
                    ? "bg-[rgba(255,91,53,0.12)] text-[rgba(255,91,53,0.9)] border border-[rgba(255,91,53,0.25)] shadow-[0_0_16px_rgba(255,91,53,0.08)]"
                    : "text-[rgba(255,255,255,0.25)] hover:text-[rgba(255,91,53,0.7)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,91,53,0.06)] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,91,53,0.15)]"
                }`}
                aria-label={isShortlisted ? "Remove from shortlist" : "Add to shortlist"}
              >
                {isShortlisted ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              </motion.button>
            </div>
            {costs && (
              <span className="text-[10px] font-medium text-[rgba(255,255,255,0.3)]">~{costs.onRoad} on-road</span>
            )}
          </div>
        </div>

        {/* Score Bar */}
        {match.combined_score != null && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, rgba(133,213,237,0.6), rgba(255,91,53,0.6), rgba(255,160,50,0.6))"
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (match.combined_score / (topScore || 100)) * 100)}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.8, delay: idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="text-[13px] font-bold text-[rgba(255,91,53,0.85)] tabular-nums w-9 text-right">
              {match.combined_score.toFixed(0)}
            </span>
          </div>
        )}
      </div>

      {/* Expanded Area */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
            className="overflow-hidden"
          >
            <div className="relative px-5 pb-5">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.06)] to-transparent mb-4" />

              {/* Quick Stats */}
              <div className="flex gap-3">
                <div className="bg-[rgba(133,213,237,0.05)] backdrop-blur-md rounded-xl p-3.5 flex-1 border border-[rgba(133,213,237,0.10)]">
                  <span className="block text-[9px] font-bold text-[rgba(133,213,237,0.7)] uppercase tracking-wider mb-1">Power</span>
                  <span className="font-bold text-white text-sm">{car?.["Max Power"] || "N/A"}</span>
                </div>
                <div className="bg-[rgba(255,91,53,0.05)] backdrop-blur-md rounded-xl p-3.5 flex-1 border border-[rgba(255,91,53,0.10)]">
                  <span className="block text-[9px] font-bold text-[rgba(255,91,53,0.7)] uppercase tracking-wider mb-1">Torque</span>
                  <span className="font-bold text-white text-sm">{car?.["Max Torque"] || "N/A"}</span>
                </div>
              </div>

              {/* Sentiments */}
              {sentiments?.[variant] && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {sentiments[variant].pros?.length > 0 && (
                    <div className="bg-[rgba(80,200,180,0.05)] backdrop-blur-md rounded-xl p-3.5 border border-[rgba(80,200,180,0.10)]">
                      <p className="text-[10px] font-bold text-[rgba(80,200,180,0.8)] uppercase mb-2 flex items-center gap-1">
                        <ThumbsUp size={10} /> Pros
                      </p>
                      {sentiments[variant].pros.map((p, i) => (
                        <p key={i} className="text-[11px] text-[rgba(255,255,255,0.6)] mb-1 last:mb-0 leading-snug">+ {p}</p>
                      ))}
                    </div>
                  )}
                  {sentiments[variant].cons?.length > 0 && (
                    <div className="bg-[rgba(255,91,53,0.04)] backdrop-blur-md rounded-xl p-3.5 border border-[rgba(255,91,53,0.10)]">
                      <p className="text-[10px] font-bold text-[rgba(255,91,53,0.7)] uppercase mb-2 flex items-center gap-1">
                        <ThumbsDown size={10} /> Cons
                      </p>
                      {sentiments[variant].cons.map((c, i) => (
                        <p key={i} className="text-[11px] text-[rgba(255,255,255,0.5)] mb-1 last:mb-0 leading-snug">− {c}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1.5 mt-4 mb-3 pb-1" role="tablist">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={activeTab === tab.key}
                    onClick={() => setActiveTab(activeTab === tab.key ? null : tab.key)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold backdrop-blur-sm transition-all duration-200 ${
                      activeTab === tab.key
                        ? "bg-[rgba(255,91,53,0.10)] text-[rgba(255,91,53,0.85)] border border-[rgba(255,91,53,0.20)]"
                        : "text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.65)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] border border-transparent hover:border-[rgba(255,255,255,0.06)]"
                    }`}
                  >
                    <tab.icon size={12} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <AnimatePresence mode="wait">
                {activeTab === "highlights" && (
                  <motion.div key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-1 space-y-3">
                    {highlightItems.length > 0 ? (
                      highlightItems.map((text, i) => (
                        <p key={`${text}-${i}`} className="text-[12px] text-[rgba(255,255,255,0.66)] flex items-start gap-2.5 leading-relaxed">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[rgba(255,91,53,0.6)] flex-shrink-0" />
                          {text}
                        </p>
                      ))
                    ) : (
                      <p className="text-[12px] text-[rgba(255,255,255,0.4)] italic">No explanation highlights available yet.</p>
                    )}

                    {matchedPreferences.length > 0 && (
                      <div className="pt-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[rgba(133,213,237,0.72)] mb-2">
                          Matched Preferences
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {matchedPreferences.slice(0, 10).map((pref, i) => (
                            <span
                              key={`${pref?.key || "pref"}-${i}`}
                              className={`px-2.5 py-1 rounded-lg text-[10px] border backdrop-blur-sm ${
                                pref?.is_must_have
                                  ? "bg-[rgba(255,91,53,0.10)] border-[rgba(255,91,53,0.20)] text-[rgba(255,91,53,0.9)]"
                                  : "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.6)]"
                              }`}
                            >
                              {formatLabel(pref?.key)}: {formatValue(pref?.value)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
                {activeTab === "breakdown" && match.score_breakdown && (
                  <motion.div key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-1 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-sm rounded-xl p-3 border border-[rgba(255,255,255,0.05)]">
                        <p className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.35)] mb-0.5">Combined</p>
                        <p className="text-[13px] font-bold text-white">{formatValue(match.combined_score ?? match.score)}</p>
                      </div>
                      <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-sm rounded-xl p-3 border border-[rgba(255,255,255,0.05)]">
                        <p className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.35)] mb-0.5">Rule</p>
                        <p className="text-[13px] font-bold text-white">{formatValue(explanationContext?.rule_score ?? match.score)}</p>
                      </div>
                      <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-sm rounded-xl p-3 border border-[rgba(255,255,255,0.05)]">
                        <p className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.35)] mb-0.5">Semantic</p>
                        <p className="text-[13px] font-bold text-white">{formatValue(match.semantic_score ?? explanationContext?.semantic_score ?? 0)}</p>
                      </div>
                      <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-sm rounded-xl p-3 border border-[rgba(255,255,255,0.05)]">
                        <p className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.35)] mb-0.5">Graph Confidence</p>
                        <p className="text-[13px] font-bold text-white">
                          {typeof (match.graph_confidence ?? explanationContext?.graph_confidence) === "number"
                            ? `${((match.graph_confidence ?? explanationContext?.graph_confidence) * 100).toFixed(0)}%`
                            : "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {scoreEntries.slice(0, 10).map(([k, v]) => (
                        <div key={k} className="bg-[rgba(255,255,255,0.03)] backdrop-blur-sm rounded-xl p-3 border border-[rgba(255,255,255,0.05)]">
                          <p className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.35)] mb-0.5">{formatLabel(k)}</p>
                          <p className="text-[13px] font-bold text-white">{formatValue(v)}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
                {activeTab === "reasoning" && (
                  <motion.div key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-1 space-y-3">
                    {reasoningPaths.length > 0 && (
                      <div className="space-y-2">
                        {reasoningPaths.map((path, i) => (
                          <div key={i} className="bg-[rgba(133,213,237,0.04)] backdrop-blur-sm border border-[rgba(133,213,237,0.10)] rounded-xl p-3.5 text-[11px] text-[rgba(255,255,255,0.6)] leading-relaxed">
                            {typeof path === "string" ? (
                              path
                            ) : (
                              <>
                                <p className="text-[rgba(255,255,255,0.78)]">
                                  {path?.path || `${formatLabel(path?.preference_key)}: ${formatValue(path?.preference_value)}`}
                                </p>
                                <p className="mt-1 text-[10px] text-[rgba(133,213,237,0.66)]">
                                  {isNonEmpty(path?.preference_key) ? formatLabel(path.preference_key) : "Signal"} • Weight {formatValue(path?.weight ?? 0)}
                                  {path?.is_must_have ? " • Must-have" : ""}
                                </p>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {tradeoffs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[rgba(255,160,50,0.75)]">Trade-offs</p>
                        {tradeoffs.map((tradeoff, i) => (
                          <div key={`tradeoff-${i}`} className="bg-[rgba(255,160,50,0.05)] border border-[rgba(255,160,50,0.14)] rounded-xl p-3 text-[11px] text-[rgba(255,255,255,0.68)]">
                            {tradeoff?.description || formatValue(tradeoff)}
                          </div>
                        ))}
                      </div>
                    )}

                    {violations.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[rgba(255,91,53,0.8)]">Constraint Warnings</p>
                        {violations.map((violation, i) => (
                          <div key={`violation-${i}`} className="bg-[rgba(255,91,53,0.05)] border border-[rgba(255,91,53,0.14)] rounded-xl p-3 text-[11px] text-[rgba(255,255,255,0.66)]">
                            {formatLabel(violation?.preference_key || "preference")}: {violation?.reason || "Partially outside preferred constraint"}
                          </div>
                        ))}
                      </div>
                    )}

                    {explanationContext?.graph_snapshot && (
                      <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[rgba(133,213,237,0.72)] mb-2">Graph Snapshot</p>
                        <p className="text-[11px] text-[rgba(255,255,255,0.66)] mb-2">
                          Outgoing edges: {formatValue(explanationContext.graph_snapshot.total_outgoing_edges)}
                        </p>
                        {Object.entries(explanationContext.graph_snapshot.edge_type_counts || {}).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(explanationContext.graph_snapshot.edge_type_counts).map(([edgeType, count]) => (
                              <span key={edgeType} className="px-2 py-1 rounded-lg text-[10px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.62)]">
                                {formatLabel(edgeType)}: {count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {reasoningPaths.length === 0 && tradeoffs.length === 0 && violations.length === 0 && !explanationContext?.graph_snapshot && (
                      <p className="text-[12px] text-[rgba(255,255,255,0.4)] italic">
                        No detailed path trace was returned for this variant yet.
                      </p>
                    )}
                  </motion.div>
                )}
                {activeTab === "review" && (
                  <motion.div key="v" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-1 space-y-3">
                    {reviews?.[variant] ? (
                      <p className="text-[12px] text-[rgba(255,255,255,0.6)] leading-relaxed p-3.5 bg-[rgba(255,255,255,0.03)] backdrop-blur-sm rounded-xl border border-[rgba(255,255,255,0.05)]">
                        {reviews[variant]}
                      </p>
                    ) : (
                      <p className="text-[12px] text-[rgba(255,255,255,0.3)] italic">No review available</p>
                    )}

                    {Array.isArray(match.critique_notes) && match.critique_notes.length > 0 && (
                      <div className="bg-[rgba(133,213,237,0.04)] border border-[rgba(133,213,237,0.12)] rounded-xl p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[rgba(133,213,237,0.75)] mb-2">Agent Critique Notes</p>
                        <div className="space-y-1.5">
                          {match.critique_notes.map((note, i) => (
                            <p key={`critique-${i}`} className="text-[11px] text-[rgba(255,255,255,0.66)] leading-relaxed">
                              • {formatValue(note)}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {match.agent_votes && Object.keys(match.agent_votes).length > 0 && (
                      <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.55)] mb-2">Agent Votes</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(match.agent_votes).map(([agent, vote]) => (
                            <div key={agent} className="px-2.5 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]">
                              <p className="text-[9px] uppercase tracking-wider text-[rgba(255,255,255,0.4)]">{formatLabel(agent)}</p>
                              <p className="text-[11px] font-semibold text-[rgba(255,255,255,0.72)]">{formatValue(vote)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Deep Dive CTA — glass button */}
              <div className="mt-5">
                {typeof onExploreVariants === "function" && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onExploreVariants(variant);
                    }}
                    className="mb-2 group/cta w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-bold transition-all duration-250 backdrop-blur-md bg-[rgba(133,213,237,0.08)] text-[rgba(133,213,237,0.86)] border border-[rgba(133,213,237,0.18)] hover:bg-[rgba(133,213,237,0.12)] hover:border-[rgba(133,213,237,0.28)]"
                  >
                    Explore Other Variants Of This Model
                  </button>
                )}
                <Link
                  href={`/report/${encodeURIComponent(variant?.replace(/ /g, "-"))}`}
                  className="group/cta flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-[13px] font-bold transition-all duration-250 backdrop-blur-md bg-[rgba(255,91,53,0.10)] text-[rgba(255,91,53,0.9)] border border-[rgba(255,91,53,0.20)] hover:bg-[rgba(255,91,53,0.14)] hover:border-[rgba(255,91,53,0.30)] shadow-[0_4px_20px_rgba(0,0,0,0.2),0_0_16px_rgba(255,91,53,0.04)] hover:shadow-[0_6px_28px_rgba(0,0,0,0.25),0_0_24px_rgba(255,91,53,0.06)]"
                >
                  View Full Deep Dive Report <ArrowRight size={14} className="transition-transform group-hover/cta:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
