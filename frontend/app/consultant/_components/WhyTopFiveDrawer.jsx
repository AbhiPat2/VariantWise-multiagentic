import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  Target,
  GitBranch,
  Filter,
  BarChart3,
  Shield,
  AlertTriangle,
  Brain,
  Sliders,
  CheckCircle,
} from "lucide-react";

const normalizeVariant = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

const formatLabel = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const getContextForVariant = (contexts, variantName) => {
  if (!Array.isArray(contexts)) return null;
  const norm = normalizeVariant(variantName);
  return (
    contexts.find((ctx) => normalizeVariant(ctx?.variant_name) === norm) ||
    contexts.find((ctx) => normalizeVariant(ctx?.variant_id) === `variant_${norm}`) ||
    null
  );
};

export default function WhyTopFiveDrawer({
  isOpen,
  onClose,
  results,
  agentTrace,
  pipelineStats,
  conflicts,
  agentEvaluations,
  scoringDiagnostics,
  userControlApplied,
  explanationContexts,
  clarifyingQuestions,
  variantFocusInfo,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg overflow-y-auto custom-scrollbar bg-[rgb(10,10,14)] shadow-[-16px_0_56px_rgba(0,0,0,0.6),0_0_40px_rgba(133,213,237,0.02)] border-l border-[rgba(133,213,237,0.08)]"
            role="dialog"
            aria-label="Why these recommendations"
          >
            <div className="sticky top-0 z-10 px-6 py-5 flex items-center justify-between border-b border-[rgba(133,213,237,0.1)] bg-[rgba(10,10,14,0.96)] backdrop-blur-xl">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[rgba(133,213,237,0.1)] flex items-center justify-center text-[rgb(133,213,237)] border border-[rgba(133,213,237,0.2)] shadow-[0_0_16px_rgba(133,213,237,0.08)]">
                  <Brain size={18} />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-white tracking-[-0.01em]">
                    Reasoning Engine
                  </h2>
                  <p className="text-[10px] text-[rgba(255,255,255,0.35)] uppercase tracking-wider font-medium">
                    Trace ID: {new Date().getTime().toString(36)}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-[rgb(var(--vw-text-muted))] hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgb(var(--vw-text-strong))] transition-colors"
                aria-label="Close drawer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              <Section icon={Target} title="Matched Constraints" stage="calm">
                {results.slice(0, 5).map((m, i) => (
                  <div key={i} className="group bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl p-3 mb-2 hover:border-[rgba(var(--sky-blue),0.2)] transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[13px] font-bold text-[rgb(var(--vw-text-strong))]">{m.car?.variant}</p>
                      {m.graph_confidence > 0 && (
                        <span className="flex items-center gap-1 text-[9px] font-mono text-[rgb(var(--sky-blue))] bg-[rgba(var(--sky-blue),0.1)] px-1.5 py-0.5 rounded">
                          <Shield size={8} /> {(m.graph_confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(m.details || {}).slice(0, 3).map(([, v], j) => (
                        <span key={j} className="text-[10px] text-[rgb(var(--vw-text-muted))] border border-[rgba(255,255,255,0.06)] px-1.5 py-0.5 rounded">{v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </Section>

              {Array.isArray(explanationContexts) && explanationContexts.length > 0 && (
                <Section icon={CheckCircle} title="Explanation Agent Output" stage="clarity">
                  <div className="space-y-2.5">
                    {results.slice(0, 5).map((m, i) => {
                      const ctx = getContextForVariant(explanationContexts, m?.car?.variant);
                      if (!ctx) return null;
                      const matched = Array.isArray(ctx.matched_preferences) ? ctx.matched_preferences : [];
                      const mustHaveCount = matched.filter((pref) => pref?.is_must_have).length;
                      const violations = Array.isArray(ctx.violations) ? ctx.violations : [];
                      const tradeoffs = Array.isArray(ctx.tradeoffs) ? ctx.tradeoffs : [];
                      return (
                        <div key={`ctx-${i}`} className="rounded-xl border border-[rgba(133,213,237,0.12)] bg-[rgba(133,213,237,0.05)] p-3.5">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-[12px] font-semibold text-[rgb(var(--vw-text-strong))]">{ctx.variant_name}</p>
                            <span className="text-[10px] text-[rgba(133,213,237,0.8)]">
                              Score {typeof ctx.score === "number" ? ctx.score.toFixed(2) : "N/A"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2.5 py-2">
                              <p className="text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1">Matched Signals</p>
                              <p className="text-[rgba(255,255,255,0.78)]">{matched.length} ({mustHaveCount} must-have)</p>
                            </div>
                            <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2.5 py-2">
                              <p className="text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1">Warnings</p>
                              <p className="text-[rgba(255,255,255,0.78)]">{violations.length} violation(s), {tradeoffs.length} trade-off(s)</p>
                            </div>
                          </div>
                          {matched.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {matched.slice(0, 6).map((pref, pIdx) => (
                                <span
                                  key={`pref-${pIdx}`}
                                  className={`px-2 py-1 rounded-lg text-[10px] border ${
                                    pref?.is_must_have
                                      ? "border-[rgba(var(--portland-orange),0.25)] bg-[rgba(var(--portland-orange),0.08)] text-[rgb(var(--portland-orange))]"
                                      : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.62)]"
                                  }`}
                                >
                                  {formatLabel(pref?.key)}: {Array.isArray(pref?.value) ? pref.value.join(" - ") : String(pref?.value ?? "N/A")}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {variantFocusInfo?.active && (
                <Section icon={Filter} title="Variant Focus Scope" stage="scope">
                  <div className="rounded-xl border border-[rgba(133,213,237,0.14)] bg-[rgba(133,213,237,0.05)] p-3.5">
                    <p className="text-[12px] text-[rgba(255,255,255,0.78)] mb-2">
                      Pipeline was focused on: <span className="font-semibold">{variantFocusInfo.focus_variant || variantFocusInfo.family_label || "selected model"}</span>
                    </p>
                    <p className="text-[11px] text-[rgba(255,255,255,0.55)]">
                      Candidate dataset scoped from {variantFocusInfo.dataset_size_before} to {variantFocusInfo.dataset_size_after} variants.
                    </p>
                  </div>
                </Section>
              )}

              {conflicts?.length > 0 && (
                <Section icon={AlertTriangle} title="Trade-offs & Conflicts" stage="tender">
                  {conflicts.map((c, i) => (
                    <div key={i} className="bg-[rgba(var(--portland-orange),0.05)] border border-[rgba(var(--portland-orange),0.1)] rounded-xl p-3 mb-2">
                      <p className="text-[12px] text-[rgb(var(--vw-text-body))] leading-relaxed">
                        {typeof c === "string" ? c : JSON.stringify(c)}
                      </p>
                    </div>
                  ))}
                </Section>
              )}

              {agentEvaluations?.length > 0 && (
                <Section icon={Brain} title="Agent Notes" stage="longing">
                  {agentEvaluations.map((ev, i) => (
                    <div key={i} className="bg-[rgba(255,255,255,0.02)] rounded-lg p-3 mb-2 text-[11px] text-[rgb(var(--vw-text-muted))] border border-[rgba(255,255,255,0.04)] font-mono leading-relaxed">
                      {typeof ev === "string" ? ev : JSON.stringify(ev)}
                    </div>
                  ))}
                </Section>
              )}

              {agentTrace?.length > 0 && (
                <Section icon={GitBranch} title="Execution Trace" stage="void">
                  <div className="space-y-px rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)]">
                    {agentTrace.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 text-[11px] bg-[rgba(255,255,255,0.02)] p-2.5">
                        {step.status === "ok" ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 shadow-[0_0_5px_rgba(74,222,128,0.5)]" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                        )}
                        <span className="text-[rgb(var(--vw-text-body))] font-medium">{step.agent}</span>
                        <span className="text-[rgb(var(--vw-text-muted))] ml-auto font-mono text-[9px]">{step.duration_ms}ms</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {scoringDiagnostics && Object.keys(scoringDiagnostics).length > 0 && (
                <Section icon={BarChart3} title="Scoring Vectors" stage="desire">
                  <pre className="text-[10px] text-[rgb(var(--vw-text-muted))] overflow-x-auto bg-[rgba(0,0,0,0.3)] rounded-lg p-3 border border-[rgba(255,255,255,0.06)] font-mono">
                    {JSON.stringify(scoringDiagnostics, null, 2)}
                  </pre>
                </Section>
              )}

              {userControlApplied && (
                <Section icon={Sliders} title="Active Controls" stage="passion">
                  <pre className="text-[10px] text-[rgb(var(--vw-text-muted))] overflow-x-auto bg-[rgba(0,0,0,0.3)] rounded-lg p-3 border border-[rgba(255,255,255,0.06)] font-mono">
                    {JSON.stringify(userControlApplied, null, 2)}
                  </pre>
                </Section>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ icon: Icon, title, stage, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={14} className="text-[rgb(var(--vw-text-muted))]" />
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[rgb(var(--vw-text-muted))]">{title}</h3>
      </div>
      {children}
    </div>
  );
}
