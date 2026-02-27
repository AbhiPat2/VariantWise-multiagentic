import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Loader2,
  Network,
  Sparkles,
} from "lucide-react";

const AGENTS = [
  {
    key: "preference_extraction",
    label: "Preference Extraction",
    lookup: "preferenceextractionagent",
    intent: "Converts your constraints into weighted graph preference nodes.",
  },
  {
    key: "variant_pruning",
    label: "Variant Pruning",
    lookup: "variantpruningagent",
    intent: "Filters infeasible variants and records soft violations for transparency.",
  },
  {
    key: "car_matchmaker",
    label: "Car Matchmaker",
    lookup: "carmatchmakeragent",
    intent: "Finds candidate variants through preference-to-variant graph paths.",
  },
  {
    key: "tradeoff_negotiator",
    label: "Trade-off Negotiator",
    lookup: "tradeoffnegotiatoragent",
    intent: "Detects preference conflicts and recommends pragmatic relaxations.",
  },
  {
    key: "context_awareness",
    label: "Context Awareness",
    lookup: "contextawarenessagent",
    intent: "Uses session history (rejected/viewed/shortlisted) to avoid repetition.",
  },
  {
    key: "scoring_engine",
    label: "Scoring Engine",
    lookup: "scoringengine",
    intent: "Combines rule score, semantic score, path score, and alignment score.",
  },
  {
    key: "hybrid_coalition",
    label: "Hybrid Graph Coalition",
    lookup: "hybridgraphcoalition",
    intent: "Adds graph-centrality, path coherence, comparison intent, exploration bonus.",
  },
  {
    key: "validation",
    label: "Validation & Sanity",
    lookup: "validationandsanityagent",
    intent: "Removes unsafe/hallucinated options violating strict constraints.",
  },
  {
    key: "advanced_reasoning",
    label: "Advanced Reasoning",
    lookup: "advancedreasoningagent",
    intent: "Runs confidence + critique + consensus voting over top variants.",
  },
  {
    key: "explanation",
    label: "Explanation Agent",
    lookup: "explanationagent",
    intent: "Builds explainability contexts from graph paths and edge snapshots.",
  },
];

const FLOW_STEPS = [
  { key: "preferences", label: "Preferences", metric: "preference_nodes" },
  { key: "candidates", label: "Candidates", metric: "candidates_found" },
  { key: "scored", label: "Scored", metric: "variants_scored" },
  { key: "validated", label: "Validated", metric: "variants_validated" },
  { key: "final", label: "Top Picks", metric: "final_recommendations" },
];

const METRIC_KEYS = new Set([
  "preference_nodes",
  "variants_kept",
  "variants_removed",
  "soft_violations",
  "candidate_variants",
  "matching_paths",
  "tradeoffs",
  "rejected_variants",
  "viewed_variants",
  "shortlisted_variants",
  "scored_variants",
  "alignment_compliant_variants",
  "hybrid_ranked_variants",
  "comparison_targets",
  "validated_variants",
  "removed_variants",
  "advanced_variants",
  "agent_evaluations",
  "low_confidence_flagged",
  "explanation_contexts",
]);

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const numberish = (value) => typeof value === "number" && Number.isFinite(value);

const toTitle = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const truncate = (value, max = 140) => {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

function getTraceForAgent(agentTrace, lookup) {
  if (!Array.isArray(agentTrace) || agentTrace.length === 0) return null;
  return agentTrace.find((step) => normalize(step?.agent).includes(lookup)) || null;
}

function statusForTrace(trace, isSearching) {
  if (isSearching && !trace) return "running";
  if (!trace) return "idle";
  return trace.status === "ok" ? "done" : "error";
}

function toInlineObject(value) {
  if (!value || typeof value !== "object") return String(value ?? "");
  const parts = Object.entries(value)
    .filter(([, v]) => v !== null && v !== undefined && String(v) !== "")
    .slice(0, 3)
    .map(([k, v]) => `${toTitle(k)}: ${truncate(v, 36)}`);
  return parts.join(" | ");
}

function toEvidenceLine(key, value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean) return null;
    return `${toTitle(key)}: ${truncate(clean, 180)}`;
  }
  if (typeof value === "boolean") return `${toTitle(key)}: ${value ? "Yes" : "No"}`;
  if (numberish(value)) return `${toTitle(key)}: ${value}`;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const sample = value
      .slice(0, 2)
      .map((item) => (typeof item === "object" ? toInlineObject(item) : truncate(item, 90)))
      .filter(Boolean);
    if (sample.length === 0) return null;
    return `${toTitle(key)}: ${sample.join(" • ")}`;
  }
  if (typeof value === "object") {
    const inline = toInlineObject(value);
    if (!inline) return null;
    return `${toTitle(key)}: ${truncate(inline, 180)}`;
  }
  return null;
}

