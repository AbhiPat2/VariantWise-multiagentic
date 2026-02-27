"use client";

import { motion } from "framer-motion";
import { Bot, Send, SlidersHorizontal, Sparkles, Paperclip, SplitSquareHorizontal } from "lucide-react";
import { AppliedFiltersChips } from "./AppliedFiltersChips";
import { ControlBadgeGroup } from "./ControlBadgeGroup";

const ACTION_BUTTONS = [
  { id: "upload", label: "Upload context", icon: Paperclip, prompt: "I'd like to upload some context about what I'm looking for" },
  { id: "compare", label: "Compare variants", icon: SplitSquareHorizontal, prompt: "I want to compare specific variants" },
  { id: "ask", label: "Ask agent", icon: Sparkles, prompt: "Tell me more about the top recommendations" },
];

export function ChatPanel({
  messages = [],
  isTyping = false,
  isChatLoading = false,
  currentMessage = "",
  onCurrentMessageChange,
  onSend,
  onKeyDown,
  onReset,
  conversationStarters = [],
  onStarterSelect,
  renderControl,
  context,
  chatContainerRef,
  messagesEndRef,
  onScroll,
  reduceMotion,
  showDeepControls = false,
  onOpenDeepControls,
  showFollowUp = false,
  followUpPrompt = "",
  onFollowUpChange,
  onFollowUpAsk,
  isFollowUpLoading = false,
  followUpResponse = "",
  followUpDisabled = false,
  stageClass = "vw-stage-calm",
}) {
  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={reduceMotion ? false : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={`${stageClass} relative overflow-hidden rounded-[32px] vw-glass-elevated`}
    >
      {/* Top bar */}
      <div className="relative flex items-center justify-between border-b border-white/55 bg-white/45 px-6 py-4">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,rgba(var(--vw-stage-rgb),0.75),rgba(34,49,98,0.6),rgba(var(--vw-stage-rgb),0.75))]" />
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/75 bg-white/82 text-[#22345f] shadow-[0_6px_16px_rgba(0,0,0,0.065)]">
            <Bot size={19} strokeWidth={2.2} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#17233f]">VariantWise Chat</p>
            <p className="text-xs text-[#6b7a9d]">Prompt your needs. Filters update progressively.</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {showDeepControls ? (
            <button
              type="button"
              onClick={onOpenDeepControls}
              className="vw-pill"
            >
              <SlidersHorizontal size={13} />
              Go deep
            </button>
          ) : null}
          <button
            type="button"
            onClick={onReset}
            className="vw-pill"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Hero prompt input */}
      <div className="relative border-b border-white/55 bg-white/38 px-6 py-5">
        <span className="vw-accent-orb absolute -right-14 -top-14 opacity-60" />
        
        <div className="relative vw-glass-hero rounded-[26px] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.095)]">
          <textarea
            value={currentMessage}
            onChange={(event) => onCurrentMessageChange(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Tell me your car needs..."
            className="w-full resize-none border-none bg-transparent text-base text-[#1c2a46] placeholder:text-[#8a96ae] focus:outline-none"
            aria-label="Chat input"
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2.5">
              {ACTION_BUTTONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onCurrentMessageChange(action.prompt)}
                    className="vw-icon-btn inline-flex h-10 w-auto items-center gap-2 px-4 text-xs font-semibold"
                  >
                    <Icon size={14} strokeWidth={2.2} />
                    {action.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onSend}
              disabled={isChatLoading || !currentMessage.trim()}
              className="vw-btn-primary h-10 px-5 text-xs"
            >
              Send
              <Send size={14} />
            </button>
          </div>
        </div>

        {conversationStarters.length ? (
          <div className="relative mt-4 flex flex-wrap gap-2.5">
            {conversationStarters.map((starter) => (
              <motion.button
                key={starter}
                type="button"
                onClick={() => onStarterSelect(starter)}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className="vw-pill text-xs"
              >
                {starter}
              </motion.button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Messages area */}
      <div
        ref={chatContainerRef}
        onScroll={onScroll}
        className="custom-scrollbar max-h-[560px] space-y-6 overflow-y-auto px-6 py-6"
      >
        {messages.map((message, index) => {
          const isUser = message.type === "user";
          const sourceLabel = message.controls?.length ? "Preference agent" : "RAG agent";

          return (
            <motion.div
              key={`${message.type}-${index}`}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={reduceMotion ? false : { opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              className={`space-y-2.5 ${isUser ? "text-right" : "text-left"}`}
            >
              {!isUser ? (
                <span className="vw-badge inline-flex text-[10px]">
                  {sourceLabel}
                </span>
              ) : null}

              <div
                className={`inline-block max-w-[90%] rounded-[20px] px-5 py-4 text-[15px] leading-relaxed ${
                  isUser
                    ? "vw-glass-elevated border-white/70 text-[#162443]"
                    : "vw-glass vw-stage-wash border-white/65 text-[#3f537c]"
                }`}
              >
                {message.text}
              </div>

              {message.appliedBadges?.length ? (
                <div className="inline-block max-w-[90%]">
                  <AppliedFiltersChips items={message.appliedBadges} />
                </div>
              ) : null}

              {message.summaryBadges?.length ? (
                <div className="inline-block max-w-[90%]">
                  <ControlBadgeGroup items={message.summaryBadges} />
                </div>
              ) : null}

              {message.controls?.length ? (
                <div className="grid max-w-[90%] gap-4 md:grid-cols-2">
                  {message.controls.map((controlId) => (
                    <div key={controlId} className={controlId === "budget" ? "md:col-span-2" : ""}>
                      {renderControl(controlId, context)}
                    </div>
                  ))}
                </div>
              ) : null}
            </motion.div>
          );
        })}

        {isTyping ? (
          <div className="vw-glass inline-flex rounded-xl px-4 py-2.5 text-xs text-[#5a6c92]">
            Typing...
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      {/* Follow-up section */}
      {showFollowUp ? (
        <div className="border-t border-white/55 bg-white/42 px-6 py-5">
          <div className="vw-stage-longing vw-glass-elevated rounded-[22px] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#68789d]">RAG follow-up</p>
                <p className="mt-1 text-xs leading-relaxed text-[#617192]">
                  Ask recommendation-specific questions after shortlist generation.
                </p>
              </div>
              <Sparkles size={16} className="text-[#4f63a5]" />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <input
                type="text"
                value={followUpPrompt}
                onChange={(event) => onFollowUpChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    onFollowUpAsk();
                  }
                }}
                disabled={followUpDisabled}
                placeholder="Which option has best mileage?"
                className="vw-input h-11 flex-1"
                aria-label="RAG follow-up input"
              />
              <button
                type="button"
                onClick={onFollowUpAsk}
                disabled={followUpDisabled || isFollowUpLoading || !followUpPrompt.trim()}
                className="vw-btn-secondary h-11 px-4 text-xs"
              >
                {isFollowUpLoading ? "..." : "Ask"}
              </button>
            </div>
            {followUpResponse ? (
              <div className="vw-glass mt-4 rounded-xl p-4 text-xs whitespace-pre-line leading-relaxed text-[#44567f]">
                {followUpResponse}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </motion.section>
  );
}
