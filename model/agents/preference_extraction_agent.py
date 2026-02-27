"""
Preference Extraction Agent
Converts user input into structured Preference nodes with weights
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.base_agent import BaseAgent
from knowledge_graph import Node, Edge


class PreferenceExtractionAgent(BaseAgent):
    """
    Agent 1: Extract preferences from user input and create graph nodes.
    
    Responsibilities:
    - Create User node if not exists
    - Convert structured preferences into Preference nodes
    - Assign weights based on preference_config
    - Create PREFERS edges between User and Preferences
    - Mark must-have preferences
    """
    
    def __init__(self):
        super().__init__("PreferenceExtractionAgent")
    
    def execute(self, graph, context):
        """
        Extract preferences from user input using existing OpenAI chat logic.
        Creates Preference nodes and PREFERS edges.
        
        Args:
            graph: KnowledgeGraph to populate
            context: Must contain 'session_id' and 'extracted_preferences'
        
        Returns:
            dict with 'preference_nodes' (list) and 'user_id' (str)
        """
        user_input = context.get('user_input', '')
        preferences = context.get('extracted_preferences', {})
        user_control_config = context.get('user_control_config')
        must_have_features = []
        nice_to_have_features = []
        use_cases = []
        if user_control_config:
            # Support dict or UserControlConfig objects
            if isinstance(user_control_config, dict):
                must_have_features = user_control_config.get('must_have_features', [])
                nice_to_have_features = user_control_config.get('nice_to_have_features', [])
                use_cases = user_control_config.get('use_cases', [])
            else:
                must_have_features = getattr(user_control_config, 'must_have_features', [])
                nice_to_have_features = getattr(user_control_config, 'nice_to_have_features', [])
                use_cases = getattr(user_control_config, 'use_cases', [])
        context['must_have_features'] = must_have_features
        
        # Create User node if not exists
        user_id = context.get('session_id', 'user_default')
        if not graph.has_node(user_id):
            user_node = Node(user_id, 'User', {
                'session_id': user_id,
                'created_at': context.get('timestamp', None)
            })
            graph.add_node(user_node)
            self.log(f"Created User node: {user_id}")
        
        # Create Preference nodes from extracted preferences
        pref_nodes_created = []
        
        for pref_key, pref_value in preferences.items():
            # Skip empty or 'Any' preferences
            if pref_value is None or pref_value == 'Any':
                continue
            
            # Skip if it's a list and empty
            if isinstance(pref_value, list) and len(pref_value) == 0:
                continue
            
            pref_id = f"pref_{user_id}_{pref_key}"
            
            # Determine weight from preference_config
            weight = self._get_preference_weight(pref_key, user_control_config)
            
            # Check if it's a must-have
            is_must_have = self._is_must_have(pref_key, context, user_control_config)
            
            # Create Preference node
            pref_node = Node(pref_id, 'Preference', {
                'key': pref_key,
                'value': pref_value,
                'weight': weight,
                'is_must_have': is_must_have,
                'user_id': user_id
            })
            graph.add_node(pref_node)
            
            # Create PREFERS edge from User to Preference
            edge = Edge(user_id, pref_id, 'PREFERS', {
                'weight': weight,
                'is_must_have': is_must_have
            })
            graph.add_edge(edge)
            
            pref_nodes_created.append(pref_id)
            
            # Format value for logging
            if pref_key == 'budget' and isinstance(pref_value, tuple):
                value_str = f"₹{pref_value[0]:,}-₹{pref_value[1]:,}"
            elif isinstance(pref_value, list):
                value_str = f"{len(pref_value)} items"
            else:
                value_str = str(pref_value)
            
            must_have_str = " [MUST-HAVE]" if is_must_have else ""
            self.log(f"Created preference: {pref_key}={value_str} (weight={weight}){must_have_str}")

            # Create per-feature Preference nodes for better reasoning
            if pref_key == 'features' and isinstance(pref_value, list):
                for feat in pref_value:
                    feature_id = f"pref_{user_id}_feature_{feat}".replace(' ', '_')
                    feature_weight = self._get_feature_node_weight(
                        feat,
                        must_have_features,
                        user_control_config
                    )
                    feature_must = feat in must_have_features
                    feature_node = Node(feature_id, 'Preference', {
                        'key': 'feature',
                        'value': feat,
                        'weight': feature_weight,
                        'is_must_have': feature_must,
                        'user_id': user_id
                    })
                    graph.add_node(feature_node)
                    edge = Edge(user_id, feature_id, 'PREFERS', {
                        'weight': feature_weight,
                        'is_must_have': feature_must
                    })
                    graph.add_edge(edge)
                    pref_nodes_created.append(feature_id)

        # Add UseCase preferences (advanced graph reasoning)
        if use_cases:
            for use_case in use_cases:
                use_case_id = f"usecase_{user_id}_{use_case}".replace(' ', '_')
                if not graph.has_node(use_case_id):
                    use_case_node = Node(use_case_id, 'UseCase', {
                        'name': use_case,
                        'user_id': user_id
                    })
                    graph.add_node(use_case_node)
                if not graph.has_edge(user_id, use_case_id, 'PREFERS'):
                    use_case_weight = self._get_use_case_weight(user_control_config)
                    edge = Edge(user_id, use_case_id, 'PREFERS', {
                        'weight': use_case_weight,
                        'is_must_have': False
                    })
                    graph.add_edge(edge)
                pref_nodes_created.append(use_case_id)
        
        self.log(f"Total preferences extracted: {len(pref_nodes_created)}")
        
        return {
            'preference_nodes': pref_nodes_created,
            'user_id': user_id
        }
    
    def _to_controls_dict(self, user_control_config):
        if not user_control_config:
            return {}
        if isinstance(user_control_config, dict):
            return user_control_config
        if hasattr(user_control_config, "to_dict"):
            try:
                return user_control_config.to_dict()
            except Exception:
                return {}
        return {}

    def _priority_and_strictness(self, pref_key, user_control_config):
        controls = self._to_controls_dict(user_control_config)
        priorities = controls.get('scoring_priorities', {}) or {}
        exploration_rate_set = bool(controls.get('exploration_rate_set', True))
        if not exploration_rate_set:
            priorities = {}
        try:
            priority = float(priorities.get(pref_key, 0.5))
        except Exception:
            priority = 0.5
        priority = max(0.0, min(1.0, priority))
        try:
            exploration_rate = float(controls.get('exploration_rate', 0.1) or 0.1)
        except Exception:
            exploration_rate = 0.1
        exploration_rate = max(0.0, min(0.5, exploration_rate))
        exploration_norm = exploration_rate / 0.5
        strictness = (0.68 * priority) + (0.32 * (1.0 - exploration_norm))
        strictness = max(0.0, min(1.0, strictness))
        return priority, strictness

    def _get_preference_weight(self, pref_key, user_control_config=None):
        """
        Map preference keys to weights from existing preference_config.
        
        Weights align with existing enhanced_matching() scoring:
        - budget: 10
        - fuel_type: 8
        - body_type: 7
        - transmission: 6
        - seating: 5
        - performance: 4
        - features: 3 (each)
        
        Args:
            pref_key: Preference key (e.g., 'budget', 'fuel_type')
        
        Returns:
            Weight value (int)
        """
        weight_map = {
            'budget': 10,
            'fuel_type': 8,
            'body_type': 7,
            'transmission': 6,
            'seating': 5,
            'performance': 4,
            'features': 3,
            'feature': 3,
            'brand': 5  # Added brand preference
        }
        base = float(weight_map.get(pref_key, 3))
        priority, strictness = self._priority_and_strictness(pref_key, user_control_config)
        # Priority controls graph-edge influence; strictness boosts hard-constraint relevance.
        scaled = base * (0.55 + (1.35 * priority))
        if strictness >= 0.8:
            scaled *= 1.12
        return round(scaled, 3)

    def _is_must_have(self, pref_key, context, user_control_config=None):
        """
        Determine if preference is a hard constraint.
        
        Args:
            pref_key: Preference key
            context: Context dictionary
        
        Returns:
            Boolean indicating if preference is must-have
        """
        must_have_prefs = context.get('must_have_preferences', [])
        if pref_key in must_have_prefs:
            return True
        _, strictness = self._priority_and_strictness(pref_key, user_control_config)
        return strictness >= 0.82

    def _get_feature_node_weight(self, feature_name, must_have_features, user_control_config=None):
        base = 5.0 if feature_name in must_have_features else 2.0
        priority, strictness = self._priority_and_strictness('features', user_control_config)
        weight = base * (0.6 + (1.25 * priority))
        if strictness >= 0.82 and feature_name in must_have_features:
            weight *= 1.15
        return round(weight, 3)

    def _get_use_case_weight(self, user_control_config=None):
        controls = self._to_controls_dict(user_control_config)
        objectives = controls.get('objective_weights', {}) or {}
        try:
            relevance = float(objectives.get('relevance', 0.5) or 0.5)
        except Exception:
            relevance = 0.5
        try:
            feature_div = float(objectives.get('feature_diversity', 0.15) or 0.15)
        except Exception:
            feature_div = 0.15
        relevance = max(0.0, min(1.0, relevance))
        feature_div = max(0.0, min(1.0, feature_div))
        return round(2.2 + (2.0 * relevance) + (0.8 * feature_div), 3)
