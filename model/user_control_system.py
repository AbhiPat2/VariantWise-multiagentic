"""
Advanced User Control System for VariantWise
Handles user-controlled parameters, edge cases, and advanced preferences

Author: VariantWise Team
"""

from typing import Dict, List, Optional, Tuple
from enum import Enum
import numpy as np
import re


class DiversityMode(Enum):
    """User-controlled diversity modes"""
    MAXIMUM_RELEVANCE = "maximum_relevance"  # Best matches only (exploitation)
    BALANCED = "balanced"  # Default: 70% relevance, 30% diversity
    MAXIMUM_DIVERSITY = "maximum_diversity"  # Maximum variety (exploration)
    CUSTOM = "custom"  # User sets exact weights


class BrandPreferenceMode(Enum):
    """Brand preference handling modes"""
    ANY = "any"  # No brand preference
    PREFERRED = "preferred"  # Prefer these brands (boost score)
    STRICT = "strict"  # ONLY these brands (hard filter)
    BLACKLIST = "blacklist"  # Exclude these brands (hard filter)

class UserControlConfig:
    """
    User-controlled configuration for recommendations.
    
    Edge Cases Handled:
    1. Relevance vs Diversity trade-off
    2. Brand preferences (prefer/strict/blacklist)
    3. Price range refinement within budget
    4. Feature priorities (must-have vs nice-to-have)
    5. Use case specific recommendations
    6. Comparison mode (compare specific cars)
    7. Exploration vs Exploitation
    8. Conflicting preferences resolution
    9. Similar-to car recommendations
    10. Multi-use-case recommendations
    """
    
    def __init__(self):
        # Core controls
        self.diversity_mode: DiversityMode = DiversityMode.BALANCED
        self.relevance_weight: float = 0.7  # 0-1, how much weight to relevance
        self.diversity_weight: float = 0.3  # 0-1, how much weight to diversity
        
        # Brand controls
        self.brand_mode: BrandPreferenceMode = BrandPreferenceMode.ANY
        self.preferred_brands: List[str] = []  # Brands to prefer/require
        self.blacklisted_brands: List[str] = []  # Brands to exclude
        
        # Price refinement
        self.price_preference: Optional[str] = None  # "lower", "mid", "higher", None
        self.price_tolerance: float = 0.2  # 20% flexibility within budget
        
        # Feature priorities
        self.must_have_features: List[str] = []  # Hard requirements
        self.nice_to_have_features: List[str] = []  # Soft preferences
        self.feature_weights: Dict[str, float] = {}  # Custom feature weights
        
        # Use case
        self.use_cases: List[str] = []  # ["city_commute", "highway", "family_trips"]
        self.use_case_weights: Dict[str, float] = {}  # Weight per use case
        
        # Comparison mode
        self.comparison_mode: bool = False
        self.comparison_cars: List[str] = []  # Variant names to compare
        
        # Similarity mode
        self.similar_to_car: Optional[str] = None  # Find cars similar to this
        self.similarity_threshold: float = 0.7  # How similar (0-1)
        
        # Exploration
        self.exploration_rate: float = 0.1  # 10% chance to show wildcard
        self.exploration_rate_set: bool = False  # UI gate: priorities activate after user sets exploration
        self.show_different_from_seen: bool = False  # Avoid previously seen
        
        # Multi-objective
        self.objective_weights: Dict[str, float] = {
            'relevance': 0.5,
            'brand_diversity': 0.2,
            'feature_diversity': 0.15,
            'price_coverage': 0.1,
            'exploration': 0.05
        }

        # Scoring priorities (0-1): user-controlled importance per factor
        self.scoring_priorities: Dict[str, float] = {
            'budget': 0.5,
            'fuel_type': 0.5,
            'body_type': 0.5,
            'transmission': 0.5,
            'seating': 0.5,
            'features': 0.5,
            'performance': 0.5
        }
        
        # Conflict resolution
        self.conflict_resolution: str = "prioritize_budget"  # "prioritize_budget", "prioritize_features", "ask_user"
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API/JSON serialization"""
        return {
            'diversity_mode': self.diversity_mode.value,
            'relevance_weight': self.relevance_weight,
            'diversity_weight': self.diversity_weight,
            'brand_mode': self.brand_mode.value,
            'preferred_brands': self.preferred_brands,
            'blacklisted_brands': self.blacklisted_brands,
            'price_preference': self.price_preference,
            'price_tolerance': self.price_tolerance,
            'must_have_features': self.must_have_features,
            'nice_to_have_features': self.nice_to_have_features,
            'feature_weights': self.feature_weights,
            'use_cases': self.use_cases,
            'use_case_weights': self.use_case_weights,
            'comparison_mode': self.comparison_mode,
            'comparison_cars': self.comparison_cars,
            'similar_to_car': self.similar_to_car,
            'similarity_threshold': self.similarity_threshold,
            'exploration_rate': self.exploration_rate,
            'exploration_rate_set': self.exploration_rate_set,
            'show_different_from_seen': self.show_different_from_seen,
            'objective_weights': self.objective_weights,
            'scoring_priorities': self.scoring_priorities,
            'conflict_resolution': self.conflict_resolution
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'UserControlConfig':
        """Create from dictionary"""
        config = cls()

        def _clamp(value, min_val, max_val, default):
            try:
                return max(min_val, min(max_val, float(value)))
            except Exception:
                return default

        if 'diversity_mode' in data:
            config.diversity_mode = DiversityMode(data['diversity_mode'])
        if 'relevance_weight' in data:
            config.relevance_weight = _clamp(data['relevance_weight'], 0.0, 1.0, config.relevance_weight)
        if 'diversity_weight' in data:
            config.diversity_weight = _clamp(data['diversity_weight'], 0.0, 1.0, config.diversity_weight)
        if 'brand_mode' in data:
            config.brand_mode = BrandPreferenceMode(data['brand_mode'])
        if 'preferred_brands' in data:
            config.preferred_brands = data['preferred_brands']
        if 'blacklisted_brands' in data:
            config.blacklisted_brands = data['blacklisted_brands']
        if 'price_preference' in data:
            config.price_preference = data['price_preference']
        if 'price_tolerance' in data:
            config.price_tolerance = _clamp(data['price_tolerance'], 0.0, 0.5, config.price_tolerance)
        if 'must_have_features' in data:
            config.must_have_features = data['must_have_features']
        if 'nice_to_have_features' in data:
            config.nice_to_have_features = data['nice_to_have_features']
        if 'feature_weights' in data:
            config.feature_weights = data['feature_weights']
        if 'use_cases' in data:
            config.use_cases = data['use_cases']
        if 'use_case_weights' in data:
            config.use_case_weights = data['use_case_weights']
        if 'comparison_mode' in data:
            config.comparison_mode = data['comparison_mode']
        if 'comparison_cars' in data:
            config.comparison_cars = data['comparison_cars']
        if 'similar_to_car' in data:
            config.similar_to_car = data['similar_to_car']
        if 'similarity_threshold' in data:
            config.similarity_threshold = _clamp(data['similarity_threshold'], 0.0, 1.0, config.similarity_threshold)
        if 'exploration_rate' in data:
            config.exploration_rate = _clamp(data['exploration_rate'], 0.0, 0.5, config.exploration_rate)
        if 'exploration_rate_set' in data:
            config.exploration_rate_set = bool(data['exploration_rate_set'])
        elif 'exploration_rate' in data:
            # Backward-compatible: if rate arrives from client, consider it explicitly set.
            config.exploration_rate_set = True
        if 'show_different_from_seen' in data:
            config.show_different_from_seen = data['show_different_from_seen']
        if 'objective_weights' in data:
            config.objective_weights = data['objective_weights']
        if 'scoring_priorities' in data:
            merged_priorities = {**config.scoring_priorities, **(data['scoring_priorities'] or {})}
            config.scoring_priorities = {
                key: _clamp(value, 0.0, 1.0, 0.5)
                for key, value in merged_priorities.items()
            }
        if 'conflict_resolution' in data:
            config.conflict_resolution = data['conflict_resolution']

        # Gate priority controls until exploration has been explicitly set by user.
        if not config.exploration_rate_set:
            config.scoring_priorities = {
                'budget': 0.5,
                'fuel_type': 0.5,
                'body_type': 0.5,
                'transmission': 0.5,
                'seating': 0.5,
                'features': 0.5,
                'performance': 0.5,
            }
        return config

    def get_priority(self, key: str, default: float = 0.5) -> float:
        """Return validated scoring priority for a dimension."""
        try:
            value = float((self.scoring_priorities or {}).get(key, default))
        except Exception:
            value = default
        return max(0.0, min(1.0, value))

    def get_constraint_strictness(self, key: str) -> float:
        """
        Compute strictness as a blend of user priority and exploration openness.
        0.0 => fully soft, 1.0 => fully hard.
        """
        priority = self.get_priority(key, 0.5)
        exploration_norm = max(0.0, min(1.0, self.exploration_rate / 0.5))
        strictness = (0.68 * priority) + (0.32 * (1.0 - exploration_norm))
        return max(0.0, min(1.0, strictness))
    
    def apply_diversity_mode(self):
        """Apply diversity mode to weights"""
        if self.diversity_mode == DiversityMode.MAXIMUM_RELEVANCE:
            self.relevance_weight = 0.95
            self.diversity_weight = 0.05
        elif self.diversity_mode == DiversityMode.BALANCED:
            self.relevance_weight = 0.7
            self.diversity_weight = 0.3
        elif self.diversity_mode == DiversityMode.MAXIMUM_DIVERSITY:
            self.relevance_weight = 0.4
            self.diversity_weight = 0.6
        # CUSTOM mode: user sets weights manually


class EdgeCaseHandler:
    """
    Handles edge cases in user preferences and recommendations.
    """
    
    @staticmethod
    def detect_conflicts(preferences: Dict, control_config: UserControlConfig) -> List[Dict]:
        """
        Detect conflicting preferences.
        
        Returns:
            List of conflict descriptions
        """
        conflicts = []
        
        # Conflict 1: Luxury features but low budget
        if control_config.must_have_features:
            luxury_features = ['sunroof', 'panoramic', 'leather', 'ventilated', 'premium']
            has_luxury = any(f.lower() in luxury_features for f in control_config.must_have_features)
            if has_luxury and preferences.get('budget'):
                budget_max = preferences['budget'][1] if isinstance(preferences['budget'], tuple) else preferences['budget']
                if budget_max < 1500000:  # Under 15L
                    conflicts.append({
                        'type': 'luxury_budget_conflict',
                        'message': 'Luxury features typically cost more. Consider increasing budget or relaxing features.',
                        'severity': 'medium'
                    })
        
        # Conflict 2: Strict brand preference but no matches
        if control_config.brand_mode == BrandPreferenceMode.STRICT and control_config.preferred_brands:
            # This will be checked during filtering
            conflicts.append({
                'type': 'strict_brand_warning',
                'message': f'Only showing cars from: {", ".join(control_config.preferred_brands)}',
                'severity': 'low'
            })
        
        # Conflict 3: Too many must-have features
        if len(control_config.must_have_features) > 5:
            conflicts.append({
                'type': 'too_many_requirements',
                'message': f'You have {len(control_config.must_have_features)} must-have features. This may limit options significantly.',
                'severity': 'medium'
            })
        
        # Conflict 4: Exploration but strict preferences
        if control_config.exploration_rate > 0.2 and control_config.brand_mode == BrandPreferenceMode.STRICT:
            conflicts.append({
                'type': 'exploration_conflict',
                'message': 'High exploration rate conflicts with strict brand preference.',
                'severity': 'low'
            })
        
        return conflicts
    
    @staticmethod
    def resolve_conflicts(preferences: Dict, control_config: UserControlConfig) -> Tuple[Dict, UserControlConfig]:
        """
        Automatically resolve conflicts based on conflict_resolution strategy.
        
        Returns:
            (resolved_preferences, updated_config)
        """
        conflicts = EdgeCaseHandler.detect_conflicts(preferences, control_config)
        
        if control_config.conflict_resolution == "prioritize_budget":
            # If budget conflict, relax features
            for conflict in conflicts:
                if conflict['type'] == 'luxury_budget_conflict':
                    # Move some features from must-have to nice-to-have
                    luxury_features = ['sunroof', 'panoramic', 'leather', 'ventilated']
                    for feature in control_config.must_have_features[:]:
                        if any(lux in feature.lower() for lux in luxury_features):
                            control_config.must_have_features.remove(feature)
                            control_config.nice_to_have_features.append(feature)
        
        elif control_config.conflict_resolution == "prioritize_features":
            # If feature conflict, suggest budget increase
            for conflict in conflicts:
                if conflict['type'] == 'luxury_budget_conflict':
                    # Suggest 20% budget increase
                    if isinstance(preferences['budget'], tuple):
                        min_b, max_b = preferences['budget']
                        preferences['budget'] = (min_b, int(max_b * 1.2))
        
        return preferences, control_config
    
    @staticmethod
    def validate_config(control_config: UserControlConfig) -> Tuple[bool, List[str]]:
        """
        Validate user control config.
        
        Returns:
            (is_valid, list_of_errors)
        """
        errors = []
        
        # Check weights sum to 1
        if abs(control_config.relevance_weight + control_config.diversity_weight - 1.0) > 0.01:
            errors.append("Relevance and diversity weights must sum to 1.0")
        
        # Check objective weights sum to 1
        total_obj_weight = sum(control_config.objective_weights.values())
        if abs(total_obj_weight - 1.0) > 0.01:
            errors.append("Objective weights must sum to 1.0")

        # Check scoring priorities are in range
        for key, value in control_config.scoring_priorities.items():
            if value < 0 or value > 1:
                errors.append(f"Scoring priority '{key}' must be between 0 and 1")
        
        # Check brand mode consistency
        if control_config.brand_mode == BrandPreferenceMode.STRICT and not control_config.preferred_brands:
            errors.append("Strict brand mode requires at least one preferred brand")
        
        if control_config.brand_mode == BrandPreferenceMode.BLACKLIST and not control_config.blacklisted_brands:
            errors.append("Blacklist mode requires at least one blacklisted brand")
        
        # Check exploration rate
        if control_config.exploration_rate < 0 or control_config.exploration_rate > 1:
            errors.append("Exploration rate must be between 0 and 1")
        
        return len(errors) == 0, errors


class AdvancedPreferenceExtractor:
    """
    Advanced preference extraction with edge case detection.
    """
    
    @staticmethod
    def extract_user_controls(user_input: str, conversation_history: List[Dict]) -> UserControlConfig:
        """
        Extract user control preferences from natural language.
        
        Examples:
        - "I want maximum diversity" -> MAXIMUM_DIVERSITY
        - "Only show me Honda cars" -> STRICT brand mode
        - "I prefer Toyota but open to others" -> PREFERRED brand mode
        - "No Maruti cars" -> BLACKLIST brand mode
        - "Show me cars similar to City" -> Similarity mode
        - "Compare City and Creta" -> Comparison mode
        """
        config = UserControlConfig()
        user_lower = user_input.lower()
        
        # Diversity mode detection
        if any(phrase in user_lower for phrase in ['maximum diversity', 'more variety', 'show different', 'explore']):
            config.diversity_mode = DiversityMode.MAXIMUM_DIVERSITY
        elif any(phrase in user_lower for phrase in ['best match', 'most relevant', 'top matches', 'exact match']):
            config.diversity_mode = DiversityMode.MAXIMUM_RELEVANCE
        elif any(phrase in user_lower for phrase in ['balanced', 'mix', 'variety']):
            config.diversity_mode = DiversityMode.BALANCED
        
        # Brand preference detection
        brands = [
            'maruti', 'hyundai', 'tata', 'mahindra', 'kia', 'honda',
            'toyota', 'volkswagen', 'skoda', 'mg', 'nissan', 'renault',
            'jeep', 'citroen', 'byd', 'audi', 'bmw', 'mercedes', 'lexus',
            'porsche', 'mini', 'volvo', 'isuzu'
        ]

        preferred = []
        blacklisted = []

        def add_unique(target_list, value):
            if value and value not in target_list:
                target_list.append(value)

        for brand in brands:
            brand_title = brand.title()

            strict_patterns = [
                f'only {brand}', f'just {brand}', f'{brand} only'
            ]
            blacklist_patterns = [
                f'no {brand}', f'avoid {brand}', f'ignore {brand}',
                f'exclude {brand}', f'dont want {brand}', f"don't want {brand}",
                f'not {brand}'
            ]
            preferred_patterns = [
                f'prefer {brand}', f'like {brand}', f'prioritize {brand}',
                f'priority to {brand}', f'focus on {brand}'
            ]

            if any(p in user_lower for p in strict_patterns):
                config.brand_mode = BrandPreferenceMode.STRICT
                add_unique(preferred, brand_title)
                continue

            if any(p in user_lower for p in blacklist_patterns):
                add_unique(blacklisted, brand_title)

            if any(p in user_lower for p in preferred_patterns):
                add_unique(preferred, brand_title)

        # Generic command patterns for commands like:
        # "ignore maruti and tata", "give priority to toyota, honda"
        ignore_match = re.search(
            r'(?:ignore|exclude|avoid|no)\s+([a-z0-9,&\s-]+?)(?:\s+(?:brand|brands))?(?:$|[.;]| but )',
            user_lower
        )
        if ignore_match:
            segment = ignore_match.group(1)
            for brand in brands:
                if brand in segment:
                    add_unique(blacklisted, brand.title())

        priority_match = re.search(
            r'(?:prioriti[sz]e|give priority to|focus on|prefer)\s+([a-z0-9,&\s-]+?)(?:\s+(?:brand|brands))?(?:$|[.;]| but )',
            user_lower
        )
        if priority_match:
            segment = priority_match.group(1)
            for brand in brands:
                if brand in segment:
                    add_unique(preferred, brand.title())

        config.preferred_brands = preferred
        config.blacklisted_brands = blacklisted
        if config.brand_mode != BrandPreferenceMode.STRICT:
            if blacklisted and not preferred:
                config.brand_mode = BrandPreferenceMode.BLACKLIST
            elif preferred:
                config.brand_mode = BrandPreferenceMode.PREFERRED
        
        # Price preference
        if 'lower end' in user_lower or 'cheaper' in user_lower or 'budget' in user_lower:
            config.price_preference = "lower"
        elif 'higher end' in user_lower or 'premium' in user_lower or 'luxury' in user_lower:
            config.price_preference = "higher"
        elif 'mid' in user_lower or 'middle' in user_lower:
            config.price_preference = "mid"

        # Budget flexibility / strictness
        if any(phrase in user_lower for phrase in ['strict budget', 'tight budget', 'fixed budget', 'cannot stretch', "can't stretch"]):
            config.price_tolerance = 0.05
            config.scoring_priorities['budget'] = 0.9
        elif any(phrase in user_lower for phrase in ['flexible budget', 'can stretch', 'slightly over', 'okay to go over']):
            config.price_tolerance = 0.3
            config.scoring_priorities['budget'] = 0.6

        # Feature importance
        if any(phrase in user_lower for phrase in ['features matter most', 'feature rich', 'loaded with features', 'tech is priority']):
            config.scoring_priorities['features'] = 0.9
        elif any(phrase in user_lower for phrase in ['features not important', "don't care about features", 'no feature preference']):
            config.scoring_priorities['features'] = 0.2

        # Performance importance
        if any(phrase in user_lower for phrase in ['performance', 'power', 'sporty', 'fast', 'torque']):
            config.scoring_priorities['performance'] = 0.9
        elif any(phrase in user_lower for phrase in ['mileage', 'efficiency', 'comfort over performance']):
            config.scoring_priorities['performance'] = 0.2

        # Fuel type strictness
        if any(phrase in user_lower for phrase in ['only petrol', 'only diesel', 'only electric', 'only cng']):
            config.scoring_priorities['fuel_type'] = 0.9
        elif any(phrase in user_lower for phrase in ['fuel type doesn\'t matter', 'any fuel', 'no fuel preference']):
            config.scoring_priorities['fuel_type'] = 0.2

        # Body type strictness
        if any(phrase in user_lower for phrase in ['only suv', 'must be suv', 'only sedan', 'must be sedan', 'only hatchback', 'must be hatchback']):
            config.scoring_priorities['body_type'] = 0.9

        # Transmission strictness
        if any(phrase in user_lower for phrase in ['only automatic', 'automatic only', 'must be automatic', 'only manual', 'manual only', 'must be manual']):
            config.scoring_priorities['transmission'] = 0.9

        # Seating strictness
        if any(phrase in user_lower for phrase in ['7 seater', '7-seater', '8 seater', '8-seater', 'must seat']):
            config.scoring_priorities['seating'] = 0.9
        
        # Comparison mode
        if 'compare' in user_lower or 'vs' in user_lower or 'versus' in user_lower:
            config.comparison_mode = True
            # Extract car names (simplified - would use NER in production)
            car_pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b'
            matches = re.findall(car_pattern, user_input)
            config.comparison_cars = matches[:5]  # Max 5 cars
        
        # Similarity mode
        if 'similar to' in user_lower or 'like' in user_lower:
            # Extract car name after "similar to" or "like"
            match = re.search(r'(?:similar to|like)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', user_input)
            if match:
                config.similar_to_car = match.group(1)
        
        # Use case detection
        use_cases = {
            'city_commute': ['city', 'commute', 'daily', 'urban'],
            'highway': ['highway', 'long drive', 'road trip'],
            'family_trips': ['family', 'trips', 'vacation'],
            'weekend': ['weekend', 'fun', 'sporty']
        }
        
        detected_use_cases = []
        for use_case, keywords in use_cases.items():
            if any(kw in user_lower for kw in keywords):
                detected_use_cases.append(use_case)
        
        config.use_cases = detected_use_cases
        
        # Apply diversity mode to weights
        config.apply_diversity_mode()
        
        return config
