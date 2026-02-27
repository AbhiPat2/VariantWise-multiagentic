import os
import sys
import unittest


MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if MODEL_DIR not in sys.path:
    sys.path.insert(0, MODEL_DIR)

from preference_alignment import (
    compile_alignment_rules,
    enforce_alignment_on_ranked_variants,
    has_strict_constraints,
)


def _variant(name, brand, score, features=None, price=1200000):
    return {
        "car": {
            "variant": name,
            "brand": brand,
            "numeric_price": price,
            "Fuel Type": "Petrol",
            "Body Type": "SUV",
            "Transmission Type": "Automatic",
            "Seating Capacity": 5,
            "features_blob": " ".join(features or []),
        },
        "score": float(score),
        "combined_score": float(score),
        "details": {},
        "score_breakdown": {},
    }


class PreferenceAlignmentTests(unittest.TestCase):
    def setUp(self):
        self.preferences = {
            "budget": (800000, 1500000),
            "fuel_type": "Petrol",
            "body_type": "SUV",
            "transmission": "Automatic",
            "seating": 5,
            "features": [],
        }

    def test_ignore_and_prioritize_work_together(self):
        controls = {
            "brand_mode": "preferred",
            "preferred_brands": ["Toyota"],
            "blacklisted_brands": ["Maruti"],
            "price_tolerance": 0.15,
            "scoring_priorities": {},
        }
        rules = compile_alignment_rules(self.preferences, controls, must_have_preferences=["budget"])
        self.assertTrue(has_strict_constraints(rules))

        ranked = [
            _variant("Maruti Brezza ZXi", "Maruti", 100),
            _variant("Hyundai Creta S", "Hyundai", 98),
            _variant("Toyota Urban Cruiser", "Toyota", 95),
        ]
        filtered = enforce_alignment_on_ranked_variants(
            ranked,
            self.preferences,
            rules,
            allow_relaxation=False,
        )

        brands = [v["car"]["brand"].lower() for v in filtered]
        self.assertNotIn("maruti", brands)
        self.assertEqual(filtered[0]["car"]["brand"].lower(), "toyota")

    def test_strict_brand_only_returns_preferred(self):
        controls = {
            "brand_mode": "strict",
            "preferred_brands": ["Honda"],
            "blacklisted_brands": [],
            "price_tolerance": 0.15,
            "scoring_priorities": {},
        }
        rules = compile_alignment_rules(self.preferences, controls, must_have_preferences=["budget"])

        ranked = [
            _variant("Honda City VX", "Honda", 90),
            _variant("Tata Nexon XZ", "Tata", 120),
        ]
        filtered = enforce_alignment_on_ranked_variants(
            ranked,
            self.preferences,
            rules,
            allow_relaxation=False,
        )

        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["car"]["brand"].lower(), "honda")

    def test_must_have_feature_is_hard_constraint(self):
        controls = {
            "brand_mode": "any",
            "preferred_brands": [],
            "blacklisted_brands": [],
            "must_have_features": ["Sunroof"],
            "price_tolerance": 0.15,
            "scoring_priorities": {},
        }
        rules = compile_alignment_rules(self.preferences, controls, must_have_preferences=["budget"])

        ranked = [
            _variant("Kia Seltos HTK+", "Kia", 99, features=["wireless charging"]),
            _variant("Hyundai Creta SX", "Hyundai", 96, features=["sunroof", "wireless charging"]),
        ]
        filtered = enforce_alignment_on_ranked_variants(
            ranked,
            self.preferences,
            rules,
            allow_relaxation=False,
        )

        self.assertEqual(len(filtered), 1)
        self.assertIn("sunroof", filtered[0]["car"]["features_blob"])


if __name__ == "__main__":
    unittest.main()