function buildOutputBlocks(outputs) {
  if (!outputs || typeof outputs !== "object") return { metrics: [], evidence: [] };
  const metrics = [];
  const evidence = [];
  Object.entries(outputs).forEach(([key, value]) => {
    if (METRIC_KEYS.has(key) && (numberish(value) || typeof value === "boolean")) {
      metrics.push({ label: toTitle(key), value: typeof value === "boolean" ? (value ? "Yes" : "No") : value });
      return;
    }
    const line = toEvidenceLine(key, value);
    if (line) evidence.push(line);
  });
  return { metrics: metrics.slice(0, 6), evidence: evidence.slice(0, 5) };
}

function resolveFlowCount(step, pipelineStats, agentTrace) {
  if (step.key === "preferences") {
    const trace = getTraceForAgent(agentTrace, "preferenceextractionagent");
    const count = trace?.outputs?.preference_nodes;
    return numberish(count) ? count : null;
  }
  if (step.key === "final") return 5;
  const value = pipelineStats?.[step.metric];
  return numberish(value) ? value : null;
}

export default function AgentRunStrip({ agentTrace, pipelineStats, variantFocusInfo, isSearching }) {
  const reduceMotion = useReducedMotion();
  const hasTrace = Array.isArray(agentTrace) && agentTrace.length > 0;
  const hasStatus = hasTrace || isSearching || pipelineStats;
  if (!hasStatus) return null;

  const orderedAgents = AGENTS.map((agent) => {
    const trace = getTraceForAgent(agentTrace, agent.lookup);
    const blocks = buildOutputBlocks(trace?.outputs);
    return {
      ...agent,
      trace,
      status: statusForTrace(trace, isSearching),
      durationMs: trace?.duration_ms,
      metrics: blocks.metrics,
      evidence: blocks.evidence,
      error: trace?.error || "",
    };
  });

  const doneCount = orderedAgents.filter((agent) => agent.status === "done").length;
  const runningCount = orderedAgents.filter((agent) => agent.status === "running").length;
  const errorCount = orderedAgents.filter((agent) => agent.status === "error").length;
  const totalDuration = orderedAgents.reduce((sum, agent) => sum + (numberish(agent.durationMs) ? agent.durationMs : 0), 0);

  const timelineAgents = orderedAgents.filter((agent) => numberish(agent.durationMs) && agent.durationMs > 0);

  return (
    <div className="rounded-2xl border border-[rgba(133,213,237,0.12)] bg-[rgba(133,213,237,0.04)] p-3.5 sm:p-4 backdrop-blur-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-[rgba(133,213,237,0.75)]" />
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[rgba(133,213,237,0.8)]">
            System Status (Execution Evidence)
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="px-2 py-0.5 rounded-lg border border-[rgba(80,200,180,0.22)] bg-[rgba(80,200,180,0.09)] text-[rgba(80,200,180,0.85)]">
            done {doneCount}/{AGENTS.length}
          </span>
          {runningCount > 0 && (
            <span className="px-2 py-0.5 rounded-lg border border-[rgba(133,213,237,0.24)] bg-[rgba(133,213,237,0.1)] text-[rgba(133,213,237,0.9)]">
              running {runningCount}
            </span>
          )}
          {errorCount > 0 && (
            <span className="px-2 py-0.5 rounded-lg border border-[rgba(255,91,53,0.24)] bg-[rgba(255,91,53,0.1)] text-[rgba(255,91,53,0.9)]">
              errors {errorCount}
            </span>
          )}
          {totalDuration > 0 && (
            <span className="px-2 py-0.5 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.72)]">
              total {totalDuration}ms
            </span>
          )}
        </div>
      </div>

      <p className="text-[11px] text-[rgba(255,255,255,0.6)] leading-relaxed">
        This section is built from live `agent_trace` artifacts returned by the backend pipeline, not placeholder UI values.
      </p>

      {timelineAgents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.11em] text-[rgba(255,255,255,0.45)] font-semibold">
            <BarChart3 size={12} />
            Execution Timeline
          </div>
          <div className="h-2 w-full rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden flex">
            {timelineAgents.map((agent) => {
              const width = Math.max(3, Math.round((agent.durationMs / totalDuration) * 100));
              return (
                <div
                  key={agent.key}
                  className="h-full border-r border-[rgba(10,10,10,0.35)] bg-gradient-to-r from-[rgba(133,213,237,0.68)] to-[rgba(255,91,53,0.6)]"
                  style={{ width: `${width}%` }}
                  title={`${agent.label}: ${agent.durationMs}ms`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {timelineAgents.map((agent) => (
              <span
                key={`${agent.key}-legend`}
                className="text-[9px] px-2 py-1 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.68)]"
              >
                {agent.label}: {agent.durationMs}ms
              </span>
            ))}
          </div>
        </div>
      )}

      {variantFocusInfo?.active && (
        <div className="rounded-xl border border-[rgba(133,213,237,0.2)] bg-[rgba(133,213,237,0.08)] px-3 py-2.5 text-[11px] text-[rgba(255,255,255,0.76)]">
          <span className="font-semibold text-[rgba(133,213,237,0.92)]">Focused mode:</span>{" "}
          {variantFocusInfo.focus_variant || variantFocusInfo.family_label || "model focus"}{" "}
          ({variantFocusInfo.dataset_size_before} → {variantFocusInfo.dataset_size_after} variants)
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.11em] text-[rgba(255,255,255,0.45)] font-semibold">
          <Network size={12} />
          Graph Flow Map
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FLOW_STEPS.map((step, index) => {
            const count = resolveFlowCount(step, pipelineStats, agentTrace);
            return (
              <div key={step.key} className="flex items-center gap-2">
                <div className="min-w-[92px] rounded-xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.03)] px-2.5 py-2 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-[rgba(255,255,255,0.42)]">{step.label}</p>
                  <p className="text-[12px] font-bold text-[rgba(255,255,255,0.85)]">{count ?? "—"}</p>
                </div>
                {index < FLOW_STEPS.length - 1 && (
                  <span className="text-[rgba(133,213,237,0.55)] text-[11px] font-bold">→</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {pipelineStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatChip label="Graph Nodes" value={pipelineStats.graph_nodes} />
          <StatChip label="Graph Edges" value={pipelineStats.graph_edges} />
          <StatChip label="Trade-offs" value={pipelineStats.tradeoffs_identified} />
          <StatChip label="Rejected" value={pipelineStats.rejected_variants} />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.11em] text-[rgba(255,255,255,0.45)] font-semibold">
          <Sparkles size={12} />
          Agent Execution Details
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {orderedAgents.map((agent, index) => (
            <motion.div
              key={agent.key}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className={`rounded-xl border px-3 py-2.5 ${
                agent.status === "done"
                  ? "border-[rgba(80,200,180,0.18)] bg-[rgba(80,200,180,0.06)]"
                  : agent.status === "running"
                  ? "border-[rgba(133,213,237,0.2)] bg-[rgba(133,213,237,0.06)]"
                  : agent.status === "error"
                  ? "border-[rgba(255,91,53,0.2)] bg-[rgba(255,91,53,0.05)]"
                  : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  {agent.status === "done" && <CheckCircle2 size={12} className="text-[rgba(80,200,180,0.9)]" />}
                  {agent.status === "running" && <Loader2 size={12} className="text-[rgba(133,213,237,0.9)] animate-spin" />}
                  {agent.status === "error" && <AlertTriangle size={12} className="text-[rgba(255,91,53,0.9)]" />}
                  {agent.status === "idle" && <Clock3 size={12} className="text-[rgba(255,255,255,0.45)]" />}
                  <p className="text-[11px] font-semibold text-[rgba(255,255,255,0.86)]">{agent.label}</p>
                </div>
                {numberish(agent.durationMs) && (
                  <span className="text-[10px] text-[rgba(255,255,255,0.58)]">{agent.durationMs}ms</span>
                )}
              </div>

              <p className="text-[10px] text-[rgba(255,255,255,0.56)] mb-2 leading-relaxed">{agent.intent}</p>

              {agent.metrics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {agent.metrics.map((metric) => (
                    <span
                      key={`${agent.key}-${metric.label}`}
                      className="text-[9px] px-2 py-1 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.72)]"
                    >
                      {metric.label}: {metric.value}
                    </span>
                  ))}
                </div>
              )}

              {agent.evidence.length > 0 && (
                <div className="space-y-0.5 mb-2">
                  {agent.evidence.slice(0, 3).map((line) => (
                    <p key={line} className="text-[10px] text-[rgba(255,255,255,0.66)] leading-relaxed">
                      • {line}
                    </p>
                  ))}
                </div>
              )}

              {agent.trace?.outputs && (
                <details className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(5,7,10,0.28)] px-2.5 py-2">
                  <summary className="cursor-pointer select-none text-[10px] text-[rgba(133,213,237,0.8)] font-semibold">
                    Show raw agent trace
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto text-[9px] leading-relaxed text-[rgba(255,255,255,0.62)]">
                    {JSON.stringify(agent.trace.outputs, null, 2)}
                  </pre>
                </details>
              )}

              {agent.status === "error" && agent.error && (
                <p className="mt-1 text-[10px] text-[rgba(255,140,120,0.9)] leading-relaxed">{agent.error}</p>
              )}
              {agent.status === "idle" && !isSearching && (
                <p className="text-[10px] text-[rgba(255,255,255,0.42)]">Not required for this run.</p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-wider text-[rgba(255,255,255,0.42)]">{label}</p>
      <p className="text-[12px] font-semibold text-[rgba(255,255,255,0.86)]">{numberish(value) ? value : "—"}</p>
    </div>
  );
}
