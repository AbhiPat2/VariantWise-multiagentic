"""
Preference Alignment Engine
Constraint-aware alignment and reranking for recommendation quality.
"""

from typing import Any, Dict, List, Optional, Set, Tuple
import re


_FUEL_SYNONYMS = {
    "petrol": {"petrol", "gasoline"},
    "diesel": {"diesel"},
    "electric": {"electric", "ev", "battery"},
    "cng": {"cng", "compressed natural gas"},
    "hybrid": {"hybrid"},
}

_BODY_SYNONYMS = {
    "suv": {"suv", "sport utility vehicle", "compact suv", "midsize suv"},
    "sedan": {"sedan", "saloon"},
    "hatchback": {"hatchback", "hatch"},
    "muv": {"muv", "mpv", "multi utility vehicle"},
    "crossover": {"crossover"},
}

_TRANSMISSION_SYNONYMS = {
    "automatic": {"automatic", "amt", "cvt", "dct", "ivt"},
    "manual": {"manual", "mt"},
}

_FEATURE_SYNONYMS = {
    "sunroof": {"sunroof", "panoramic", "moonroof"},
    "apple carplay android auto": {"apple carplay", "android auto", "carplay"},
    "automatic climate control": {"automatic climate control", "climate control", "auto ac"},
    "360 camera": {"360 camera", "360", "surround view", "parking camera"},
    "lane assist": {"lane assist", "lane keep", "adas"},
    "ventilated seats": {"ventilated seats", "ventilated"},
    "wireless charging": {"wireless charging", "wireless charger"},
}


def normalize_text(value: Any) -> str:
    """Normalize free-form text for robust matching."""
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9\s]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_brand(value: Any) -> str:
    """Normalize brand name for matching."""
    return normalize_text(value)


def normalize_feature(value: Any) -> str:
    """Normalize feature text to a stable key."""
    return normalize_text(value)


