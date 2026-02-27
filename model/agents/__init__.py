"""
Multi-Agent System for VariantWise Recommendation Pipeline
"""

from importlib import import_module

_EXPORTS = {
    "BaseAgent": "base_agent",
    "PreferenceExtractionAgent": "preference_extraction_agent",
    "VariantPruningAgent": "variant_pruning_agent",
    "CarMatchmakerAgent": "car_matchmaker_agent",
    "TradeOffNegotiatorAgent": "tradeoff_negotiator_agent",
    "ContextAwarenessAgent": "context_awareness_agent",
    "ValidationAndSanityAgent": "validation_sanity_agent",
    "ExplanationAgent": "explanation_agent",
    "AdvancedReasoningAgent": "advanced_reasoning_agent",
}

__all__ = [
    "BaseAgent",
    "PreferenceExtractionAgent",
    "VariantPruningAgent",
    "CarMatchmakerAgent",
    "TradeOffNegotiatorAgent",
    "ContextAwarenessAgent",
    "ValidationAndSanityAgent",
    "ExplanationAgent",
    "AdvancedReasoningAgent",
]


def __getattr__(name):
    module_name = _EXPORTS.get(name)
    if not module_name:
        raise AttributeError(f"module 'agents' has no attribute '{name}'")
    module = import_module(f".{module_name}", __name__)
    value = getattr(module, name)
    globals()[name] = value
    return value
