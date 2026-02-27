import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Search, MessageSquare, Send, Loader2 } from "lucide-react";
import AgentRunStrip from "./AgentRunStrip";
import RecommendationCard from "./RecommendationCard";

export default function FormResultsPanel({
  results,
  hasSearched,
  isSearching,
  topScore,
  shortlist,
  toggleShortlist,
  reviews,
  sentiments,
  explanationContexts,
  variantFocusInfo,
  onWhyTopFive,
  agentTrace,
  pipelineStats,
  sessionId,
  onAskQuestion,
  onExploreVariants,
}) {
  const reduceMotion = useReducedMotion();
  const [formQuestion, setFormQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [qaMessages, setQaMessages] = useState([]);
  const qaMessagesRef = useRef(null);

  useEffect(() => {
    if (!sessionId) {
      setQaMessages([
        {
          role: "assistant",
          text: "Run Find Matches first, then ask follow-up questions here.",
        },
      ]);
      return;
    }
    setQaMessages([
      {
        role: "assistant",
        text: "Ask follow-ups on these recommendations or request changes like include/exclude brands.",
      },
    ]);
  }, [sessionId]);

  useEffect(() => {
    if (qaMessagesRef.current) {
      qaMessagesRef.current.scrollTop = qaMessagesRef.current.scrollHeight;
    }
  }, [qaMessages, isAsking]);

  const askQuestion = async () => {
    const question = formQuestion.trim();
    if (!question || isAsking) return;

    setFormQuestion("");
    setQaMessages((prev) => [...prev, { role: "user", text: question }]);
    setIsAsking(true);

    try {
      if (!onAskQuestion) {
        throw new Error("Follow-up assistant is unavailable right now.");
      }
      const response = await onAskQuestion(question);
      let answer = response?.content || "Processed your request.";
      if (response?.type === "update") {
        answer = `${answer} Updated preferences and refreshed form recommendations.`;
      }
      setQaMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Unable to process that question right now.";
      setQaMessages((prev) => [...prev, { role: "assistant", text: message }]);
    } finally {
      setIsAsking(false);
    }
  };

  if (!hasSearched && !isSearching) {
    return (
      <div className="rounded-2xl border border-[rgba(133,213,237,0.12)] bg-[rgba(133,213,237,0.04)] px-5 py-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(133,213,237,0.20)] bg-[rgba(133,213,237,0.10)] text-[rgba(133,213,237,0.9)]">
          <Search size={18} />
        </div>
        <p className="text-[13px] font-semibold text-[rgba(255,255,255,0.7)]">Set preferences and click Find Matches.</p>
        <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.4)]">Recommendations will appear here in form mode.</p>
      </div>
    );
  }

  if (isSearching && !hasSearched) {
    return (
      <div className="space-y-2.5 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (hasSearched && results.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[rgba(255,91,53,0.16)] bg-[rgba(255,91,53,0.05)] px-5 py-6 text-center">
          <p className="text-[13px] font-semibold text-[rgba(255,255,255,0.78)]">No matches found for the current constraints.</p>
          <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.45)]">Relax filters, increase budget flexibility, or reduce strict conditions.</p>
        </div>

        <div className="rounded-2xl border border-[rgba(133,213,237,0.12)] bg-[rgba(133,213,237,0.04)] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-[rgba(133,213,237,0.88)]">
            <MessageSquare size={14} />
            Ask the recommendation assistant
          </div>
          <div className="flex gap-2">
            <input
              value={formQuestion}
              onChange={(e) => setFormQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  askQuestion();
                }
              }}
              className="vw-input h-11 flex-1 rounded-xl"
              placeholder="Try: relax fuel type and include more brands"
            />
            <button
              type="button"
              onClick={askQuestion}
              disabled={isAsking || !formQuestion.trim()}
              className="h-11 min-w-[44px] rounded-xl border border-[rgba(133,213,237,0.2)] bg-[rgba(133,213,237,0.12)] px-3 text-[rgba(133,213,237,0.95)] transition-all hover:bg-[rgba(133,213,237,0.16)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isAsking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[rgba(133,213,237,0.12)] bg-[rgba(14,12,24,0.62)] p-4 sm:p-5 backdrop-blur-xl">
      <AgentRunStrip
        agentTrace={agentTrace}
        pipelineStats={pipelineStats}
        variantFocusInfo={variantFocusInfo}
        isSearching={isSearching}
      />

      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-[15px] font-bold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(255,91,53,0.2)] bg-[rgba(255,91,53,0.1)] text-[rgba(255,91,53,0.85)]">
            <Sparkles size={13} />
          </span>
          Form Recommendations
          <span className="rounded-lg border border-[rgba(255,91,53,0.22)] bg-[rgba(255,91,53,0.12)] px-2 py-0.5 text-[10px] font-extrabold text-[rgba(255,91,53,0.92)] tabular-nums">
            {results.length}
          </span>
        </h3>

        <button
          type="button"
          onClick={onWhyTopFive}
          className="text-[10px] font-bold text-[rgba(133,213,237,0.72)] hover:text-[rgba(133,213,237,0.95)] transition-colors"
        >
          Why these?
        </button>
      </div>

      <div className="space-y-3">
        {results.map((match, idx) => (
          <motion.div
            key={match.car?.variant || idx}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: idx * 0.03 }}
          >
            <RecommendationCard
              match={match}
              idx={idx}
              topScore={topScore}
              isShortlisted={shortlist.includes(match.car?.variant)}
              toggleShortlist={toggleShortlist}
              reviews={reviews}
              sentiments={sentiments}
              explanationContexts={explanationContexts}
              onExploreVariants={onExploreVariants}
            />
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl border border-[rgba(133,213,237,0.12)] bg-[rgba(133,213,237,0.04)] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="flex items-center gap-2 text-[12px] font-semibold text-[rgba(133,213,237,0.88)]">
            <MessageSquare size={14} />
            Ask about these recommendations
          </h4>
          <span className="text-[10px] text-[rgba(255,255,255,0.35)]">RAG follow-up</span>
        </div>

        <div
          ref={qaMessagesRef}
          className="mb-3 max-h-44 space-y-2.5 overflow-y-auto rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3"
        >
          {qaMessages.map((msg, idx) => (
            <div
              key={`${msg.role}-${idx}`}
              className={`rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
                msg.role === "user"
                  ? "ml-auto max-w-[88%] border border-[rgba(255,91,53,0.22)] bg-[rgba(255,91,53,0.10)] text-[rgba(255,255,255,0.9)]"
                  : "max-w-[92%] border border-[rgba(133,213,237,0.16)] bg-[rgba(133,213,237,0.08)] text-[rgba(255,255,255,0.86)]"
              }`}
            >
              {msg.text}
            </div>
          ))}
          {isAsking && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-[rgba(133,213,237,0.16)] bg-[rgba(133,213,237,0.08)] px-3 py-2 text-[11px] text-[rgba(133,213,237,0.8)]">
              <Loader2 size={12} className="animate-spin" />
              Thinking...
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={formQuestion}
            onChange={(e) => setFormQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                askQuestion();
              }
            }}
            className="vw-input h-11 flex-1 rounded-xl"
            placeholder="Ask why this was ranked higher, or request changes like 'exclude Maruti'"
          />
          <button
            type="button"
            onClick={askQuestion}
            disabled={isAsking || !formQuestion.trim()}
            className="h-11 min-w-[44px] rounded-xl border border-[rgba(133,213,237,0.2)] bg-[rgba(133,213,237,0.12)] px-3 text-[rgba(133,213,237,0.95)] transition-all hover:bg-[rgba(133,213,237,0.16)] disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Send question"
          >
            {isAsking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
