"""
Trade-Off Negotiator Agent
Identifies practical preference conflicts and records them in the knowledge graph.
"""

import os
import sys
from typing import Dict, List

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.base_agent import BaseAgent
from knowledge_graph import Edge, Node


class TradeOffNegotiatorAgent(BaseAgent):
    """
    Agent 4: Detect trade-offs across user constraints.

    This agent does not rank cars directly. It surfaces where preferences are
    mutually restrictive so downstream agents can reason with better context.
    """

    def __init__(self):
        super().__init__("TradeOffNegotiatorAgent")

    def execute(self, graph, context):
        session_id = context.get("session_id")
        preferences = context.get("extracted_preferences", {}) or {}
        candidate_variants = context.get("candidate_variants", []) or []

        if not session_id:
            self.log("WARNING: Missing session_id in context")
            return {"tradeoffs": [], "tradeoff_summary": "No session context."}

        tradeoffs = self._detect_tradeoffs(preferences, len(candidate_variants))

        user_id = session_id
        for idx, item in enumerate(tradeoffs, start=1):
            node_id = f"tradeoff_{session_id}_{idx}"
            node = Node(
                node_id,
                "TradeOff",
                {
                    "title": item["title"],
                    "description": item["description"],
                    "severity": item["severity"],
                    "impacted_preferences": item["impacted_preferences"],
                    "recommendation": item["recommendation"],
                },
            )
            graph.add_node(node)

            if graph.has_node(user_id) and not graph.has_edge(user_id, node_id, "INVOLVES_TRADEOFF"):
                graph.add_edge(
                    Edge(
                        user_id,
                        node_id,
                        "INVOLVES_TRADEOFF",
                        {
                            "severity": item["severity"],
                            "source": "tradeoff_negotiator",
                        },
                    )
                )

        self.log(f"Identified {len(tradeoffs)} trade-off(s)")
        summary = self._summarize_tradeoffs(tradeoffs)
        return {
            "tradeoffs": tradeoffs,
            "tradeoff_summary": summary,
        }

    def _detect_tradeoffs(self, prefs: Dict, candidate_count: int) -> List[Dict]:
        tradeoffs: List[Dict] = []

        max_budget = self._to_int(prefs.get("max_budget"), 0)
        fuel = str(prefs.get("fuel_type", "Any") or "Any").strip().lower()
        body = str(prefs.get("body_type", "Any") or "Any").strip().lower()
        transmission = str(prefs.get("transmission", "Any") or "Any").strip().lower()
        performance = self._to_int(prefs.get("performance"), 5)
        features = prefs.get("features", []) or []
        if isinstance(features, str):
            features = [f.strip() for f in features.split(",") if f.strip()]

        if max_budget and performance >= 8 and max_budget <= 1200000:
            tradeoffs.append(
                self._tradeoff(
                    title="Performance vs Budget",
                    description="High performance preference with a tight budget reduces strong matches.",
                    severity="high",
                    impacted=["performance", "budget"],
                    recommendation="Increase budget or relax performance priority for better options.",
                )
            )

        if fuel == "electric" and body == "suv" and max_budget and max_budget <= 1800000:
            tradeoffs.append(
                self._tradeoff(
                    title="EV SUV Availability",
                    description="Electric SUV options are fewer in this budget segment.",
                    severity="medium",
                    impacted=["fuel_type", "body_type", "budget"],
                    recommendation="Raise budget slightly or allow hybrid/petrol alternatives.",
                )
            )

        if transmission == "automatic" and max_budget and max_budget <= 900000:
            tradeoffs.append(
                self._tradeoff(
                    title="Automatic Gearbox vs Price",
                    description="Automatic variants are limited at the lower price band.",
                    severity="medium",
                    impacted=["transmission", "budget"],
                    recommendation="Increase budget or consider AMT/manual fallback.",
                )
            )

        if len(features) >= 4 and max_budget and max_budget <= 1500000:
            tradeoffs.append(
                self._tradeoff(
                    title="Feature Loadout vs Budget",
                    description="Requesting many must-have features can over-constrain mid-budget choices.",
                    severity="medium",
                    impacted=["features", "budget"],
                    recommendation="Prioritize top 2-3 must-have features first.",
                )
            )

        if candidate_count and candidate_count < 10:
            tradeoffs.append(
                self._tradeoff(
                    title="Narrow Candidate Pool",
                    description=f"Only {candidate_count} candidates remained after filtering.",
                    severity="low",
                    impacted=["overall_constraints"],
                    recommendation="Relax one strict preference to improve diversity.",
                )
            )

        return tradeoffs

    @staticmethod
    def _tradeoff(title: str, description: str, severity: str, impacted: List[str], recommendation: str) -> Dict:
        return {
            "title": title,
            "description": description,
            "severity": severity,
            "impacted_preferences": impacted,
            "recommendation": recommendation,
        }

    @staticmethod
    def _summarize_tradeoffs(tradeoffs: List[Dict]) -> str:
        if not tradeoffs:
            return "No major trade-offs detected."
        high = sum(1 for t in tradeoffs if t.get("severity") == "high")
        medium = sum(1 for t in tradeoffs if t.get("severity") == "medium")
        low = sum(1 for t in tradeoffs if t.get("severity") == "low")
        return f"Detected {len(tradeoffs)} trade-off(s): {high} high, {medium} medium, {low} low."

    @staticmethod
    def _to_int(value, default: int = 0) -> int:
        try:
            return int(float(value))
        except Exception:
            return default
