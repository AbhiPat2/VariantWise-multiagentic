"""
Knowledge Graph Implementation for VariantWise
Lightweight in-memory graph for car recommendation reasoning
"""

class Node:
    """
    Represents a node in the knowledge graph.
    
    Node types: User, Preference, Car, Variant, Feature, UseCase, TradeOff, Risk
    """
    
    def __init__(self, node_id, node_type, properties=None):
        """
        Initialize a node.
        
        Args:
            node_id: Unique identifier for the node
            node_type: Type of node (User, Preference, Variant, etc.)
            properties: Dictionary of node properties
        """
        self.id = node_id
        self.type = node_type
        self.properties = properties or {}
    
    def __repr__(self):
        return f"Node({self.type}:{self.id})"
    
    def __eq__(self, other):
        if not isinstance(other, Node):
            return False
        return self.id == other.id
    
    def __hash__(self):
        return hash(self.id)


class Edge:
    """
    Represents a directed edge in the knowledge graph.
    
    Edge types: PREFERS, HAS_VARIANT, HAS_FEATURE, SUITABLE_FOR, 
                INVOLVES_TRADEOFF, HAS_RISK, VIOLATES, BETTER_THAN, 
                REJECTED, VIEWED, SHORTLISTED
    """
    
    def __init__(self, source_id, target_id, edge_type, properties=None):
        """
        Initialize an edge.
        
        Args:
            source_id: ID of source node
            target_id: ID of target node
            edge_type: Type of relationship
            properties: Dictionary of edge properties
        """
        self.source_id = source_id
        self.target_id = target_id
        self.type = edge_type
        self.properties = properties or {}
    
    def __repr__(self):
        return f"Edge({self.source_id}-[{self.type}]->{self.target_id})"
    
    def __eq__(self, other):
        if not isinstance(other, Edge):
            return False
        return (self.source_id == other.source_id and 
                self.target_id == other.target_id and 
                self.type == other.type)
    
    def __hash__(self):
        return hash((self.source_id, self.target_id, self.type))


