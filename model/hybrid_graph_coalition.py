"""
Hybrid Graph Coalition Engine

Combines modern graph ranking signals with multi-agent recommendation output:
- Personalized PageRank over the session graph
- Constraint path coherence scoring
- Comparison/similarity intent shaping
- Exploration-aware novelty bonus
"""

from __future__ import annotations

from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple


@dataclass
class HybridDiagnostics:
    pagerank_ready: bool
    comparison_mode: bool
    comparison_targets: int
    similar_anchor: str
    exploration_rate: float
    top_brand_spread: Dict[str, int]
    strictness_profile: Dict[str, float]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pagerank_ready": self.pagerank_ready,
            "comparison_mode": self.comparison_mode,
            "comparison_targets": self.comparison_targets,
            "similar_anchor": self.similar_anchor,
            "exploration_rate": self.exploration_rate,
            "top_brand_spread": dict(self.top_brand_spread),
            "strictness_profile": dict(self.strictness_profile),
        }


class HybridGraphCoalition:
    """
    Hybrid ranker that fuses graph-first and agent-first signals.
    """

    EDGE_WEIGHTS = {
        "PREFERS": 1.0,
        "HAS_FEATURE": 0.9,
        "SUITABLE_FOR": 0.85,
        "BETTER_THAN": 0.7,
        "INVOLVES_TRADEOFF": 0.55,
        "SHORTLISTED": 0.65,
        "VIEWED": 0.45,
        "VIOLATES": 0.25,
        "REJECTED": 0.2,
    }

    def __init__(self, damping: float = 0.85, iterations: int = 26):
        self.damping = damping
        self.iterations = iterations

    @staticmethod
    def _normalize_text(value: Any) -> str:
        text = str(value or "").strip().lower()
        return " ".join(text.split())

    @staticmethod
    def _variant_name(variant_match: Dict[str, Any]) -> str:
        car = variant_match.get("car", {})
        if isinstance(car, dict):
            return str(car.get("variant") or car.get("name") or "").strip()
        if hasattr(car, "get"):
            return str(car.get("variant", "") or car.get("name", "")).strip()
        return ""

    @staticmethod
    def _variant_brand(variant_match: Dict[str, Any]) -> str:
        car = variant_match.get("car", {})
        if isinstance(car, dict):
            brand = car.get("brand")
            if brand:
                return str(brand).strip().lower()
            name = str(car.get("variant") or car.get("name") or "")
            return name.split(" ")[0].lower() if name else "unknown"
        if hasattr(car, "get"):
            brand = car.get("brand", "")
            if brand:
                return str(brand).strip().lower()
            name = str(car.get("variant", "") or car.get("name", ""))
            return name.split(" ")[0].lower() if name else "unknown"
        return "unknown"

    @staticmethod
    def _score_key(variant_match: Dict[str, Any]) -> float:
        try:
            return float(variant_match.get("combined_score", variant_match.get("score", 0.0)))
        except Exception:
            return 0.0

    def _to_controls_dict(self, user_control_config: Any) -> Dict[str, Any]:
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

    def _name_to_variant_id(self, graph) -> Dict[str, str]:
        mapping: Dict[str, str] = {}
        for node_id, node in getattr(graph, "nodes", {}).items():
            if getattr(node, "type", "") != "Variant":
                continue
            name = self._normalize_text(node.properties.get("name", ""))
            if name:
                mapping[name] = node_id
        return mapping

    def _weighted_outgoing(self, graph) -> Dict[str, List[Tuple[str, float]]]:
        outgoing: Dict[str, List[Tuple[str, float]]] = defaultdict(list)
        for edge in getattr(graph, "edges", []):
            w = float(self.EDGE_WEIGHTS.get(edge.type, 0.35))
            outgoing[edge.source_id].append((edge.target_id, w))
            if edge.type in {"HAS_FEATURE", "SUITABLE_FOR", "INVOLVES_TRADEOFF", "BETTER_THAN"}:
                outgoing[edge.target_id].append((edge.source_id, max(0.2, w * 0.45)))
        return outgoing

    def _personalized_pagerank(self, graph, session_id: str) -> Dict[str, float]:
        node_ids = list(getattr(graph, "nodes", {}).keys())
        if not node_ids or session_id not in getattr(graph, "nodes", {}):
            return {}

        outgoing = self._weighted_outgoing(graph)
        n = len(node_ids)
        score = {nid: 1.0 / n for nid in node_ids}

        preference_neighbors = [n.id for n in graph.get_neighbors(session_id, "PREFERS")] if hasattr(graph, "get_neighbors") else []
        teleport_nodes = [session_id] + preference_neighbors
        teleport_mass = 1.0 / max(1, len(teleport_nodes))

        for _ in range(self.iterations):
            nxt = {nid: (1.0 - self.damping) / n for nid in node_ids}
            for src in node_ids:
                neighbors = outgoing.get(src, [])
                src_score = score.get(src, 0.0)
                if not neighbors:
                    continue
                norm = sum(w for _, w in neighbors) or 1.0
                for dst, weight in neighbors:
                    nxt[dst] += self.damping * src_score * (weight / norm)

            # Personalized teleport bias.
            for nid in teleport_nodes:
                if nid in nxt:
                    nxt[nid] += (1.0 - self.damping) * teleport_mass
            score = nxt

        max_val = max(score.values()) if score else 1.0
        if max_val <= 0:
            return score
        return {k: v / max_val for k, v in score.items()}

    def _shortest_distance(self, graph, source_id: str, target_id: str, max_depth: int = 6) -> Optional[int]:
        if source_id == target_id:
            return 0
        q = deque([(source_id, 0)])
        visited = {source_id}

        while q:
            node_id, depth = q.popleft()
            if depth >= max_depth:
                continue
            neighbors = graph.get_neighbors(node_id, direction="both") if hasattr(graph, "get_neighbors") else []
            for nbr in neighbors:
                nid = nbr.id
                if nid == target_id:
                    return depth + 1
                if nid not in visited:
                    visited.add(nid)
                    q.append((nid, depth + 1))
        return None

    def _preference_path_score(self, graph, session_id: str, variant_id: str) -> float:
        if not hasattr(graph, "get_neighbors"):
            return 0.0
        preference_nodes = graph.get_neighbors(session_id, "PREFERS")
        if not preference_nodes:
            return 0.0

        matched = 0.0
        for pref in preference_nodes:
            if graph.has_edge(variant_id, pref.id, "HAS_FEATURE"):
                matched += 1.0
            if graph.has_edge(variant_id, pref.id, "SUITABLE_FOR"):
                matched += 0.7
            if graph.has_edge(variant_id, pref.id, "VIOLATES"):
                matched -= 0.8

        distance = self._shortest_distance(graph, session_id, variant_id, max_depth=6)
        distance_factor = 0.25 if distance is None else (1.0 / (1.0 + float(distance)))
        coverage = matched / max(1.0, float(len(preference_nodes)))
        return max(0.0, min(1.0, (coverage * 0.75) + (distance_factor * 0.25)))

    @staticmethod
    def _token_set(text: str) -> Set[str]:
        return {tok for tok in text.lower().replace("/", " ").replace("-", " ").split() if tok}

    def _name_similarity(self, a: str, b: str) -> float:
        na = self._normalize_text(a)
        nb = self._normalize_text(b)
        if not na or not nb:
            return 0.0
        if na == nb:
            return 1.0
        ratio = SequenceMatcher(None, na, nb).ratio()
        ta, tb = self._token_set(na), self._token_set(nb)
        jaccard = len(ta & tb) / max(1, len(ta | tb))
        return max(ratio, jaccard)

    def _comparison_signal(
        self,
        variant_name: str,
        comparison_mode: bool,
        comparison_targets: List[str],
        similar_to_car: str,
    ) -> float:
        if not variant_name:
            return 0.0

        signal = 0.0
        if comparison_mode and comparison_targets:
            signal = max(self._name_similarity(variant_name, target) for target in comparison_targets)
        if similar_to_car:
            signal = max(signal, self._name_similarity(variant_name, similar_to_car))
        if not comparison_mode and not similar_to_car:
            return 0.5
        return max(0.0, min(1.0, signal))

    @staticmethod
    def _clamp(val: float, lo: float, hi: float) -> float:
        return max(lo, min(hi, val))

    def _priority_focus(self, priorities: Dict[str, Any]) -> float:
        if not priorities:
            return 0.5
        vals = []
        for key in ["budget", "fuel_type", "body_type", "transmission", "seating", "features", "performance"]:
            try:
                vals.append(float(priorities.get(key, 0.5)))
            except Exception:
                vals.append(0.5)
        vals = [self._clamp(v, 0.0, 1.0) for v in vals]
        return sum(vals) / len(vals)

    def apply(
        self,
        ranked_variants: List[Dict[str, Any]],
        graph,
        context: Dict[str, Any],
        user_control_config: Any = None,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Apply hybrid coalition scoring.
        """
        if not ranked_variants:
            return [], HybridDiagnostics(False, False, 0, "", 0.0, {}).to_dict()

        controls = self._to_controls_dict(user_control_config)
        session_id = context.get("session_id", "")
        comparison_mode = bool(controls.get("comparison_mode", False))
        comparison_targets = [str(v).strip() for v in (controls.get("comparison_cars", []) or []) if str(v).strip()]
        similar_to_car = str(controls.get("similar_to_car", "") or "").strip()
        exploration_rate = self._clamp(float(controls.get("exploration_rate", 0.1) or 0.1), 0.0, 0.5)
        priorities = controls.get("scoring_priorities", {}) or {}
        if not bool(controls.get("exploration_rate_set", True)):
            priorities = {}
        objective_weights = controls.get("objective_weights", {}) or {}

        default_priorities = {
            "budget": 0.5,
            "fuel_type": 0.5,
            "body_type": 0.5,
            "transmission": 0.5,
            "seating": 0.5,
            "features": 0.5,
            "performance": 0.5,
        }
        merged_priorities = {**default_priorities, **priorities}
        exploration_norm = self._clamp(exploration_rate / 0.5, 0.0, 1.0)

        def _priority(key: str) -> float:
            try:
                return self._clamp(float(merged_priorities.get(key, 0.5) or 0.5), 0.0, 1.0)
            except Exception:
                return 0.5

        strictness_map = {
            key: self._clamp((0.68 * _priority(key)) + (0.32 * (1.0 - exploration_norm)), 0.0, 1.0)
            for key in default_priorities.keys()
        }

        name_to_variant_id = self._name_to_variant_id(graph)
        pagerank = self._personalized_pagerank(graph, session_id)
        pagerank_ready = bool(pagerank)

        base_scores = [self._score_key(v) for v in ranked_variants]
        min_score = min(base_scores) if base_scores else 0.0
        max_score = max(base_scores) if base_scores else 1.0
        score_span = (max_score - min_score) if max_score > min_score else 1.0

        brand_counts = Counter(self._variant_brand(v) for v in ranked_variants[:20])
        max_brand_count = max(brand_counts.values()) if brand_counts else 1
        priority_focus = self._priority_focus(merged_priorities)
        obj_relevance = self._clamp(float(objective_weights.get("relevance", 0.5) or 0.5), 0.0, 1.0)
        obj_exploration = self._clamp(float(objective_weights.get("exploration", exploration_rate) or exploration_rate), 0.0, 1.0)
        obj_feature_div = self._clamp(float(objective_weights.get("feature_diversity", 0.15) or 0.15), 0.0, 1.0)
        obj_price_cov = self._clamp(float(objective_weights.get("price_coverage", 0.1) or 0.1), 0.0, 1.0)

        for variant in ranked_variants:
            variant_name = self._variant_name(variant)
            variant_key = self._normalize_text(variant_name)
            variant_id = name_to_variant_id.get(variant_key, "")
            brand = self._variant_brand(variant)

            old_combined = self._score_key(variant)
            normalized_base = self._clamp((old_combined - min_score) / score_span, 0.0, 1.0)
            pr_score = pagerank.get(variant_id, 0.0) if variant_id else 0.0
            path_score = self._preference_path_score(graph, session_id, variant_id) if variant_id else 0.0
            comparison_score = self._comparison_signal(
                variant_name,
                comparison_mode,
                comparison_targets,
                similar_to_car,
            )
            alignment_score = self._clamp(float(variant.get("alignment_score", 0.0) or 0.0), 0.0, 1.0)

            # Novelty bonus scales with exploration and underrepresented brands.
            rarity = 1.0 - (brand_counts.get(brand, 1) / float(max_brand_count))
            exploration_bonus = exploration_rate * max(0.0, rarity) * (0.7 + (0.6 * obj_exploration))

            # Unique coalition blend: base + graph centrality + path coherence + comparison intent.
            # Strict preference profiles rely more on path coherence, exploratory
            # profiles rely more on graph centrality/diversity signals.
            strictness_focus = (
                strictness_map["fuel_type"]
                + strictness_map["body_type"]
                + strictness_map["transmission"]
                + strictness_map["seating"]
                + strictness_map["features"]
            ) / 5.0
            graph_weight = 0.13 + (0.08 * (1.0 - strictness_focus)) + (0.03 * obj_feature_div)
            path_weight = 0.13 + (0.1 * strictness_focus) + (0.03 * obj_price_cov)
            comparison_weight = 0.12 if (comparison_mode or similar_to_car) else 0.06
            alignment_weight = 0.08 + (0.04 * obj_relevance)
            base_weight = 1.0 - (graph_weight + path_weight + comparison_weight + alignment_weight)
            if base_weight < 0.25:
                # Keep enough original model signal for ranking stability.
                overflow = 0.25 - base_weight
                graph_weight = max(0.05, graph_weight - (overflow * 0.5))
                path_weight = max(0.05, path_weight - (overflow * 0.3))
                comparison_weight = max(0.04, comparison_weight - (overflow * 0.2))
                base_weight = 1.0 - (graph_weight + path_weight + comparison_weight + alignment_weight)

            hybrid_norm = (
                (base_weight * normalized_base)
                + (graph_weight * pr_score)
                + (path_weight * path_score)
                + (comparison_weight * comparison_score)
                + (alignment_weight * alignment_score)
                + exploration_bonus
            )
            hybrid_norm = self._clamp(hybrid_norm, 0.0, 1.0)

            # Keep score scale stable: blend old combined score with hybrid projection.
            hybrid_projection = min_score + (hybrid_norm * score_span)
            final_combined = (0.68 * old_combined) + (0.32 * hybrid_projection)

            variant["combined_score"] = float(final_combined)
            variant["score"] = float(variant.get("score", 0.0)) * (0.92 + 0.16 * hybrid_norm)
            variant["graph_hybrid"] = {
                "variant_id": variant_id or None,
                "pagerank": round(pr_score, 6),
                "path_coherence": round(path_score, 6),
                "comparison_similarity": round(comparison_score, 6),
                "exploration_bonus": round(exploration_bonus, 6),
                "hybrid_norm": round(hybrid_norm, 6),
            }
            score_breakdown = variant.get("score_breakdown", {}) or {}
            score_breakdown.update({
                "hybrid_base_component": float(base_weight * normalized_base),
                "hybrid_pagerank_component": float(graph_weight * pr_score),
                "hybrid_path_component": float(path_weight * path_score),
                "hybrid_comparison_component": float(comparison_weight * comparison_score),
                "hybrid_alignment_component": float(alignment_weight * alignment_score),
                "hybrid_exploration_bonus": float(exploration_bonus),
                "hybrid_combined_score": float(final_combined),
                "hybrid_strictness_focus": float(strictness_focus),
            })
            variant["score_breakdown"] = score_breakdown

        ranked_variants.sort(key=self._score_key, reverse=True)
        diagnostics = HybridDiagnostics(
            pagerank_ready=pagerank_ready,
            comparison_mode=comparison_mode,
            comparison_targets=len(comparison_targets),
            similar_anchor=similar_to_car,
            exploration_rate=exploration_rate,
            top_brand_spread=dict(Counter(self._variant_brand(v) for v in ranked_variants[:5])),
            strictness_profile={k: float(v) for k, v in strictness_map.items()},
        )
        return ranked_variants, diagnostics.to_dict()
