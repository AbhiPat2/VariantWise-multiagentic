"""
Context Awareness Agent
Tracks conversation history and prevents repetition
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.base_agent import BaseAgent
from knowledge_graph import Edge


class ContextAwarenessAgent(BaseAgent):
    """
    Agent 5: Track conversation history and user interactions.
    
    Responsibilities:
    - Parse conversation history for user actions
    - Add REJECTED edges for explicitly rejected variants
    - Add VIEWED edges for variants user has seen
    - Add SHORTLISTED edges for variants user is interested in
    - Prevent recommending rejected variants again
    """
    
    def __init__(self):
        super().__init__("ContextAwarenessAgent")
    
    def execute(self, graph, context):
        """
        Track conversation history and prevent repetition.
        Add REJECTED, VIEWED, SHORTLISTED edges.
        
        Args:
            graph: KnowledgeGraph
            context: Must contain 'session_id' and 'conversation_history'
        
        Returns:
            dict with 'rejected_variants', 'viewed_variants', 'shortlisted_variants'
        """
        user_id = context.get('session_id')
        conversation_history = context.get('conversation_history', [])
        
        if not graph.has_node(user_id):
            self.log(f"WARNING: User node {user_id} not found")
            return {
                'rejected_variants': [],
                'viewed_variants': [],
                'shortlisted_variants': []
            }
        
        rejected_variants = []
        viewed_variants = []
        shortlisted_variants = []
        
        # Parse conversation history for user actions
        for entry in conversation_history:
            action = entry.get('action')
            variant_name = entry.get('variant')
            
            if not variant_name:
                continue
            
            # Clean variant name to match graph node IDs
            variant_id = f"variant_{variant_name.replace(' ', '_')}"
            
            # Check if variant exists in graph
            if not graph.has_node(variant_id):
                # Try fuzzy matching
                variant_id = self._find_variant_fuzzy(graph, variant_name)
                if not variant_id:
                    continue
            
            timestamp = entry.get('timestamp', None)
            
            # Handle different actions
            if action == 'rejected':
                # Check if edge already exists
                if not graph.has_edge(user_id, variant_id, 'REJECTED'):
                    edge = Edge(user_id, variant_id, 'REJECTED', {
                        'timestamp': timestamp,
                        'reason': entry.get('reason', 'User rejected')
                    })
                    graph.add_edge(edge)
                    rejected_variants.append(variant_id)
                    self.log(f"Tracked rejection: {variant_name}")
            
            elif action == 'viewed':
                if not graph.has_edge(user_id, variant_id, 'VIEWED'):
                    edge = Edge(user_id, variant_id, 'VIEWED', {
                        'timestamp': timestamp,
                        'view_count': entry.get('view_count', 1)
                    })
                    graph.add_edge(edge)
                    viewed_variants.append(variant_id)
            
            elif action == 'shortlisted' or action == 'interested':
                if not graph.has_edge(user_id, variant_id, 'SHORTLISTED'):
                    edge = Edge(user_id, variant_id, 'SHORTLISTED', {
                        'timestamp': timestamp,
                        'interest_level': entry.get('interest_level', 'high')
                    })
                    graph.add_edge(edge)
                    shortlisted_variants.append(variant_id)
                    self.log(f"Tracked shortlist: {variant_name}")
            
            elif action == 'compared':
                # Track that user compared this variant with others
                if not graph.has_edge(user_id, variant_id, 'VIEWED'):
                    edge = Edge(user_id, variant_id, 'VIEWED', {
                        'timestamp': timestamp,
                        'context': 'comparison'
                    })
                    graph.add_edge(edge)
                    viewed_variants.append(variant_id)
        
        self.log(f"Tracked: {len(rejected_variants)} rejected, {len(viewed_variants)} viewed, {len(shortlisted_variants)} shortlisted")
        
        # Filter out rejected variants from candidates if requested
        if context.get('filter_rejected', True):
            candidate_variants = context.get('candidate_variants', [])
            filtered_candidates = [v for v in candidate_variants if v not in rejected_variants]
            if len(filtered_candidates) < len(candidate_variants):
                self.log(f"Filtered out {len(candidate_variants) - len(filtered_candidates)} rejected variants from candidates")
                # Update context with filtered candidates
                context['candidate_variants'] = filtered_candidates
        
        return {
            'rejected_variants': rejected_variants,
            'viewed_variants': viewed_variants,
            'shortlisted_variants': shortlisted_variants
        }
    
    def _find_variant_fuzzy(self, graph, variant_name):
        """
        Try to find variant using fuzzy matching.
        
        Args:
            graph: KnowledgeGraph
            variant_name: Variant name to search for
        
        Returns:
            Variant node ID if found, None otherwise
        """
        variant_name_clean = variant_name.lower().replace(' ', '_')
        
        # Check all variant nodes
        for node_id, node in graph.nodes.items():
            if node.type != 'Variant':
                continue
            
            node_name = node.properties.get('name', '').lower().replace(' ', '_')
            
            # Exact match
            if node_name == variant_name_clean:
                return node_id
            
            # Contains match
            if variant_name_clean in node_name or node_name in variant_name_clean:
                return node_id
        
        return None
