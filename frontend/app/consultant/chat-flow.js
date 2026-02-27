const CORE_PREFS = ["body_type", "fuel_type", "transmission", "seating"];

const SIGNALS = {
  strictBudget: ["strict budget", "no stretch", "hard budget", "tight budget"],
  variety: ["more options", "variety", "explore", "something different"],
  compare: ["compare", "comparison", "vs", "versus"],
  brand: ["brand", "avoid", "prefer", "only", "not toyota", "not tata"],
  features: ["feature", "sunroof", "ventilated", "carplay", "camera"],
  similar: ["similar to", "like", "same as"],
};

const hasBudget = (prefs) =>
  Number(prefs.min_budget) > 0 && Number(prefs.max_budget) > 0;

const countCore = (prefs) =>
  CORE_PREFS.reduce((acc, key) => {
    const value = prefs[key];
    if (key === "seating") return acc + (Number(value) > 0 ? 1 : 0);
    return acc + (value && value !== "Any" ? 1 : 0);
  }, 0);

const matchSignals = (text) => {
  if (!text) return {};
  const lower = text.toLowerCase();
  return Object.entries(SIGNALS).reduce((acc, [key, phrases]) => {
    acc[key] = phrases.some((phrase) => lower.includes(phrase));
    return acc;
  }, {});
};

export function shouldTriggerSearch(prefs) {
  if (!hasBudget(prefs)) return false;
  return countCore(prefs) >= 2;
}

export function getNextControlIds({ prefs, userControls, lastUserMessage }) {
  const next = [];
  const signals = matchSignals(lastUserMessage);

  if (!hasBudget(prefs)) {
    next.push("budget");
    return next;
  }

  if (countCore(prefs) < 2) {
    CORE_PREFS.forEach((key) => {
      if (next.length >= 2) return;
      if (key === "seating") {
        if (!prefs.seating) next.push("seating");
        return;
      }
      if (!prefs[key] || prefs[key] === "Any") next.push(key);
    });
    return next;
  }

  if (signals.strictBudget) next.push("price_tolerance");
  if (signals.variety) next.push("diversity_mode", "exploration_rate");
  if (signals.compare) next.push("comparison_mode", "comparison_cars");
  if (signals.brand) next.push("brand_mode", "preferred_brands", "blacklisted_brands");
  if (signals.features) next.push("must_have_features", "nice_to_have_features");
  if (signals.similar) next.push("similar_to_car");

  if (next.length === 0) {
    if (!userControls.use_cases?.length) next.push("use_cases");
    if (!userControls.price_preference) next.push("price_preference");
  }

  return Array.from(new Set(next));
}
