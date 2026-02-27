import { X } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const formatBudget = (v) =>
  `₹${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`;

const normalizeFeatureList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return trimmed
      .split(/[,\n;|]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export default function AppliedFilterPills({ prefs, userControls, onRemovePref }) {
  const reduceMotion = useReducedMotion();
  const pills = [];
  const features = normalizeFeatureList(prefs?.features);

  if (prefs.min_budget > 0 && prefs.max_budget > 0) {
    pills.push({
      key: "budget",
      label: `${formatBudget(prefs.min_budget)} – ${formatBudget(prefs.max_budget)}`,
      reset: { min_budget: 500000, max_budget: 2000000 },
    });
  }
  if (prefs.body_type && prefs.body_type !== "Any") {
    pills.push({ key: "body_type", label: prefs.body_type, reset: { body_type: "Any" } });
  }
  if (prefs.fuel_type && prefs.fuel_type !== "Any") {
    pills.push({ key: "fuel_type", label: prefs.fuel_type, reset: { fuel_type: "Any" } });
  }
  if (prefs.transmission && prefs.transmission !== "Any") {
    pills.push({ key: "transmission", label: prefs.transmission, reset: { transmission: "Any" } });
  }
  if (prefs.brand && prefs.brand !== "Any" && prefs.brand !== "") {
    pills.push({ key: "brand", label: `Brand: ${prefs.brand}`, reset: { brand: "Any" } });
  }
  if (features.length > 0) {
    features.forEach((f) => {
      pills.push({
        key: `feature-${f}`,
        label: f,
        reset: { features: features.filter((x) => x !== f) },
      });
    });
  }
  if (userControls?.preferred_brands && (Array.isArray(userControls.preferred_brands) ? userControls.preferred_brands.length > 0 : userControls.preferred_brands.trim())) {
    const brands = Array.isArray(userControls.preferred_brands) ? userControls.preferred_brands : userControls.preferred_brands.split(",").map(s => s.trim()).filter(Boolean);
    brands.forEach((b) => {
      pills.push({
        key: `pref-brand-${b}`,
        label: `Prefer: ${b}`,
        stage: "calm",
      });
    });
  }
  if (userControls?.blacklisted_brands && (Array.isArray(userControls.blacklisted_brands) ? userControls.blacklisted_brands.length > 0 : userControls.blacklisted_brands.trim())) {
    const brands = Array.isArray(userControls.blacklisted_brands) ? userControls.blacklisted_brands : userControls.blacklisted_brands.split(",").map(s => s.trim()).filter(Boolean);
    brands.forEach((b) => {
      pills.push({
        key: `block-brand-${b}`,
        label: `Exclude: ${b}`,
        stage: "passion",
      });
    });
  }
  if (userControls?.diversity_mode && userControls.diversity_mode !== "balanced") {
    pills.push({
      key: "diversity",
      label: userControls.diversity_mode.replace(/_/g, " "),
      stage: "longing",
    });
  }
  if (userControls?.comparison_mode) {
    pills.push({
      key: "comparison-mode",
      label: "Comparison mode",
      stage: "longing",
    });
  }
  const comparisonCars = Array.isArray(userControls?.comparison_cars)
    ? userControls.comparison_cars
    : typeof userControls?.comparison_cars === "string"
    ? userControls.comparison_cars.split(/[,\n;]+/g).map((s) => s.trim()).filter(Boolean)
    : [];
  comparisonCars.slice(0, 3).forEach((car) => {
    pills.push({
      key: `comparison-${car}`,
      label: `vs ${car}`,
      stage: "calm",
    });
  });
  if (userControls?.similar_to_car && String(userControls.similar_to_car).trim()) {
    pills.push({
      key: "similar-anchor",
      label: `Like: ${String(userControls.similar_to_car).trim()}`,
      stage: "calm",
    });
  }

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5" role="list" aria-label="Applied filters">
      <AnimatePresence>
        {pills.map((pill) => (
          <motion.span
            key={pill.key}
            role="listitem"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className={`vw-pill-active ${pill.stage ? `vw-stage-${pill.stage}` : ""} inline-flex items-center gap-1 text-[10px] pr-1.5`}
          >
            {pill.label}
            {pill.reset && (
              <button
                onClick={() => onRemovePref(pill.reset)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                aria-label={`Remove ${pill.label}`}
              >
                <X size={10} />
              </button>
            )}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function countApplied(prefs, userControls) {
  let c = 0;
  const features = normalizeFeatureList(prefs?.features);
  if (prefs.min_budget > 0 && prefs.max_budget > 0) c++;
  if (prefs.body_type && prefs.body_type !== "Any") c++;
  if (prefs.fuel_type && prefs.fuel_type !== "Any") c++;
  if (prefs.transmission && prefs.transmission !== "Any") c++;
  if (prefs.brand && prefs.brand !== "Any" && prefs.brand !== "") c++;
  if (features.length > 0) c += features.length;
  if (userControls?.diversity_mode && userControls.diversity_mode !== "balanced") c++;
  if (userControls?.comparison_mode) c++;
  const comparisonCars = userControls?.comparison_cars;
  if (comparisonCars && (Array.isArray(comparisonCars) ? comparisonCars.length > 0 : typeof comparisonCars === "string" && comparisonCars.trim())) c++;
  if (userControls?.similar_to_car && String(userControls.similar_to_car).trim()) c++;
  const pBrands = userControls?.preferred_brands;
  if (pBrands && (Array.isArray(pBrands) ? pBrands.length > 0 : typeof pBrands === "string" && pBrands.trim())) c++;
  const bBrands = userControls?.blacklisted_brands;
  if (bBrands && (Array.isArray(bBrands) ? bBrands.length > 0 : typeof bBrands === "string" && bBrands.trim())) c++;
  return c;
}
