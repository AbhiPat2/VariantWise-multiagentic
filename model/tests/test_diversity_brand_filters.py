import os
import sys
import unittest


MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if MODEL_DIR not in sys.path:
    sys.path.insert(0, MODEL_DIR)

from diversity_reranker import _apply_brand_filters
from user_control_system import BrandPreferenceMode


class DummyConfig:
    def __init__(self, mode, preferred, blacklisted):
        self.brand_mode = mode
        self.preferred_brands = preferred
        self.blacklisted_brands = blacklisted


def _variant(name, brand, score):
    return {
        "car": {"variant": name, "brand": brand},
        "score": float(score),
        "combined_score": float(score),
        "details": {},
    }


class DiversityBrandFilterTests(unittest.TestCase):
    def test_blacklist_applies_even_with_preferred_mode(self):
        config = DummyConfig(
            BrandPreferenceMode.PREFERRED,
            preferred=["Toyota"],
            blacklisted=["Maruti"],
        )
        scored = [
            _variant("Maruti Brezza ZXi", "Maruti", 100),
            _variant("Toyota Hyryder V", "Toyota", 90),
            _variant("Hyundai Creta S", "Hyundai", 95),
        ]

        filtered = _apply_brand_filters(scored, config)
        brands = [v["car"]["brand"].lower() for v in filtered]

        self.assertNotIn("maruti", brands)
        self.assertIn("toyota", brands)
        self.assertIn("hyundai", brands)

        toyota = next(v for v in filtered if v["car"]["brand"].lower() == "toyota")
        hyundai = next(v for v in filtered if v["car"]["brand"].lower() == "hyundai")
        self.assertGreater(toyota["score"], hyundai["score"])

    def test_strict_mode_keeps_only_preferred(self):
        config = DummyConfig(
            BrandPreferenceMode.STRICT,
            preferred=["Honda"],
            blacklisted=[],
        )
        scored = [
            _variant("Honda City VX", "Honda", 80),
            _variant("Tata Nexon XZ", "Tata", 120),
        ]

        filtered = _apply_brand_filters(scored, config)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["car"]["brand"].lower(), "honda")


if __name__ == "__main__":
    unittest.main()

