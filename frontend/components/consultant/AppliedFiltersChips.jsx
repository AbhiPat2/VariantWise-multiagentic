import React from "react";

export function AppliedFiltersChips({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => (
        <span
          key={`${item.label || item}-${idx}`}
          className="vw-pill-active inline-flex items-center gap-1.5 text-[11px]"
        >
          {typeof item === "string" ? item : item.label || item.value || String(item)}
        </span>
      ))}
    </div>
  );
}
