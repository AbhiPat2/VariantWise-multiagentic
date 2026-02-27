import React from "react";

export function SummaryChips({ items = [], emptyLabel = "No items yet." }) {
  if (!items.length) {
    return <p className="text-xs text-[#617192]">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => (
        <span
          key={`${item.label || item}-${idx}`}
          className="vw-pill text-[11px]"
        >
          {typeof item === "string" ? item : item.label || item.value || String(item)}
        </span>
      ))}
    </div>
  );
}
