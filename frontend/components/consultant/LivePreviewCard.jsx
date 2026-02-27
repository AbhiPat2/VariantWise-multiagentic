import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";

export function LivePreviewCard({ match, reasons = [], onWhy }) {
  if (!match?.car) {
    return (
      <div className="vw-glass rounded-[20px] border border-dashed border-white/75 p-5 text-center">
        <p className="text-sm font-semibold text-[#223353]">No match yet</p>
        <p className="mt-2 text-xs text-[#6c7b9d]">Run consultant to preview top variants.</p>
      </div>
    );
  }

  const confidence = match.confidence || match.score;

  return (
    <div className="group vw-card-lift relative overflow-hidden vw-glass-elevated rounded-[20px] p-5">
      <span className="vw-accent-orb-sm pointer-events-none absolute -right-6 -top-6 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="vw-accent-strip absolute left-0 top-0 bottom-0 w-0.5 opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[15px] font-semibold leading-tight text-[#17233f]">{match.car.variant}</p>
          <p className="mt-2 text-base font-bold text-[rgb(var(--vw-stage-rgb))]">{match.car.price}</p>
        </div>
        {confidence != null ? (
          <div className="vw-badge shrink-0 text-[10px]">
            {Math.round(confidence * 100)}%
          </div>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2 text-xs leading-relaxed text-[#4f5f83]">
        {reasons.slice(0, 3).map((reason, idx) => (
          <li key={`${reason}-${idx}`} className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[rgba(var(--vw-stage-rgb),0.85)]" />
            <span>{reason}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onWhy}
        className="vw-icon-btn mt-4 inline-flex h-9 w-auto items-center gap-2 px-4 text-xs font-semibold"
      >
        <Sparkles size={13} />
        Why this
        <ArrowRight size={13} />
      </button>
    </div>
  );
}
