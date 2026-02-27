import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  BookmarkCheck,
  X,
  Shield,
  HelpCircle,
  ChevronDown,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Brain,
  Search,
} from "lucide-react";
import AgentRunStrip from "./AgentRunStrip";

export default function ShortlistPane({
  results,
  shortlist,
  toggleShortlist,
  agentTrace,
  pipelineStats,
  isSearching,
  hasSearched,
  conflicts,
  explanationContexts,
  question,
  setQuestion,
  handleAsk,
  isAsking,
  sessionId,
  chatResponse,
  renderChatResponse,
  onWhyTopFive,
  onSearch,
  prefs,
  userControls,
}) {
  const reduceMotion = useReducedMotion();
  const [showRAG, setShowRAG] = useState(false);

  const shortlistedMatches = shortlist
    .map((v) => results.find((r) => r.car?.variant === v))
    .filter(Boolean);

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-[rgba(18,16,28,0.45)] backdrop-blur-2xl border border-[rgba(255,255,255,0.06)] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]">
      <AgentRunStrip
        agentTrace={agentTrace}
        pipelineStats={pipelineStats}
        isSearching={isSearching}
      />

      {/* Why These? Button */}
      {hasSearched && results.length > 0 && (
        <button
          onClick={onWhyTopFive}
          className="w-full group flex items-center justify-between p-4 rounded-2xl backdrop-blur-md border border-[rgba(133,213,237,0.12)] bg-[rgba(133,213,237,0.04)] hover:bg-[rgba(133,213,237,0.07)] hover:border-[rgba(133,213,237,0.20)] transition-all duration-250 shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(133,213,237,0.08)] backdrop-blur-md flex items-center justify-center text-[rgba(133,213,237,0.8)] border border-[rgba(133,213,237,0.15)] group-hover:border-[rgba(133,213,237,0.25)] transition-all">
              <Brain size={18} />
            </div>
            <div className="text-left">
              <p className="text-[13px] font-bold text-white group-hover:text-[rgba(133,213,237,0.9)] transition-colors">
                Why these {results.length}?
              </p>
              <p className="text-[10px] text-[rgba(255,255,255,0.35)]">
                Reasoning trace & trade-offs
              </p>
            </div>
          </div>
          <ChevronDown size={14} className="text-[rgba(133,213,237,0.5)] group-hover:text-[rgba(133,213,237,0.8)] transition-all" />
        </button>
      )}

      {/* Shortlist Cards */}
      {shortlistedMatches.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <BookmarkCheck size={14} className="text-[rgba(255,91,53,0.7)]" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[rgba(255,91,53,0.7)]">
              Your Picks ({shortlistedMatches.length})
            </h3>
          </div>

          <AnimatePresence>
            {shortlistedMatches.map((match) => (
              <motion.div
                key={match.car.variant}
                initial={reduceMotion ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="relative group rounded-xl p-4 backdrop-blur-md border border-[rgba(255,91,53,0.12)] bg-[rgba(255,91,53,0.04)] hover:bg-[rgba(255,91,53,0.06)] hover:border-[rgba(255,91,53,0.20)] transition-all duration-250 shadow-[0_2px_10px_rgba(0,0,0,0.15)]"
              >
                {/* Left accent */}
                <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-gradient-to-b from-[rgba(255,91,53,0.6)] to-[rgba(255,140,60,0.3)]" />

                <div className="flex justify-between items-start gap-3 pl-3">
                  <div>
                    <p className="text-[13px] font-bold text-white leading-tight">
                      {match.car.variant}
                    </p>
                    <p className="text-[13px] text-[rgba(255,91,53,0.8)] font-bold mt-1">
                      {match.car.price}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleShortlist(match.car.variant)}
                    className="p-1.5 rounded-lg text-[rgba(255,255,255,0.25)] hover:bg-[rgba(255,60,60,0.08)] hover:text-[rgba(255,80,80,0.7)] border border-transparent hover:border-[rgba(255,60,60,0.12)] transition-all"
                  >
                    <X size={13} />
                  </button>
                </div>

                {match.graph_confidence > 0 && (
                  <div className="mt-3 flex items-center gap-2 pl-3">
                    <div className="h-1.5 w-20 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${match.graph_confidence * 100}%`,
                          background: "linear-gradient(90deg, rgba(133,213,237,0.5), rgba(80,200,180,0.5))"
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-[rgba(133,213,237,0.7)] font-bold flex items-center gap-1">
                      <Shield size={9} /> {(match.graph_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Conflicts */}
      {conflicts?.length > 0 && (
        <div className="p-4 rounded-xl backdrop-blur-md bg-[rgba(255,91,53,0.04)] border border-[rgba(255,91,53,0.12)]">
          <p className="text-[10px] font-bold text-[rgba(255,91,53,0.7)] uppercase tracking-[0.1em] mb-2.5">
            Trade-offs
          </p>
          <ul className="space-y-2">
            {conflicts.slice(0, 3).map((c, i) => (
              <li key={i} className="text-[11px] text-[rgba(255,255,255,0.55)] leading-snug flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[rgba(255,91,53,0.5)] flex-shrink-0" />
                {typeof c === "string" ? c : JSON.stringify(c)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* RAG Ask */}
      {hasSearched && results.length > 0 && (
        <div className="rounded-xl backdrop-blur-md border border-[rgba(133,213,237,0.10)] bg-[rgba(133,213,237,0.03)] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.12)]">
          <button
            onClick={() => setShowRAG(!showRAG)}
            className="w-full flex items-center justify-between p-4 hover:bg-[rgba(133,213,237,0.04)] transition-colors duration-200"
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare size={14} className="text-[rgba(133,213,237,0.6)]" />
              <span className="text-[12px] font-bold text-[rgba(255,255,255,0.8)]">Ask about results</span>
            </div>
            <motion.span animate={{ rotate: showRAG ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={14} className="text-[rgba(255,255,255,0.3)]" />
            </motion.span>
          </button>

          <AnimatePresence>
            {showRAG && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden border-t border-[rgba(133,213,237,0.08)]"
              >
                <div className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g., Best mileage?"
                      className="flex-1 h-10 rounded-xl text-[12px] px-3.5 bg-[rgba(255,255,255,0.04)] backdrop-blur-md border border-[rgba(255,255,255,0.08)] text-white placeholder-[rgba(255,255,255,0.22)] focus:outline-none focus:border-[rgba(133,213,237,0.25)] focus:bg-[rgba(255,255,255,0.05)] focus:shadow-[0_0_16px_rgba(133,213,237,0.04)] transition-all duration-200 shadow-[0_1px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.02)]"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                    />
                    <button
                      onClick={handleAsk}
                      disabled={isAsking || !question.trim()}
                      className="px-4 py-2.5 backdrop-blur-md bg-[rgba(133,213,237,0.08)] text-[rgba(133,213,237,0.8)] border border-[rgba(133,213,237,0.15)] rounded-xl text-[11px] font-bold hover:bg-[rgba(133,213,237,0.12)] hover:border-[rgba(133,213,237,0.25)] disabled:opacity-35 transition-all duration-200 shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
                    >
                      {isAsking ? <RefreshCw size={13} className="animate-spin" /> : "Ask"}
                    </button>
                  </div>
                  {renderChatResponse()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Captured Preferences */}
      <CapturedPreferences prefs={prefs} userControls={userControls} />

      {/* Empty State */}
      {!hasSearched && !isSearching && (
        <div className="space-y-4">
          <div className="relative rounded-2xl p-10 flex flex-col items-center justify-center text-center overflow-hidden backdrop-blur-md border border-dashed border-[rgba(133,213,237,0.12)] bg-[rgba(133,213,237,0.03)]">
            <div className="absolute inset-0 bg-gradient-to-b from-[rgba(133,213,237,0.04)] via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-[rgba(133,213,237,0.08)] backdrop-blur-md flex items-center justify-center mx-auto mb-4 border border-[rgba(133,213,237,0.15)]">
                <Sparkles size={22} className="text-[rgba(133,213,237,0.6)]" />
              </div>
              <p className="text-[13px] font-bold text-[rgba(255,255,255,0.55)]">
                Your shortlist will appear here
              </p>
              <p className="text-[11px] text-[rgba(255,255,255,0.3)] mt-1.5">
                Start a conversation or set preferences
              </p>
            </div>
          </div>

          {/* Find Matches CTA */}
          <button
            onClick={onSearch}
            disabled={isSearching}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-[13px] font-bold transition-all duration-250 disabled:opacity-35 disabled:cursor-not-allowed backdrop-blur-md bg-[rgba(255,91,53,0.08)] text-[rgba(255,91,53,0.85)] border border-[rgba(255,91,53,0.15)] hover:bg-[rgba(255,91,53,0.12)] hover:border-[rgba(255,91,53,0.25)] shadow-[0_2px_12px_rgba(0,0,0,0.15),0_0_8px_rgba(255,91,53,0.03)] active:scale-[0.98]"
          >
            {isSearching ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <Search size={15} />
            )}
            Find Matches
          </button>
        </div>
      )}

      {/* Update Matches — after search */}
      {hasSearched && (
        <button
          onClick={onSearch}
          disabled={isSearching}
          className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-[12px] font-bold transition-all duration-250 disabled:opacity-35 disabled:cursor-not-allowed backdrop-blur-md bg-[rgba(255,91,53,0.08)] text-[rgba(255,91,53,0.85)] border border-[rgba(255,91,53,0.15)] hover:bg-[rgba(255,91,53,0.12)] hover:border-[rgba(255,91,53,0.25)] shadow-[0_2px_12px_rgba(0,0,0,0.15),0_0_8px_rgba(255,91,53,0.03)] active:scale-[0.98]"
        >
          {isSearching ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Search size={14} />
          )}
          Update Matches
        </button>
      )}

      {/* Skeleton Loading */}
      {isSearching && !hasSearched && (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse overflow-hidden backdrop-blur-sm border border-[rgba(255,255,255,0.04)]">
              <div className="h-full bg-gradient-to-r from-[rgba(133,213,237,0.04)] via-[rgba(255,255,255,0.02)] to-[rgba(255,91,53,0.04)]"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Captured Preferences strip */
function CapturedPreferences({ prefs, userControls }) {
  if (!prefs) return null;
  const formatBudget = (v) => `₹${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`;

  const items = [];
  if (prefs.min_budget > 0 && prefs.max_budget > 0) {
    items.push({ label: "Budget", value: `${formatBudget(prefs.min_budget)} – ${formatBudget(prefs.max_budget)}`, rgb: "255,160,50" });
  }
  if (prefs.body_type && prefs.body_type !== "Any") {
    items.push({ label: "Body", value: prefs.body_type, rgb: "133,213,237" });
  }
  if (prefs.fuel_type && prefs.fuel_type !== "Any") {
    items.push({ label: "Fuel", value: prefs.fuel_type, rgb: "80,200,180" });
  }
  if (prefs.transmission && prefs.transmission !== "Any") {
    items.push({ label: "Trans", value: prefs.transmission, rgb: "160,120,240" });
  }
  if (prefs.seating && prefs.seating !== 5) {
    items.push({ label: "Seats", value: `${prefs.seating}+`, rgb: "255,91,53" });
  }
  if (prefs.brand && prefs.brand !== "Any" && prefs.brand !== "") {
    items.push({ label: "Brand", value: prefs.brand, rgb: "255,91,53" });
  }
  if (prefs.features?.length > 0) {
    items.push({ label: "Features", value: `${prefs.features.length} selected`, rgb: "255,160,50" });
  }
  const prefBrands = userControls?.preferred_brands;
  if (prefBrands && (Array.isArray(prefBrands) ? prefBrands.length > 0 : typeof prefBrands === "string" && prefBrands.trim())) {
    const brands = Array.isArray(prefBrands) ? prefBrands : prefBrands.split(",").map(s => s.trim()).filter(Boolean);
    items.push({ label: "Prefer", value: brands.join(", "), rgb: "133,213,237" });
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl backdrop-blur-md border border-[rgba(133,213,237,0.10)] bg-[rgba(133,213,237,0.03)] p-3.5 space-y-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[rgba(133,213,237,0.6)] flex items-center gap-1.5">
        <Sparkles size={10} />
        Captured Preferences
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold backdrop-blur-sm"
            style={{
              background: `rgba(${item.rgb}, 0.06)`,
              border: `1px solid rgba(${item.rgb}, 0.14)`,
            }}
          >
            <span className="text-[rgba(255,255,255,0.35)] text-[9px]">{item.label}</span>
            <span className="font-bold" style={{ color: `rgba(${item.rgb}, 0.85)` }}>{item.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