def _to_normalized_set(values: Optional[List[Any]]) -> Set[str]:
    return {normalize_text(v) for v in (values or []) if normalize_text(v)}


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def _to_int(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        text = str(value)
        nums = re.findall(r"\d+", text)
        if not nums:
            return None
        return int(nums[0])
    except Exception:
        return None


def extract_variant_payload(variant_match: Dict) -> Dict:
    """Extract a dict-like car payload from a variant result object."""
    car = variant_match.get("car", {})
    if isinstance(car, dict):
        return car
    if hasattr(car, "to_dict"):
        try:
            return car.to_dict()
        except Exception:
            pass
    if hasattr(car, "get"):
        # pandas Series supports get + keys iteration
        try:
            return {k: car.get(k) for k in car.keys()}
        except Exception:
            return {}
    return {}


def extract_brand_from_payload(car: Dict) -> str:
    """Best-effort brand extraction."""
    brand = normalize_brand(car.get("brand", ""))
    if brand:
        return brand
    variant_name = normalize_text(car.get("variant", "") or car.get("name", ""))
    if not variant_name:
        return ""
    return variant_name.split(" ")[0]


def compile_alignment_rules(
    preferences: Dict,
    user_control_config: Optional[Any],
    must_have_preferences: Optional[List[str]] = None,
) -> Dict:
    """
    Compile hard/soft alignment rules from basic + advanced preferences.
    """
    if user_control_config and not isinstance(user_control_config, dict):
        try:
            user_control_config = user_control_config.to_dict()
        except Exception:
            user_control_config = {}
    controls = user_control_config or {}

    brand_mode = str(controls.get("brand_mode", "any") or "any").lower()
    preferred_brands = _to_normalized_set(controls.get("preferred_brands", []))
    blacklisted_brands = _to_normalized_set(controls.get("blacklisted_brands", []))
    strict_brands = preferred_brands if brand_mode == "strict" else set()

    scoring_priorities = controls.get("scoring_priorities", {}) or {}
    hard_preferences = set(must_have_preferences or [])
    for key in ["fuel_type", "body_type", "transmission", "seating", "features"]:
        try:
            priority = float(scoring_priorities.get(key, 0.5))
        except Exception:
            priority = 0.5
        if priority >= 0.8 and preferences.get(key) not in (None, "", "Any", []):
            hard_preferences.add(key)

    try:
        budget_priority = float(scoring_priorities.get("budget", 0.5))
    except Exception:
        budget_priority = 0.5
    strict_budget = budget_priority >= 0.8

    price_tolerance = controls.get("price_tolerance", 0.2)
    try:
        price_tolerance = float(price_tolerance)
    except Exception:
        price_tolerance = 0.2
    price_tolerance = max(0.02, min(0.5, price_tolerance))

    if strict_budget:
        budget_tolerance = min(price_tolerance, 0.12)
    else:
        budget_tolerance = min(max(0.08, price_tolerance), 0.3)

    must_have_features = _to_normalized_set(controls.get("must_have_features", []))
    nice_to_have_features = _to_normalized_set(controls.get("nice_to_have_features", []))

    return {
        "brand_mode": brand_mode,
        "preferred_brands": preferred_brands,
        "blacklisted_brands": blacklisted_brands,
        "strict_brands": strict_brands,
        "hard_preferences": hard_preferences,
        "strict_budget": strict_budget,
        "budget_tolerance": budget_tolerance,
        "must_have_features": must_have_features,
        "nice_to_have_features": nice_to_have_features,
    }


def has_strict_constraints(rules: Dict) -> bool:
    """Whether current rules should avoid any fallback relaxation."""
    return bool(
        rules.get("strict_brands")
        or rules.get("blacklisted_brands")
        or rules.get("must_have_features")
        or rules.get("strict_budget")
    )


def _matches_with_synonyms(pref_value: Any, actual_value: Any, synonym_map: Dict[str, Set[str]]) -> bool:
    pref = normalize_text(pref_value)
    actual = normalize_text(actual_value)
    if not pref or pref == "any":
        return True
    if not actual:
        return False
    if pref in actual or actual in pref:
        return True
    for key, aliases in synonym_map.items():
        if key in pref:
            return any(alias in actual for alias in aliases)
    return False


def _feature_present(feature_key: str, blob: str) -> bool:
    if not feature_key:
        return False
    if feature_key in blob:
        return True
    aliases = _FEATURE_SYNONYMS.get(feature_key, {feature_key})
    return any(alias in blob for alias in aliases)


def _flatten_car_text(car: Dict) -> str:
    parts = []
    for value in car.values():
        if value is None:
            continue
        parts.append(str(value).lower())
    return " ".join(parts)


def evaluate_variant_alignment(
    variant_match: Dict,
    rules: Dict,
    preferences: Dict,
) -> Dict:
    """
    Evaluate one variant against hard and soft user constraints.
    """
    car = extract_variant_payload(variant_match)
    brand = extract_brand_from_payload(car)
    hard_failures: List[str] = []
    soft_issues: List[str] = []

    blacklisted_brands = set(rules.get("blacklisted_brands", set()))
    strict_brands = set(rules.get("strict_brands", set()))
    preferred_brands = set(rules.get("preferred_brands", set()))
    hard_preferences = set(rules.get("hard_preferences", set()))

    if brand and brand in blacklisted_brands:
        hard_failures.append("blacklisted_brand")

    if strict_brands and brand not in strict_brands:
        hard_failures.append("brand_not_in_strict_list")

    preferred_brand_hit = bool(brand and brand in preferred_brands)

    matched_signals = 0
    total_signals = 0

    budget = preferences.get("budget")
    if isinstance(budget, (tuple, list)) and len(budget) == 2:
        min_budget, max_budget = budget
        price = _to_float(car.get("numeric_price", car.get("price")))
        if price is not None and max_budget:
            total_signals += 1
            budget_tolerance = float(rules.get("budget_tolerance", 0.2))
            if price > float(max_budget) * (1 + budget_tolerance):
                if "budget" in hard_preferences or rules.get("strict_budget"):
                    hard_failures.append("budget_overflow")
                else:
                    soft_issues.append("budget_overflow_soft")
            else:
                matched_signals += 1
            if price < float(min_budget) * 0.6:
                soft_issues.append("budget_too_low")

    pref_fuel = preferences.get("fuel_type")
    if pref_fuel not in (None, "", "Any"):
        total_signals += 1
        actual_fuel = car.get("fuel_type_norm", car.get("Fuel Type", ""))
        if _matches_with_synonyms(pref_fuel, actual_fuel, _FUEL_SYNONYMS):
            matched_signals += 1
        elif "fuel_type" in hard_preferences:
            hard_failures.append("fuel_mismatch")
        else:
            soft_issues.append("fuel_mismatch_soft")

    pref_body = preferences.get("body_type")
    if pref_body not in (None, "", "Any"):
        total_signals += 1
        actual_body = car.get("body_type_norm", car.get("Body Type", ""))
        if _matches_with_synonyms(pref_body, actual_body, _BODY_SYNONYMS):
            matched_signals += 1
        elif "body_type" in hard_preferences:
            hard_failures.append("body_mismatch")
        else:
            soft_issues.append("body_mismatch_soft")

    pref_trans = preferences.get("transmission")
    if pref_trans not in (None, "", "Any"):
        total_signals += 1
        actual_trans = car.get("transmission_norm", car.get("Transmission Type", ""))
        if _matches_with_synonyms(pref_trans, actual_trans, _TRANSMISSION_SYNONYMS):
            matched_signals += 1
        elif "transmission" in hard_preferences:
            hard_failures.append("transmission_mismatch")
        else:
            soft_issues.append("transmission_mismatch_soft")

    pref_seating = _to_int(preferences.get("seating"))
    if pref_seating:
        total_signals += 1
        actual_seating = _to_int(car.get("seating_norm", car.get("Seating Capacity")))
        if actual_seating is not None and actual_seating >= pref_seating:
            matched_signals += 1
        elif "seating" in hard_preferences:
            hard_failures.append("seating_mismatch")
        else:
            soft_issues.append("seating_mismatch_soft")

    feature_blob = _flatten_car_text(car)
    required_features = set(rules.get("must_have_features", set()))
    if "features" in hard_preferences:
        required_features.update(
            normalize_feature(f)
            for f in (preferences.get("features", []) or [])
            if normalize_feature(f)
        )

    for feature in required_features:
        total_signals += 1
        if _feature_present(feature, feature_blob):
            matched_signals += 1
        else:
            hard_failures.append(f"missing_feature:{feature}")

    nice_to_have = set(rules.get("nice_to_have_features", set()))
    nice_hits = 0
    for feature in nice_to_have:
        if _feature_present(feature, feature_blob):
            nice_hits += 1

    base_score = matched_signals / max(1, total_signals)
    if preferred_brand_hit:
        base_score += 0.08
    if nice_to_have:
        base_score += 0.05 * (nice_hits / max(1, len(nice_to_have)))
    base_score -= 0.03 * len(soft_issues)
    alignment_score = max(0.0, min(1.0, base_score))

    return {
        "compliant": len(hard_failures) == 0,
        "hard_failures": hard_failures,
        "soft_issues": soft_issues,
        "preferred_brand_hit": preferred_brand_hit,
        "alignment_score": alignment_score,
    }


def enforce_alignment_on_ranked_variants(
    ranked_variants: List[Dict],
    preferences: Dict,
    rules: Dict,
    min_results: int = 5,
    allow_relaxation: bool = True,
) -> List[Dict]:
    """
    Re-rank with alignment-first logic and optional hard-constraint relaxation.
    """
    if not ranked_variants:
        return []

    compliant: List[Dict] = []
    violated: List[Dict] = []

    for variant in ranked_variants:
        alignment = evaluate_variant_alignment(variant, rules, preferences)
        variant["alignment"] = alignment
        variant["alignment_score"] = float(alignment["alignment_score"])
        variant["hard_failures"] = list(alignment["hard_failures"])

        score_breakdown = variant.get("score_breakdown", {}) or {}
        score_breakdown["alignment_score"] = float(alignment["alignment_score"])
        score_breakdown["hard_failures"] = list(alignment["hard_failures"])

        if alignment["preferred_brand_hit"]:
            boost = 1.15
            if "score" in variant:
                variant["score"] = float(variant["score"]) * boost
            if "combined_score" in variant:
                variant["combined_score"] = float(variant["combined_score"]) * boost
            score_breakdown["preferred_brand_boost"] = boost

        variant["score_breakdown"] = score_breakdown

        if alignment["compliant"]:
            compliant.append(variant)
        else:
            violated.append(variant)

    compliant = sorted(
        compliant,
        key=lambda x: (
            float(x.get("alignment_score", 0.0)),
            float(x.get("combined_score", x.get("score", 0.0))),
        ),
        reverse=True,
    )

    violated = sorted(
        violated,
        key=lambda x: (
            len(x.get("hard_failures", [])),
            -float(x.get("alignment_score", 0.0)),
            -float(x.get("combined_score", x.get("score", 0.0))),
        ),
    )

    if allow_relaxation and len(compliant) < min_results:
        needed = max(0, min_results - len(compliant))
        compliant.extend(violated[:needed])
        compliant.extend(violated[needed:])
        return compliant

    return compliant if not allow_relaxation else compliant + violated

