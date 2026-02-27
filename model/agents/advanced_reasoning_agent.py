"""
Advanced Reasoning Agent
Combines critique scoring, graph confidence, and consensus voting.
"""

import sys
import os
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.base_agent import BaseAgent


class AdvancedReasoningAgent(BaseAgent):
    """
    Final evaluator agent:
    - Critique scoring (must-have violations, weak matches)
    - Graph confidence scoring (paths, violations, matches)
    - Consensus voting across signals
    """

    def __init__(self):
        super().__init__("AdvancedReasoningAgent")

    def execute(self, graph, context):
        ranked_variants = context.get('validated_variants') or context.get('ranked_variants', [])
        preferences = context.get('extracted_preferences', {})
        must_haves = set(context.get('must_have_preferences', []))
        must_have_features = set(context.get('must_have_features', []))
        session_id = context.get('session_id')
        path_reasoner = context.get('path_reasoner')

        if not ranked_variants:
            self.log("No variants to evaluate")
            return {'advanced_variants': [], 'agent_evaluations': []}

        evaluations = []
        advanced = []
        rejected = []

        for variant in ranked_variants:
            car = variant.get('car', {})
            if isinstance(car, pd.Series):
                variant_name = car.get('variant', '')
                car_dict = car
            else:
                variant_name = car.get('variant', '')
                car_dict = car

            variant_id = self._find_variant_id(graph, variant_name)
            if not variant_id:
                continue

            # Graph signals
            path_score = variant.get('path_reasoning_score', 0)
            if path_reasoner and path_score == 0:
                path_results = path_reasoner.score_variant_by_paths(
                    variant_id, session_id, preferences
                )
                path_score = path_results.get('total_path_score', 0)

            matched_edges = graph.get_edges_from(variant_id, 'HAS_FEATURE')
            violation_edges = graph.get_edges_from(variant_id, 'VIOLATES')
            matched_count = len(matched_edges)
            violation_count = len(violation_edges)
            graph_confidence = self._compute_graph_confidence(matched_count, violation_count)

            # Critique scoring
            critique_penalty, critique_notes = self._critique_variant(
                graph, variant_id, car_dict, preferences, must_haves, must_have_features, session_id
            )

            # Consensus voting across signals
            rule_score = float(variant.get('score', 0))
            semantic_score = float(variant.get('semantic_score', 0)) * 100
            consensus_score = (
                0.45 * rule_score +
                0.20 * semantic_score +
                0.20 * path_score +
                0.15 * (graph_confidence * 10) -
                critique_penalty
            )

            low_confidence = graph_confidence < 0.35 or critique_penalty >= 3.5 or consensus_score < 5.0
            variant['advanced_score'] = consensus_score
            variant['graph_confidence'] = graph_confidence
            variant['critique_notes'] = critique_notes
            variant['combined_score'] = consensus_score
            variant['low_confidence'] = low_confidence
            variant['agent_votes'] = {
                'rule_score': rule_score,
                'semantic_score': semantic_score,
                'path_score': path_score,
                'graph_confidence': graph_confidence,
                'critique_penalty': critique_penalty
            }

            evaluations.append({
                'variant_id': variant_id,
                'variant_name': variant_name,
                'agent_votes': variant['agent_votes'],
                'critique_notes': critique_notes
            })
            if low_confidence:
                rejected.append(variant)
            else:
                advanced.append(variant)

        advanced.sort(key=lambda x: x.get('combined_score', x.get('score', 0)), reverse=True)
        rejected.sort(key=lambda x: x.get('combined_score', x.get('score', 0)), reverse=True)
        # If too few remain, add back highest scored rejected with override flag
        if len(advanced) < 5 and rejected:
            for variant in rejected:
                if len(advanced) >= 5:
                    break
                variant['low_confidence_override'] = True
                advanced.append(variant)
        advanced.sort(key=lambda x: x.get('combined_score', x.get('score', 0)), reverse=True)
        self.log(f"Advanced reasoning evaluated {len(advanced)} variants")

        return {
            'advanced_variants': advanced,
            'agent_evaluations': evaluations,
            'rejected_variants': rejected
        }

    def _find_variant_id(self, graph, variant_name):
        if not variant_name:
            return None
        target = variant_name.strip().lower()
        for node_id, node in graph.nodes.items():
            if node.type != 'Variant':
                continue
            name = str(node.properties.get('name', '')).strip().lower()
            if name == target:
                return node_id
        return None

    def _compute_graph_confidence(self, matched, violations):
        if matched == 0 and violations == 0:
            return 0.3
        score = (matched - (violations * 2)) / max(1, matched + violations)
        return max(0.0, min(1.0, 0.5 + (score / 2)))

    def _critique_variant(self, graph, variant_id, car, prefs, must_haves, must_have_features, session_id):
        penalty = 0.0
        notes = []

        # Must-have constraints
        if 'transmission' in must_haves:
            pref_trans = str(prefs.get('transmission', '')).lower()
            variant_trans = str(car.get('Transmission Type', car.get('transmission', ''))).lower()
            if pref_trans and pref_trans != 'any' and pref_trans not in variant_trans:
                penalty += 2.5
                notes.append(f"Transmission mismatch ({variant_trans} vs {pref_trans})")

        if 'fuel_type' in must_haves:
            pref_fuel = str(prefs.get('fuel_type', '')).lower()
            variant_fuel = str(car.get('Fuel Type', car.get('fuel_type', ''))).lower()
            if pref_fuel and pref_fuel != 'any' and pref_fuel not in variant_fuel:
                penalty += 2.0
                notes.append(f"Fuel mismatch ({variant_fuel} vs {pref_fuel})")

        if 'seating' in must_haves:
            required = int(prefs.get('seating', 0))
            seats = car.get('seating_norm', car.get('Seating Capacity', 0))
            try:
                if int(seats) < required:
                    penalty += 2.0
                    notes.append(f"Seats {seats} < required {required}")
            except Exception:
                pass

        # Must-have features via graph edges
        for feat in must_have_features:
            pref_id = f"pref_{session_id}_feature_{feat}".replace(' ', '_')
            if graph.has_node(pref_id) and not graph.has_edge(variant_id, pref_id, 'HAS_FEATURE'):
                penalty += 1.5
                notes.append(f"Missing must-have feature: {feat}")

        return penalty, notes
