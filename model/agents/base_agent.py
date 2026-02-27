"""
Base Agent Class for Multi-Agent Recommendation System
"""

from abc import ABC, abstractmethod
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from knowledge_graph import KnowledgeGraph


class BaseAgent(ABC):
    """
    Abstract base class for all agents in the recommendation pipeline.
    
    All agents must:
    - Be stateless (except for graph modifications)
    - Implement the execute() method
    - Return a dictionary with results
    - Communicate only through the KnowledgeGraph
    """
    
    def __init__(self, name):
        """
        Initialize the agent.
        
        Args:
            name: Human-readable name for the agent
        """
        self.name = name
    
    @abstractmethod
    def execute(self, graph, context):
        """
        Execute the agent's logic.
        
        Args:
            graph: KnowledgeGraph object to operate on
            context: Dictionary containing:
                - user_input: Raw user input text
                - extracted_preferences: Structured preferences dict
                - conversation_history: List of conversation turns
                - variants_df: Car variants DataFrame
                - session_id: User session ID
                - must_have_preferences: List of hard constraint preference keys
                - ... (agent-specific context added by previous agents)
        
        Returns:
            Dictionary with agent-specific results that will be merged into context
        """
        pass
    
    def log(self, message):
        """
        Log a message with the agent's name prefix.
        
        Args:
            message: Message to log
        """
        print(f"[{self.name}] {message}")
    
    def __repr__(self):
        return f"{self.__class__.__name__}(name='{self.name}')"
