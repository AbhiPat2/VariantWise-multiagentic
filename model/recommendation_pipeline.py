"""
Recommendation Pipeline Orchestrator
Multi-agent recommendation pipeline with knowledge graph
"""

from typing import Dict, List, Callable
import pandas as pd
import time
import sys

from knowledge_graph import KnowledgeGraph
from agents.preference_extraction_agent import PreferenceExtractionAgent
from agents.variant_pruning_agent import VariantPruningAgent
from agents.car_matchmaker_agent import CarMatchmakerAgent
from agents.tradeoff_negotiator_agent import TradeOffNegotiatorAgent
from agents.context_awareness_agent import ContextAwarenessAgent
from agents.validation_sanity_agent import ValidationAndSanityAgent
from agents.advanced_reasoning_agent import AdvancedReasoningAgent
from agents.explanation_agent import ExplanationAgent
from diversity_reranker import enhance_scoring_with_diversity, PreferenceElicitor
from hybrid_graph_coalition import HybridGraphCoalition
from agent_lightning_bridge import AgentLightningBridge
from preference_alignment import (
    compile_alignment_rules,
    enforce_alignment_on_ranked_variants,
    has_strict_constraints,
)


class RecommendationPipeline:
    """
    Multi-agent recommendation pipeline with knowledge graph.
    Orchestrates agents in strict order.
    
    Pipeline flow:
    1. PreferenceExtractionAgent: User input → Preference nodes
    2. VariantPruningAgent: Create Variant nodes, soft filtering
    3. CarMatchmakerAgent: Graph traversal → candidate set
    4. TradeOffNegotiatorAgent: Identify trade-offs
    5. ContextAwarenessAgent: Track conversation history
    6. **EXISTING SCORING LOGIC** (enhanced_matching + semantic)
    7. ValidationAndSanityAgent: Sanity checks
    8. AdvancedReasoningAgent: Critique + confidence + consensus
    9. ExplanationAgent: Extract graph paths → JSON context
    """
    
    def __init__(self):
        """Initialize all agents and pre-import runtime modules."""
        self.agents = {
            'preference_extraction': PreferenceExtractionAgent(),
            'variant_pruning': VariantPruningAgent(),
            'car_matchmaker': CarMatchmakerAgent(),
            'tradeoff_negotiator': TradeOffNegotiatorAgent(),
            'context_awareness': ContextAwarenessAgent(),
            'validation': ValidationAndSanityAgent(),
            'advanced_reasoning': AdvancedReasoningAgent(),
            'explanation': ExplanationAgent()
        }
        self.hybrid_coalition = HybridGraphCoalition()
        self.lightning_bridge = AgentLightningBridge()

        print("[Pipeline] Initialized with 8 agents")
    
    def run_recommendation_pipeline(
        self,
        user_input: str,
        extracted_preferences: Dict,
        conversation_history: List[Dict],
        variants_dataset: pd.DataFrame,
        session_id: str,
        existing_scoring_function: Callable,
        user_control_config=None,
        scoring_weights=None
    ) -> Dict:
        """
        Main pipeline execution.
        
        Args:
            user_input: Raw user input text
            extracted_preferences: Structured preferences (from existing OpenAI chat)
            conversation_history: List of conversation turns with actions
                                 [{'action': 'rejected', 'variant': 'Honda City', ...}, ...]
            variants_dataset: Full car variants DataFrame
            session_id: User session ID
            existing_scoring_function: Your existing enhanced_matching + semantic scoring
                                      Should accept (candidates_df, prefs) and return ranked list
        
        Returns:
            Dictionary with:
            - session_id: Session identifier
            - recommendations: Top validated variants
            - explanation_contexts: Structured explanation data for each variant
            - knowledge_graph: The constructed graph (for debugging)
            - pipeline_stats: Statistics about pipeline execution
        """
        print("\n" + "="*80)
        print("STARTING RECOMMENDATION PIPELINE")
        print("="*80 + "\n")
        sys.stdout.flush()
        
        # Create fresh knowledge graph for this session
        graph = KnowledgeGraph()
        from enhanced_filtering import GraphPathReasoner
        path_reasoner = GraphPathReasoner(graph)
        
        # Extract user controls from input if not provided
        if user_control_config is None:
            from user_control_system import AdvancedPreferenceExtractor
            extractor = AdvancedPreferenceExtractor()
            user_control_config = extractor.extract_user_controls(user_input, conversation_history)
        
        # Detect and resolve conflicts
        from user_control_system import EdgeCaseHandler
        conflicts = EdgeCaseHandler.detect_conflicts(extracted_preferences, user_control_config)
        extracted_preferences, user_control_config = EdgeCaseHandler.resolve_conflicts(
            extracted_preferences, user_control_config
        )

        must_have_preferences = self._identify_must_haves(
            extracted_preferences,
            user_control_config=user_control_config,
        )
        alignment_rules = compile_alignment_rules(
            extracted_preferences,
            user_control_config,
            must_have_preferences=must_have_preferences,
        )
        strict_constraints_active = has_strict_constraints(alignment_rules)
        
        # Build context dictionary
        context = {
            'user_input': user_input,
            'extracted_preferences': extracted_preferences,
            'conversation_history': conversation_history,
            'variants_df': variants_dataset,
            'session_id': session_id,
            'must_have_preferences': must_have_preferences,
            'filter_rejected': True,  # Filter out rejected variants from candidates
            'user_control_config': user_control_config,  # NEW: User controls
            'detected_conflicts': conflicts,  # NEW: Conflict information
            'path_reasoner': path_reasoner,  # Shared path reasoning cache
            'alignment_rules': alignment_rules,
            'strict_constraints_active': strict_constraints_active,
        }
        agent_trace = []

        self.lightning_bridge.session_start(
            session_id,
            {
                'user_input': user_input,
                'preferences': extracted_preferences,
                'controls': user_control_config.to_dict() if hasattr(user_control_config, 'to_dict') else user_control_config,
            },
        )

        def _trace(payload):
            agent_trace.append(payload)
            try:
                self.lightning_bridge.agent_step(
                    session_id=session_id,
                    step=payload.get('step'),
                    agent=payload.get('agent', ''),
                    payload=payload,
                )
            except Exception:
                pass

        def _variant_label_from_id(variant_id):
            node = graph.get_node(variant_id) if variant_id else None
            if node and getattr(node, "type", "") == "Variant":
                return str(node.properties.get("name", variant_id))
            return str(variant_id or "")

        def _top_score_factors(score_breakdown, limit=4):
            if not isinstance(score_breakdown, dict):
                return []
            numeric_items = []
            for key, value in score_breakdown.items():
                try:
                    numeric_items.append((str(key), float(value)))
                except Exception:
                    continue
            numeric_items.sort(key=lambda item: abs(item[1]), reverse=True)
            return [
                {"factor": key, "value": round(value, 4)}
                for key, value in numeric_items[:limit]
            ]
        
        # === AGENT EXECUTION SEQUENCE ===
        
        # Step 1: Extract preferences into graph
        print("\n[1/7] Running PreferenceExtractionAgent...")
        step_start = time.perf_counter()
        try:
            result_1 = self.agents['preference_extraction'].execute(graph, context)
            context.update(result_1)
            _trace({
                'step': 1,
                'agent': self.agents['preference_extraction'].name,
                'status': 'ok',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'outputs': {
                    'preference_nodes': len(result_1.get('preference_nodes', [])),
                    'must_have_preferences': list(context.get('must_have_preferences', []))[:6],
                    'preference_examples': [
                        {
                            'key': str(pref_node.properties.get('key', '')),
                            'value': str(pref_node.properties.get('value', '')),
                            'is_must_have': bool(pref_node.properties.get('is_must_have', False)),
                            'weight': float(pref_node.properties.get('weight', 0) or 0),
                        }
                        for pref_id in result_1.get('preference_nodes', [])[:6]
                        for pref_node in [graph.get_node(pref_id)]
                        if pref_node and getattr(pref_node, 'type', '') == 'Preference'
                    ],
                    'strict_constraints_active': bool(context.get('strict_constraints_active', False)),
                    'alignment_rules': len(context.get('alignment_rules', []) or []),
                }
            })
        except Exception as e:
            _trace({
                'step': 1,
                'agent': self.agents['preference_extraction'].name,
                'status': 'error',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'error': str(e)
            })
            print(f"ERROR in PreferenceExtractionAgent: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Step 2: Prune variants (soft filtering)
        print("\n[2/7] Running VariantPruningAgent...")
        step_start = time.perf_counter()
        try:
            result_2 = self.agents['variant_pruning'].execute(graph, context)
            context.update(result_2)
            _trace({
                'step': 2,
                'agent': self.agents['variant_pruning'].name,
                'status': 'ok',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'outputs': {
                    'variants_kept': len(result_2.get('variants_kept', [])),
                    'variants_removed': len(result_2.get('variants_removed', [])),
                    'soft_violations': len(result_2.get('soft_violations', [])),
                    'kept_examples': [
                        _variant_label_from_id(variant_id)
                        for variant_id in (result_2.get('variants_kept', []) or [])[:3]
                    ],
                    'soft_violation_examples': [
                        {
                            'variant': str(v.get('variant_name', '') or v.get('variant_id', '')),
                            'pref': str(v.get('pref_key', '')),
                            'severity': str(v.get('severity', '')),
                        }
                        for v in (result_2.get('soft_violations', []) or [])[:3]
                    ],
                }
            })
        except Exception as e:
            _trace({
                'step': 2,
                'agent': self.agents['variant_pruning'].name,
                'status': 'error',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'error': str(e)
            })
            print(f"ERROR in VariantPruningAgent: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Step 3: Find candidate variants via graph traversal
        print("\n[3/7] Running CarMatchmakerAgent...")
        step_start = time.perf_counter()
        try:
            result_3 = self.agents['car_matchmaker'].execute(graph, context)
            context['candidate_variants'] = result_3['candidate_variants']
            context['matching_paths'] = result_3.get('matching_paths', [])
            _trace({
                'step': 3,
                'agent': self.agents['car_matchmaker'].name,
                'status': 'ok',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'outputs': {
                    'candidate_variants': len(result_3.get('candidate_variants', [])),
                    'matching_paths': len(result_3.get('matching_paths', [])),
                    'top_candidate_preview': [
                        {
                            'variant': str(p.get('variant_name', '')),
                            'preliminary_score': round(float(p.get('preliminary_score', 0) or 0), 4),
                            'matched_preferences': len(p.get('matched_preferences', []) or []),
                        }
                        for p in (result_3.get('matching_paths', []) or [])[:3]
                    ],
                }
            })
        except Exception as e:
            _trace({
                'step': 3,
                'agent': self.agents['car_matchmaker'].name,
                'status': 'error',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'error': str(e)
            })
            print(f"ERROR in CarMatchmakerAgent: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Step 4: Identify trade-offs
        print("\n[4/7] Running TradeOffNegotiatorAgent...")
        step_start = time.perf_counter()
        try:
            result_4 = self.agents['tradeoff_negotiator'].execute(graph, context)
            context.update(result_4)
            _trace({
                'step': 4,
                'agent': self.agents['tradeoff_negotiator'].name,
                'status': 'ok',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'outputs': {
                    'tradeoffs': len(result_4.get('tradeoffs', [])),
                    'tradeoff_summary': str(result_4.get('tradeoff_summary', '') or ''),
                    'tradeoff_titles': [
                        str(t.get('title', ''))
                        for t in (result_4.get('tradeoffs', []) or [])[:3]
                    ],
                }
            })
        except Exception as e:
            _trace({
                'step': 4,
                'agent': self.agents['tradeoff_negotiator'].name,
                'status': 'error',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'error': str(e)
            })
            print(f"ERROR in TradeOffNegotiatorAgent: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Step 5: Track conversation context
        print("\n[5/7] Running ContextAwarenessAgent...")
        step_start = time.perf_counter()
        try:
            result_5 = self.agents['context_awareness'].execute(graph, context)
            context.update(result_5)
            _trace({
                'step': 5,
                'agent': self.agents['context_awareness'].name,
                'status': 'ok',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'outputs': {
                    'rejected_variants': len(result_5.get('rejected_variants', [])),
                    'viewed_variants': len(result_5.get('viewed_variants', [])),
                    'shortlisted_variants': len(result_5.get('shortlisted_variants', [])),
                    'rejected_examples': [
                        _variant_label_from_id(variant_id)
                        for variant_id in (result_5.get('rejected_variants', []) or [])[:3]
                    ],
                    'shortlisted_examples': [
                        _variant_label_from_id(variant_id)
                        for variant_id in (result_5.get('shortlisted_variants', []) or [])[:3]
                    ],
                }
            })
        except Exception as e:
            _trace({
                'step': 5,
                'agent': self.agents['context_awareness'].name,
                'status': 'error',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'error': str(e)
            })
            print(f"ERROR in ContextAwarenessAgent: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # === EXISTING SCORING LOGIC (UNCHANGED) ===
        print("\n[SCORING] Running existing scoring & semantic ranking...")
        scoring_start = time.perf_counter()
        
        # Filter variants_df to only candidates from graph
        candidate_variant_names = []
        for vid in context.get('candidate_variants', []):
            variant_node = graph.get_node(vid)
            if variant_node:
                candidate_variant_names.append(variant_node.properties.get('name'))
        
        if not candidate_variant_names:
            print("WARNING: No candidate variants found. Returning empty results.")
            try:
                self.lightning_bridge.session_end(
                    session_id,
                    {
                        'status': 'no_candidates',
                        'recommendations': 0,
                    },
                )
            except Exception:
                pass
            return {
                'session_id': session_id,
                'recommendations': [],
                'explanation_contexts': [],
                'knowledge_graph': graph,
                'agent_trace': agent_trace,
                'pipeline_stats': {
                    'candidates_found': 0,
                    'variants_scored': 0,
                    'variants_validated': 0,
                    'tradeoffs_identified': len(result_4.get('tradeoffs', [])),
                    'rejected_variants': len(result_5.get('rejected_variants', []))
                }
            }
        
        candidates_df = variants_dataset[
            variants_dataset['variant'].isin(candidate_variant_names)
        ]
        
        print(f"Scoring {len(candidates_df)} candidate variants...")
        
        # Call existing scoring function (enhanced_matching + semantic)
        try:
            ranked_variants = existing_scoring_function(candidates_df, extracted_preferences)
            
            # Enhance scores with graph path reasoning
            print("Enhancing scores with graph path reasoning...")
            for variant_match in ranked_variants:
                car = variant_match.get('car')
                if isinstance(car, pd.Series):
                    variant_name = car.get('variant', '')
                else:
                    variant_name = car.get('variant', '')
                
                # Find variant node in graph
                variant_node_id = None
                for vid in context.get('candidate_variants', []):
                    variant_node = graph.get_node(vid)
                    if variant_node and variant_node.properties.get('name') == variant_name:
                        variant_node_id = vid
                        break
                
                if variant_node_id:
                    # Get path-based reasoning score
                    path_results = context['path_reasoner'].score_variant_by_paths(
                        variant_node_id,
                        session_id,
                        extracted_preferences
                    )
                    variant_node = graph.get_node(variant_node_id)
                    if variant_node and isinstance(variant_node.properties, dict):
                        variant_node.properties['path_reasoning'] = path_results
                    
                    # Add path reasoning score (30% weight)
                    path_score = path_results['total_path_score']
                    original_score = variant_match.get('score', 0)
                    variant_match['path_reasoning_score'] = path_score
                    variant_match['reasoning_paths'] = path_results.get('reasoning_paths', [])
                    score_breakdown = variant_match.get('score_breakdown', {})
                    
                    # Blend scores: 70% original, 30% path reasoning
                    variant_match['score'] = original_score * 0.7 + path_score * 0.3
                    score_breakdown['path_component'] = float(path_score * 0.3)
                    score_breakdown['post_path_rule_component'] = float(original_score * 0.7)
                    score_breakdown['post_path_score'] = float(variant_match['score'])
                    
                    # Update combined_score if it exists
                    if 'combined_score' in variant_match:
                        variant_match['combined_score'] = variant_match['combined_score'] * 0.7 + path_score * 0.3
                    else:
                        variant_match['combined_score'] = variant_match['score']
                    score_breakdown['post_path_combined_score'] = float(variant_match['combined_score'])
                    variant_match['score_breakdown'] = score_breakdown
            
            # Re-sort by enhanced score
            ranked_variants.sort(key=lambda x: x.get('combined_score', x.get('score', 0)), reverse=True)

            # Apply context-awareness signals (advanced collaboration)
            rejected = set(context.get('rejected_variants', []))
            viewed = set(context.get('viewed_variants', []))
            shortlisted = set(context.get('shortlisted_variants', []))
            if rejected or viewed or shortlisted:
                for variant_match in ranked_variants:
                    car = variant_match.get('car')
                    if isinstance(car, pd.Series):
                        variant_name = car.get('variant', '')
                    else:
                        variant_name = car.get('variant', '')
                    variant_node_id = None
                    for vid in context.get('candidate_variants', []):
                        variant_node = graph.get_node(vid)
                        if variant_node and variant_node.properties.get('name') == variant_name:
                            variant_node_id = vid
                            break
                    if not variant_node_id:
                        continue
                    score_breakdown = variant_match.get('score_breakdown', {})
                    if variant_node_id in rejected:
                        variant_match['score'] = variant_match.get('score', 0) * 0.5
                        variant_match['combined_score'] = variant_match.get('combined_score', variant_match['score']) * 0.5
                        score_breakdown['context_penalty_rejected'] = 0.5
                    if variant_node_id in viewed:
                        variant_match['score'] = variant_match.get('score', 0) * 1.03
                        variant_match['combined_score'] = variant_match.get('combined_score', variant_match['score']) * 1.03
                        score_breakdown['context_boost_viewed'] = 1.03
                    if variant_node_id in shortlisted:
                        variant_match['score'] = variant_match.get('score', 0) * 1.08
                        variant_match['combined_score'] = variant_match.get('combined_score', variant_match['score']) * 1.08
                        score_breakdown['context_boost_shortlisted'] = 1.08
                    score_breakdown['post_context_score'] = float(variant_match.get('score', 0))
                    score_breakdown['post_context_combined_score'] = float(variant_match.get('combined_score', variant_match.get('score', 0)))
                    variant_match['score_breakdown'] = score_breakdown
                ranked_variants.sort(key=lambda x: x.get('combined_score', x.get('score', 0)), reverse=True)
            
        except Exception as e:
            print(f"ERROR in existing scoring function: {e}")
            import traceback
            traceback.print_exc()
            # Fallback: return unranked candidates
            ranked_variants = []
        
        # Apply diversity reranking after scoring (with user controls and DYNAMIC weights)
        print("\nApplying diversity reranking with user controls and dynamic weights...")
        ranked_variants = enhance_scoring_with_diversity(
            ranked_variants,
            extracted_preferences,
            use_mmr=True,
            lambda_diversity=user_control_config.diversity_weight if user_control_config else 0.3,
            user_control_config=user_control_config,
            scoring_weights=scoring_weights  # Pass dynamic weights
        )
        print(f"After diversity reranking: {len(ranked_variants)} variants")

        # Constraint-aware alignment enforcement to improve user-intent accuracy.
        ranked_variants = enforce_alignment_on_ranked_variants(
            ranked_variants,
            extracted_preferences,
            alignment_rules,
            min_results=5,
            allow_relaxation=not strict_constraints_active,
        )
        compliant_count = len([v for v in ranked_variants if not v.get('hard_failures')])
        print(f"After alignment enforcement: {len(ranked_variants)} variants ({compliant_count} compliant)")

        # Hybrid coalition: combine graph-centrality/path/comparison/exploration signals.
        hybrid_diagnostics = {}
        hybrid_start = time.perf_counter()
        try:
            ranked_variants, hybrid_diagnostics = self.hybrid_coalition.apply(
                ranked_variants=ranked_variants,
                graph=graph,
                context=context,
                user_control_config=user_control_config,
            )
            context['hybrid_graph_diagnostics'] = hybrid_diagnostics
            _trace({
                'step': 5.7,
                'agent': 'HybridGraphCoalition',
                'status': 'ok',
                'duration_ms': int((time.perf_counter() - hybrid_start) * 1000),
                'outputs': {
                    'hybrid_ranked_variants': len(ranked_variants),
                    'comparison_mode': bool(hybrid_diagnostics.get('comparison_mode')),
                    'comparison_targets': int(hybrid_diagnostics.get('comparison_targets', 0)),
                    'pagerank_ready': bool(hybrid_diagnostics.get('pagerank_ready')),
                    'similar_anchor': str(hybrid_diagnostics.get('similar_anchor', '') or ''),
                    'top_brand_spread': hybrid_diagnostics.get('top_brand_spread', {}),
                }
            })
        except Exception as e:
            _trace({
                'step': 5.7,
                'agent': 'HybridGraphCoalition',
                'status': 'error',
                'duration_ms': int((time.perf_counter() - hybrid_start) * 1000),
                'error': str(e),
            })
            print(f"WARNING: Hybrid graph coalition failed, continuing with base ranking: {e}")

        _trace({
            'step': 5.5,
            'agent': 'ScoringEngine',
            'status': 'ok',
            'duration_ms': int((time.perf_counter() - scoring_start) * 1000),
            'outputs': {
                'scored_variants': len(ranked_variants),
                'diversity_mode': getattr(getattr(user_control_config, 'diversity_mode', None), 'value', 'balanced'),
                'strict_constraints_active': strict_constraints_active,
                'alignment_compliant_variants': compliant_count,
                'hybrid_graph_enabled': bool(hybrid_diagnostics),
                'top_rank_preview': [
                    {
                        'variant': self._safe_variant_name(v),
                        'combined_score': round(float(v.get('combined_score', v.get('score', 0)) or 0), 4),
                    }
                    for v in ranked_variants[:3]
                ],
                'top_score_factors': _top_score_factors(
                    (ranked_variants[0].get('score_breakdown', {}) if ranked_variants else {})
                ),
            }
        })
        
        # Log brand distribution for debugging
        brand_dist = {}
        for v in ranked_variants[:10]:
            car = v.get('car', {})
            if isinstance(car, pd.Series):
                brand = str(car.get('brand', 'Unknown')).lower()
            elif isinstance(car, dict):
                brand = str(car.get('brand', 'Unknown')).lower()
            else:
                brand = 'Unknown'
            brand_dist[brand] = brand_dist.get(brand, 0) + 1
        print(f"Brand distribution in top 10: {dict(list(brand_dist.items())[:10])}")
        
        # Robustness check: Verify brand diversity in top 5
        top5_brands = {}
        for v in ranked_variants[:5]:
            car = v.get('car', {})
            if isinstance(car, pd.Series):
                brand = str(car.get('brand', 'Unknown')).lower()
            elif isinstance(car, dict):
                brand = str(car.get('brand', 'Unknown')).lower()
            else:
                brand = 'Unknown'
            top5_brands[brand] = top5_brands.get(brand, 0) + 1
        
        unique_brands_top5 = len(top5_brands)
        print(f"📊 Brand diversity in top 5: {unique_brands_top5} unique brands - {list(top5_brands.keys())}")
        
        # Warn if maximum diversity requested but insufficient brands
        if user_control_config and hasattr(user_control_config, 'diversity_mode'):
            if user_control_config.diversity_mode.value == 'maximum_diversity' and unique_brands_top5 < 3:
                print(f"⚠️ WARNING: Maximum diversity requested but only {unique_brands_top5} brands in top 5. May need more diverse candidates.")
        
        context['ranked_variants'] = ranked_variants
        
        # Step 6: Validation and sanity checks
        print("\n[6/8] Running ValidationAndSanityAgent...")
        step_start = time.perf_counter()
        try:
            result_6 = self.agents['validation'].execute(graph, context)
            validated_variants = result_6['validated_variants']
            removed_variants = result_6.get('removed_variants', [])

            removed_names = set()
            for removed in removed_variants:
                name = str(removed.get('variant_id', '') or '').strip()
                if name:
                    removed_names.add(name.lower())
            context['validation_removed_variant_names'] = removed_names
            
            # CRITICAL FIX: Ensure we have at least 5 validated variants
            if (
                len(validated_variants) < 5
                and len(ranked_variants) >= 5
                and not strict_constraints_active
            ):
                print(f"⚠️ WARNING: Validation removed too many variants ({len(validated_variants)}/{len(ranked_variants)}).")
                print(f"   Adding best remaining variants to reach 5...")
                
                # Get removed variants
                removed_ids = {str(r.get('variant_id', '')).strip().lower() for r in removed_variants}
                
                # Add back best variants that weren't removed (relax validation)
                for variant in ranked_variants:
                    if len(validated_variants) >= 5:
                        break
                    if variant.get('hard_failures'):
                        continue
                    
                    # Check if this variant was removed
                    variant_name = ''
                    if isinstance(variant, dict):
                        car_data = variant.get('car', {})
                        if isinstance(car_data, dict):
                            variant_name = car_data.get('variant', '')
                        elif hasattr(car_data, 'get'):
                            variant_name = car_data.get('variant', '')
                    
                    if variant_name and variant_name.strip().lower() not in removed_ids:
                        # Check if it's already in validated
                        already_validated = any(
                            v.get('car', {}).get('variant', '') == variant_name 
                            for v in validated_variants
                        )
                        if not already_validated:
                            validated_variants.append(variant)
                            print(f"   Added back: {variant_name}")
            
            context['validated_variants'] = validated_variants
            print(f"✅ Final validated variants: {len(validated_variants)}")
            _trace({
                'step': 6,
                'agent': self.agents['validation'].name,
                'status': 'ok',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'outputs': {
                    'validated_variants': len(validated_variants),
                    'removed_variants': len(removed_variants),
                    'validated_examples': [
                        self._safe_variant_name(v)
                        for v in (validated_variants or [])[:3]
                    ],
                    'removed_examples': [
                        {
                            'variant': str(v.get('variant_id', '')),
                            'reason': str(v.get('reason', ''))[:180],
                        }
                        for v in (removed_variants or [])[:2]
                    ],
                }
            })
        except Exception as e:
            _trace({
                'step': 6,
                'agent': self.agents['validation'].name,
                'status': 'error',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'error': str(e)
            })
            print(f"ERROR in ValidationAndSanityAgent: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Step 7: Advanced reasoning (critique + confidence + consensus)
        print("\n[7/8] Running AdvancedReasoningAgent...")
        step_start = time.perf_counter()
        try:
            result_7 = self.agents['advanced_reasoning'].execute(graph, context)
            context['advanced_variants'] = result_7.get('advanced_variants', [])
            context['agent_evaluations'] = result_7.get('agent_evaluations', [])
            if context['advanced_variants']:
                context['ranked_variants'] = context['advanced_variants']
            _trace({
                'step': 7,
                'agent': self.agents['advanced_reasoning'].name,
                'status': 'ok',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'outputs': {
                    'advanced_variants': len(result_7.get('advanced_variants', [])),
                    'agent_evaluations': len(result_7.get('agent_evaluations', [])),
                    'low_confidence_flagged': len(result_7.get('rejected_variants', [])),
                    'consensus_preview': [
                        {
                            'variant': str(e.get('variant_name', '')),
                            'graph_confidence': round(float((e.get('agent_votes', {}) or {}).get('graph_confidence', 0) or 0), 4),
                            'critique_penalty': round(float((e.get('agent_votes', {}) or {}).get('critique_penalty', 0) or 0), 4),
                        }
                        for e in (result_7.get('agent_evaluations', []) or [])[:3]
                    ],
                }
            })
        except Exception as e:
            _trace({
                'step': 7,
                'agent': self.agents['advanced_reasoning'].name,
                'status': 'error',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'error': str(e)
            })
            print(f"ERROR in AdvancedReasoningAgent: {e}")
            import traceback
            traceback.print_exc()
            raise

        # Step 8: Generate explanation contexts
        print("\n[8/8] Running ExplanationAgent...")
        step_start = time.perf_counter()
        try:
            result_8 = self.agents['explanation'].execute(graph, context)
            explanation_contexts = (result_8.get('explanation_contexts', []) or [])
            explanation_preview = [
                {
                    'variant': str(ex.get('variant_name', '')),
                    'matched_preferences': len(ex.get('matched_preferences', []) or []),
                    'reasoning_paths': len(ex.get('reasoning_paths', []) or []),
                    'violations': len(ex.get('violations', []) or []),
                }
                for ex in explanation_contexts[:3]
            ]
            top_reasoning_path = ""
            if explanation_contexts:
                first_paths = (
                    explanation_contexts[0].get('reasoning_paths', [])
                    or explanation_contexts[0].get('paths', [])
                    or []
                )
                if first_paths:
                    first_path = first_paths[0]
                    if isinstance(first_path, dict):
                        top_reasoning_path = str(first_path.get('path', '') or '')
                    else:
                        top_reasoning_path = str(first_path)
            _trace({
                'step': 8,
                'agent': self.agents['explanation'].name,
                'status': 'ok',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'outputs': {
                    'explanation_contexts': len(result_8.get('explanation_contexts', [])),
                    'explanation_preview': explanation_preview,
                    'top_reasoning_path': top_reasoning_path[:220],
                }
            })
        except Exception as e:
            _trace({
                'step': 8,
                'agent': self.agents['explanation'].name,
                'status': 'error',
                'duration_ms': int((time.perf_counter() - step_start) * 1000),
                'error': str(e)
            })
            print(f"ERROR in ExplanationAgent: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        print("\n" + "="*80)
        print("PIPELINE COMPLETE")
        print("="*80 + "\n")
        
        # Print graph statistics
        stats = graph.get_statistics()
        print(f"Knowledge Graph Stats: {stats['total_nodes']} nodes, {stats['total_edges']} edges")
        print(f"  Node types: {stats['node_types']}")
        print(f"  Edge types: {stats['edge_types']}")
        
        # Generate clarifying questions for preference refinement
        elicitor = PreferenceElicitor()
        clarifying_questions = elicitor.generate_clarifying_questions(
            extracted_preferences,
            conversation_history
        )
        
        # CRITICAL: Ensure we return at least 5 recommendations
        final_recommendations = context.get('advanced_variants') or result_6['validated_variants']
        if len(final_recommendations) < 5 and not strict_constraints_active:
            print(f"⚠️ CRITICAL: Only {len(final_recommendations)} recommendations. Adding best remaining...")
            removed_by_validation = set(context.get('validation_removed_variant_names', set()))
            # Add best remaining from ranked_variants
            for variant in ranked_variants:
                if len(final_recommendations) >= 5:
                    break
                if variant.get('hard_failures'):
                    continue
                # Check if already in final_recommendations
                variant_name = ''
                if isinstance(variant, dict):
                    car_data = variant.get('car', {})
                    if isinstance(car_data, dict):
                        variant_name = car_data.get('variant', '')
                    elif hasattr(car_data, 'get'):
                        variant_name = car_data.get('variant', '')
                
                if variant_name and variant_name.strip().lower() in removed_by_validation:
                    continue

                already_in = any(
                    v.get('car', {}).get('variant', '') == variant_name 
                    for v in final_recommendations
                )
                if not already_in:
                    final_recommendations.append(variant)

        final_recommendations = final_recommendations[:5]

        try:
            self.lightning_bridge.ranking_event(
                session_id,
                {
                    'top_variants': [self._safe_variant_name(v) for v in final_recommendations],
                    'pipeline_stats': {
                        'scored': len(ranked_variants),
                        'validated': len(result_6['validated_variants']),
                        'strict_constraints_active': strict_constraints_active,
                    },
                    'hybrid_graph_diagnostics': context.get('hybrid_graph_diagnostics', {}),
                },
            )
            self.lightning_bridge.session_end(
                session_id,
                {
                    'status': 'ok',
                    'recommendations': len(final_recommendations),
                },
            )
        except Exception:
            pass
        
        # Return final results
        return {
            'session_id': session_id,
            'recommendations': final_recommendations,  # Ensure exactly 5
            'explanation_contexts': result_8['explanation_contexts'],
            'clarifying_questions': clarifying_questions,  # Questions to refine preferences
            'conflicts': [c for c in conflicts if c['severity'] != 'low'],  # Detected conflicts
            'user_control_applied': user_control_config.to_dict() if user_control_config else None,
            'knowledge_graph': graph,  # Return graph for debugging/visualization
            'agent_evaluations': context.get('agent_evaluations', []),
            'agent_trace': agent_trace,
            'hybrid_graph_diagnostics': context.get('hybrid_graph_diagnostics', {}),
            'pipeline_stats': {
                'candidates_found': len(context.get('candidate_variants', [])),
                'variants_scored': len(ranked_variants),
                'variants_validated': len(result_6['validated_variants']),
                'tradeoffs_identified': len(result_4.get('tradeoffs', [])),
                'rejected_variants': len(result_5.get('rejected_variants', [])),
                'graph_nodes': stats['total_nodes'],
                'graph_edges': stats['total_edges'],
                'diversity_applied': True,
                'hybrid_graph_applied': bool(context.get('hybrid_graph_diagnostics')),
                'strict_constraints_active': strict_constraints_active,
                'alignment_compliant_variants': compliant_count,
                'edge_cases_detected': len(conflicts),
                'edge_cases_resolved': len([c for c in conflicts if c.get('resolved', False)])
            }
        }
    
    def _identify_must_haves(self, preferences, user_control_config=None):
        """
        Identify which preferences are hard constraints.
        
        Budget and transmission are typically must-haves.
        
        Args:
            preferences: User preferences dict
        
        Returns:
            List of preference keys that are must-haves
        """
        must_haves = {'budget'}  # Budget is always a must-have
        
        # Transmission is must-have if explicitly specified (not 'Any')
        if preferences.get('transmission') and preferences['transmission'] != 'Any':
            must_haves.add('transmission')
        
        # Fuel type is must-have if explicitly specified (not 'Any')
        if preferences.get('fuel_type') and preferences['fuel_type'] != 'Any':
            must_haves.add('fuel_type')
        
        # Seating is must-have if specified and > 5 (unusual requirement)
        if preferences.get('seating') and int(preferences['seating']) > 5:
            must_haves.add('seating')

        # Dynamic strictness from advanced sliders:
        # high priority + low exploration => promote to hard constraint.
        controls = {}
        if user_control_config:
            if isinstance(user_control_config, dict):
                controls = user_control_config
            elif hasattr(user_control_config, "to_dict"):
                try:
                    controls = user_control_config.to_dict()
                except Exception:
                    controls = {}

        priorities = controls.get('scoring_priorities', {}) or {}
        if not bool(controls.get('exploration_rate_set', True)):
            priorities = {}
        try:
            exploration_rate = float(controls.get('exploration_rate', 0.1) or 0.1)
        except Exception:
            exploration_rate = 0.1
        exploration_rate = max(0.0, min(0.5, exploration_rate))
        exploration_norm = exploration_rate / 0.5

        def strictness(key, default_priority=0.5):
            try:
                p = float(priorities.get(key, default_priority))
            except Exception:
                p = default_priority
            p = max(0.0, min(1.0, p))
            return max(0.0, min(1.0, (0.68 * p) + (0.32 * (1.0 - exploration_norm))))

        for key in ['fuel_type', 'body_type', 'transmission', 'seating', 'features', 'performance']:
            if strictness(key) >= 0.8:
                must_haves.add(key)

        return sorted(must_haves)

    @staticmethod
    def _safe_variant_name(variant_match):
        car = variant_match.get('car', {})
        if isinstance(car, dict):
            return str(car.get('variant', '') or car.get('name', ''))
        if hasattr(car, 'get'):
            return str(car.get('variant', '') or car.get('name', ''))
        return ''
