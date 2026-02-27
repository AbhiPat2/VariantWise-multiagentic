"""
Diversity Re-Ranker for Car Recommendations

Implements Maximal Marginal Relevance (MMR) and brand diversity 
to ensure varied, high-quality recommendations.

Author: VariantWise Team
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Tuple
from collections import defaultdict


class DiversityReranker:
    """
    Re-ranks recommendations to balance relevance with diversity.
    
    Uses multiple diversity signals:
    1. Brand diversity (avoid showing 5 cars from same brand)
    2. Price tier diversity (mix of budget ranges)
    3. Feature diversity (different feature sets)
    4. Body type diversity (if user doesn't have strong preference)
    """
    
    def __init__(self, lambda_diversity: float = 0.3):
        """
        Args:
            lambda_diversity: Weight for diversity vs relevance (0-1)
                             0 = pure relevance, 1 = pure diversity
                             Recommended: 0.2-0.4 for balanced results
        """
        self.lambda_diversity = lambda_diversity
    
    def rerank(self, 
               scored_variants: List[Dict], 
               top_k: int = 20,
               preferences: Dict = None,
               similarity_weights=None) -> List[Dict]:
        """
        Re-rank variants using Maximal Marginal Relevance (MMR).
        
        MMR Formula:
        Score(i) = λ * Relevance(i) - (1-λ) * max_j∈Selected Similarity(i,j)
        
        Args:
            scored_variants: List of {car, score, details} dicts
            top_k: Number of results to return
            preferences: User preferences for intelligent diversity
        
        Returns:
            Re-ranked list of variants with diversity
        """
        if len(scored_variants) <= top_k:
            return scored_variants
        
        # Normalize scores to 0-1 range
        max_score = max(v['score'] for v in scored_variants)
        min_score = min(v['score'] for v in scored_variants)
        score_range = max_score - min_score if max_score > min_score else 1
        
        for variant in scored_variants:
            variant['normalized_score'] = (variant['score'] - min_score) / score_range
        
        # Start with highest scoring item
        selected = [scored_variants[0]]
        remaining = scored_variants[1:]
        
        # Iteratively select items that maximize MMR
        while len(selected) < top_k and remaining:
            mmr_scores = []
            
            for idx, candidate in enumerate(remaining):
                # Relevance component
                relevance = candidate['normalized_score']
                
                # Diversity component: calculate similarity to already selected items (DYNAMIC weights)
                max_similarity = max(
                    self._calculate_similarity(candidate, selected_item, similarity_weights)
                    for selected_item in selected
                )
                
                # MMR score
                mmr = (self.lambda_diversity * relevance - 
                       (1 - self.lambda_diversity) * max_similarity)
                
                mmr_scores.append((mmr, idx, candidate))
            
            # Select item with highest MMR score
            _, best_idx, best_candidate = max(mmr_scores, key=lambda x: x[0])
            selected.append(best_candidate)
            remaining.pop(best_idx)
        
        # Restore original scores for consistency
        for variant in selected:
            variant.pop('normalized_score', None)
        
        return selected
    
    def _calculate_similarity(self, variant1: Dict, variant2: Dict, similarity_weights=None) -> float:
        """
        Calculate similarity between two car variants (DYNAMIC weights).
        
        Considers:
        - Brand (DYNAMIC weight - avoid same brand domination)
        - Body type (DYNAMIC weight)
        - Price tier (DYNAMIC weight)
        - Feature overlap (DYNAMIC weight)
        
        Args:
            variant1: First variant dict
            variant2: Second variant dict
            similarity_weights: Optional DynamicScoringWeights for similarity weights
        
        Returns:
            Similarity score (0-1, where 1 = identical)
        """
        from dynamic_scoring_config import DynamicScoringWeights
        
        if similarity_weights is None:
            similarity_weights = DynamicScoringWeights()
        
        car1 = variant1['car']
        car2 = variant2['car']
        
        similarity = 0.0
        
        # Brand similarity (DYNAMIC weight - most important for diversity)
        brand1 = str(car1.get('brand', '')).lower()
        brand2 = str(car2.get('brand', '')).lower()
        if brand1 == brand2 and brand1:
            similarity += similarity_weights.brand_similarity_weight
        
        # Body type similarity (DYNAMIC weight)
        body1 = str(car1.get('Body Type', '')).lower()
        body2 = str(car2.get('Body Type', '')).lower()
        if body1 and body2 and (body1 in body2 or body2 in body1):
            similarity += similarity_weights.body_type_similarity_weight
        
        # Price tier similarity (DYNAMIC weight and thresholds)
        price1 = car1.get('numeric_price')
        price2 = car2.get('numeric_price')
        if pd.notna(price1) and pd.notna(price2):
            price_diff = abs(price1 - price2) / max(price1, price2)
            # Use dynamic thresholds
            if price_diff < similarity_weights.price_tier_similar_threshold:
                similarity += similarity_weights.price_tier_similarity_weight
            elif price_diff < similarity_weights.price_tier_moderate_threshold:
                similarity += similarity_weights.price_tier_similarity_weight * 0.5
        
        # Feature overlap (DYNAMIC weight)
        features1 = set(self._extract_features(car1))
        features2 = set(self._extract_features(car2))
        
        if features1 and features2:
            jaccard = len(features1.intersection(features2)) / len(features1.union(features2))
            similarity += similarity_weights.feature_similarity_weight * jaccard
        
        return similarity
    
    def _extract_features(self, car) -> List[str]:
        """Extract feature keywords from car data."""
        features = []
        
        # Key feature columns to check
        feature_columns = [
            'variant', 'Body Type', 'Fuel Type', 'Transmission Type',
            'Seating Capacity', 'Max Power', 'Max Torque'
        ]
        
        for col in feature_columns:
            val = car.get(col)
            if pd.notna(val):
                features.append(str(val).lower())
        
        return features
    
    def apply_brand_diversity_penalty(self, 
                                     scored_variants: List[Dict],
                                     max_per_brand: int = 2,
                                     penalty_factor: float = 0.7,
                                     enforce_strict: bool = False) -> List[Dict]:
        """
        Apply penalty to ensure brand diversity.
        
        Strategy: 
        - If enforce_strict=True: Hard filter - only keep max_per_brand from each brand
        - If enforce_strict=False: Soft penalty - exponential penalty after threshold
        
        Args:
            scored_variants: Sorted list of variants
            max_per_brand: Max variants per brand in top results (DYNAMIC)
            penalty_factor: Penalty multiplier (DYNAMIC)
            enforce_strict: If True, hard filter instead of penalty
        
        Returns:
            Re-scored list with brand diversity enforced
        """
        if enforce_strict:
            # HARD FILTER: Only keep top N variants per brand
            brand_counts = {}
            filtered_variants = []
            
            for variant in scored_variants:
                brand = str(variant['car'].get('brand', 'Unknown')).lower()
                brand_counts[brand] = brand_counts.get(brand, 0) + 1
                
                if brand_counts[brand] <= max_per_brand:
                    filtered_variants.append(variant)
                # Otherwise, skip (hard filter)
            
            return filtered_variants
        
        else:
            # SOFT PENALTY: Apply exponential penalty
            brand_counts = {}
            penalized_variants = []
            
            total_variants = len(scored_variants)
            top_window = max(5, int(total_variants * 0.15)) if total_variants else 5
            
            for idx, variant in enumerate(scored_variants):
                brand = str(variant['car'].get('brand', 'Unknown')).lower()
                brand_counts[brand] = brand_counts.get(brand, 0) + 1
                
                # Apply exponential penalty after threshold (DYNAMIC penalty_factor)
                if brand_counts[brand] > max_per_brand:
                    # Quality-aware: reduce penalty for top-ranked variants
                    penalty_factor_eff = penalty_factor
                    if idx < top_window:
                        penalty_factor_eff = min(0.9, penalty_factor + 0.2)
                    penalty = penalty_factor_eff ** (brand_counts[brand] - max_per_brand)
                    # Apply penalty to both score and combined_score
                    if 'score' in variant:
                        variant['score'] = variant['score'] * penalty
                    if 'combined_score' in variant:
                        variant['combined_score'] = variant['combined_score'] * penalty
                    details = variant.get('details', {}) or {}
                    details['diversity_penalty'] = f"Brand diversity (#{brand_counts[brand]} from {brand.title()})"
                    variant['details'] = details
                
                penalized_variants.append(variant)
            
            # Re-sort after penalty (use combined_score if available, else score)
            return sorted(penalized_variants, 
                key=lambda x: x.get('combined_score', x.get('score', 0)), 
                reverse=True)


class PreferenceElicitor:
    """
    Intelligent preference extraction that asks clarifying questions
    to better understand user needs.
    """
    
    @staticmethod
    def generate_clarifying_questions(initial_preferences: Dict, 
                                      conversation_history: List[Dict]) -> List[Dict]:
        """
        Generate smart follow-up questions to refine preferences.
        
        Returns:
            List of questions with context
        """
        questions = []
        
        # Check if budget is very broad
        budget_range = initial_preferences['budget']
        budget_span = budget_range[1] - budget_range[0]
        if budget_span > 1000000:  # > 10L range
            questions.append({
                'type': 'budget_refinement',
                'question': "Your budget range is quite broad. Would you prefer to stay closer to the lower end or are you flexible to spend more for better features?",
                'options': ['Lower end', 'Mid-range', 'Higher end', 'Flexible']
            })
        
        # Brand preference unclear
        if initial_preferences.get('brand') == 'Any':
            questions.append({
                'type': 'brand_preference',
                'question': "Do you have any brand preferences or brands you'd like to avoid?",
                'options': ['No preference', 'Prefer Korean (Hyundai/Kia)', 
                           'Prefer Japanese (Honda/Toyota)', 'Prefer Indian (Maruti/Tata)',
                           'Prefer European']
            })
        
        # Feature priorities unclear
        if len(initial_preferences.get('features', [])) == 0:
            questions.append({
                'type': 'feature_priorities',
                'question': "What matters most to you in a car?",
                'options': ['Safety features', 'Tech & connectivity', 
                           'Comfort & space', 'Performance & handling',
                           'Fuel efficiency', 'Premium features']
            })
        
        # Use case unclear
        questions.append({
            'type': 'use_case',
            'question': "How do you primarily plan to use this car?",
            'options': ['Daily city commute', 'Long highway drives', 
                       'Family trips', 'Weekend getaways', 'Mixed usage']
        })
        
        # Trade-off preferences
        if budget_range[1] < 2000000:  # Budget under 20L
            questions.append({
                'type': 'tradeoff',
                'question': "If you had to choose, what would you prioritize?",
                'options': ['More features in lower price', 
                           'Better build quality even if pricier',
                           'Proven reliability & low maintenance',
                           'Latest tech & design']
            })
        
        return questions[:2]  # Return top 2 most relevant questions


class SmartFeatureExtractor:
    """
    Advanced NLP-based feature extraction from user input.
    """
    
    INTENT_KEYWORDS = {
        'safety': ['safe', 'airbag', 'abs', 'esp', 'crash', 'safety', 'secure', 'protection'],
        'comfort': ['comfort', 'spacious', 'legroom', 'soft', 'cushion', 'plush', 'ergonomic'],
        'performance': ['fast', 'powerful', 'speed', 'acceleration', 'turbo', 'bhp', 'sporty'],
        'efficiency': ['mileage', 'fuel', 'efficient', 'economy', 'kmpl', 'running cost'],
        'tech': ['touchscreen', 'android auto', 'apple carplay', 'connectivity', 'digital', 'tech'],
        'luxury': ['premium', 'luxury', 'plush', 'leather', 'sunroof', 'panoramic', 'ambient'],
        'reliability': ['reliable', 'dependable', 'low maintenance', 'durable', 'proven'],
        'space': ['spacious', 'roomy', 'big', 'large', 'family', '7 seater', 'cargo']
    }
    
    @staticmethod
    def extract_implicit_preferences(user_text: str) -> Dict[str, float]:
        """
        Extract implicit preference signals from natural language.
        
        Returns:
            Dict of preference dimensions and their weights (0-1)
        """
        user_text_lower = user_text.lower()
        preferences = {}
        
        for intent, keywords in SmartFeatureExtractor.INTENT_KEYWORDS.items():
            # Count keyword matches
            match_count = sum(1 for kw in keywords if kw in user_text_lower)
            if match_count > 0:
                # Normalize to 0-1 scale
                preferences[intent] = min(match_count / 3.0, 1.0)
        
        return preferences
    
    @staticmethod
    def detect_brand_sentiment(user_text: str, conversation_history: List) -> Dict[str, str]:
        """
        Detect positive/negative sentiment towards specific brands.
        
        Returns:
            Dict of {brand: 'positive'/'negative'/'neutral'}
        """
        brands = ['maruti', 'hyundai', 'tata', 'mahindra', 'kia', 'honda', 
                 'toyota', 'volkswagen', 'skoda', 'mg', 'nissan', 'renault']
        
        sentiment = {}
        user_text_lower = user_text.lower()
        
        positive_words = ['like', 'prefer', 'love', 'want', 'good', 'great', 'excellent']
        negative_words = ['dont like', 'avoid', 'not', 'no', 'bad', 'poor', 'hate']
        
        for brand in brands:
            if brand in user_text_lower:
                # Check surrounding context
                brand_index = user_text_lower.find(brand)
                context = user_text_lower[max(0, brand_index-50):brand_index+50]
                
                if any(neg in context for neg in negative_words):
                    sentiment[brand] = 'negative'
                elif any(pos in context for pos in positive_words):
                    sentiment[brand] = 'positive'
        
        return sentiment


def enhance_scoring_with_diversity(scored_variants: List[Dict], 
                                   preferences: Dict,
                                   use_mmr: bool = True,
                                   lambda_diversity: float = 0.3,
                                   user_control_config=None,
                                   scoring_weights=None) -> List[Dict]:
    """
    Main function to enhance recommendations with diversity.
    
    Args:
        scored_variants: Initial scored results
        preferences: User preferences
        use_mmr: Whether to use MMR reranking
        lambda_diversity: Diversity weight (overridden by user_control_config if provided)
        user_control_config: Optional UserControlConfig for advanced controls
    
    Returns:
        Diversity-enhanced recommendations
    """
    # Import here to avoid circular imports
    from user_control_system import UserControlConfig, BrandPreferenceMode
    
    # Import dynamic scoring config
    from dynamic_scoring_config import DynamicScoringWeights
    
    # Get dynamic weights
    if scoring_weights is None:
        scoring_weights = DynamicScoringWeights.from_user_preferences(
            preferences, 
            user_control_config.to_dict() if user_control_config else None
        )
    
    # Use dynamic weights from scoring_weights
    if user_control_config:
        lambda_diversity = user_control_config.diversity_weight
        max_per_brand = scoring_weights.max_variants_per_brand
        penalty_factor = scoring_weights.brand_penalty_factor
        # Don't use strict enforcement - it's too aggressive and breaks results
        # Instead, use aggressive penalties but ensure we have enough candidates
        enforce_strict = False  # FIXED: Never use strict enforcement
    else:
        lambda_diversity = scoring_weights.diversity_weight
        max_per_brand = scoring_weights.max_variants_per_brand
        penalty_factor = scoring_weights.brand_penalty_factor
        enforce_strict = False
    
    reranker = DiversityReranker(lambda_diversity=lambda_diversity)
    
    # Step 1: Apply brand filtering based on user controls
    if user_control_config:
        scored_variants = _apply_brand_filters(scored_variants, user_control_config)
    
    # Ensure we have enough candidates before applying diversity
    if len(scored_variants) < 10:
        print(f"⚠️ WARNING: Only {len(scored_variants)} candidates available. Diversity might be limited.")
    
    # Step 2: Apply brand diversity (DYNAMIC - uses scoring_weights)
    # Use aggressive penalties but don't hard filter
    variants_with_penalty = reranker.apply_brand_diversity_penalty(
        scored_variants, 
        max_per_brand=max_per_brand,
        penalty_factor=penalty_factor,
        enforce_strict=False  # FIXED: Never use strict - use penalties instead
    )
    
    # Step 3: Apply MMR reranking if requested (with DYNAMIC similarity weights)
    # Ensure we rerank enough candidates to have diverse options
    rerank_top_k = min(30, len(variants_with_penalty))  # Rerank more candidates for diversity
    if use_mmr and len(variants_with_penalty) > 5:
        final_variants = reranker.rerank(
            variants_with_penalty,
            top_k=rerank_top_k,  # Rerank more to ensure diversity
            preferences=preferences,
            similarity_weights=scoring_weights  # Pass dynamic weights
        )
    else:
        final_variants = variants_with_penalty
    
    # Step 4: Apply additional user controls (price preference, exploration, etc.)
    if user_control_config:
        final_variants = _apply_user_controls(final_variants, user_control_config, preferences)
    
    # Step 5: Final diversity enforcement - ensure top 5 has diverse brands
    # Always return at least 5 results
    # For maximum diversity mode, use max_per_brand=1 to force different brands
    effective_max_per_brand = max_per_brand
    if user_control_config and user_control_config.diversity_mode.value == "maximum_diversity":
        # In constrained pools, allow 2 per brand to avoid quality collapse
        if len(final_variants) < 12:
            effective_max_per_brand = max(2, max_per_brand)
            print("🎯 Maximum diversity mode: constrained pool, allowing up to 2 per brand")
        else:
            effective_max_per_brand = 1  # Force 1 per brand for true diversity
            print("🎯 Maximum diversity mode: Using max_per_brand=1 for aggressive diversity")
    
    final_variants = _enforce_top_k_diversity(
        final_variants, 
        top_k=5, 
        max_per_brand=effective_max_per_brand  # Use effective max_per_brand
    )
    
    # Final safety check: ensure we have at least 5 results
    if len(final_variants) < 5 and len(scored_variants) >= 5:
        print(f"⚠️ WARNING: Only {len(final_variants)} diverse results. Adding best remaining...")
        # Add best remaining variants to reach 5 (avoid pandas Series equality)
        final_keys = {RobustDiversityEnforcer._variant_key(v) for v in final_variants}
        remaining = [v for v in scored_variants if RobustDiversityEnforcer._variant_key(v) not in final_keys]
        remaining_sorted = sorted(remaining, 
            key=lambda x: x.get('combined_score', x.get('score', 0)), 
            reverse=True)
        while len(final_variants) < 5 and remaining_sorted:
            final_variants.append(remaining_sorted.pop(0))
    
    # Log brand distribution for debugging
    brand_dist = {}
    for v in final_variants[:5]:
        brand = str(v['car'].get('brand', 'Unknown')).lower()
        brand_dist[brand] = brand_dist.get(brand, 0) + 1
    print(f"✅ Final diversity: {len(final_variants)} results, Brand distribution: {brand_dist}")
    
    return final_variants[:5]  # Return exactly top 5


class RobustDiversityEnforcer:
    """
    Robust diversity enforcement that guarantees brand variety.
    
    Uses multiple strategies:
    1. Round-robin brand selection
    2. Score-based selection within brands
    3. Fallback to best remaining if needed
    """
    
    @staticmethod
    def enforce_diversity(variants: List[Dict], 
                          top_k: int = 5, 
                          max_per_brand: int = 1,
                          min_brands: int = 3) -> List[Dict]:
        """
        Enforce diversity with guaranteed brand variety.
        
        Args:
            variants: List of variant dicts with 'car' and 'score'/'combined_score'
            top_k: Number of results to return
            max_per_brand: Maximum variants per brand
            min_brands: Minimum number of different brands to aim for
        
        Returns:
            List of top_k diverse variants
        """
        if len(variants) == 0:
            return []
        
        if len(variants) <= top_k:
            # If we have fewer variants than requested, return what we have
            # But still try to maximize diversity
            return RobustDiversityEnforcer._maximize_diversity_in_set(variants, max_per_brand)
        
        # Strategy 1: Group by brand and sort by score
        variants_by_brand = defaultdict(list)
        for variant in variants:
            brand = RobustDiversityEnforcer._extract_brand(variant)
            variants_by_brand[brand].append(variant)
        
        # Sort variants within each brand by score
        for brand in variants_by_brand:
            variants_by_brand[brand].sort(
                key=lambda x: x.get('combined_score', x.get('score', 0)), 
                reverse=True
            )
        
        # Strategy 2: Round-robin selection
        selected = []
        selected_keys = set()
        brand_counts = defaultdict(int)
        brands_used = set()
        
        # First pass: Select one from each brand (round-robin)
        round_num = 0
        while len(selected) < top_k:
            found_any = False
            
            for brand, brand_variants in variants_by_brand.items():
                if len(selected) >= top_k:
                    break
                
                # Skip if brand already at max
                if brand_counts[brand] >= max_per_brand:
                    continue
                
                # Get best variant from this brand that's not selected
                for variant in brand_variants:
                    key = RobustDiversityEnforcer._variant_key(variant)
                    if key not in selected_keys:
                        selected.append(variant)
                        selected_keys.add(key)
                        brand_counts[brand] += 1
                        brands_used.add(brand)
                        found_any = True
                        break
                
                if len(selected) >= top_k:
                    break
            
            # If we didn't find any new variants, break
            if not found_any:
                break
            
            round_num += 1
            if round_num > top_k * 2:  # Safety limit
                break
        
        # Strategy 3: If we have duplicates, replace with different brands
        if max_per_brand == 1:
            selected = RobustDiversityEnforcer._remove_duplicate_brands(
                selected, variants_by_brand, top_k
            )
        
        # Strategy 4: Fill remaining slots with best diverse options
        if len(selected) < top_k:
            remaining = [v for v in variants if RobustDiversityEnforcer._variant_key(v) not in selected_keys]
            selected = RobustDiversityEnforcer._fill_with_diverse(
                selected, remaining, top_k, brand_counts, max_per_brand
            )
        
        return selected[:top_k]
    
    @staticmethod
    def _extract_brand(variant: Dict) -> str:
        """Extract brand from variant dict"""
        car = variant.get('car', {})
        if isinstance(car, dict):
            brand = car.get('brand', 'Unknown')
        else:
            brand = getattr(car, 'brand', 'Unknown')
        return str(brand).lower()
    
    @staticmethod
    def _variant_key(variant: Dict) -> str:
        """
        Stable identity for membership checks.
        Avoids comparing pandas Series inside dicts (can raise ambiguous truth errors).
        """
        car = variant.get('car', {})
        name = ''
        if isinstance(car, dict):
            name = car.get('variant') or car.get('name') or ''
        else:
            # pandas Series has .get
            if hasattr(car, 'get'):
                name = car.get('variant', '') or car.get('name', '')
            else:
                name = getattr(car, 'variant', '') or getattr(car, 'name', '')
        if not name:
            name = variant.get('variant_id', '') or ''
        return str(name).strip().lower()
    
    @staticmethod
    def _maximize_diversity_in_set(variants: List[Dict], max_per_brand: int) -> List[Dict]:
        """Maximize diversity even in small sets"""
        variants_by_brand = defaultdict(list)
        for variant in variants:
            brand = RobustDiversityEnforcer._extract_brand(variant)
            variants_by_brand[brand].append(variant)
        
        # Sort by score within each brand
        for brand in variants_by_brand:
            variants_by_brand[brand].sort(
                key=lambda x: x.get('combined_score', x.get('score', 0)), 
                reverse=True
            )
        
        selected = []
        brand_counts = defaultdict(int)
        
        # Round-robin selection
        while len(selected) < len(variants):
            found = False
            for brand, brand_variants in variants_by_brand.items():
                if brand_counts[brand] < max_per_brand and brand_variants:
                    selected.append(brand_variants.pop(0))
                    brand_counts[brand] += 1
                    found = True
                    break
            if not found:
                # Add remaining
                for brand_variants in variants_by_brand.values():
                    selected.extend(brand_variants)
                break
        
        return selected
    
    @staticmethod
    def _remove_duplicate_brands(selected: List[Dict], 
                                 variants_by_brand: Dict,
                                 top_k: int) -> List[Dict]:
        """Remove duplicate brands, replace with different brands"""
        brand_counts = defaultdict(int)
        for variant in selected:
            brand = RobustDiversityEnforcer._extract_brand(variant)
            brand_counts[brand] += 1
        
        # Find duplicates
        duplicates = {b: c for b, c in brand_counts.items() if c > 1}
        
        if not duplicates:
            return selected
        
        # Keep best from each duplicate brand, replace others
        new_selected = []
        brands_used = set()
        
        for variant in selected:
            brand = RobustDiversityEnforcer._extract_brand(variant)
            if brand not in brands_used:
                new_selected.append(variant)
                brands_used.add(brand)
        
        # Fill remaining with different brands
        remaining_slots = top_k - len(new_selected)
        if remaining_slots > 0:
            for brand, brand_variants in variants_by_brand.items():
                if brand in brands_used:
                    continue
                if remaining_slots <= 0:
                    break
                if brand_variants:
                    new_selected.append(brand_variants[0])
                    remaining_slots -= 1
        
        return new_selected[:top_k]
    
    @staticmethod
    def _fill_with_diverse(selected: List[Dict], 
                           remaining: List[Dict], 
                           top_k: int,
                           brand_counts: Dict,
                           max_per_brand: int) -> List[Dict]:
        """Fill remaining slots while respecting diversity constraints"""
        remaining.sort(key=lambda x: x.get('combined_score', x.get('score', 0)), reverse=True)
        
        for variant in remaining:
            if len(selected) >= top_k:
                break
            brand = RobustDiversityEnforcer._extract_brand(variant)
            if brand_counts[brand] < max_per_brand:
                selected.append(variant)
                brand_counts[brand] += 1
        
        return selected


def _enforce_top_k_diversity(variants: List[Dict], top_k: int = 5, max_per_brand: int = 2) -> List[Dict]:
    """
    ROBUST diversity enforcement using RobustDiversityEnforcer.
    
    Guarantees brand variety in recommendations using multiple strategies:
    1. Round-robin brand selection
    2. Score-based selection within brands
    3. Duplicate removal and replacement
    4. Fallback to best remaining if needed
    """
    # Use robust enforcer for better diversity
    return RobustDiversityEnforcer.enforce_diversity(
        variants, 
        top_k=top_k, 
        max_per_brand=max_per_brand,
        min_brands=3  # Aim for at least 3 different brands
    )


def _apply_brand_filters(scored_variants: List[Dict], 
                        user_control_config) -> List[Dict]:
    """
    Apply brand controls with strict guardrails.

    Rules:
    - Blacklisted brands are always excluded (hard constraint).
    - Strict mode keeps only preferred brands.
    - Preferred brands receive a strong boost, while non-preferred are slightly deprioritized.
    """
    from user_control_system import BrandPreferenceMode
    from preference_alignment import normalize_brand, extract_variant_payload

    preferred = {normalize_brand(b) for b in (user_control_config.preferred_brands or []) if normalize_brand(b)}
    blacklisted = {normalize_brand(b) for b in (user_control_config.blacklisted_brands or []) if normalize_brand(b)}

    filtered = []
    for variant in scored_variants:
        car = extract_variant_payload(variant)
        brand = normalize_brand(car.get('brand', 'Unknown'))

        # Hard blacklist regardless of mode
        if brand and brand in blacklisted:
            continue

        # Strict mode: only include explicitly preferred brands
        if user_control_config.brand_mode == BrandPreferenceMode.STRICT:
            if preferred and brand not in preferred:
                continue
            filtered.append(variant)
            continue

        # Preferred mode (or preferred list present): strong boost for preferred brands
        if preferred:
            if brand in preferred:
                boost = 1.35
                variant['score'] = float(variant.get('score', 0)) * boost
                if 'combined_score' in variant:
                    variant['combined_score'] = float(variant.get('combined_score', variant.get('score', 0))) * boost
                details = variant.get('details', {}) or {}
                details['brand_preference'] = 'preferred_brand_boost'
                variant['details'] = details
            elif user_control_config.brand_mode == BrandPreferenceMode.PREFERRED:
                # Mild demotion to make preferred brands surface higher.
                variant['score'] = float(variant.get('score', 0)) * 0.92
                if 'combined_score' in variant:
                    variant['combined_score'] = float(variant.get('combined_score', variant.get('score', 0))) * 0.92

        filtered.append(variant)

    return filtered


def _apply_user_controls(final_variants: List[Dict], 
                        user_control_config,
                        preferences: Dict) -> List[Dict]:
    """Apply additional user controls (price preference, exploration, etc.)"""
    from user_control_system import DiversityMode
    
    # Price preference filtering
    if user_control_config.price_preference:
        budget_range = preferences.get('budget', [0, 10000000])
        if isinstance(budget_range, tuple):
            min_budget, max_budget = budget_range
        else:
            min_budget, max_budget = budget_range[0], budget_range[1]
        
        budget_span = max_budget - min_budget
        
        if user_control_config.price_preference == "lower":
            # Prefer lower 40% of budget range
            target_max = min_budget + (budget_span * 0.4)
            final_variants = [v for v in final_variants 
                            if v['car'].get('numeric_price', max_budget) <= target_max]
        
        elif user_control_config.price_preference == "higher":
            # Prefer upper 40% of budget range
            target_min = min_budget + (budget_span * 0.6)
            final_variants = [v for v in final_variants 
                            if v['car'].get('numeric_price', 0) >= target_min]
        
        elif user_control_config.price_preference == "mid":
            # Prefer middle 40% of budget range
            target_min = min_budget + (budget_span * 0.3)
            target_max = min_budget + (budget_span * 0.7)
            final_variants = [v for v in final_variants 
                            if target_min <= v['car'].get('numeric_price', 0) <= target_max]
    
    # Exploration: add wildcard if enabled
    if user_control_config.exploration_rate > 0 and len(final_variants) > 5:
        import random
        if random.random() < user_control_config.exploration_rate:
            # Add a random variant from lower-ranked results (not in top 5)
            # This would require access to full candidate set - simplified here
            pass
    
    return final_variants
