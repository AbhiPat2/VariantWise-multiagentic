import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { SCORING_PRIORITY_OPTIONS } from "../controls-config";

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

function sliderTrackStyle(val, min, max, rgb) {
  const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
  return {
    background: `linear-gradient(90deg, rgba(${rgb}, 0.5) 0%, rgba(${rgb}, 0.35) ${pct}%, rgba(255,255,255,0.08) ${pct}%)`,
  };
}

const parseTokenArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,\n;]+/g)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

function TokenTextInput({ control, value, onChange, id, accentRgb }) {
  const [draft, setDraft] = useState("");
  const tokens = useMemo(() => Array.from(new Set(parseTokenArray(value))), [value]);
  const maxItems = control.maxItems || 8;

  const pushToken = (raw) => {
    const next = String(raw || "").trim();
    if (!next) return;
    if (tokens.includes(next) || tokens.length >= maxItems) {
      setDraft("");
      return;
    }
    onChange({ [id]: [...tokens, next] });
    setDraft("");
  };

  const removeToken = (token) => {
    onChange({ [id]: tokens.filter((t) => t !== token) });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex justify-between items-center">
        <label className="text-[11px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
          {control.label}
        </label>
        <span className="text-[10px] text-[rgba(255,255,255,0.35)]">
          {tokens.length}/{maxItems}
        </span>
      </div>

      <div className="rounded-xl border bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.1)] p-2">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tokens.map((token) => (
            <span
              key={token}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold"
              style={{
                background: `rgba(${accentRgb}, 0.12)`,
                color: `rgb(${accentRgb})`,
                border: `1px solid rgba(${accentRgb}, 0.25)`,
              }}
            >
              {token}
              <button
                type="button"
                className="opacity-75 hover:opacity-100 transition-opacity"
                onClick={() => removeToken(token)}
                aria-label={`Remove ${token}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>

        <input
          type="text"
          className="vw-input h-10 rounded-lg"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={control.placeholder || "Type and press Enter"}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === ";") {
              e.preventDefault();
              pushToken(draft);
            }
          }}
          onBlur={() => pushToken(draft)}
          aria-label={control.label}
        />
      </div>

      {!!control.suggestions?.length && (
        <div className="flex flex-wrap gap-1.5">
          {control.suggestions.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => pushToken(s)}
              disabled={tokens.includes(s) || tokens.length >= maxItems}
              className="px-2.5 py-1.5 rounded-lg text-[10px] border transition-all disabled:opacity-30"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.55)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {control.helper && <p className="text-[10px] text-[rgba(255,255,255,0.3)]">{control.helper}</p>}
    </div>
  );
}

export default function ControlRenderer({
  control,
  value,
  onChange,
  prefs,
  accentRgb = "133,213,237",
  controlsContext = {},
}) {
  const id = control.id;

  switch (control.type) {
    case "budget":
      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
              {control.label}
            </label>
            <span
              className="text-[13px] font-bold px-3 py-1 rounded-lg"
              style={{
                color: `rgb(${accentRgb})`,
                background: `rgba(${accentRgb}, 0.1)`,
                border: `1px solid rgba(${accentRgb}, 0.2)`,
              }}
            >
              {formatPrice(prefs.min_budget)} – {formatPrice(prefs.max_budget)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              className="vw-input text-right font-mono text-white"
              value={prefs.min_budget}
              onChange={(e) => onChange({ min_budget: parseInt(e.target.value) || 0 })}
              placeholder="Min"
              aria-label="Min budget"
            />
            <input
              type="number"
              className="vw-input text-right font-mono text-white"
              value={prefs.max_budget}
              onChange={(e) => onChange({ max_budget: parseInt(e.target.value) || 0 })}
              placeholder="Max"
              aria-label="Max budget"
            />
          </div>
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={prefs.max_budget}
            onChange={(e) => onChange({ max_budget: parseInt(e.target.value) })}
            className="w-full cursor-pointer"
            style={sliderTrackStyle(prefs.max_budget, control.min, control.max, accentRgb)}
            aria-label="Max budget slider"
          />
        </div>
      );

    case "select": {
      const opts = control.options || [];
      const isObjectOpts = opts.length > 0 && typeof opts[0] !== "string";

      return (
        <div className="space-y-3">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
            {control.label}
          </label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={control.label}>
            {opts.map((opt) => {
              const v = isObjectOpts ? opt.value : opt;
              const l = isObjectOpts ? opt.label : opt;
              const isSelected = (value || "") === v;

              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onChange({ [id]: v })}
                  className="px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all duration-200 border cursor-pointer"
                  style={{
                    background: isSelected
                      ? `rgba(${accentRgb}, 0.15)`
                      : "rgba(255,255,255,0.04)",
                    borderColor: isSelected
                      ? `rgba(${accentRgb}, 0.4)`
                      : "rgba(255,255,255,0.1)",
                    color: isSelected
                      ? `rgb(${accentRgb})`
                      : "rgba(255,255,255,0.55)",
                    boxShadow: isSelected
                      ? `0 0 16px rgba(${accentRgb}, 0.1), inset 0 0 8px rgba(${accentRgb}, 0.04)`
                      : "none",
                  }}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    case "slider":
      return (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
              {control.label}
            </label>
            <span
              className="px-2.5 py-1 rounded-lg font-mono text-[12px] font-bold"
              style={{
                background: `rgba(${accentRgb}, 0.12)`,
                color: `rgb(${accentRgb})`,
                border: `1px solid rgba(${accentRgb}, 0.22)`,
              }}
            >
              {typeof value === "number" ? (value < 1 ? `${(value * 100).toFixed(0)}%` : value) : value}
            </span>
          </div>
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={value ?? control.min}
            onChange={(e) => {
              const nextValue = parseFloat(e.target.value);
              if (id === "exploration_rate") {
                onChange({ [id]: nextValue, exploration_rate_set: true });
              } else {
                onChange({ [id]: nextValue });
              }
            }}
            className="w-full cursor-pointer"
            style={sliderTrackStyle(value ?? control.min, control.min, control.max, accentRgb)}
            aria-label={control.label}
          />
          {control.helper && (
            <p className="text-[10px] text-[rgba(255,255,255,0.3)]">{control.helper}</p>
          )}
        </div>
      );

    case "chips": {
      const opts = control.options || [];
      return (
        <div className="space-y-3">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
            {control.label}
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label={control.label}>
            {opts.map((opt) => {
              const chipVal = typeof opt === "string" ? opt : opt.value || opt.id;
              const chipLabel = typeof opt === "string" ? opt : opt.label;
              const arr = Array.isArray(value) ? value : [];
              const selected = arr.includes(chipVal);
              return (
                <button
                  key={chipVal}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  className="px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all duration-200 border cursor-pointer"
                  style={{
                    background: selected
                      ? `rgba(${accentRgb}, 0.15)`
                      : "rgba(255,255,255,0.04)",
                    borderColor: selected
                      ? `rgba(${accentRgb}, 0.4)`
                      : "rgba(255,255,255,0.1)",
                    color: selected
                      ? `rgb(${accentRgb})`
                      : "rgba(255,255,255,0.55)",
                    boxShadow: selected
                      ? `0 0 14px rgba(${accentRgb}, 0.1)`
                      : "none",
                  }}
                  onClick={() => {
                    const newArr = selected ? arr.filter((v) => v !== chipVal) : [...arr, chipVal];
                    onChange({ [id]: newArr });
                  }}
                >
                  {selected && <Check size={11} className="inline mr-1.5 -mt-0.5" strokeWidth={3} />}
                  {chipLabel}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    case "text":
      return (
        <div className="space-y-2.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
            {control.label}
          </label>
          <input
            type="text"
            className="vw-input h-11 rounded-xl"
            value={value || ""}
            onChange={(e) => onChange({ [id]: e.target.value })}
            placeholder={control.placeholder || ""}
            aria-label={control.label}
          />
        </div>
      );

    case "token-text":
      return (
        <TokenTextInput
          control={control}
          value={value}
          onChange={onChange}
          id={id}
          accentRgb={accentRgb}
        />
      );

    case "toggle":
      return (
        <div className="flex items-center justify-between py-2">
          <div>
            <label className="text-[12px] font-bold text-white block">
              {control.label}
            </label>
            {control.helper && (
              <p className="text-[10px] text-[rgba(255,255,255,0.35)] mt-0.5">
                {control.helper}
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            className="relative rounded-full transition-all duration-200 border"
            style={{
              width: "44px",
              height: "24px",
              background: value
                ? `linear-gradient(90deg, rgb(${accentRgb}), rgba(${accentRgb}, 0.7))`
                : "rgba(255,255,255,0.08)",
              borderColor: value
                ? `rgba(${accentRgb}, 0.5)`
                : "rgba(255,255,255,0.15)",
              boxShadow: value
                ? `0 0 14px rgba(${accentRgb}, 0.25)`
                : "none",
            }}
            onClick={() => onChange({ [id]: !value })}
          >
            <span
              className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full transition-transform duration-200 ${
                value ? "bg-white translate-x-[20px] shadow-[0_2px_6px_rgba(0,0,0,0.3)]" : "bg-[rgba(255,255,255,0.35)] translate-x-0"
              }`}
            />
          </button>
        </div>
      );

    case "mode": {
      const modes = [
        { value: "maximum_relevance", label: "Focused", desc: "Best matches", rgb: "255,91,53" },
        { value: "balanced", label: "Balanced", desc: "Mix of best + variety", rgb: "133,213,237" },
        { value: "maximum_diversity", label: "Explore", desc: "Maximum variety", rgb: "160,120,240" },
      ];
      return (
        <div className="space-y-3">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
            {control.label}
          </label>
          <div className="grid grid-cols-3 gap-2.5" role="radiogroup">
            {modes.map((m) => {
              const isActive = value === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className="flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200 border cursor-pointer"
                  style={{
                    background: isActive
                      ? `linear-gradient(180deg, rgba(${m.rgb}, 0.18) 0%, rgba(${m.rgb}, 0.06) 100%)`
                      : "rgba(255, 255, 255, 0.04)",
                    borderColor: isActive
                      ? `rgba(${m.rgb}, 0.4)`
                      : "rgba(255, 255, 255, 0.1)",
                    boxShadow: isActive
                      ? `0 0 18px rgba(${m.rgb}, 0.12)`
                      : "none",
                  }}
                  onClick={() => onChange({ [id]: m.value })}
                >
                  <p
                    className="text-[12px] font-bold"
                    style={{ color: isActive ? `rgb(${m.rgb})` : "rgba(255,255,255,0.7)" }}
                  >
                    {m.label}
                  </p>
                  <p className="text-[9px] text-[rgba(255,255,255,0.35)] mt-1 leading-tight text-center">
                    {m.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    case "scoring":
      const scoringEnabled = Boolean(controlsContext?.exploration_rate_set);
      return (
        <div className="space-y-3">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
            {control.label}
          </label>
          {!scoringEnabled && (
            <p className="text-[10px] font-semibold text-[rgba(255,160,50,0.82)]">
              Set `Exploration Rate` first to unlock scoring priorities.
            </p>
          )}
          <div className="space-y-5 pt-1">
            {SCORING_PRIORITY_OPTIONS.map((sp) => (
              <div key={sp.key} className="group">
                <div className="flex justify-between text-[10px] font-bold mb-2 uppercase tracking-wide">
                  <span style={{ color: `rgba(${accentRgb}, 0.7)` }}>{sp.left}</span>
                  <span className="text-white">{sp.label}</span>
                  <span className="text-[rgba(255,255,255,0.5)]">{sp.right}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={value?.[sp.key] ?? 0.5}
                  disabled={!scoringEnabled}
                  onChange={(e) =>
                    onChange({
                      scoring_priorities: { ...value, [sp.key]: parseFloat(e.target.value) },
                    })
                  }
                  className={`w-full ${scoringEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                  style={sliderTrackStyle(value?.[sp.key] ?? 0.5, 0, 1, accentRgb)}
                  aria-label={sp.label}
                />
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}
