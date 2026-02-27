"""
Variant Pruning Agent
Removes discontinued variants and adds VIOLATES edges for soft violations
"""

import sys
import os
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.base_agent import BaseAgent
from knowledge_graph import Node, Edge


class VariantPruningAgent(BaseAgent):
    """
    Agent 2: Prune discontinued variants and identify soft violations.
    
    Responsibilities:
    - Remove discontinued variants (hard filter)
    - Create Variant nodes for all valid variants
    - Add VIOLATES edges for soft constraint violations
    - Keep variants with minor violations visible for trade-off analysis
    """
    
    def __init__(self):
        super().__init__("VariantPruningAgent")
    
    def execute(self, graph, context):
        """
        Enhanced variant pruning with detailed filtering and graph reasoning.
        Uses EnhancedFilter for multi-dimensional checks.
        
        Args:
            graph: KnowledgeGraph to populate with Variant nodes
            context: Must contain 'variants_df' and 'extracted_preferences'
        
        Returns:
            dict with 'variants_kept', 'variants_removed', 'soft_violations'
        """
        from enhanced_filtering import EnhancedFilter
        
        variants_df = context.get('variants_df')
        preferences = context.get('extracted_preferences', {})
        session_id = context.get('session_id', 'user_default')
        
        if variants_df is None or variants_df.empty:
            self.log("WARNING: No variants DataFrame provided")
            return {
                'variants_kept': [],
                'variants_removed': [],
                'soft_violations': []
            }
        
        # Use enhanced filtering for detailed multi-dimensional checks
        enhanced_filter = EnhancedFilter(graph)
        kept_variant_ids, filtering_details = enhanced_filter.filter_variants(
            variants_df, preferences, context
        )

        # Build index of existing user-linked use-case nodes so variant suitability
        # can connect to both global and user-session use-case IDs.
        use_case_name_to_ids = {}
        for node_id, node in graph.nodes.items():
            if node.type != 'UseCase':
                continue
            use_case_name = str(node.properties.get('name', '')).strip().lower()
            if not use_case_name:
                continue
            if use_case_name not in use_case_name_to_ids:
                use_case_name_to_ids[use_case_name] = set()
            use_case_name_to_ids[use_case_name].add(node_id)
        
        variants_removed = []
        variants_kept = []
        soft_violations = []
        
        # Track which variants were removed and why
        removed_variants_set = set()
        for removal_type, removals in filtering_details.items():
            if removal_type != 'soft_violations':
                for removal in removals:
                    variant_name = removal.get('variant', removal.get('variant_name', ''))
                    removed_variants_set.add(variant_name)
        
        # Create variant nodes for kept variants and add to graph
        # Build a mapping from variant names to IDs for lookup
        kept_variant_ids_set = set(kept_variant_ids)
        
        for idx, row in variants_df.iterrows():
            variant_name = row.get('variant', f'variant_{idx}')
            variant_id = f"variant_{variant_name.replace(' ', '_')}"
            
            # Check if variant was removed by enhanced filtering
            # Enhanced filter uses same ID format, so check directly
            if variant_id not in kept_variant_ids_set or variant_name in removed_variants_set:
                variants_removed.append(variant_id)
                continue
            
            # Hard filter: discontinued variants (if you have this data)
            is_discontinued = row.get('discontinued', False)
            if is_discontinued:
                variants_removed.append(variant_id)
                self.log(f"Removed discontinued variant: {variant_name}")
                continue
            
            # Extract key properties for the node
            variant_props = {
                'name': variant_name,
                'price': row.get('numeric_price'),
                'fuel_type': row.get('fuel_type_norm', row.get('Fuel Type')),
                'body_type': row.get('body_type_norm', row.get('Body Type')),
                'transmission': row.get('transmission_norm', row.get('Transmission Type')),
                'seating': row.get('seating_norm', row.get('Seating Capacity')),
                'max_power': row.get('Max Power'),
                'mileage': row.get('Petrol Mileage ARAI') or row.get('Diesel Mileage ARAI'),
                'brand': row.get('brand', ''),
                'original_index': idx  # Store original DataFrame index
            }
            
            # Add all other columns as properties for feature checking
            for col in row.index:
                if col not in variant_props:
                    variant_props[col] = row.get(col)
            
            # Create Variant node
            variant_node = Node(variant_id, 'Variant', variant_props)
            graph.add_node(variant_node)
            variants_kept.append(variant_id)

            # Add SUITABLE_FOR edges for inferred use-cases (heuristics)
            use_cases = []
            body_type = str(variant_props.get('body_type', '')).lower()
            seating = variant_props.get('seating', 0) or 0
            try:
                if seating is None or (isinstance(seating, float) and pd.isna(seating)):
                    seating = 0
                seating = int(seating)
            except Exception:
                seating = 0
            power = variant_props.get('max_power', '')
            mileage = variant_props.get('mileage', '')
            if body_type in ['suv', 'muv'] and seating >= 5:
                use_cases.append('family_trips')
            if body_type in ['hatchback', 'sedan'] and (mileage or ''):
                use_cases.append('city_commute')
            if power:
                use_cases.append('highway')

            for use_case in use_cases:
                use_case_normalized = str(use_case).strip().lower()
                if not use_case_normalized:
                    continue

                linked_use_case_ids = set()

                # Canonical global use-case node
                use_case_id = f"usecase_{use_case_normalized}"
                if not graph.has_node(use_case_id):
                    use_case_node = Node(use_case_id, 'UseCase', {
                        'name': use_case_normalized
                    })
                    graph.add_node(use_case_node)
                linked_use_case_ids.add(use_case_id)

                # Also link to any user/session-specific UseCase nodes
                for existing_id in use_case_name_to_ids.get(use_case_normalized, set()):
                    linked_use_case_ids.add(existing_id)

                # Keep index updated for future iterations
                use_case_name_to_ids.setdefault(use_case_normalized, set()).update(linked_use_case_ids)

                for linked_use_case_id in linked_use_case_ids:
                    if not graph.has_edge(variant_id, linked_use_case_id, 'SUITABLE_FOR'):
                        graph.add_edge(Edge(variant_id, linked_use_case_id, 'SUITABLE_FOR', {
                            'confidence': 'heuristic'
                        }))
            
            # Add soft violations from enhanced filtering
            for soft_violation in filtering_details.get('soft_violations', []):
                if soft_violation.get('variant_id') == variant_id:
                    violations = soft_violation.get('violations', [])
                    for violation in violations:
                        pref_key = violation.get('type')
                        pref_id = f"pref_{session_id}_{pref_key}"
                        
                        # Only add edge if preference node exists
                        if graph.has_node(pref_id):
                            edge = Edge(variant_id, pref_id, 'VIOLATES', {
                                'reason': violation.get('message', ''),
                                'severity': violation.get('severity', 'medium')
                            })
                            graph.add_edge(edge)
                            soft_violations.append({
                                'variant_id': variant_id,
                                'variant_name': variant_name,
                                'pref_key': pref_key,
                                'reason': violation.get('message', ''),
                                'severity': violation.get('severity', 'medium')
                            })
        
        self.log(f"Kept {len(variants_kept)} variants, removed {len(variants_removed)}")
        self.log(f"Identified {len(soft_violations)} soft violations")
        
        return {
            'variants_kept': variants_kept,
            'variants_removed': variants_removed,
            'soft_violations': soft_violations
        }
    
    def _check_violations(self, variant_row, preferences, context):
        """
        Check if variant violates any MUST-HAVE preferences.
        
        These are SOFT violations - variants are kept but flagged.
        
        Args:
            variant_row: Pandas Series for the variant
            preferences: Dictionary of user preferences
            context: Context dictionary
        
        Returns:
            List of violation dictionaries
        """
        violations = []
        must_have_prefs = context.get('must_have_preferences', [])
        
        # Budget soft violation (50% over budget = high severity)
        if 'budget' in must_have_prefs and 'budget' in preferences:
            min_budget, max_budget = preferences['budget']
            price = variant_row.get('numeric_price')
            
            if pd.notna(price):
                if price > max_budget * 1.5:  # 50%+ over = high violation
                    violations.append({
                        'pref_key': 'budget',
                        'reason': f'Price ₹{int(price):,} exceeds max budget ₹{int(max_budget):,} by {int((price/max_budget - 1) * 100)}%',
                        'severity': 'high'
                    })
                elif price > max_budget * 1.2:  # 20-50% over = medium violation
                    violations.append({
                        'pref_key': 'budget',
                        'reason': f'Price ₹{int(price):,} exceeds max budget ₹{int(max_budget):,} by {int((price/max_budget - 1) * 100)}%',
                        'severity': 'medium'
                    })
                elif price < min_budget * 0.7:  # Significantly under budget might indicate lower quality
                    violations.append({
                        'pref_key': 'budget',
                        'reason': f'Price ₹{int(price):,} is significantly below min budget ₹{int(min_budget):,}',
                        'severity': 'low'
                    })
        
        # Transmission mismatch
        if 'transmission' in must_have_prefs and preferences.get('transmission') and preferences['transmission'] != 'Any':
            pref_trans = preferences['transmission'].lower()
            variant_trans = str(variant_row.get('Transmission Type', '')).lower()
            
            if pref_trans not in variant_trans and variant_trans not in pref_trans:
                violations.append({
                    'pref_key': 'transmission',
                    'reason': f'Has {variant_trans} transmission, but {pref_trans} was required',
                    'severity': 'high'
                })
        
        # Fuel type mismatch
        if 'fuel_type' in must_have_prefs and preferences.get('fuel_type') and preferences['fuel_type'] != 'Any':
            pref_fuel = preferences['fuel_type'].lower()
            variant_fuel = str(variant_row.get('Fuel Type', '')).lower()
            
            if pref_fuel not in variant_fuel and variant_fuel not in pref_fuel:
                violations.append({
                    'pref_key': 'fuel_type',
                    'reason': f'Has {variant_fuel} fuel, but {pref_fuel} was required',
                    'severity': 'medium'
                })
        
        # Seating capacity mismatch
        if 'seating' in must_have_prefs and 'seating' in preferences:
            required_seats = int(preferences['seating'])
            variant_seats = variant_row.get('Seating Capacity')
            
            if pd.notna(variant_seats):
                try:
                    variant_seats = int(variant_seats)
                    if variant_seats < required_seats:
                        violations.append({
                            'pref_key': 'seating',
                            'reason': f'Has {variant_seats} seats, but {required_seats}+ required',
                            'severity': 'high'
                        })
                except (ValueError, TypeError):
                    pass
        
        return violations
