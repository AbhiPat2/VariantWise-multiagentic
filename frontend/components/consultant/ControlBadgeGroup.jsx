import React from "react";

export function ControlBadgeGroup({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => (
        <span
          key={`${item.label || item}-${idx}`}
          className="vw-badge text-[10px]"
        >
          {typeof item === "string" ? item : item.label || item.value || String(item)}
        </span>
      ))}
    </div>
  );
}
