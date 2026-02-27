"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { SummaryChips } from "./SummaryChips";
import { LivePreviewCard } from "./LivePreviewCard";

export function ShortlistDrawer({
  open,
  onToggle,
  mobile = false,
  hasSearched,
  isSearching,
  previewRefreshing,
  picks = [],
  confidencePct,
  previewCards = [],
  tradeoffNotes = [],
  onViewFullList,
  onCompare,
  onOpenEvidence,
  onRunSearch,
  stageClass = "vw-stage-calm",
}) {
  if (!open && !mobile) {
    return (
      <aside className="vw-glass flex h-full items-start justify-center rounded-[22px] py-4">
        <button
          type="button"
          onClick={onToggle}
          className="vw-icon-btn h-10 w-10"
          aria-label="Open shortlist drawer"
        >
          <ChevronLeft size={18} />
        </button>
      </aside>
    );
  }

  return (
    <motion.aside
      initial={mobile ? { y: 20, opacity: 0 } : { x: 12, opacity: 0 }}
      animate={mobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
      exit={mobile ? { y: 20, opacity: 0 } : { x: 12, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`${stageClass} rounded-[28px] vw-glass-elevated p-5`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#67779c]">Shortlist</p>
          <p className="mt-1.5 text-sm font-semibold text-[#17233f]">Your picks and top matches</p>
        </div>

        {!mobile ? (
          <button
            type="button"
            onClick={onToggle}
            className="vw-icon-btn h-9 w-9"
            aria-label="Collapse shortlist drawer"
          >
            <ChevronRight size={16} />
          </button>
        ) : null}
      </div>

      <div className="space-y-5">
        <section className="vw-glass rounded-[20px] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#66779c]">Your picks</p>
          <div className="mt-3">
            <SummaryChips items={picks} emptyLabel="No picks yet. Start with budget and body style." />
          </div>
          <p className="mt-4 text-xs font-medium text-[#617192]">
            {confidencePct != null ? `${confidencePct}% confidence` : "Confidence appears after shortlist generation."}
          </p>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1b2a49]">Top matches</p>
            <p className="text-xs font-medium text-[#617192]">
              {hasSearched ? `${previewCards.length} shown` : "Not generated"}
            </p>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {previewRefreshing ? (
              <motion.div
                key="drawer-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`drawer-skeleton-${index}`} className="vw-glass rounded-[20px] p-5">
                    <div className="h-4 w-2/3 rounded skeleton-shimmer" />
                    <div className="mt-3 h-3 w-1/3 rounded skeleton-shimmer" />
                    <div className="mt-4 h-2 rounded skeleton-shimmer" />
                    <div className="mt-2 h-2 rounded skeleton-shimmer" />
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="drawer-preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {previewCards.length ? (
                  previewCards.map((entry) => (
                    <LivePreviewCard
                      key={`${entry.match?.car?.variant || "preview"}-${entry.index}`}
                      match={entry.match}
                      reasons={entry.reasons}
                      onWhy={() => onOpenEvidence(entry.index)}
                    />
                  ))
                ) : (
                  <div className="vw-glass rounded-[20px] border border-dashed border-white/75 p-5 text-center">
                    <p className="text-xs text-[#5e6f93]">Run consultant to generate matches.</p>
                    <button type="button" onClick={onRunSearch} className="vw-btn-primary mt-4 px-4 py-2.5 text-xs">
                      <Search size={15} />
                      {isSearching ? "Searching..." : "Find matches"}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onViewFullList}
              className="vw-btn-secondary px-3 py-2.5 text-xs"
            >
              View full list
            </button>
            <button
              type="button"
              onClick={onCompare}
              className="vw-btn-secondary px-3 py-2.5 text-xs"
            >
              Compare
            </button>
          </div>
        </section>

        <section className="vw-glass rounded-[20px] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#66779c]">Trade-offs</p>
          {tradeoffNotes.length ? (
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[#4c5f86]">
              {tradeoffNotes.map((item, index) => (
                <li key={`${item}-${index}`} className="vw-accent-strip flex items-start gap-3 pl-4">
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-[#617192]">No strong exclusions yet. Filters are broad.</p>
          )}
        </section>
      </div>
    </motion.aside>
  );
}
