import React from "react";

export function ControlBadgeGroup({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => (
        <span
          key={`${item}-${idx}`}
          className="rounded-full border border-[rgba(var(--vw-stage-rgb),0.33)] bg-[rgba(var(--vw-stage-soft-rgb),0.36)] px-3 py-1 text-xs text-[#2f4c7e]"
        >
          {item}
        </span>
      ))}
    </div>
  );
}
