"""
Enhanced Filtering System
Multi-dimensional, detailed filtering with graph-aware reasoning

Author: VariantWise Team
"""

from typing import Dict, List, Tuple, Set
import os
import pandas as pd
import re
from knowledge_graph import KnowledgeGraph, Node


class EnhancedFilter:
    """
    Advanced filtering system that performs detailed multi-dimensional checks
    and uses graph reasoning for better candidate selection.
    """
    
    def __init__(self, graph: KnowledgeGraph):
        self.graph = graph
    
    def filter_variants(self, 
                       variants_df: pd.DataFrame,
                       preferences: Dict,
                       context: Dict) -> Tuple[List[str], Dict]:
        """
        Perform detailed multi-dimensional filtering.
        
        Returns:
            Tuple of (kept_variant_ids, filtering_details)
        """
        kept_variants = []
        filtering_details = {
            'removed_by_budget': [],
            'removed_by_fuel': [],
            'removed_by_body': [],
            'removed_by_transmission': [],
            'removed_by_seating': [],
            'removed_by_features': [],
            'removed_by_brand': [],
            'removed_by_performance': [],
            'soft_violations': []
        }
        
        must_have_prefs = set(context.get('must_have_preferences', []) or [])
        user_control_config = context.get('user_control_config')

        # Blend strictness from per-dimension priorities + exploration openness.
        control_data = {}
        if user_control_config:
            if isinstance(user_control_config, dict):
                control_data = user_control_config
            elif hasattr(user_control_config, "to_dict"):
                try:
                    control_data = user_control_config.to_dict()
                except Exception:
                    control_data = {}

        default_priorities = {
            'budget': 0.5,
            'fuel_type': 0.5,
            'body_type': 0.5,
            'transmission': 0.5,
            'seating': 0.5,
            'features': 0.5,
            'performance': 0.5,
        }
        priorities = {**default_priorities, **(control_data.get('scoring_priorities', {}) or {})}
        if not bool(control_data.get('exploration_rate_set', True)):
            priorities = default_priorities

        try:
            exploration_rate = float(control_data.get('exploration_rate', 0.1) or 0.1)
        except Exception:
            exploration_rate = 0.1
        exploration_rate = max(0.0, min(0.5, exploration_rate))
        exploration_norm = exploration_rate / 0.5

        def _priority(key: str) -> float:
            try:
                return max(0.0, min(1.0, float(priorities.get(key, 0.5))))
            except Exception:
                return 0.5

        def _strictness(key: str) -> float:
            return max(0.0, min(1.0, (0.7 * _priority(key)) + (0.3 * (1.0 - exploration_norm))))

        # Promote high-priority dimensions to hard constraints dynamically.
        for key in ["budget", "fuel_type", "body_type", "transmission", "seating", "features"]:
            if _strictness(key) >= 0.78:
                must_have_prefs.add(key)

        budget_priority = _priority("budget")
        # Exploration and low budget priority increase acceptable flexibility.
        budget_tolerance = 1.03 + (0.26 * exploration_norm) + (0.14 * (1.0 - budget_priority))
        budget_tolerance = max(1.03, min(1.35, budget_tolerance))
        
        for idx, row in variants_df.iterrows():
            variant_name = row.get('variant', f'variant_{idx}')
            variant_id = f"variant_{variant_name.replace(' ', '_')}"
            
            # Detailed filtering checks
            should_keep = True
            violation_reasons = []
            
            # 1. BUDGET FILTERING (Detailed)
            if 'budget' in preferences:
                min_budget, max_budget = preferences['budget']
                price = row.get('numeric_price')
                
                if pd.notna(price):
                    if 'budget' in must_have_prefs:
                        # Strict: Must be within budget
                        if price > max_budget:
                            should_keep = False
                            filtering_details['removed_by_budget'].append({
                                'variant': variant_name,
                                'price': price,
                                'max_budget': max_budget,
                                'over_by': price - max_budget
                            })
                    else:
                        # Soft: Allow 15% over budget, but mark violation
                        if price > max_budget * budget_tolerance:
                            should_keep = False
                            filtering_details['removed_by_budget'].append({
                                'variant': variant_name,
                                'price': price,
                                'max_budget': max_budget
                            })
                        elif price > max_budget:
                            violation_reasons.append({
                                'type': 'budget',
                                'severity': 'medium',
                                'message': f'Price ₹{int(price):,} exceeds budget by ₹{int(price - max_budget):,}'
                            })
            
            # 2. FUEL TYPE FILTERING (Detailed)
            if should_keep and 'fuel_type' in preferences:
                pref_fuel = preferences['fuel_type']
                if pref_fuel != 'Any':
                    variant_fuel = str(row.get('fuel_type_norm', row.get('Fuel Type', ''))).lower()
                    pref_fuel_lower = pref_fuel.lower()
                    
                    # Check exact match or contains
                    fuel_match = (
                        pref_fuel_lower in variant_fuel or
                        variant_fuel in pref_fuel_lower or
                        self._fuzzy_fuel_match(pref_fuel_lower, variant_fuel)
                    )
                    
                    if not fuel_match:
                        if 'fuel_type' in must_have_prefs:
                            should_keep = False
                            filtering_details['removed_by_fuel'].append({
                                'variant': variant_name,
                                'variant_fuel': variant_fuel,
                                'required_fuel': pref_fuel
                            })
                        else:
                            violation_reasons.append({
                                'type': 'fuel_type',
                                'severity': 'medium' if _strictness("fuel_type") >= 0.6 else 'low',
                                'message': f'Has {variant_fuel}, but {pref_fuel} preferred'
                            })
            
            # 3. BODY TYPE FILTERING (Detailed)
            if should_keep and 'body_type' in preferences:
                pref_body = preferences['body_type']
                if pref_body != 'Any':
                    variant_body = str(row.get('body_type_norm', row.get('Body Type', ''))).lower()
                    pref_body_lower = pref_body.lower()
                    
                    body_match = (
                        pref_body_lower in variant_body or
                        variant_body in pref_body_lower or
                        self._fuzzy_body_match(pref_body_lower, variant_body)
                    )
                    
                    if not body_match:
                        if 'body_type' in must_have_prefs:
                            should_keep = False
                            filtering_details['removed_by_body'].append({
                                'variant': variant_name,
                                'variant_body': variant_body,
                                'required_body': pref_body
                            })
                        else:
                            violation_reasons.append({
                                'type': 'body_type',
                                'severity': 'medium' if _strictness("body_type") >= 0.6 else 'low',
                                'message': f'Has {variant_body}, but {pref_body} preferred'
                            })
            
            # 4. TRANSMISSION FILTERING (Detailed)
            if should_keep and 'transmission' in preferences:
                pref_trans = preferences['transmission']
                if pref_trans != 'Any':
                    variant_trans = str(row.get('transmission_norm', row.get('Transmission Type', ''))).lower()
                    pref_trans_lower = pref_trans.lower()
                    
                    trans_match = (
                        pref_trans_lower in variant_trans or
                        variant_trans in pref_trans_lower or
                        self._fuzzy_transmission_match(pref_trans_lower, variant_trans)
                    )
                    
                    if not trans_match:
                        if 'transmission' in must_have_prefs:
                            should_keep = False
                            filtering_details['removed_by_transmission'].append({
                                'variant': variant_name,
                                'variant_trans': variant_trans,
                                'required_trans': pref_trans
                            })
                        else:
                            violation_reasons.append({
                                'type': 'transmission',
                                'severity': 'high' if _strictness("transmission") >= 0.7 else 'medium',
                                'message': f'Has {variant_trans}, but {pref_trans} required'
                            })
            
            # 5. SEATING CAPACITY FILTERING (Detailed)
            if should_keep and 'seating' in preferences:
                required_seats = int(preferences['seating'])
                variant_seats = row.get('seating_norm', row.get('Seating Capacity'))
                
                if pd.notna(variant_seats):
                    try:
                        variant_seats_int = int(variant_seats)
                        if variant_seats_int < required_seats:
                            if 'seating' in must_have_prefs:
                                should_keep = False
                                filtering_details['removed_by_seating'].append({
                                    'variant': variant_name,
                                    'variant_seats': variant_seats_int,
                                    'required_seats': required_seats
                                })
                            else:
                                violation_reasons.append({
                                    'type': 'seating',
                                    'severity': 'high' if _strictness("seating") >= 0.7 else 'medium',
                                    'message': f'Has {variant_seats_int} seats, but {required_seats}+ required'
                                })
                    except (ValueError, TypeError):
                        pass
            
            # 6. FEATURE FILTERING (Detailed - ACTUALLY CHECKS FEATURES)
            if should_keep and 'features' in preferences:
                required_features = preferences.get('features', [])
                if required_features:
                    matched_features, missing_features = self._check_features(row, required_features)
                    
                    # Check if must-have features are missing
                    must_have_features = context.get('must_have_features', [])
                    missing_must_haves = [f for f in must_have_features if f not in matched_features]
                    
                    if missing_must_haves:
                        should_keep = False
                        filtering_details['removed_by_features'].append({
                            'variant': variant_name,
                            'missing_features': missing_must_haves
                        })
                    elif missing_features:
                        violation_reasons.append({
                            'type': 'features',
                            'severity': 'high' if _strictness("features") >= 0.7 else 'medium',
                            'message': f'Missing features: {", ".join(missing_features)}'
                        })
            
            # 7. BRAND FILTERING (Detailed)
            if should_keep and 'brand' in preferences:
                pref_brand = preferences['brand']
                if pref_brand and pref_brand != 'Any':
                    variant_brand = str(row.get('brand', '')).lower()
                    variant_name_lower = variant_name.lower()
                    pref_brand_lower = pref_brand.lower()
                    
                    brand_match = pref_brand_lower in variant_brand or pref_brand_lower in variant_name_lower
                    
                    if not brand_match:
                        if 'brand' in must_have_prefs:
                            should_keep = False
                            filtering_details['removed_by_brand'].append({
                                'variant': variant_name,
                                'required_brand': pref_brand
                            })
            
            # 8. PERFORMANCE FILTERING (Detailed)
            if should_keep and 'performance' in preferences:
                perf_score = preferences.get('performance', 0)
                if perf_score > 7:  # High performance requirement
                    max_power = row.get('Max Power', '')
                    power_val = self._extract_power(max_power)
                    
                    if power_val and power_val < 120:  # Threshold for high performance
                        if _strictness("performance") >= 0.78:
                            should_keep = False
                            filtering_details['removed_by_performance'].append({
                                'variant': variant_name,
                                'power': power_val,
                                'required_min_power': 120
                            })
                            continue
                        violation_reasons.append({
                            'type': 'performance',
                            'severity': 'high' if _strictness("performance") >= 0.65 else 'medium',
                            'message': f'Power {power_val}bhp may not meet high performance requirement'
                        })
            
            if should_keep:
                kept_variants.append(variant_id)
                if violation_reasons:
                    filtering_details['soft_violations'].append({
                        'variant_id': variant_id,
                        'variant_name': variant_name,
                        'violations': violation_reasons
                    })
        
        if os.getenv("VW_DEBUG_FILTER") == "1":
            removal_counts = {
                'budget': len(filtering_details['removed_by_budget']),
                'fuel': len(filtering_details['removed_by_fuel']),
                'body': len(filtering_details['removed_by_body']),
                'transmission': len(filtering_details['removed_by_transmission']),
                'seating': len(filtering_details['removed_by_seating']),
                'features': len(filtering_details['removed_by_features']),
                'brand': len(filtering_details['removed_by_brand']),
                'performance': len(filtering_details['removed_by_performance'])
            }
            print(f"[DEBUG] Filter removals: {removal_counts}")

        return kept_variants, filtering_details
    
    def _fuzzy_fuel_match(self, pref_fuel: str, variant_fuel: str) -> bool:
        """Fuzzy matching for fuel types"""
        fuel_mappings = {
            'petrol': ['petrol', 'gasoline'],
            'diesel': ['diesel'],
            'cng': ['cng', 'compressed natural gas'],
            'electric': ['electric', 'ev', 'battery']
        }
        
        for key, variants in fuel_mappings.items():
            if key in pref_fuel:
                return any(v in variant_fuel for v in variants)
        return False
    
    def _fuzzy_body_match(self, pref_body: str, variant_body: str) -> bool:
        """Fuzzy matching for body types"""
        body_mappings = {
            'suv': ['suv', 'sport utility vehicle', 'compact suv', 'midsize suv'],
            'sedan': ['sedan', 'saloon'],
            'hatchback': ['hatchback', 'hatch'],
            'muv': ['muv', 'multi utility vehicle', 'mpv']
        }
        
        for key, variants in body_mappings.items():
            if key in pref_body:
                return any(v in variant_body for v in variants)
        return False
    
    def _fuzzy_transmission_match(self, pref_trans: str, variant_trans: str) -> bool:
        """Fuzzy matching for transmission types"""
        trans_mappings = {
            'automatic': ['automatic', 'amt', 'cvt', 'dct', 'ivt'],
            'manual': ['manual', 'mt']
        }
        
        for key, variants in trans_mappings.items():
            if key in pref_trans:
                return any(v in variant_trans for v in variants)
        return False
    
    def _check_features(self, row: pd.Series, required_features: List[str]) -> Tuple[List[str], List[str]]:
        """
        Actually check if variant has required features.
        
        Returns:
            Tuple of (matched_features, missing_features)
        """
        matched = []
        missing = []
        
        # Get all column values as strings for searching
        all_values = ' '.join([str(v).lower() for v in row.values if pd.notna(v)])
        
        for feature in required_features:
            feature_lower = feature.lower()
            
            # Check if feature appears in any column
            found = False
            
            # Direct match in column values
            if feature_lower in all_values:
                found = True
            
            # Check specific feature columns if they exist
            feature_columns = [col for col in row.index if 'feature' in col.lower() or 'option' in col.lower()]
            for col in feature_columns:
                col_value = str(row.get(col, '')).lower()
                if feature_lower in col_value:
                    found = True
                    break
            
            # Fuzzy matching for common features
            if not found:
                found = self._fuzzy_feature_match(feature_lower, all_values)
            
            if found:
                matched.append(feature)
            else:
                missing.append(feature)
        
        return matched, missing
    
    def _fuzzy_feature_match(self, feature: str, text: str) -> bool:
        """Fuzzy matching for features"""
        feature_mappings = {
            'sunroof': ['sunroof', 'panoramic', 'moonroof'],
            'leather': ['leather', 'leatherette'],
            'navigation': ['navigation', 'gps', 'nav'],
            'camera': ['camera', 'rear view', '360', 'parking'],
            'cruise': ['cruise control', 'adaptive cruise'],
            'keyless': ['keyless', 'smart key', 'push button'],
            'wireless': ['wireless', 'wireless charging'],
            'android': ['android auto', 'android'],
            'apple': ['apple carplay', 'carplay', 'apple']
        }
        
        for key, variants in feature_mappings.items():
            if key in feature:
                return any(v in text for v in variants)
        return False
    
    def _extract_power(self, power_str: str) -> int:
        """Extract numeric power value from string"""
        if not power_str:
            return None
        
        # Try to extract number
        match = re.findall(r'\d+', str(power_str))
        if match:
            return int(match[0])
        return None