class KnowledgeGraph:
    """
    Lightweight in-memory knowledge graph for car recommendations.
    
    Supports:
    - Adding nodes and edges
    - Querying neighbors by edge type
    - Graph traversal with depth limits
    - Extracting subgraphs
    """
    
    def __init__(self):
        """Initialize an empty knowledge graph."""
        self.nodes = {}  # node_id -> Node
        self.edges = []  # list of Edge objects
        self.edge_index = {}  # source_id -> {edge_type -> [Edge]}
        self.reverse_edge_index = {}  # target_id -> {edge_type -> [Edge]}
    
    def add_node(self, node):
        """
        Add a node to the graph.
        
        Args:
            node: Node object to add
        """
        if not isinstance(node, Node):
            raise TypeError("Expected Node object")
        
        self.nodes[node.id] = node
    
    def add_edge(self, edge):
        """
        Add an edge to the graph.
        
        Args:
            edge: Edge object to add
        """
        if not isinstance(edge, Edge):
            raise TypeError("Expected Edge object")
        
        # Add to edges list
        self.edges.append(edge)
        
        # Build forward index for fast lookups
        if edge.source_id not in self.edge_index:
            self.edge_index[edge.source_id] = {}
        if edge.type not in self.edge_index[edge.source_id]:
            self.edge_index[edge.source_id][edge.type] = []
        self.edge_index[edge.source_id][edge.type].append(edge)
        
        # Build reverse index for backward traversal
        if edge.target_id not in self.reverse_edge_index:
            self.reverse_edge_index[edge.target_id] = {}
        if edge.type not in self.reverse_edge_index[edge.target_id]:
            self.reverse_edge_index[edge.target_id][edge.type] = []
        self.reverse_edge_index[edge.target_id][edge.type].append(edge)
    
    def get_neighbors(self, node_id, edge_type=None, direction='outgoing'):
        """
        Get neighbor nodes connected via specific edge type.
        
        Args:
            node_id: ID of the node to get neighbors for
            edge_type: Optional edge type filter
            direction: 'outgoing' (default), 'incoming', or 'both'
        
        Returns:
            List of neighbor Node objects
        """
        neighbors = []
        
        # Get outgoing edges
        if direction in ['outgoing', 'both']:
            if node_id in self.edge_index:
                if edge_type:
                    edges = self.edge_index[node_id].get(edge_type, [])
                else:
                    edges = [e for edges_list in self.edge_index[node_id].values() 
                            for e in edges_list]
                
                for edge in edges:
                    if edge.target_id in self.nodes:
                        neighbors.append(self.nodes[edge.target_id])
        
        # Get incoming edges
        if direction in ['incoming', 'both']:
            if node_id in self.reverse_edge_index:
                if edge_type:
                    edges = self.reverse_edge_index[node_id].get(edge_type, [])
                else:
                    edges = [e for edges_list in self.reverse_edge_index[node_id].values() 
                            for e in edges_list]
                
                for edge in edges:
                    if edge.source_id in self.nodes:
                        neighbors.append(self.nodes[edge.source_id])
        
        return neighbors
    
    def get_edges(self, source_id=None, target_id=None, edge_type=None):
        """
        Get edges matching the specified criteria.
        
        Args:
            source_id: Optional source node ID filter
            target_id: Optional target node ID filter
            edge_type: Optional edge type filter
        
        Returns:
            List of Edge objects matching criteria
        """
        matching_edges = []
        
        for edge in self.edges:
            if source_id and edge.source_id != source_id:
                continue
            if target_id and edge.target_id != target_id:
                continue
            if edge_type and edge.type != edge_type:
                continue
            matching_edges.append(edge)
        
        return matching_edges
    
    def get_edges_from(self, source_id, edge_type=None):
        """
        Get all edges from a source node, optionally filtered by edge type.
        
        Args:
            source_id: Source node ID
            edge_type: Optional edge type filter
        
        Returns:
            List of Edge objects
        """
        if source_id not in self.edge_index:
            return []
        
        if edge_type:
            return self.edge_index[source_id].get(edge_type, [])
        else:
            return [e for edges_list in self.edge_index[source_id].values() for e in edges_list]
    
    def get_edge(self, source_id, target_id, edge_type=None):
        """
        Get a specific edge between two nodes.
        
        Args:
            source_id: Source node ID
            target_id: Target node ID
            edge_type: Optional edge type filter
        
        Returns:
            Edge object if found, None otherwise
        """
        edges = self.get_edges(source_id=source_id, target_id=target_id, edge_type=edge_type)
        return edges[0] if edges else None
    
    def traverse(self, start_node_id, edge_types, max_depth=3):
        """
        Traverse graph following specific edge types in sequence.
        
        Args:
            start_node_id: Starting node ID
            edge_types: List of edge types to follow in order
            max_depth: Maximum traversal depth
        
        Returns:
            List of paths, where each path is a list of Node objects
        """
        if start_node_id not in self.nodes:
            return []
        
        visited = set()
        paths = []
        
        def dfs(current_id, path, depth):
            if depth > max_depth:
                return
            
            visited.add(current_id)
            
            # If we've traversed all required edge types, save the path
            if depth == len(edge_types):
                paths.append(path)
                return
            
            # Get next edge type to follow
            next_edge_type = edge_types[depth]
            neighbors = self.get_neighbors(current_id, next_edge_type)
            
            for neighbor in neighbors:
                if neighbor.id not in visited:
                    dfs(neighbor.id, path + [neighbor], depth + 1)
            
            visited.remove(current_id)  # Allow revisiting in different paths
        
        dfs(start_node_id, [self.nodes[start_node_id]], 0)
        return paths
    
    def get_subgraph(self, node_ids):
        """
        Extract a subgraph containing only specified nodes.
        
        Args:
            node_ids: List of node IDs to include in subgraph
        
        Returns:
            New KnowledgeGraph containing only specified nodes and their edges
        """
        subgraph = KnowledgeGraph()
        
        # Add nodes
        for node_id in node_ids:
            if node_id in self.nodes:
                subgraph.add_node(self.nodes[node_id])
        
        # Add edges between included nodes
        for edge in self.edges:
            if edge.source_id in node_ids and edge.target_id in node_ids:
                subgraph.add_edge(edge)
        
        return subgraph
    
    def get_node(self, node_id):
        """
        Get a node by ID.
        
        Args:
            node_id: Node ID
        
        Returns:
            Node object or None if not found
        """
        return self.nodes.get(node_id)
    
    def has_node(self, node_id):
        """Check if node exists in graph."""
        return node_id in self.nodes
    
    def has_edge(self, source_id, target_id, edge_type=None):
        """
        Check if edge exists between two nodes.
        
        Args:
            source_id: Source node ID
            target_id: Target node ID
            edge_type: Optional edge type filter
        
        Returns:
            Boolean indicating if edge exists
        """
        edges = self.get_edges(source_id, target_id, edge_type)
        return len(edges) > 0
    
    def get_statistics(self):
        """
        Get graph statistics.
        
        Returns:
            Dictionary with node counts, edge counts, etc.
        """
        node_type_counts = {}
        for node in self.nodes.values():
            node_type_counts[node.type] = node_type_counts.get(node.type, 0) + 1
        
        edge_type_counts = {}
        for edge in self.edges:
            edge_type_counts[edge.type] = edge_type_counts.get(edge.type, 0) + 1
        
        return {
            'total_nodes': len(self.nodes),
            'total_edges': len(self.edges),
            'node_types': node_type_counts,
            'edge_types': edge_type_counts
        }
    
    def __repr__(self):
        stats = self.get_statistics()
        return f"KnowledgeGraph(nodes={stats['total_nodes']}, edges={stats['total_edges']})"
