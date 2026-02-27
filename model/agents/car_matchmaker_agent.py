"""
Car Matchmaker Agent
Traverses User→Preference→Variant paths to find candidate variants
"""

import sys
import os
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.base_agent import BaseAgent
from knowledge_graph import Edge


class CarMatchmakerAgent(BaseAgent):
    """
    Agent 3: Find candidate variants through graph traversal.
    
    Responsibilities:
    - Traverse User → PREFERS → Preference paths
    - Match Variants to Preferences
    - Create HAS_FEATURE edges for matched preferences
    - Return candidate set (not ranked)
    """
    
    def __init__(self):
        super().__init__("CarMatchmakerAgent")
    
    def execute(self, graph, context):
        """
        Traverse graph to find candidate variants.
        Path: User → PREFERS → Preference, then match Variants to Preferences
        
        Args:
            graph: KnowledgeGraph with User, Preference, and Variant nodes
            context: Must contain 'session_id'
        
        Returns:
            dict with 'candidate_variants' and 'matching_paths'
        """
        user_id = context.get('session_id')
        
        if not graph.has_node(user_id):
            self.log(f"WARNING: User node {user_id} not found in graph")
            return {
                'candidate_variants': [],
                'matching_paths': []
            }
        
        # Get all nodes connected to this user via PREFERS and split by type.
        # UseCase nodes can exist on this edge type and should not be treated as
        # plain key/value Preference nodes.
        preference_links = graph.get_neighbors(user_id, 'PREFERS')
        preference_nodes = [
            node for node in preference_links
            if node.type == 'Preference' and 'key' in node.properties and 'value' in node.properties
        ]
        use_case_nodes = [node for node in preference_links if node.type == 'UseCase']
        
        if len(preference_nodes) == 0 and len(use_case_nodes) == 0:
            self.log("WARNING: No preferences found for user")
            return {
                'candidate_variants': [],
                'matching_paths': []
            }
        
        self.log(
            f"Found {len(preference_nodes)} structured preferences and "
            f"{len(use_case_nodes)} use-case preferences"
        )
        
        candidate_variants = []
        matching_paths = []
        
        # For each variant in graph, check compatibility with preferences
        path_reasoner = context.get('path_reasoner')
        user_control_config = context.get('user_control_config')
        control_data = {}
        if user_control_config:
            if isinstance(user_control_config, dict):
                control_data = user_control_config
            elif hasattr(user_control_config, "to_dict"):
                try:
                    control_data = user_control_config.to_dict()
                except Exception:
                    control_data = {}

        for node_id, node in graph.nodes.items():
            if node.type != 'Variant':
                continue
            
            # Check if variant matches preferences
            match_score, matches = self._evaluate_variant_match(
                node, preference_nodes, graph, user_id, path_reasoner, use_case_nodes
                , control_data
            )
            
            if match_score > 0:  # Any positive match
                candidate_variants.append(node_id)
                
                # Create HAS_FEATURE edges for matched features
                for matched_pref_id in matches:
                    # Check if edge already exists to avoid duplicates
                    if not graph.has_edge(node_id, matched_pref_id, 'HAS_FEATURE'):
                        edge = Edge(node_id, matched_pref_id, 'HAS_FEATURE', {
                            'match_score': match_score
                        })
                        graph.add_edge(edge)
                
                matching_paths.append({
                    'variant_id': node_id,
                    'variant_name': node.properties.get('name', node_id),
                    'matched_preferences': matches,
                    'preliminary_score': match_score
                })
        
        self.log(f"Found {len(candidate_variants)} candidate variants")
        
        # Log brand distribution of candidates for debugging
        brand_dist = {}
        for vid in candidate_variants:
            variant_node = graph.get_node(vid)
            if variant_node:
                brand = variant_node.properties.get('brand', 'Unknown')
                brand_dist[brand] = brand_dist.get(brand, 0) + 1
        self.log(f"Brand distribution in candidates: {dict(list(brand_dist.items())[:10])}")  # Top 10 brands
        
        # Sort matching paths by score for logging
        matching_paths.sort(key=lambda x: x['preliminary_score'], reverse=True)
        
        return {
            'candidate_variants': candidate_variants,
            'matching_paths': matching_paths
        }
    
    def _evaluate_variant_match(
        self,
        variant_node,
        preference_nodes,
        graph,
        user_id=None,
        path_reasoner=None,
        use_case_nodes=None,
        control_data=None
    ):
        """
        Enhanced variant matching with detailed checks and graph reasoning.
        
        Uses enhanced filtering logic and graph path reasoning for better candidate selection.
        
        Args:
            variant_node: Variant Node object
            preference_nodes: List of Preference Node objects
            graph: KnowledgeGraph
        
        Returns:
            Tuple of (match_score, list of matched preference IDs)
        """
        from enhanced_filtering import EnhancedFilter, GraphPathReasoner
        
        match_score = 0
        matched_prefs = []
        control_data = control_data or {}

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

        def _priority(key):
            try:
                return max(0.0, min(1.0, float(priorities.get(key, 0.5))))
            except Exception:
                return 0.5

        def _multiplier(key):
            # Higher priority and lower exploration both increase match reward.
            strictness = (0.68 * _priority(key)) + (0.32 * (1.0 - exploration_norm))
            strictness = max(0.0, min(1.0, strictness))
            return 0.55 + (1.35 * strictness)

        variant_props = variant_node.properties
        
        # Use enhanced filter for detailed checks
        enhanced_filter = EnhancedFilter(graph)
        
        # Convert variant_node to a row-like dict for filtering
        variant_row_dict = {
            'variant': variant_props.get('name', ''),
            'numeric_price': variant_props.get('price'),
            'Fuel Type': variant_props.get('fuel_type', ''),
            'Body Type': variant_props.get('body_type', ''),
            'Transmission Type': variant_props.get('transmission', ''),
            'Seating Capacity': variant_props.get('seating'),
            'Max Power': variant_props.get('max_power', ''),
            'original_index': variant_props.get('original_index', 0)
        }
        
        # Add all properties to row dict for feature checking
        for key, value in variant_props.items():
            if key not in variant_row_dict:
                variant_row_dict[key] = value
        
        variant_row = pd.Series(variant_row_dict)
        
        # Get preferences dict from preference nodes
        preferences_dict = {}
        for pref_node in preference_nodes:
            pref_key = pref_node.properties.get('key')
            pref_value = pref_node.properties.get('value')
            if not pref_key:
                continue
            preferences_dict[pref_key] = pref_value
        
        # Use graph path reasoner for multi-hop reasoning
        if not user_id:
            for node_id, node in graph.nodes.items():
                if node.type == 'User':
                    user_id = node_id
                    break
        
        if user_id:
            if path_reasoner is None:
                path_reasoner = GraphPathReasoner(graph)
            path_results = path_reasoner.score_variant_by_paths(
                variant_node.id,
                user_id,
                preferences_dict
            )
            # Add path-based score
            match_score += path_results['total_path_score'] * 0.3  # 30% weight for graph reasoning
            # Store reasoning on variant for later reuse
            variant_node.properties['path_reasoning'] = path_results
        
        # Detailed preference matching
        for pref_node in preference_nodes:
            pref_key = pref_node.properties.get('key')
            pref_value = pref_node.properties.get('value')
            pref_weight = pref_node.properties.get('weight', 1)
            if not pref_key:
                continue
            is_must_have = pref_node.properties.get('is_must_have', False)
            
            is_match = False
            match_quality = 0.0  # 0.0 to 1.0
            
            # Budget match (detailed)
            if pref_key == 'budget':
                if isinstance(pref_value, (tuple, list)) and len(pref_value) == 2:
                    min_b, max_b = pref_value
                    budget_tolerance = 1.12 if max_b <= 1500000 else 1.15
                    price = variant_props.get('price')
                    if price and pd.notna(price):
                        if min_b <= price <= max_b:
                            is_match = True
                            match_quality = 1.0
                        elif price <= max_b * budget_tolerance:
                            is_match = True
                            match_quality = 0.7 - ((price - max_b) / max_b) * 0.5  # Degrade quality
            
            # Fuel type match (with fuzzy matching)
            elif pref_key == 'fuel_type':
                if pref_value != 'Any':
                    variant_fuel = str(variant_props.get('fuel_type', '')).lower()
                    pref_fuel_lower = pref_value.lower()
                    
                    if pref_fuel_lower in variant_fuel or variant_fuel in pref_fuel_lower:
                        is_match = True
                        match_quality = 1.0
                    elif enhanced_filter._fuzzy_fuel_match(pref_fuel_lower, variant_fuel):
                        is_match = True
                        match_quality = 0.8
            
            # Body type match (with fuzzy matching)
            elif pref_key == 'body_type':
                if pref_value != 'Any':
                    variant_body = str(variant_props.get('body_type', '')).lower()
                    pref_body_lower = pref_value.lower()
                    
                    if pref_body_lower in variant_body or variant_body in pref_body_lower:
                        is_match = True
                        match_quality = 1.0
                    elif enhanced_filter._fuzzy_body_match(pref_body_lower, variant_body):
                        is_match = True
                        match_quality = 0.8
            
            # Transmission match (with fuzzy matching)
            elif pref_key == 'transmission':
                if pref_value != 'Any':
                    variant_trans = str(variant_props.get('transmission', '')).lower()
                    pref_trans_lower = pref_value.lower()
                    
                    if pref_trans_lower in variant_trans or variant_trans in pref_trans_lower:
                        is_match = True
                        match_quality = 1.0
                    elif enhanced_filter._fuzzy_transmission_match(pref_trans_lower, variant_trans):
                        is_match = True
                        match_quality = 0.8
            
            # Seating match
            elif pref_key == 'seating':
                seating = variant_props.get('seating')
                if seating and pd.notna(seating):
                    try:
                        if int(seating) >= int(pref_value):
                            is_match = True
                            match_quality = 1.0
                    except (ValueError, TypeError):
                        pass
            
            # Brand match
            elif pref_key == 'brand':
                if pref_value and pref_value != 'Any':
                    variant_name = variant_props.get('name', '').lower()
                    if pref_value.lower() in variant_name:
                        is_match = True
                        match_quality = 1.0
            
            # Features match (ACTUALLY CHECKS FEATURES NOW)
            elif pref_key == 'features':
                if isinstance(pref_value, list) and pref_value:
                    matched_features, missing_features = enhanced_filter._check_features(
                        variant_row, pref_value
                    )
                    if matched_features:
                        is_match = True
                        # Quality based on how many features matched
                        match_quality = len(matched_features) / len(pref_value)
            
            # Performance match
            elif pref_key == 'performance':
                if isinstance(pref_value, (int, float)) and pref_value > 5:
                    max_power = variant_props.get('max_power')
                    if max_power:
                        power_val = enhanced_filter._extract_power(str(max_power))
                        if power_val:
                            if power_val > 120:
                                is_match = True
                                match_quality = min(1.0, power_val / 200.0)  # Normalize to 200bhp
                            elif power_val > 100:
                                is_match = True
                                match_quality = 0.7
            
            if is_match:
                # Weighted score based on match quality
                priority_key = pref_key if pref_key in priorities else 'features' if pref_key == 'feature' else pref_key
                weighted_score = pref_weight * match_quality * _multiplier(priority_key)
                match_score += weighted_score
                matched_prefs.append(pref_node.id)

        # Soft bonus for use-case suitability edges to user-specific UseCase nodes.
        # VariantPruningAgent creates these edges heuristically.
        for use_case_node in (use_case_nodes or []):
            if graph.has_edge(variant_node.id, use_case_node.id, 'SUITABLE_FOR'):
                match_score += 1.5
        
        return match_score, matched_prefs
