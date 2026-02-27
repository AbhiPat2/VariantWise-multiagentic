"""
Dynamic Scoring Configuration System
No hardcoded rules - everything is configurable and learnable

Author: VariantWise Team
"""

from typing import Dict, Optional
from dataclasses import dataclass, field
import json


@dataclass
class DynamicScoringWeights:
    """
    Dynamic scoring weights - can be adjusted per user, learned, or configured.
    No hardcoded values!
    """
    # Budget scoring
    budget_within_range: float = 10.0
    budget_slightly_over: float = 5.0
    budget_tolerance_multiplier: float = 1.2  # How much over budget is acceptable
    
    # Feature matching
    fuel_type_match: float = 8.0
    body_type_match: float = 7.0
    transmission_match: float = 6.0
    seating_match: float = 5.0
    feature_match_per_item: float = 3.0
    
    # Performance
    performance_base_threshold: float = 100.0  # bhp threshold
    performance_multiplier: float = 0.4
    
    # Best match criteria
    budget_buffer_percentage: float = 0.05  # 5% buffer
    
    # Diversity parameters
    max_variants_per_brand: int = 2
    brand_penalty_factor: float = 0.7  # Exponential penalty base
    diversity_weight: float = 0.3  # MMR lambda
    relevance_weight: float = 0.7
    
    # Similarity weights (for diversity)
    brand_similarity_weight: float = 0.4
    body_type_similarity_weight: float = 0.2
    price_tier_similarity_weight: float = 0.2
    feature_similarity_weight: float = 0.2
    
    # Price tier thresholds
    price_tier_similar_threshold: float = 0.1  # 10% price difference = similar
    price_tier_moderate_threshold: float = 0.2  # 20% price difference = moderate
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            'budget_within_range': self.budget_within_range,
            'budget_slightly_over': self.budget_slightly_over,
            'budget_tolerance_multiplier': self.budget_tolerance_multiplier,
            'fuel_type_match': self.fuel_type_match,
            'body_type_match': self.body_type_match,
            'transmission_match': self.transmission_match,
            'seating_match': self.seating_match,
            'feature_match_per_item': self.feature_match_per_item,
            'performance_base_threshold': self.performance_base_threshold,
            'performance_multiplier': self.performance_multiplier,
            'budget_buffer_percentage': self.budget_buffer_percentage,
            'max_variants_per_brand': self.max_variants_per_brand,
            'brand_penalty_factor': self.brand_penalty_factor,
            'diversity_weight': self.diversity_weight,
            'relevance_weight': self.relevance_weight,
            'brand_similarity_weight': self.brand_similarity_weight,
            'body_type_similarity_weight': self.body_type_similarity_weight,
            'price_tier_similarity_weight': self.price_tier_similarity_weight,
            'feature_similarity_weight': self.feature_similarity_weight,
            'price_tier_similar_threshold': self.price_tier_similar_threshold,
            'price_tier_moderate_threshold': self.price_tier_moderate_threshold
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'DynamicScoringWeights':
        """Create from dictionary"""
        return cls(**{k: v for k, v in data.items() if hasattr(cls, k)})
    
    @classmethod
    def from_user_preferences(cls, user_prefs: Dict, user_control_config: Optional[Dict] = None) -> 'DynamicScoringWeights':
        """
        Dynamically adjust weights based on user preferences and controls.
        
        Examples:
        - User wants maximum diversity → lower max_variants_per_brand, higher diversity_weight
        - User has strict budget → higher budget_within_range weight
        - User prioritizes features → higher feature_match_per_item
        """
        config = cls()

        if user_control_config and not isinstance(user_control_config, dict):
            # Support UserControlConfig objects
            try:
                user_control_config = user_control_config.to_dict()
            except Exception:
                user_control_config = None

        def clamp(value: float, min_val: float, max_val: float) -> float:
            return max(min_val, min(max_val, value))

        def priority_value(priorities: Dict, key: str, default: float = 0.5) -> float:
            try:
                return clamp(float(priorities.get(key, default)), 0.0, 1.0)
            except Exception:
                return default

        if user_control_config:
            # Adjust diversity based on user control
            if user_control_config.get('diversity_mode') == 'maximum_diversity':
                # FIXED: For maximum diversity, use max_per_brand=1 to force different brands
                config.max_variants_per_brand = 1  # Only 1 per brand for true diversity
                config.diversity_weight = 0.7  # Even more weight to diversity
                config.relevance_weight = 0.3
                config.brand_penalty_factor = 0.2  # Very aggressive penalty (80% reduction)
            elif user_control_config.get('diversity_mode') == 'maximum_relevance':
                config.max_variants_per_brand = 5  # Allow more from same brand
                config.diversity_weight = 0.05
                config.relevance_weight = 0.95
                config.brand_penalty_factor = 0.9  # Less aggressive penalty
            
            # Adjust based on brand preference mode
            if user_control_config.get('brand_mode') == 'strict':
                config.max_variants_per_brand = 10  # No limit if strict brand preference
                config.brand_penalty_factor = 1.0  # No penalty

            # Respect explicit relevance/diversity weights if provided
            if user_control_config.get('diversity_weight') is not None:
                try:
                    config.diversity_weight = clamp(float(user_control_config.get('diversity_weight')), 0.0, 1.0)
                except Exception:
                    pass
            if user_control_config.get('relevance_weight') is not None:
                try:
                    config.relevance_weight = clamp(float(user_control_config.get('relevance_weight')), 0.0, 1.0)
                except Exception:
                    pass
            # Keep weights normalized if both provided
            total = config.diversity_weight + config.relevance_weight
            if total > 0:
                config.diversity_weight = config.diversity_weight / total
                config.relevance_weight = config.relevance_weight / total

            # Budget flexibility (price_tolerance) affects budget tolerance + buffer
            price_tolerance = user_control_config.get('price_tolerance')
            if isinstance(price_tolerance, (int, float)):
                tol = clamp(float(price_tolerance), 0.0, 0.5)
                flex = tol / 0.5  # 0..1
                # Higher flexibility → allow more over-budget and wider buffer
                config.budget_tolerance_multiplier = max(
                    config.budget_tolerance_multiplier,
                    1.0 + 0.5 * flex
                )
                config.budget_buffer_percentage = max(
                    config.budget_buffer_percentage,
                    0.02 + 0.08 * flex
                )
                # Re-balance within vs slightly-over budget scoring
                config.budget_within_range = max(4.0, config.budget_within_range * (1.1 - 0.2 * flex))
                config.budget_slightly_over = max(2.0, config.budget_slightly_over * (0.7 + 0.6 * flex))

            # Scoring priorities (0-1) scale dynamic weights
            scoring_priorities = user_control_config.get('scoring_priorities', {}) or {}
            if not bool(user_control_config.get('exploration_rate_set', True)):
                scoring_priorities = {}
            budget_priority = priority_value(scoring_priorities, 'budget')
            fuel_priority = priority_value(scoring_priorities, 'fuel_type')
            body_priority = priority_value(scoring_priorities, 'body_type')
            transmission_priority = priority_value(scoring_priorities, 'transmission')
            seating_priority = priority_value(scoring_priorities, 'seating')
            features_priority = priority_value(scoring_priorities, 'features')
            performance_priority = priority_value(scoring_priorities, 'performance')

            # Scale base weights (0.5x to 1.5x)
            budget_scale = 0.5 + budget_priority
            config.budget_within_range *= budget_scale
            config.budget_slightly_over *= budget_scale

            config.fuel_type_match *= (0.5 + fuel_priority)
            config.body_type_match *= (0.5 + body_priority)
            config.transmission_match *= (0.5 + transmission_priority)
            config.seating_match *= (0.5 + seating_priority)
            config.feature_match_per_item *= (0.5 + features_priority)
            config.performance_multiplier *= (0.5 + performance_priority)

            # Must-have features increase feature weight
            must_have = user_control_config.get('must_have_features', []) or []
            if must_have:
                config.feature_match_per_item = max(
                    config.feature_match_per_item,
                    3.0 + min(3.0, 0.4 * len(must_have))
                )
        
        # Adjust weights based on preference specificity (without clobbering
        # explicit advanced-control scaling already applied above).
        if user_prefs.get('fuel_type') != 'Any':
            config.fuel_type_match = max(config.fuel_type_match, 10.0)
        else:
            config.fuel_type_match = max(3.5, config.fuel_type_match * 0.72)
        
        if user_prefs.get('body_type') != 'Any':
            config.body_type_match = max(config.body_type_match, 9.0)
        else:
            config.body_type_match = max(3.0, config.body_type_match * 0.68)
        
        if user_prefs.get('transmission') != 'Any':
            config.transmission_match = max(config.transmission_match, 8.0)
        else:
            config.transmission_match = max(2.5, config.transmission_match * 0.65)
        
        # Adjust feature weight based on number of features
        num_features = len(user_prefs.get('features', []))
        if num_features > 0:
            config.feature_match_per_item = max(config.feature_match_per_item, 4.0)
        else:
            config.feature_match_per_item = max(1.8, config.feature_match_per_item * 0.7)
        
        # Adjust budget tolerance based on budget range
        budget_range = user_prefs.get('budget', [0, 10000000])
        if isinstance(budget_range, tuple):
            budget_span = budget_range[1] - budget_range[0]
        else:
            budget_span = budget_range[1] - budget_range[0]
        
        # Segment-aware budget tolerance (tight for <= 15L)
        max_budget = budget_range[1] if isinstance(budget_range, (list, tuple)) and len(budget_range) == 2 else 0
        if max_budget and max_budget <= 1500000:
            config.budget_tolerance_multiplier = min(config.budget_tolerance_multiplier, 1.12)
            config.budget_buffer_percentage = min(config.budget_buffer_percentage, 0.03)
            config.budget_within_range = max(config.budget_within_range, 12.0)
            config.budget_slightly_over = min(config.budget_slightly_over, 4.0)
            # Value-for-money emphasis in <= 15L segment
            config.feature_match_per_item = max(config.feature_match_per_item, 3.0)
        else:
            # Wider budget range = more tolerance
            if budget_span > 1000000:  # > 10L range
                config.budget_tolerance_multiplier = max(config.budget_tolerance_multiplier, 1.3)
            else:
                config.budget_tolerance_multiplier = max(config.budget_tolerance_multiplier, 1.1)
        
        return config


