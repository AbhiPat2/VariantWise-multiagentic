import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Bot,
  RefreshCw,
  Send,
  Settings,
  ChevronUp,
  Sparkles,
  X,
  Search,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
} from "lucide-react";
import ControlRenderer from "./ControlRenderer";
import { ADVANCED_CONTROLS } from "../controls-config";
import AppliedFilterPills from "./AppliedFilterPills";
import AgentRunStrip from "./AgentRunStrip";
import RecommendationCard from "./RecommendationCard";

const STARTERS = [
  "I need a family car under 15 lakhs",
  "Looking for my first car with good mileage",
  "Electric SUV with premium features",
  "Automatic sedan for city driving",
];

export default function ChatPanel({
  chatMessages,
  currentMessage,
  setCurrentMessage,
  sendMessage,
  isChatLoading,
  isTyping,
  isSearching,
  onReset,
  prefs,
  userControls,
  updatePrefs,
  updateControls,
  onRemovePref,
  showAdvancedInChat,
  onAdvancedChoice,
  results,
  topScore,
  shortlist,
  toggleShortlist,
  reviews,
  sentiments,
  explanationContexts,
  variantFocusInfo,
  hasSearched,
  onSearch,
  onWhyTopFive,
  onExploreVariants,
}) {
  const reduceMotion = useReducedMotion();
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const [advancedExpanded, setAdvancedExpanded] = useState(true);
  const [shortlistCollapsed, setShortlistCollapsed] = useState(true);

  useEffect(() => {
    if (shouldAutoScrollRef.current && messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [chatMessages.length, isTyping]);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 100;
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const shortlistedItems = shortlist || [];

  return (
    <div className="relative flex flex-col h-[calc(100vh-180px)] min-h-[600px] rounded-2xl overflow-hidden border border-[rgba(133,213,237,0.10)] shadow-[0_24px_72px_rgba(0,0,0,0.45),0_0_48px_rgba(133,213,237,0.025)]">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(133,213,237,0.05)] via-[rgba(16,14,26,0.88)] to-[rgba(16,14,26,0.92)] pointer-events-none" />
      <div className="absolute inset-0 backdrop-blur-3xl pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(133,213,237,0.35) 0.6px, transparent 0.6px)", backgroundSize: "20px 20px" }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between px-6 py-4 border-b border-[rgba(133,213,237,0.10)] bg-[rgba(133,213,237,0.04)] z-10">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-[rgba(133,213,237,0.10)] backdrop-blur-md flex items-center justify-center text-[rgb(133,213,237)] border border-[rgba(133,213,237,0.20)] shadow-[0_0_16px_rgba(133,213,237,0.10)]">
              <Bot size={19} />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[rgb(80,200,180)] border-2 border-[rgba(16,14,26,0.9)] shadow-[0_0_6px_rgba(80,200,180,0.6)]" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-white tracking-[-0.01em]">AI Consultant</h3>
            <p className="text-[10px] text-[rgb(var(--sky-blue))] font-semibold flex items-center gap-1 mt-0.5 opacity-70">
              <Sparkles size={9} /> Graph-powered reasoning
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Shortlist chip */}
          {shortlistedItems.length > 0 && (
            <button
              onClick={() => setShortlistCollapsed(!shortlistCollapsed)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold backdrop-blur-md bg-[rgba(255,91,53,0.08)] text-[rgba(255,91,53,0.8)] border border-[rgba(255,91,53,0.15)] hover:border-[rgba(255,91,53,0.25)] transition-all"
            >
              <BookmarkCheck size={12} />
              {shortlistedItems.length} saved
              <ChevronDown size={10} className={`transition-transform ${!shortlistCollapsed ? "rotate-180" : ""}`} />
            </button>
          )}
          <button
            onClick={onReset}
            className="p-2.5 rounded-xl text-[rgba(255,255,255,0.25)] hover:text-[rgb(var(--portland-orange))] hover:bg-[rgba(var(--portland-orange),0.08)] border border-transparent hover:border-[rgba(var(--portland-orange),0.15)] transition-all duration-200"
            title="Start over"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Shortlist expanded row */}
      <AnimatePresence>
        {shortlistedItems.length > 0 && !shortlistCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative overflow-hidden border-b border-[rgba(255,91,53,0.08)] bg-[rgba(255,91,53,0.03)] z-10"
          >
            <div className="px-5 py-3 flex flex-wrap gap-2">
              {shortlistedItems.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold backdrop-blur-md bg-[rgba(255,91,53,0.08)] text-[rgba(255,91,53,0.8)] border border-[rgba(255,91,53,0.15)]"
                >
                  <Bookmark size={9} />
                  {v}
                  <button
                    onClick={() => toggleShortlist(v)}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Applied Filters */}
      <AnimatePresence>
        {prefs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative border-b border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] backdrop-blur-md px-5 py-2.5 z-10"
          >
            <AppliedFilterPills
              prefs={prefs}
              userControls={userControls}
              onRemovePref={onRemovePref}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto px-6 py-7 space-y-5 custom-scrollbar z-10"
      >
        {chatMessages.map((msg, idx) => {
          /* ── Inline searching status ── */
          if (msg.type === "searching") {
            return (
              <div key={`msg-searching-${idx}`} className="w-full">
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 bg-[rgba(133,213,237,0.06)] backdrop-blur-md rounded-2xl px-6 py-4 border border-[rgba(133,213,237,0.12)] shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
                >
                  <div className="relative">
                    <RefreshCw size={16} className="text-[rgba(133,213,237,0.7)] animate-spin" />
                    <div className="absolute inset-0 rounded-full bg-[rgba(133,213,237,0.15)] animate-ping" style={{ animationDuration: "2s" }} />
                  </div>
                  <div>
                    <span className="text-[13px] font-bold text-[rgba(133,213,237,0.8)]">Analyzing your preferences...</span>
                    <p className="text-[10px] text-[rgba(133,213,237,0.45)] mt-0.5">Running through graph-powered pipeline</p>
                  </div>
                </motion.div>
              </div>
            );
          }

          /* ── Inline agent trace ── */
          if (msg.type === "agent-trace") {
            return (
              <div key={`msg-trace-${idx}`} className="w-full">
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-5 backdrop-blur-md bg-[rgba(133,213,237,0.04)] border border-[rgba(133,213,237,0.10)] shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
                >
                  <AgentRunStrip
                    agentTrace={msg.agentTrace}
                    pipelineStats={msg.pipelineStats}
                    variantFocusInfo={variantFocusInfo}
                    isSearching={false}
                  />
                </motion.div>
              </div>
            );
          }

          /* ── Inline results ── */
          if (msg.type === "results") {
            return (
              <div key={`msg-results-${idx}`} className="w-full space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[15px] font-bold text-white flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[rgba(255,91,53,0.10)] text-[rgba(255,91,53,0.8)] border border-[rgba(255,91,53,0.18)]">
                        <Sparkles size={13} />
                      </span>
                      Top Matches
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold tabular-nums bg-[rgba(var(--portland-orange),0.14)] text-[rgb(var(--portland-orange))] border border-[rgba(var(--portland-orange),0.25)]">
                        {msg.results.length}
                      </span>
                    </h3>
                    {hasSearched && (
                      <button
                        onClick={onWhyTopFive}
                        className="text-[10px] font-bold text-[rgba(133,213,237,0.6)] hover:text-[rgba(133,213,237,0.9)] transition-colors"
                      >
                        Why these?
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {msg.results.map((match, rIdx) => (
                      <RecommendationCard
                        key={match.car?.variant || rIdx}
                        match={match}
                        idx={rIdx}
                        topScore={topScore}
                        isShortlisted={shortlistedItems.includes(match.car?.variant)}
                        toggleShortlist={toggleShortlist}
                        reviews={reviews}
                        sentiments={sentiments}
                        explanationContexts={explanationContexts}
                        onExploreVariants={onExploreVariants}
                      />
                    ))}
                  </div>
                </motion.div>
              </div>
            );
          }

          /* ── Regular user / bot messages ── */
          return (
            <div key={`msg-${idx}-${msg.timestamp?.getTime?.() || idx}`} className="space-y-3 w-full">
              <div className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className={`max-w-[88%] rounded-2xl px-5 py-4 text-[14px] leading-relaxed backdrop-blur-md ${
                    msg.type === "user"
                      ? "bg-[rgba(255,91,53,0.10)] text-white border border-[rgba(255,91,53,0.18)] shadow-[0_4px_20px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]"
                      : "bg-[rgba(133,213,237,0.05)] text-[rgba(255,255,255,0.88)] border border-[rgba(133,213,237,0.10)] shadow-[0_4px_20px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]"
                  }`}
                >
                  {msg.type === "bot" && (
                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-[rgb(var(--sky-blue))] mb-2 uppercase tracking-[0.1em] opacity-60">
                      <Sparkles size={9} />
                      VariantWise
                    </span>
                  )}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </motion.div>
              </div>

              {/* Starters */}
              {msg.type === "bot" && msg.showStarters && (
                <div className="pl-2 max-w-[95%]">
                  <div className="flex flex-wrap gap-2 mt-2">
                    {STARTERS.map((s, si) => (
                      <button
                        key={si}
                        onClick={() => sendMessage(s)}
                        className="px-4 py-2.5 rounded-xl backdrop-blur-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[12px] text-[rgba(255,255,255,0.55)] hover:border-[rgba(133,213,237,0.25)] hover:bg-[rgba(133,213,237,0.06)] hover:text-[rgba(133,213,237,0.85)] transition-all duration-250 shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Advanced Choice */}
              {msg.type === "bot" && msg.showAdvancedOffer && (
                <div className="pl-2 flex gap-3 mt-2">
                  <button
                    onClick={() => onAdvancedChoice(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold backdrop-blur-md transition-all duration-250 bg-[rgba(133,213,237,0.08)] text-[rgba(133,213,237,0.85)] border border-[rgba(133,213,237,0.18)] hover:bg-[rgba(133,213,237,0.12)] hover:border-[rgba(133,213,237,0.28)] shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
                  >
                    <Settings size={14} />
                    Fine-tune Search
                  </button>
                  <button
                    onClick={() => onAdvancedChoice(false)}
                    className="px-5 py-3 rounded-xl text-xs font-bold backdrop-blur-md transition-all duration-250 bg-[rgba(255,91,53,0.08)] text-[rgba(255,91,53,0.85)] border border-[rgba(255,91,53,0.18)] hover:bg-[rgba(255,91,53,0.12)] hover:border-[rgba(255,91,53,0.28)] shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
                  >
                    Find matches now
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="pl-4 w-full">
            <div className="flex gap-1.5 items-center bg-[rgba(133,213,237,0.06)] backdrop-blur-md rounded-full px-5 py-2.5 w-fit border border-[rgba(133,213,237,0.12)]">
              <span className="w-2 h-2 rounded-full bg-[rgba(133,213,237,0.6)] animate-pulse" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-[rgba(133,213,237,0.6)] animate-pulse" style={{ animationDelay: "200ms" }} />
              <span className="w-2 h-2 rounded-full bg-[rgba(133,213,237,0.6)] animate-pulse" style={{ animationDelay: "400ms" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Advanced Controls — Compact floating panel (bottom-right) */}
      <AnimatePresence>
        {showAdvancedInChat && advancedExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-20 right-6 z-30 w-[420px] max-h-[55vh] flex flex-col rounded-2xl border border-[rgba(160,120,240,0.18)] bg-[rgba(22,20,34,0.94)] backdrop-blur-2xl shadow-[0_32px_80px_rgba(0,0,0,0.6),0_0_48px_rgba(160,120,240,0.04),inset_0_1px_0_rgba(255,255,255,0.05)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(160,120,240,0.12)] bg-[rgba(160,120,240,0.03)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[rgba(255,91,53,0.08)] backdrop-blur-md flex items-center justify-center text-[rgba(255,91,53,0.8)] border border-[rgba(255,91,53,0.18)]">
                  <Settings size={14} />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-white">Advanced Tuning</h3>
                  <p className="text-[9px] text-[rgba(255,255,255,0.30)]">Brand, scoring & diversity</p>
                </div>
              </div>
              <button
                onClick={() => setAdvancedExpanded(false)}
                className="p-1.5 rounded-lg text-[rgba(255,255,255,0.3)] hover:text-white hover:bg-[rgba(255,255,255,0.06)] transition-all border border-transparent hover:border-[rgba(255,255,255,0.08)]"
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
              {ADVANCED_CONTROLS.map((ctrl) => (
                <ControlRenderer
                  key={ctrl.id}
                  control={ctrl}
                  value={userControls[ctrl.id]}
                  onChange={updateControls}
                  prefs={prefs}
                  controlsContext={userControls}
                />
              ))}
            </div>

            {/* Footer with Find Matches */}
            <div className="px-5 py-3.5 border-t border-[rgba(160,120,240,0.10)] bg-[rgba(0,0,0,0.15)] flex items-center justify-between gap-3">
              <button
                onClick={() => setAdvancedExpanded(false)}
                className="px-4 py-2 rounded-xl text-[11px] font-bold text-[rgba(255,255,255,0.4)] hover:text-white backdrop-blur-md bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.14)] transition-all duration-200"
              >
                Close
              </button>
              <motion.button
                onClick={() => { setAdvancedExpanded(false); onSearch(); }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold backdrop-blur-md bg-[rgba(255,91,53,0.12)] text-[rgba(255,91,53,0.9)] border border-[rgba(255,91,53,0.22)] hover:bg-[rgba(255,91,53,0.16)] hover:border-[rgba(255,91,53,0.32)] shadow-[0_4px_16px_rgba(0,0,0,0.25),0_0_12px_rgba(255,91,53,0.05)] transition-all duration-200"
              >
                <Search size={13} />
                Find Matches
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advanced toggle — collapsed state */}
      <AnimatePresence>
        {showAdvancedInChat && !advancedExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative border-t border-[rgba(160,120,240,0.08)] bg-[rgba(160,120,240,0.03)] z-10"
          >
            <button
              onClick={() => setAdvancedExpanded(true)}
              className="w-full px-5 py-2.5 flex items-center justify-center gap-2 text-[11px] font-bold text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,91,53,0.8)] transition-colors"
            >
              <Settings size={11} className="text-[rgba(255,91,53,0.6)]" />
              <span>Open Advanced Controls</span>
              <ChevronUp size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="relative p-4 bg-[rgba(10,9,18,0.75)] backdrop-blur-xl border-t border-[rgba(255,255,255,0.06)] z-10">
        <div className="relative flex items-end gap-3 w-full">
          <div className="relative flex-1 bg-[rgba(255,255,255,0.05)] backdrop-blur-md rounded-2xl border border-[rgba(255,255,255,0.08)] focus-within:border-[rgba(133,213,237,0.30)] focus-within:shadow-[0_0_24px_rgba(133,213,237,0.06)] focus-within:bg-[rgba(255,255,255,0.06)] transition-all duration-250 shadow-[0_2px_12px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.02)]">
            <textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Describe your ideal car..."
              rows={1}
              disabled={isChatLoading}
              className="w-full bg-transparent text-[14px] text-white placeholder-[rgba(255,255,255,0.22)] px-5 py-4 focus:outline-none resize-none custom-scrollbar"
              style={{ minHeight: "52px", maxHeight: "120px" }}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
            />
          </div>

          {/* Find Matches persistent button */}
          {showAdvancedInChat && !advancedExpanded && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={onSearch}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              disabled={isSearching}
              className="h-[52px] px-5 rounded-2xl flex items-center gap-2 text-[12px] font-bold transition-all duration-250 backdrop-blur-md bg-[rgba(255,91,53,0.12)] text-[rgba(255,91,53,0.9)] border border-[rgba(255,91,53,0.22)] hover:bg-[rgba(255,91,53,0.16)] hover:border-[rgba(255,91,53,0.32)] shadow-[0_4px_16px_rgba(0,0,0,0.25),0_0_12px_rgba(255,91,53,0.05)] disabled:opacity-50"
            >
              {isSearching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              {hasSearched ? "Update" : "Search"}
            </motion.button>
          )}

          <motion.button
            onClick={sendMessage}
            disabled={!currentMessage.trim() || isChatLoading}
            whileHover={currentMessage.trim() ? { scale: 1.04 } : {}}
            whileTap={currentMessage.trim() ? { scale: 0.96 } : {}}
            className={`h-[52px] w-[52px] rounded-2xl flex items-center justify-center transition-all duration-250 flex-shrink-0 ${
              currentMessage.trim()
                ? "bg-[rgba(255,91,53,0.15)] text-[rgba(255,91,53,0.9)] border border-[rgba(255,91,53,0.25)] shadow-[0_4px_16px_rgba(0,0,0,0.25),0_0_20px_rgba(255,91,53,0.06)] hover:bg-[rgba(255,91,53,0.20)] hover:border-[rgba(255,91,53,0.35)]"
                : "bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.15)] border border-[rgba(255,255,255,0.05)] cursor-not-allowed"
            }`}
          >
            {isChatLoading ? (
              <RefreshCw size={17} className="animate-spin" />
            ) : (
              <Send size={17} />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
