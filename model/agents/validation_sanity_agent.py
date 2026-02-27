"""
Validation and Sanity Agent
Validates ranked variants and catches violations, mismatches, and hallucinations
"""

import sys
import os
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.base_agent import BaseAgent
from preference_alignment import normalize_brand, normalize_text


class ValidationAndSanityAgent(BaseAgent):
    """
    Agent 6: Validate ranked variants for sanity checks.
    
    Responsibilities:
    - Run AFTER existing scoring logic
    - Check for budget violations (hard constraints)
    - Check for transmission mismatches
    - Detect discontinued variants
    - Catch hallucinated recommendations (variants not in graph)
    - Remove variants that violate hard constraints
    """
    
    def __init__(self):
        super().__init__("ValidationAndSanityAgent")
    
    def execute(self, graph, context):
        """
        Validate ranked variants for sanity checks.
        Remove variants that violate hard constraints.
        
        Args:
            graph: KnowledgeGraph
            context: Must contain 'ranked_variants' and 'extracted_preferences'
        
        Returns:
            dict with 'validated_variants' and 'removed_variants'
        """
        ranked_variants = context.get('ranked_variants', [])
        preferences = context.get('extracted_preferences', {})
        variants_df = context.get('variants_df')
        
        if not ranked_variants:
            self.log("No ranked variants to validate")
            return {
                'validated_variants': [],
                'removed_variants': []
            }
        
        validated_variants = []
        removed_variants = []
        
        for variant_result in ranked_variants:
            # Extract variant identifier
            # Handle both dict and object formats
            if isinstance(variant_result, dict):
                car_data = variant_result.get('car', {})
                if isinstance(car_data, dict):
                    variant_name = car_data.get('variant', '')
                else:
                    # car_data is a pandas Series
                    variant_name = car_data.get('variant', '') if hasattr(car_data, 'get') else str(car_data.get('variant', ''))
            else:
                variant_name = ''
            
            if not variant_name:
                removed_variants.append({
                    'variant_id': 'unknown',
                    'reason': 'Missing variant name in result'
                })
                continue
            
            variant_id_clean = f"variant_{variant_name.replace(' ', '_')}"
            
            # Check 1: Variant exists in knowledge graph
            if not graph.has_node(variant_id_clean):
                removed_variants.append({
                    'variant_id': variant_name,
                    'reason': 'Variant not in knowledge graph (possible hallucination)'
                })
                self.log(f"Removed hallucinated variant: {variant_name}")
                continue
            
            variant_node = graph.get_node(variant_id_clean)
            
            # Check 2: Hard constraint violations
            violations = self._check_hard_constraints(
                graph, variant_node, preferences, context
            )
            
            if violations:
                removed_variants.append({
                    'variant_id': variant_name,
                    'reason': f"Hard constraint violations: {'; '.join(violations)}"
                })
                self.log(f"Removed {variant_name}: {violations[0]}")
            else:
                validated_variants.append(variant_result)
        
        total_validated = len(validated_variants)
        total_removed = len(removed_variants)
        total_input = len(ranked_variants)
        
        self.log(f"Validated {total_validated}/{total_input} variants ({total_removed} removed)")
        
        return {
            'validated_variants': validated_variants,
            'removed_variants': removed_variants
        }
    
    def _check_hard_constraints(self, graph, variant_node, preferences, context):
        """
        Check for hard constraint violations.
        
        Hard constraints:
        - Budget: No more than 50% over max budget
        - Transmission: If explicitly required and is must-have
        - Discontinued: If variant is marked discontinued
        
        Args:
            variant_node: Variant Node from graph
            preferences: User preferences dict
            context: Context dictionary
        
        Returns:
            List of violation strings (empty if no violations)
        """
        violations = []
        
        v_props = variant_node.properties
        must_have_prefs = context.get('must_have_preferences', [])
        user_control_config = context.get('user_control_config')

        control_data = {}
        if user_control_config:
            if isinstance(user_control_config, dict):
                control_data = user_control_config
            else:
                try:
                    control_data = user_control_config.to_dict()
                except Exception:
                    control_data = {}

        # Budget hard limit (segment-aware)
        if 'budget' in preferences:
            if isinstance(preferences['budget'], (tuple, list)) and len(preferences['budget']) == 2:
                min_b, max_b = preferences['budget']
                price = v_props.get('price')
                
                if price and pd.notna(price):
                    # Dynamic budget tolerance from controls and strictness
                    try:
                        budget_priority = float((control_data.get('scoring_priorities', {}) or {}).get('budget', 0.5))
                    except Exception:
                        budget_priority = 0.5
                    try:
                        configured_tolerance = float(control_data.get('price_tolerance', 0.2))
                    except Exception:
                        configured_tolerance = 0.2
                    configured_tolerance = max(0.02, min(0.5, configured_tolerance))

                    if budget_priority >= 0.8 or 'budget' in must_have_prefs:
                        allowed_over = min(configured_tolerance, 0.12)
                    else:
                        allowed_over = min(max(0.08, configured_tolerance), 0.3)

                    budget_tolerance = 1.0 + allowed_over
                    if price > max_b * budget_tolerance:
                        violations.append(
                            f"Price ₹{int(price):,} exceeds max budget ₹{int(max_b):,} by "
                            f"{int((price/max_b - 1) * 100)}% (>{int((budget_tolerance - 1) * 100)}% limit)"
                        )

        # Brand hard constraints from advanced controls
        variant_brand = normalize_brand(v_props.get('brand', ''))
        preferred_brands = {
            normalize_brand(b) for b in (control_data.get('preferred_brands', []) or []) if normalize_brand(b)
        }
        blacklisted_brands = {
            normalize_brand(b) for b in (control_data.get('blacklisted_brands', []) or []) if normalize_brand(b)
        }
        brand_mode = str(control_data.get('brand_mode', 'any')).lower()

        if variant_brand and variant_brand in blacklisted_brands:
            violations.append(f"Brand blacklisted: {variant_brand}")

        if brand_mode == 'strict' and preferred_brands and variant_brand not in preferred_brands:
            violations.append(f"Brand outside strict preference list: {variant_brand}")
        
        # Transmission mismatch (only if must-have and explicitly specified)
        if 'transmission' in must_have_prefs:
            pref_trans = preferences.get('transmission', '')
            if pref_trans and pref_trans != 'Any':
                pref_trans_lower = pref_trans.lower()
                variant_trans = str(v_props.get('transmission', '')).lower()
                
                # Check for clear mismatch
                if pref_trans_lower not in variant_trans and variant_trans not in pref_trans_lower:
                    # Additional check: manual vs automatic are incompatible
                    if ('manual' in pref_trans_lower and 'automatic' in variant_trans) or \
                       ('automatic' in pref_trans_lower and 'manual' in variant_trans):
                        violations.append(f"Transmission mismatch: wanted {pref_trans}, got {variant_trans}")
        
        # Fuel type mismatch (only if must-have and explicitly specified)
        if 'fuel_type' in must_have_prefs:
            pref_fuel = preferences.get('fuel_type', '')
            if pref_fuel and pref_fuel != 'Any':
                pref_fuel_lower = pref_fuel.lower()
                variant_fuel = str(v_props.get('fuel_type', '')).lower()
                
                # Check for clear mismatch (but allow hybrid to match petrol/diesel)
                if pref_fuel_lower not in variant_fuel and variant_fuel not in pref_fuel_lower:
                    # Hybrid is acceptable for petrol or diesel
                    if not ('hybrid' in variant_fuel and pref_fuel_lower in ['petrol', 'diesel']):
                        violations.append(f"Fuel type mismatch: wanted {pref_fuel}, got {variant_fuel}")

        # Body type mismatch if marked as strict
        scoring_priorities = control_data.get('scoring_priorities', {}) or {}
        try:
            body_priority = float(scoring_priorities.get('body_type', 0.5))
        except Exception:
            body_priority = 0.5
        if 'body_type' in must_have_prefs or body_priority >= 0.85:
            pref_body = preferences.get('body_type', '')
            if pref_body and pref_body != 'Any':
                pref_body_lower = pref_body.lower()
                variant_body = str(v_props.get('body_type', '')).lower()
                if pref_body_lower not in variant_body and variant_body not in pref_body_lower:
                    violations.append(f"Body type mismatch: wanted {pref_body}, got {variant_body}")
        
        # Seating capacity (only if must-have)
        if 'seating' in must_have_prefs and 'seating' in preferences:
            required_seats = int(preferences['seating'])
            variant_seats = v_props.get('seating')
            
            if variant_seats and pd.notna(variant_seats):
                try:
                    variant_seats_int = int(variant_seats)
                    if variant_seats_int < required_seats:
                        violations.append(f"Insufficient seating: has {variant_seats_int} seats, need {required_seats}")
                except (ValueError, TypeError):
                    pass
        
        # Check for must-have feature edges
        must_have_features = context.get('must_have_features', [])
        feature_blob = ' '.join([str(v).lower() for v in v_props.values() if v is not None])
        for feature in must_have_features:
            pref_id = f"pref_{context.get('session_id')}_feature_{feature}".replace(' ', '_')
            has_graph_match = graph.has_node(pref_id) and graph.has_edge(variant_node.id, pref_id, 'HAS_FEATURE')
            has_text_match = self._feature_present_in_blob(str(feature), feature_blob)
            if not has_graph_match and not has_text_match:
                violations.append(f"Missing must-have feature: {feature}")

        # Check for discontinued variants
        if v_props.get('discontinued', False):
            violations.append("Variant discontinued")
        
        return violations

    def _feature_present_in_blob(self, feature: str, blob: str) -> bool:
        """Fallback feature matcher when graph feature edges are unavailable."""
        feature_norm = normalize_text(feature)
        if not feature_norm:
            return False
        if feature_norm in blob:
            return True

        feature_aliases = {
            'sunroof': ['sunroof', 'panoramic', 'moonroof'],
            'apple carplay android auto': ['apple carplay', 'android auto', 'carplay'],
            'automatic climate control': ['automatic climate control', 'climate control', 'auto ac'],
            '360 camera': ['360 camera', 'surround view', 'parking camera', '360'],
            'lane assist': ['lane assist', 'lane keep', 'adas'],
            'ventilated seats': ['ventilated seats', 'ventilated'],
            'wireless charging': ['wireless charging', 'wireless charger'],
        }
        aliases = feature_aliases.get(feature_norm, [feature_norm])
        return any(alias in blob for alias in aliases)