class AdaptiveScoringSystem:
    """
    Adaptive scoring that learns from user interactions.
    Adjusts weights dynamically based on feedback.
    """
    
    def __init__(self):
        self.user_feedback_history = {}  # session_id -> feedback
        self.learned_weights = DynamicScoringWeights()
    
    def update_from_feedback(self, session_id: str, feedback: Dict):
        """
        Learn from user feedback and adjust weights.
        
        feedback format:
        {
            'accepted_variants': ['variant1', 'variant2'],
            'rejected_variants': ['variant3'],
            'preferences': {...}
        }
        """
        if session_id not in self.user_feedback_history:
            self.user_feedback_history[session_id] = []
        
        self.user_feedback_history[session_id].append(feedback)
        
        # Analyze feedback to adjust weights
        # Example: If user consistently rejects high-scoring variants from same brand,
        # increase diversity_weight
        
        accepted_brands = set()
        rejected_brands = set()
        
        for fb in self.user_feedback_history[session_id]:
            for variant in fb.get('accepted_variants', []):
                # Extract brand from variant
                accepted_brands.add(self._extract_brand(variant))
            
            for variant in fb.get('rejected_variants', []):
                rejected_brands.add(self._extract_brand(variant))
        
        # If user rejects many variants from same brand, increase diversity
        if len(rejected_brands) > 0 and len(accepted_brands) > len(rejected_brands):
            self.learned_weights.diversity_weight = min(0.5, self.learned_weights.diversity_weight + 0.05)
            self.learned_weights.max_variants_per_brand = max(1, self.learned_weights.max_variants_per_brand - 1)
    
    def _extract_brand(self, variant: str) -> str:
        """Extract brand from variant name"""
        # Simple extraction - can be improved
        parts = variant.split()
        if len(parts) > 0:
            return parts[0]
        return "Unknown"
    
    def get_weights(self, user_prefs: Dict, user_control_config: Optional[Dict] = None) -> DynamicScoringWeights:
        """
        Get dynamic weights for a user.
        Combines learned weights with user-specific adjustments.
        """
        base_weights = DynamicScoringWeights.from_user_preferences(user_prefs, user_control_config)
        
        # Blend with learned weights
        blended = DynamicScoringWeights()
        blend_factor = 0.3  # 30% learned, 70% user-specific
        
        blended.diversity_weight = (
            blend_factor * self.learned_weights.diversity_weight +
            (1 - blend_factor) * base_weights.diversity_weight
        )
        
        blended.max_variants_per_brand = int(
            blend_factor * self.learned_weights.max_variants_per_brand +
            (1 - blend_factor) * base_weights.max_variants_per_brand
        )
        
        # Copy other weights from base (user-specific)
        for attr in ['budget_within_range', 'fuel_type_match', 'body_type_match',
                     'transmission_match', 'seating_match', 'feature_match_per_item']:
            setattr(blended, attr, getattr(base_weights, attr))
        
        return blended


# Global adaptive system instance
adaptive_scoring = AdaptiveScoringSystem()