class GraphPathReasoner:
    """
    Uses graph paths for multi-hop reasoning and better candidate selection.
    """
    
    def __init__(self, graph: KnowledgeGraph):
        self.graph = graph
        self._path_cache = {}
    
    def score_variant_by_paths(self, 
                              variant_id: str,
                              user_id: str,
                              preferences: Dict) -> Dict:
        """
        Score variant based on graph paths from user to variant.
        
        Paths considered:
        1. User → PREFERS → Preference → HAS_FEATURE ← Variant
        2. User → PREFERS → Preference → SUITABLE_FOR ← UseCase ← Variant
        3. User → SHORTLISTED → Variant (if exists)
        
        Returns:
            Dict with path_scores, reasoning_paths, total_score
        """
        cache_key = (variant_id, user_id)
        if cache_key in self._path_cache:
            return self._path_cache[cache_key]

        path_scores = {}
        reasoning_paths = []
        total_score = 0
        
        # Get user preferences
        preference_nodes = self.graph.get_neighbors(user_id, 'PREFERS')
        
        # Path 1: Direct preference matching
        for pref_node in preference_nodes:
            pref_id = pref_node.id
            pref_key = pref_node.properties.get('key')
            pref_weight = pref_node.properties.get('weight', 1)
            
            # Check if variant has edge to this preference
            if self.graph.has_edge(variant_id, pref_id, 'HAS_FEATURE'):
                edge = self.graph.get_edge(variant_id, pref_id, 'HAS_FEATURE')
                match_score = edge.properties.get('match_score', 1)
                
                path_score = pref_weight * match_score
                path_scores[f'pref_{pref_key}'] = path_score
                total_score += path_score
                
                reasoning_paths.append({
                    'path': f'User → PREFERS → {pref_key} ← HAS_FEATURE ← Variant',
                    'score': path_score,
                    'reasoning': f'Variant matches {pref_key} preference'
                })
        
        # Path 2: Check for violations (negative score)
        violation_edges = self.graph.get_edges_from(variant_id, 'VIOLATES')
        for edge in violation_edges:
            pref_id = edge.target_id
            pref_node = self.graph.get_node(pref_id)
            if pref_node:
                severity = edge.properties.get('severity', 'medium')
                severity_multiplier = {'high': -2.0, 'medium': -1.0, 'low': -0.5}.get(severity, -1.0)
                
                violation_score = severity_multiplier * 5  # Base penalty
                path_scores[f'violation_{pref_id}'] = violation_score
                total_score += violation_score
                
                reasoning_paths.append({
                    'path': f'Variant → VIOLATES → {pref_id}',
                    'score': violation_score,
                    'reasoning': edge.properties.get('reason', 'Violates preference')
                })

        # Path 3: Use-case suitability
        use_case_nodes = [n for n in self.graph.get_neighbors(user_id, 'PREFERS') if n.type == 'UseCase']
        for use_case in use_case_nodes:
            if self.graph.has_edge(variant_id, use_case.id, 'SUITABLE_FOR'):
                path_score = 3.0
                path_scores[f'usecase_{use_case.id}'] = path_score
                total_score += path_score
                reasoning_paths.append({
                    'path': f'Variant → SUITABLE_FOR → {use_case.id}',
                    'score': path_score,
                    'reasoning': f'Suitable for {use_case.properties.get("name", "use case")}'
                })
        
        # Path 4: Check for trade-offs (contextual scoring)
        tradeoff_edges = self.graph.get_edges_from(variant_id, 'INVOLVES_TRADEOFF')
        for edge in tradeoff_edges:
            tradeoff_id = edge.target_id
            tradeoff_node = self.graph.get_node(tradeoff_id)
            if tradeoff_node:
                # Trade-offs can be positive or negative depending on user priorities
                tradeoff_score = tradeoff_node.properties.get('net_value', 0)
                path_scores[f'tradeoff_{tradeoff_id}'] = tradeoff_score
                total_score += tradeoff_score
                
                reasoning_paths.append({
                    'path': f'Variant → INVOLVES_TRADEOFF → {tradeoff_id}',
                    'score': tradeoff_score,
                    'reasoning': tradeoff_node.properties.get('description', 'Trade-off involved')
                })
        
        result = {
            'path_scores': path_scores,
            'reasoning_paths': reasoning_paths,
            'total_path_score': total_score
        }
        self._path_cache[cache_key] = result
        return result
