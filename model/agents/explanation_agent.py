"""
Explanation Agent (GraphRAG-style)
Extracts graph paths and prepares structured explanation context for LLM
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.base_agent import BaseAgent


class ExplanationAgent(BaseAgent):
    """
    Agent 7: Extract graph paths and prepare structured explanation context.
    
    Responsibilities:
    - Extract User → Preference → Variant paths
    - Identify matched preferences for each variant
    - Extract trade-offs involving each variant
    - Extract soft violations
    - Build structured JSON context (NOT natural language)
    - Prepare context for LLM explanation generation
    """
    
    def __init__(self):
        super().__init__("ExplanationAgent")
    
    def execute(self, graph, context):
        """
        Extract graph paths and prepare structured explanation context for LLM.
        Does NOT generate natural language explanations itself.
        
        Args:
            graph: KnowledgeGraph with all nodes and edges
            context: Must contain 'validated_variants' and 'session_id'
        
        Returns:
            dict with 'explanation_contexts' (list of structured contexts)
        """
        validated_variants = context.get('validated_variants', [])
        user_id = context.get('session_id')
        
        if not validated_variants:
            self.log("No validated variants to explain")
            return {'explanation_contexts': []}
        
        explanations = []
        
        # Generate explanation contexts for top 5 variants
        for variant_result in validated_variants[:5]:
            # Extract variant name
            if isinstance(variant_result, dict):
                car_data = variant_result.get('car', {})
                if isinstance(car_data, dict):
                    variant_name = car_data.get('variant', '')
                else:
                    variant_name = str(car_data.get('variant', '')) if hasattr(car_data, 'get') else ''
            else:
                variant_name = ''
            
            if not variant_name:
                continue
            
            variant_id = f"variant_{variant_name.replace(' ', '_')}"
            
            if not graph.has_node(variant_id):
                continue
            
            # Extract graph paths for this variant (reuse cached reasoning if available)
            cached_paths = None
            variant_node = graph.get_node(variant_id)
            if variant_node and isinstance(variant_node.properties, dict):
                cached = variant_node.properties.get('path_reasoning')
                if cached and isinstance(cached, dict):
                    cached_paths = cached.get('reasoning_paths')
            if cached_paths is None and context.get('path_reasoner'):
                path_reasoner = context.get('path_reasoner')
                path_results = path_reasoner.score_variant_by_paths(
                    variant_id,
                    user_id,
                    context.get('extracted_preferences', {})
                )
                cached_paths = path_results.get('reasoning_paths', [])
            paths = cached_paths if cached_paths is not None else self._extract_paths(graph, user_id, variant_id)
            reasoning_paths = variant_result.get('reasoning_paths', []) or paths
            
            # Extract trade-offs
            tradeoffs = self._extract_tradeoffs(graph, variant_id)
            
            # Extract violations (if any)
            violations = self._extract_violations(graph, variant_id)
            
            # Get matched preferences
            matched_prefs = self._get_matched_preferences(graph, variant_id)
            
            # Get rejection/viewing status
            user_interaction = self._get_user_interaction(graph, user_id, variant_id)
            
            # Build structured context
            explanation_context = {
                'variant_id': variant_id,
                'variant_name': variant_name,
                'score': variant_result.get('combined_score', variant_result.get('score', 0)),
                'semantic_score': variant_result.get('semantic_score', 0),
                'rule_score': variant_result.get('score', 0),
                'paths': paths,  # User → Preference → Variant paths
                'reasoning_paths': reasoning_paths,
                'matched_preferences': matched_prefs,
                'tradeoffs': tradeoffs,
                'violations': violations,
                'user_interaction': user_interaction,
                'advanced_score': variant_result.get('advanced_score'),
                'graph_confidence': variant_result.get('graph_confidence'),
                'agent_votes': variant_result.get('agent_votes', {}),
                'graph_snapshot': self._build_graph_snapshot(graph, variant_id),
                'verdict': variant_result.get('details', {}).get('verdict', ''),
                'price_status': variant_result.get('details', {}).get('price', ''),
                'features_matched': variant_result.get('details', {}).get('features', ''),
                'seating_status': variant_result.get('details', {}).get('seating', ''),
                'performance_info': variant_result.get('details', {}).get('performance', '')
            }
            
            explanations.append(explanation_context)
        
        self.log(f"Generated explanation contexts for {len(explanations)} variants")
        
        return {
            'explanation_contexts': explanations
        }
    
    def _extract_paths(self, graph, user_id, variant_id):
        """
        Extract User → Preference → Variant paths.
        
        Shows how the variant connects to user preferences through the graph.
        
        Args:
            graph: KnowledgeGraph
            user_id: User node ID
            variant_id: Variant node ID
        
        Returns:
            List of path dictionaries
        """
        paths = []
        
        if not graph.has_node(user_id):
            return paths
        
        # Get all preferences user prefers
        pref_nodes = graph.get_neighbors(user_id, 'PREFERS')
        
        for pref_node in pref_nodes:
            # Check if this variant has this feature/preference
            has_feature_edges = [e for e in graph.edges 
                                 if e.source_id == variant_id and 
                                    e.target_id == pref_node.id and 
                                    e.type == 'HAS_FEATURE']
            
            if has_feature_edges:
                paths.append({
                    'path': f"{user_id} → PREFERS → {pref_node.id} ← HAS_FEATURE ← {variant_id}",
                    'preference_key': pref_node.properties.get('key', ''),
                    'preference_value': pref_node.properties.get('value', ''),
                    'weight': pref_node.properties.get('weight', 0),
                    'is_must_have': pref_node.properties.get('is_must_have', False)
                })
        
        return paths
    
    def _extract_tradeoffs(self, graph, variant_id):
        """
        Extract trade-offs involving this variant.
        
        Args:
            graph: KnowledgeGraph
            variant_id: Variant node ID
        
        Returns:
            List of trade-off dictionaries
        """
        tradeoffs = []
        
        tradeoff_edges = [e for e in graph.edges 
                         if e.source_id == variant_id and e.type == 'INVOLVES_TRADEOFF']
        
        for edge in tradeoff_edges:
            tradeoff_node = graph.get_node(edge.target_id)
            if tradeoff_node:
                tradeoffs.append({
                    'type': tradeoff_node.properties.get('type', ''),
                    'description': tradeoff_node.properties.get('description', ''),
                    'side': edge.properties.get('side', ''),
                    'advantage': edge.properties.get('advantage', '')
                })
        
        return tradeoffs
    
    def _extract_violations(self, graph, variant_id):
        """
        Extract soft violations for this variant.
        
        Args:
            graph: KnowledgeGraph
            variant_id: Variant node ID
        
        Returns:
            List of violation dictionaries
        """
        violations = []
        
        violation_edges = [e for e in graph.edges 
                          if e.source_id == variant_id and e.type == 'VIOLATES']
        
        for edge in violation_edges:
            pref_node = graph.get_node(edge.target_id)
            violations.append({
                'preference_id': edge.target_id,
                'preference_key': pref_node.properties.get('key', '') if pref_node else '',
                'reason': edge.properties.get('reason', ''),
                'severity': edge.properties.get('severity', 'low')
            })
        
        return violations
    
    def _get_matched_preferences(self, graph, variant_id):
        """
        Get all preferences matched by this variant.
        
        Args:
            graph: KnowledgeGraph
            variant_id: Variant node ID
        
        Returns:
            List of matched preference dictionaries
        """
        matched = []
        
        feature_edges = [e for e in graph.edges 
                        if e.source_id == variant_id and e.type == 'HAS_FEATURE']
        
        for edge in feature_edges:
            pref_node = graph.get_node(edge.target_id)
            if pref_node and pref_node.type == 'Preference':
                matched.append({
                    'key': pref_node.properties.get('key', ''),
                    'value': pref_node.properties.get('value', ''),
                    'weight': pref_node.properties.get('weight', 0),
                    'is_must_have': pref_node.properties.get('is_must_have', False)
                })
        
        return matched
    
    def _get_user_interaction(self, graph, user_id, variant_id):
        """
        Get user's interaction history with this variant.
        
        Args:
            graph: KnowledgeGraph
            user_id: User node ID
            variant_id: Variant node ID
        
        Returns:
            Dictionary with interaction status
        """
        interaction = {
            'viewed': False,
            'rejected': False,
            'shortlisted': False
        }
        
        if not graph.has_node(user_id):
            return interaction
        
        # Check for VIEWED edge
        viewed_edges = graph.get_edges(user_id, variant_id, 'VIEWED')
        if viewed_edges:
            interaction['viewed'] = True
            interaction['view_timestamp'] = viewed_edges[0].properties.get('timestamp')
        
        # Check for REJECTED edge
        rejected_edges = graph.get_edges(user_id, variant_id, 'REJECTED')
        if rejected_edges:
            interaction['rejected'] = True
            interaction['rejection_reason'] = rejected_edges[0].properties.get('reason')
        
        # Check for SHORTLISTED edge
        shortlisted_edges = graph.get_edges(user_id, variant_id, 'SHORTLISTED')
        if shortlisted_edges:
            interaction['shortlisted'] = True
            interaction['shortlist_timestamp'] = shortlisted_edges[0].properties.get('timestamp')
        
        return interaction

    def _build_graph_snapshot(self, graph, variant_id):
        """
        Build local graph structure summary for explainability UI.
        """
        outgoing = graph.get_edges_from(variant_id)
        edge_counts = {}
        for edge in outgoing:
            edge_counts[edge.type] = edge_counts.get(edge.type, 0) + 1

        neighbor_types = {}
        for edge in outgoing:
            node = graph.get_node(edge.target_id)
            if not node:
                continue
            neighbor_types[node.type] = neighbor_types.get(node.type, 0) + 1

        return {
            'variant_id': variant_id,
            'total_outgoing_edges': len(outgoing),
            'edge_type_counts': edge_counts,
            'neighbor_type_counts': neighbor_types
        }
