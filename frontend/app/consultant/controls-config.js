export const FEATURE_OPTIONS = [
  "Sunroof",
  "Apple CarPlay/Android Auto",
  "Automatic Climate Control",
  "360 Camera",
  "Lane Assist",
  "Ventilated Seats",
  "Wireless Charging",
];

export const USE_CASE_OPTIONS = [
  { id: "city_commute", label: "City Commute" },
  { id: "highway", label: "Highway Trips" },
  { id: "family_trips", label: "Family Trips" },
  { id: "weekend", label: "Weekend/Fun" },
];

export const SCORING_PRIORITY_OPTIONS = [
  { key: "budget", label: "Budget Importance", left: "Low", right: "High" },
  { key: "fuel_type", label: "Fuel Type Importance", left: "Flexible", right: "Specific" },
  { key: "body_type", label: "Body Type Importance", left: "Flexible", right: "Specific" },
  { key: "transmission", label: "Transmission Importance", left: "Flexible", right: "Specific" },
  { key: "seating", label: "Seating Importance", left: "Flexible", right: "Strict" },
  { key: "features", label: "Features Importance", left: "Nice-to-have", right: "Must-have" },
  { key: "performance", label: "Performance Importance", left: "Efficiency", right: "Power" },
];

export const DEFAULT_PREFS = {
  min_budget: 500000,
  max_budget: 2000000,
  fuel_type: "Any",
  body_type: "Any",
  transmission: "Any",
  seating: 5,
  features: [],
  performance: 5,
  brand: "Any",
};

export const DEFAULT_USER_CONTROLS = {
  diversity_mode: "balanced",
  relevance_weight: 0.7,
  diversity_weight: 0.3,
  brand_mode: "any",
  preferred_brands: [],
  blacklisted_brands: [],
  price_preference: null,
  price_tolerance: 0.2,
  must_have_features: [],
  nice_to_have_features: [],
  feature_weights: {},
  use_cases: [],
  use_case_weights: {},
  comparison_mode: false,
  comparison_cars: [],
  similar_to_car: "",
  exploration_rate: 0.1,
  exploration_rate_set: false,
  objective_weights: {
    relevance: 0.5,
    brand_diversity: 0.2,
    feature_diversity: 0.15,
    price_coverage: 0.1,
    exploration: 0.05,
  },
  scoring_priorities: {
    budget: 0.5,
    fuel_type: 0.5,
    body_type: 0.5,
    transmission: 0.5,
    seating: 0.5,
    features: 0.5,
    performance: 0.5,
  },
  showAdvanced: false,
};

const fuelOptions = ["Any", "Petrol", "Diesel", "Electric", "CNG", "Hybrid"];
const bodyOptions = ["Any", "SUV", "Sedan", "Hatchback", "MUV", "Crossover"];
const transmissionOptions = ["Any", "Manual", "Automatic", "CVT", "DCT", "AMT"];

export const BASIC_CONTROLS = [
  {
    id: "budget",
    label: "Budget Range",
    type: "budget",
    helper: "The price band you want to stay within.",
    min: 100000,
    max: 10000000,
    step: 50000,
  },
  {
    id: "body_type",
    label: "Body Style",
    type: "select",
    options: bodyOptions,
    helper: "SUV, sedan, hatchback, or stay open.",
  },
  {
    id: "fuel_type",
    label: "Fuel Type",
    type: "select",
    options: fuelOptions,
    helper: "Petrol, diesel, electric, or flexible.",
  },
  {
    id: "transmission",
    label: "Transmission",
    type: "select",
    options: transmissionOptions,
    helper: "Manual, automatic, or both.",
  },
  {
    id: "seating",
    label: "Seating Capacity",
    type: "slider",
    min: 2,
    max: 9,
    step: 1,
    helper: "Minimum seats required.",
  },
  {
    id: "features",
    label: "Core Features",
    type: "chips",
    options: FEATURE_OPTIONS,
    helper: "Pick features you care about.",
  },
  {
    id: "performance",
    label: "Performance Priority",
    type: "slider",
    min: 1,
    max: 10,
    step: 1,
    helper: "Balance comfort vs power.",
  },
  {
    id: "brand",
    label: "Brand (Optional)",
    type: "text",
    placeholder: "Any brand or type a name",
    helper: "Leave blank to keep it open.",
  },
];

