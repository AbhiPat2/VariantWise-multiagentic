import json
import os
import sys
from typing import Dict, List


EVAL_DIR = os.path.abspath(os.path.dirname(__file__))
MODEL_DIR = os.path.abspath(os.path.join(EVAL_DIR, "..", "model"))
os.chdir(MODEL_DIR)
if MODEL_DIR not in sys.path:
    sys.path.insert(0, MODEL_DIR)

from app import load_car_data, enhanced_matching  # noqa: E402
from recommendation_pipeline import RecommendationPipeline  # noqa: E402
from user_control_system import UserControlConfig  # noqa: E402


def _feature_blob(car: Dict) -> str:
    return " ".join([str(v).lower() for v in car.values() if v is not None])


def _variant_brand(car: Dict) -> str:
    return str(car.get("brand", "")).strip().lower()


def _validate_controls(recommendations: List[Dict], controls: Dict) -> Dict:
    preferred = {str(b).strip().lower() for b in (controls.get("preferred_brands", []) or []) if str(b).strip()}
    blacklisted = {str(b).strip().lower() for b in (controls.get("blacklisted_brands", []) or []) if str(b).strip()}
    brand_mode = str(controls.get("brand_mode", "any")).lower()
    must_features = [str(f).lower() for f in (controls.get("must_have_features", []) or []) if str(f).strip()]

    checks = []
    for rec in recommendations:
        car = rec.get("car", {}) if isinstance(rec, dict) else {}
        brand = _variant_brand(car)
        blob = _feature_blob(car)

        compliant = True
        reasons = []

        if brand and brand in blacklisted:
            compliant = False
            reasons.append("blacklisted_brand")

        if brand_mode == "strict" and preferred and brand not in preferred:
            compliant = False
            reasons.append("outside_strict_brand")

        for feat in must_features:
            if feat not in blob:
                compliant = False
                reasons.append(f"missing_feature:{feat}")

        checks.append(
            {
                "variant": car.get("variant", ""),
                "brand": brand,
                "compliant": compliant,
                "reasons": reasons,
            }
        )

    total = len(checks)
    compliant_count = len([c for c in checks if c["compliant"]])
    return {
        "recommendation_checks": checks,
        "compliant_recommendations": compliant_count,
        "total_recommendations": total,
        "compliance_rate": (compliant_count / total) if total else 1.0,
        "scenario_pass": compliant_count == total and total > 0,
    }


def run_eval():
    df = load_car_data()
    pipeline = RecommendationPipeline()

    scenarios = [
        {
            "name": "strict_honda_only",
            "prefs": {
                "budget": (800000, 1800000),
                "fuel_type": "Petrol",
                "body_type": "Any",
                "transmission": "Any",
                "seating": 5,
                "features": [],
                "performance": 5,
                "brand": "Any",
            },
            "controls": {
                "brand_mode": "strict",
                "preferred_brands": ["Honda"],
                "blacklisted_brands": [],
                "price_tolerance": 0.15,
                "scoring_priorities": {"budget": 0.7},
            },
        },
        {
            "name": "blacklist_maruti",
            "prefs": {
                "budget": (600000, 1600000),
                "fuel_type": "Any",
                "body_type": "Any",
                "transmission": "Any",
                "seating": 5,
                "features": [],
                "performance": 5,
                "brand": "Any",
            },
            "controls": {
                "brand_mode": "blacklist",
                "preferred_brands": [],
                "blacklisted_brands": ["Maruti"],
                "price_tolerance": 0.2,
                "scoring_priorities": {"budget": 0.6},
            },
        },
        {
            "name": "ignore_maruti_prioritize_toyota",
            "prefs": {
                "budget": (900000, 2200000),
                "fuel_type": "Petrol",
                "body_type": "SUV",
                "transmission": "Automatic",
                "seating": 5,
                "features": [],
                "performance": 6,
                "brand": "Any",
            },
            "controls": {
                "brand_mode": "preferred",
                "preferred_brands": ["Toyota"],
                "blacklisted_brands": ["Maruti"],
                "price_tolerance": 0.15,
                "scoring_priorities": {"budget": 0.7, "body_type": 0.8, "transmission": 0.8},
            },
        },
        {
            "name": "must_have_sunroof",
            "prefs": {
                "budget": (1000000, 2500000),
                "fuel_type": "Any",
                "body_type": "SUV",
                "transmission": "Any",
                "seating": 5,
                "features": [],
                "performance": 5,
                "brand": "Any",
            },
            "controls": {
                "brand_mode": "any",
                "preferred_brands": [],
                "blacklisted_brands": [],
                "must_have_features": ["Sunroof"],
                "price_tolerance": 0.2,
                "scoring_priorities": {"features": 0.95, "body_type": 0.8},
            },
        },
        {
            "name": "tight_budget_auto",
            "prefs": {
                "budget": (700000, 1400000),
                "fuel_type": "Petrol",
                "body_type": "Any",
                "transmission": "Automatic",
                "seating": 5,
                "features": [],
                "performance": 4,
                "brand": "Any",
            },
            "controls": {
                "brand_mode": "any",
                "preferred_brands": [],
                "blacklisted_brands": [],
                "price_tolerance": 0.05,
                "scoring_priorities": {"budget": 0.95, "transmission": 0.9},
            },
        },
    ]

    report_rows = []
    all_recs = 0
    all_compliant = 0
    scenario_passes = 0

    for idx, scenario in enumerate(scenarios):
        controls = UserControlConfig.from_dict(scenario["controls"])
        result = pipeline.run_recommendation_pipeline(
            user_input=f"evaluation_case_{scenario['name']}",
            extracted_preferences=scenario["prefs"],
            conversation_history=[],
            variants_dataset=df,
            session_id=f"eval_case_{idx}",
            existing_scoring_function=lambda candidates_df, prefs: enhanced_matching(
                candidates_df,
                prefs,
                user_control_config=controls,
            ),
            user_control_config=controls,
        )

        recommendations = []
        for rec in result.get("recommendations", []):
            car_data = rec.get("car", {})
            if hasattr(car_data, "to_dict"):
                car_data = car_data.to_dict()
            recommendations.append({"car": car_data})

        check = _validate_controls(recommendations, scenario["controls"])
        all_recs += check["total_recommendations"]
        all_compliant += check["compliant_recommendations"]
        scenario_passes += 1 if check["scenario_pass"] else 0

        report_rows.append(
            {
                "scenario": scenario["name"],
                "controls": scenario["controls"],
                "compliance_rate": round(check["compliance_rate"], 4),
                "scenario_pass": check["scenario_pass"],
                "recommendation_checks": check["recommendation_checks"],
            }
        )

    summary = {
        "scenarios": len(scenarios),
        "scenario_pass_rate": round(scenario_passes / len(scenarios), 4),
        "recommendation_compliance_rate": round((all_compliant / all_recs) if all_recs else 1.0, 4),
        "total_recommendations": all_recs,
    }
    report = {
        "summary": summary,
        "results": report_rows,
    }

    output_path = os.path.join(EVAL_DIR, "control_compliance_report.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(json.dumps(summary, indent=2))
    print(f"Saved report to {output_path}")


if __name__ == "__main__":
    run_eval()

