// Graph Model for shipwith.dev Visual Architecture Builder
// Phase 1: Port types, component ports, and spec classes

// ============================================
// PORT_TYPES: Define data flow types in web architectures
// ============================================
export const PORT_TYPES = {
  HTTP_IN:    { id: 'http-in', label: 'HTTP Request', color: '#2196F3' },
  HTTP_OUT:   { id: 'http-out', label: 'HTTP Response', color: '#2196F3' },
  SQL_QUERY:  { id: 'sql-q', label: 'SQL Query', color: '#9C27B0' },
  SQL_RESULT: { id: 'sql-r', label: 'SQL Result', color: '#9C27B0' },
  KV_OP:      { id: 'kv-op', label: 'KV Operation', color: '#FF9800' },
  STATIC:     { id: 'static', label: 'Static Asset', color: '#4CAF50' },
  WASM_CALL:  { id: 'wasm', label: 'WASM Call', color: '#DEA584' },
  RENDER:     { id: 'render', label: 'Render', color: '#AAAAAA' },
};

// ============================================
// COMPONENT_PORTS: Define input/output ports for each component
// ============================================
export const COMPONENT_PORTS = {
  user: {
    inputs: [],
    outputs: [{ type: 'http-out', position: 'bottom' }]
  },
  browser: {
    inputs: [{ type: 'http-in', position: 'top' }],
    outputs: [{ type: 'http-out', position: 'bottom' }]
  },
  workers: {
    inputs: [{ type: 'http-in', position: 'top' }],
    outputs: [
      { type: 'http-out', position: 'bottom' },
      { type: 'sql-q', position: 'bottom-left' },
      { type: 'kv-op', position: 'bottom-right' }
    ]
  },
  pages: {
    inputs: [{ type: 'http-in', position: 'top' }],
    outputs: [{ type: 'static', position: 'bottom' }]
  },
  kv: {
    inputs: [{ type: 'kv-op', position: 'top' }],
    outputs: [{ type: 'kv-op', position: 'bottom' }]
  },
  d1: {
    inputs: [{ type: 'sql-q', position: 'top' }],
    outputs: [{ type: 'sql-r', position: 'bottom' }]
  },
  wasm: {
    inputs: [{ type: 'wasm', position: 'top' }],
    outputs: [
      { type: 'wasm', position: 'bottom' },
      { type: 'render', position: 'right' }
    ]
  },
  threejs: {
    inputs: [{ type: 'render', position: 'left' }],
    outputs: []
  }
};

// ============================================
// COMPATIBLE_TYPES: Define which port types can connect
// ============================================
export const COMPATIBLE_TYPES = {
  'http-out': ['http-in'],
  'sql-r': ['sql-q'],      // Note: result connects back to query consumers
  'kv-op': ['kv-op'],
  'static': ['http-in'],   // Static assets serve HTTP
  'wasm': ['wasm'],
  'render': ['render'],
};

// ============================================
// CONNECTION VALIDATION FUNCTIONS
// ============================================

/**
 * Check if two port types can be connected
 * @param {string} sourcePortType - The output port type id
 * @param {string} targetPortType - The input port type id
 * @returns {boolean} True if connection is valid
 */
export function isValidConnection(sourcePortType, targetPortType) {
  const compatible = COMPATIBLE_TYPES[sourcePortType] || [];
  return compatible.includes(targetPortType);
}

/**
 * Get all valid input types for a given output type
 * @param {string} outputPortType - The output port type id
 * @returns {string[]} Array of compatible input port type ids
 */
export function getCompatibleInputs(outputPortType) {
  return COMPATIBLE_TYPES[outputPortType] || [];
}

// ============================================
// SPEC CLASSES: Serializable graph structures
// ============================================

/**
 * GraphSpec: Represents a complete architecture graph
 */
export class GraphSpec {
  constructor() {
    this.id = crypto.randomUUID();
    this.version = '1.0.0';
    this.name = 'Untitled Architecture';
    this.nodes = new Map();
    this.edges = new Map();
    this.metadata = {
      created: Date.now(),
      modified: Date.now(),
      author: null,
      description: ''
    };
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    this.metadata.modified = Date.now();
  }

  addEdge(edge) {
    this.edges.set(edge.id, edge);
    this.metadata.modified = Date.now();
  }

  removeNode(nodeId) {
    this.nodes.delete(nodeId);
    // Remove connected edges
    for (const [edgeId, edge] of this.edges) {
      if (edge.source.nodeId === nodeId || edge.target.nodeId === nodeId) {
        this.edges.delete(edgeId);
      }
    }
    this.metadata.modified = Date.now();
  }

  removeEdge(edgeId) {
    this.edges.delete(edgeId);
    this.metadata.modified = Date.now();
  }
}

/**
 * NodeSpec: Represents a single component node in the graph
 */
export class NodeSpec {
  constructor(componentId, position = { x: 0, y: 0 }) {
    this.id = crypto.randomUUID();
    this.componentId = componentId;
    this.alternativeId = null;
    this.position = { x: position.x, y: position.y };
    this.locked = false;
    this.metadata = {};

    // Simulation-relevant properties (populated by CanvasState.addNode)
    this.config = {
      capacity: { instances: 1, maxRPSPerInstance: 1000 },
      scaling: { autoScale: false, minInstances: 1, maxInstances: 10 },
      reliability: { failureProbability: 0.001, circuitBreaker: false },
      cost: { perHour: 0.05, currency: 'USD' },
      latency: { baseMs: 5, p95Multiplier: 1.8 },
    };

    this.provider = {
      id: null,
      name: null,
      alternatives: [],
    };
  }
}

/**
 * EdgeSpec: Represents a connection between two ports
 */
export class EdgeSpec {
  constructor(sourceNodeId, sourcePortId, targetNodeId, targetPortId) {
    this.id = crypto.randomUUID();
    this.source = { nodeId: sourceNodeId, portId: sourcePortId };
    this.target = { nodeId: targetNodeId, portId: targetPortId };
    this.label = null;
    this.metadata = {};

    // Connection properties
    this.config = {
      protocol: 'HTTPS',
      sync: true,
      latencyMs: 1,
      retryPolicy: { maxRetries: 3, backoffMs: 100, backoffMultiplier: 2 },
    };
  }
}