export const ADVANCED_CONTROLS = [
  {
    id: "diversity_mode",
    label: "Recommendation Style",
    type: "mode",
    helper: "Balance best-match vs variety.",
  },
  {
    id: "brand_mode",
    label: "Brand Rule",
    type: "select",
    options: [
      { value: "any", label: "Any brand" },
      { value: "preferred", label: "Prefer specific brands" },
      { value: "strict", label: "Only specific brands" },
      { value: "blacklist", label: "Exclude specific brands" },
    ],
  },
  {
    id: "preferred_brands",
    label: "Preferred Brands",
    type: "token-text",
    placeholder: "Type a brand and press Enter",
    suggestions: ["Honda", "Toyota", "Hyundai", "Kia", "Mahindra", "Tata", "Skoda", "Volkswagen"],
    maxItems: 8,
    helper: "Used as positive ranking signal (or strict filter when Brand Rule is strict).",
  },
  {
    id: "blacklisted_brands",
    label: "Excluded Brands",
    type: "token-text",
    placeholder: "Type a brand to exclude",
    suggestions: ["Maruti", "Renault", "Nissan", "Citroen", "MG"],
    maxItems: 8,
    helper: "Hard exclusion: these brands are removed before final ranking.",
  },
  {
    id: "price_preference",
    label: "Budget Focus",
    type: "select",
    options: [
      { value: "", label: "No preference" },
      { value: "lower", label: "Lower end of budget" },
      { value: "mid", label: "Mid-range" },
      { value: "higher", label: "Higher end / premium" },
    ],
  },
  {
    id: "price_tolerance",
    label: "Budget Flexibility",
    type: "slider",
    min: 0.05,
    max: 0.5,
    step: 0.05,
    helper: "How much you can stretch beyond max budget.",
  },
  {
    id: "must_have_features",
    label: "Must-Have Features",
    type: "chips",
    options: FEATURE_OPTIONS,
  },
  {
    id: "nice_to_have_features",
    label: "Nice-to-Have Features",
    type: "chips",
    options: FEATURE_OPTIONS,
  },
  {
    id: "use_cases",
    label: "Primary Use Cases",
    type: "chips",
    options: USE_CASE_OPTIONS.map((u) => ({ value: u.id, label: u.label })),
  },
  {
    id: "comparison_mode",
    label: "Comparison Mode",
    type: "toggle",
  },
  {
    id: "comparison_cars",
    label: "Cars to Compare",
    type: "token-text",
    placeholder: "Add comparison anchors (e.g., City, Creta, Seltos)",
    suggestions: ["Honda City", "Hyundai Creta", "Kia Seltos", "Maruti Brezza", "Skoda Kushaq", "VW Taigun"],
    maxItems: 5,
    helper: "Ranking biases toward variants that are similar to these anchors.",
  },
  {
    id: "similar_to_car",
    label: "Find Similar To",
    type: "text",
    placeholder: "Honda City",
    helper: "Single strong anchor for similarity search.",
  },
  {
    id: "exploration_rate",
    label: "Exploration Rate",
    type: "slider",
    min: 0,
    max: 0.5,
    step: 0.05,
    helper: "How open you are to wildcard picks.",
  },
  {
    id: "scoring_priorities",
    label: "Scoring Priorities",
    type: "scoring",
  },
];

export const CONTROL_REGISTRY = [...BASIC_CONTROLS, ...ADVANCED_CONTROLS].reduce(
  (acc, control) => {
    acc[control.id] = control;
    return acc;
  },
  {}
);
