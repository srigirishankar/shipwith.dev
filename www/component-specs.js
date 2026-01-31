// Component Specifications for Visual Architecture Canvas
// Inspired by Unit's spec.json format
// Each component defines typed inputs/outputs for connection validation

// ============================================
// TYPE SYSTEM
// ============================================

// Base types that can flow between components
export const TYPES = {
  // Request/Response
  HTTP_REQUEST: 'http-request',
  HTTP_RESPONSE: 'http-response',

  // Data
  JSON: 'json',
  HTML: 'html',
  BINARY: 'binary',
  STRING: 'string',

  // Database
  SQL_QUERY: 'sql-query',
  SQL_RESULT: 'sql-result',
  KV_OPERATION: 'kv-operation',
  KV_RESULT: 'kv-result',

  // Compute
  WASM_CALL: 'wasm-call',
  WASM_RESULT: 'wasm-result',
  RENDER_COMMAND: 'render-command',

  // Static
  STATIC_ASSET: 'static-asset',

  // AI-specific types
  LLM_PROMPT: 'llm-prompt',
  LLM_RESPONSE: 'llm-response',
  EMBEDDING: 'embedding',
  VECTOR_RESULTS: 'vector-results',
  AGENT_ACTION: 'agent-action',
  TOOL_CALL: 'tool-call',
  TOOL_RESULT: 'tool-result',

  // Generic (accepts any)
  ANY: 'any',
};

// Type compatibility matrix
// Key = source output type, Value = array of compatible input types
export const TYPE_COMPATIBILITY = {
  [TYPES.HTTP_REQUEST]: [TYPES.HTTP_REQUEST, TYPES.ANY],
  [TYPES.HTTP_RESPONSE]: [TYPES.HTTP_RESPONSE, TYPES.ANY],
  [TYPES.JSON]: [TYPES.JSON, TYPES.STRING, TYPES.ANY],
  [TYPES.HTML]: [TYPES.HTML, TYPES.STRING, TYPES.STATIC_ASSET, TYPES.ANY],
  [TYPES.BINARY]: [TYPES.BINARY, TYPES.STATIC_ASSET, TYPES.ANY],
  [TYPES.STRING]: [TYPES.STRING, TYPES.ANY],
  [TYPES.SQL_QUERY]: [TYPES.SQL_QUERY, TYPES.ANY],
  [TYPES.SQL_RESULT]: [TYPES.SQL_RESULT, TYPES.JSON, TYPES.ANY],
  [TYPES.KV_OPERATION]: [TYPES.KV_OPERATION, TYPES.ANY],
  [TYPES.KV_RESULT]: [TYPES.KV_RESULT, TYPES.JSON, TYPES.STRING, TYPES.ANY],
  [TYPES.WASM_CALL]: [TYPES.WASM_CALL, TYPES.ANY],
  [TYPES.WASM_RESULT]: [TYPES.WASM_RESULT, TYPES.BINARY, TYPES.ANY],
  [TYPES.RENDER_COMMAND]: [TYPES.RENDER_COMMAND, TYPES.ANY],
  [TYPES.STATIC_ASSET]: [TYPES.STATIC_ASSET, TYPES.BINARY, TYPES.ANY],
  [TYPES.LLM_PROMPT]: [TYPES.LLM_PROMPT, TYPES.STRING, TYPES.ANY],
  [TYPES.LLM_RESPONSE]: [TYPES.LLM_RESPONSE, TYPES.STRING, TYPES.JSON, TYPES.ANY],
  [TYPES.EMBEDDING]: [TYPES.EMBEDDING, TYPES.ANY],
  [TYPES.VECTOR_RESULTS]: [TYPES.VECTOR_RESULTS, TYPES.JSON, TYPES.ANY],
  [TYPES.AGENT_ACTION]: [TYPES.AGENT_ACTION, TYPES.TOOL_CALL, TYPES.JSON, TYPES.ANY],
  [TYPES.TOOL_CALL]: [TYPES.TOOL_CALL, TYPES.JSON, TYPES.ANY],
  [TYPES.TOOL_RESULT]: [TYPES.TOOL_RESULT, TYPES.JSON, TYPES.ANY],
  [TYPES.ANY]: Object.values(TYPES), // Any connects to anything
};

// ============================================
// COMPONENT SPECIFICATIONS
// ============================================

export const COMPONENT_SPECS = {
  user: {
    id: 'user',
    name: 'End User',
    role: 'User',
    description: 'The person interacting with the application',
    icon: '👤',
    color: '#4CAF50',
    category: 'client',

    inputs: {},

    outputs: {
      request: {
        type: TYPES.HTTP_REQUEST,
        position: 'bottom',
        description: 'HTTP request initiated by user action',
      },
    },

    metadata: {
      tags: ['client', 'entry-point'],
      singleton: true, // Only one user node typically
    },
  },

  browser: {
    id: 'browser',
    name: 'Browser',
    role: 'Web Client',
    description: 'Web browser rendering the application UI',
    icon: '🌐',
    color: '#00BCD4',
    category: 'client',

    inputs: {
      response: {
        type: TYPES.HTTP_RESPONSE,
        position: 'top',
        description: 'HTTP response from server',
      },
      html: {
        type: TYPES.HTML,
        position: 'top-left',
        description: 'HTML content to render',
      },
    },

    outputs: {
      request: {
        type: TYPES.HTTP_REQUEST,
        position: 'bottom',
        description: 'Outgoing HTTP requests',
      },
      wasmCall: {
        type: TYPES.WASM_CALL,
        position: 'bottom-right',
        description: 'Calls to WASM modules',
      },
    },

    metadata: {
      tags: ['client', 'rendering'],
    },
  },

  workers: {
    id: 'workers',
    name: 'Cloudflare Workers',
    role: 'Edge Functions',
    description: 'Serverless functions running at 300+ edge locations',
    icon: '⚡',
    color: '#F6821F',
    category: 'compute',

    inputs: {
      request: {
        type: TYPES.HTTP_REQUEST,
        position: 'top',
        description: 'Incoming HTTP request',
      },
      kvResult: {
        type: TYPES.KV_RESULT,
        position: 'left',
        description: 'Response from KV store',
      },
      sqlResult: {
        type: TYPES.SQL_RESULT,
        position: 'left-bottom',
        description: 'Response from SQL database',
      },
    },

    outputs: {
      response: {
        type: TYPES.HTTP_RESPONSE,
        position: 'top',
        description: 'HTTP response to client',
      },
      kvOp: {
        type: TYPES.KV_OPERATION,
        position: 'bottom-right',
        description: 'KV store operation',
      },
      sqlQuery: {
        type: TYPES.SQL_QUERY,
        position: 'bottom-left',
        description: 'SQL query to database',
      },
    },

    metadata: {
      tags: ['compute', 'edge', 'serverless'],
      provider: 'cloudflare',
      alternatives: ['lambda-edge', 'vercel-edge', 'deno-deploy'],
    },
  },

  pages: {
    id: 'pages',
    name: 'Cloudflare Pages',
    role: 'Static Hosting',
    description: 'Global static site hosting with instant deploys',
    icon: '📄',
    color: '#F6821F',
    category: 'hosting',

    inputs: {
      request: {
        type: TYPES.HTTP_REQUEST,
        position: 'top',
        description: 'Request for static content',
      },
    },

    outputs: {
      asset: {
        type: TYPES.STATIC_ASSET,
        position: 'bottom',
        description: 'Static file (HTML, CSS, JS, images)',
      },
      html: {
        type: TYPES.HTML,
        position: 'bottom-right',
        description: 'HTML document',
      },
    },

    metadata: {
      tags: ['hosting', 'static', 'cdn'],
      provider: 'cloudflare',
      alternatives: ['vercel', 'netlify', 'amplify'],
    },
  },

  kv: {
    id: 'kv',
    name: 'Cloudflare KV',
    role: 'Key-Value Store',
    description: 'Global, low-latency key-value data store',
    icon: '🔑',
    color: '#F6821F',
    category: 'storage',

    inputs: {
      operation: {
        type: TYPES.KV_OPERATION,
        position: 'top',
        description: 'Get, put, delete, or list operation',
      },
    },

    outputs: {
      result: {
        type: TYPES.KV_RESULT,
        position: 'bottom',
        description: 'Operation result (value or confirmation)',
      },
    },

    metadata: {
      tags: ['storage', 'cache', 'kv'],
      provider: 'cloudflare',
      alternatives: ['upstash-redis', 'dynamodb', 'vercel-kv'],
    },
  },

  d1: {
    id: 'd1',
    name: 'Cloudflare D1',
    role: 'SQL Database',
    description: 'Serverless SQLite database at the edge',
    icon: '🗄️',
    color: '#F6821F',
    category: 'storage',

    inputs: {
      query: {
        type: TYPES.SQL_QUERY,
        position: 'top',
        description: 'SQL query (SELECT, INSERT, UPDATE, DELETE)',
      },
    },

    outputs: {
      result: {
        type: TYPES.SQL_RESULT,
        position: 'bottom',
        description: 'Query result set or affected rows',
      },
    },

    metadata: {
      tags: ['storage', 'database', 'sql'],
      provider: 'cloudflare',
      alternatives: ['planetscale', 'neon', 'turso', 'supabase'],
    },
  },

  wasm: {
    id: 'wasm',
    name: 'Rust/WASM',
    role: 'Computation',
    description: 'High-performance WebAssembly module',
    icon: '🦀',
    color: '#DEA584',
    category: 'compute',

    inputs: {
      call: {
        type: TYPES.WASM_CALL,
        position: 'top',
        description: 'Function call with arguments',
      },
    },

    outputs: {
      result: {
        type: TYPES.WASM_RESULT,
        position: 'bottom',
        description: 'Computation result',
      },
      render: {
        type: TYPES.RENDER_COMMAND,
        position: 'right',
        description: 'Graphics rendering commands',
      },
    },

    metadata: {
      tags: ['compute', 'wasm', 'performance'],
    },
  },

  threejs: {
    id: 'threejs',
    name: 'Three.js',
    role: '3D Graphics',
    description: '3D graphics rendering library',
    icon: '🎮',
    color: '#AAAAAA',
    category: 'rendering',

    inputs: {
      render: {
        type: TYPES.RENDER_COMMAND,
        position: 'left',
        description: 'Scene, camera, mesh data to render',
      },
    },

    outputs: {},

    metadata: {
      tags: ['graphics', '3d', 'webgl'],
      alternatives: ['babylon', 'playcanvas', 'r3f'],
    },
  },

  llm: {
    id: 'llm',
    name: 'LLM API',
    role: 'Language Model',
    description: 'Large language model inference endpoint',
    icon: '🧠',
    color: '#10B981',
    category: 'ai',

    inputs: {
      prompt: {
        type: TYPES.LLM_PROMPT,
        position: 'top',
        description: 'Prompt/messages to send to the model'
      },
      context: {
        type: TYPES.JSON,
        position: 'left',
        description: 'Additional context (RAG results, memory)'
      }
    },

    outputs: {
      response: {
        type: TYPES.LLM_RESPONSE,
        position: 'bottom',
        description: 'Model response'
      },
      usage: {
        type: TYPES.JSON,
        position: 'right',
        description: 'Token usage metadata'
      }
    },

    metadata: {
      tags: ['ai', 'llm', 'inference'],
      provider: 'openai',
      alternatives: ['anthropic', 'google-ai', 'mistral', 'groq']
    }
  },

  vectordb: {
    id: 'vectordb',
    name: 'Vector DB',
    role: 'Semantic Search',
    description: 'Vector database for similarity search',
    icon: '📊',
    color: '#8B5CF6',
    category: 'ai-storage',

    inputs: {
      query: {
        type: TYPES.EMBEDDING,
        position: 'top',
        description: 'Query embedding for search'
      },
      upsert: {
        type: TYPES.JSON,
        position: 'left',
        description: 'Documents to index'
      }
    },

    outputs: {
      results: {
        type: TYPES.VECTOR_RESULTS,
        position: 'bottom',
        description: 'Similar documents with scores'
      }
    },

    metadata: {
      tags: ['ai', 'storage', 'vector', 'rag'],
      provider: 'pinecone',
      alternatives: ['chroma', 'weaviate', 'qdrant', 'pgvector']
    }
  },

  agent: {
    id: 'agent',
    name: 'Agent',
    role: 'Orchestrator',
    description: 'Autonomous agent with tools',
    icon: '🤖',
    color: '#F59E0B',
    category: 'ai',

    inputs: {
      task: {
        type: TYPES.JSON,
        position: 'top',
        description: 'Task or goal'
      },
      toolResult: {
        type: TYPES.TOOL_RESULT,
        position: 'left',
        description: 'Tool execution results'
      },
      memory: {
        type: TYPES.JSON,
        position: 'left-bottom',
        description: 'Retrieved memory'
      }
    },

    outputs: {
      action: {
        type: TYPES.AGENT_ACTION,
        position: 'bottom',
        description: 'Next action (tool call or answer)'
      },
      response: {
        type: TYPES.LLM_RESPONSE,
        position: 'bottom-right',
        description: 'Final response'
      },
      storeMemory: {
        type: TYPES.JSON,
        position: 'right',
        description: 'Info to store'
      }
    },

    metadata: {
      tags: ['ai', 'agent', 'orchestration'],
      provider: 'langchain',
      alternatives: ['langgraph', 'crewai', 'autogen']
    }
  },

  embedding: {
    id: 'embedding',
    name: 'Embeddings',
    role: 'Text Encoder',
    description: 'Converts text to vector embeddings',
    icon: '🔢',
    color: '#06B6D4',
    category: 'ai',

    inputs: {
      text: {
        type: TYPES.STRING,
        position: 'top',
        description: 'Text to embed'
      }
    },

    outputs: {
      embedding: {
        type: TYPES.EMBEDDING,
        position: 'bottom',
        description: 'Vector representation'
      }
    },

    metadata: {
      tags: ['ai', 'embedding'],
      provider: 'openai',
      alternatives: ['cohere', 'voyage', 'jina']
    }
  },

  tool: {
    id: 'tool',
    name: 'Tool',
    role: 'Function Call',
    description: 'External tool/function for agents',
    icon: '🔧',
    color: '#EF4444',
    category: 'ai',

    inputs: {
      call: {
        type: TYPES.TOOL_CALL,
        position: 'top',
        description: 'Tool invocation'
      }
    },

    outputs: {
      result: {
        type: TYPES.TOOL_RESULT,
        position: 'bottom',
        description: 'Execution result'
      }
    },

    metadata: {
      tags: ['ai', 'tool', 'function'],
      examples: ['web-search', 'code-exec', 'api-call']
    }
  },

  memory: {
    id: 'memory',
    name: 'Memory',
    role: 'Conversation History',
    description: 'Stores and retrieves memory',
    icon: '💾',
    color: '#EC4899',
    category: 'ai-storage',

    inputs: {
      store: {
        type: TYPES.JSON,
        position: 'top',
        description: 'Info to store'
      },
      query: {
        type: TYPES.STRING,
        position: 'left',
        description: 'Memory query'
      }
    },

    outputs: {
      recall: {
        type: TYPES.JSON,
        position: 'bottom',
        description: 'Retrieved memories'
      }
    },

    metadata: {
      tags: ['ai', 'memory', 'storage'],
      provider: 'custom',
      alternatives: ['redis', 'postgres', 'mem0', 'zep']
    }
  },

  guardrails: {
    id: 'guardrails',
    name: 'Guardrails',
    role: 'Safety Filter',
    description: 'Content filtering and safety checks',
    icon: '🛡️',
    color: '#64748B',
    category: 'ai',

    inputs: {
      content: {
        type: TYPES.LLM_RESPONSE,
        position: 'top',
        description: 'Content to validate'
      },
      rules: {
        type: TYPES.JSON,
        position: 'left',
        description: 'Validation rules'
      }
    },

    outputs: {
      validated: {
        type: TYPES.LLM_RESPONSE,
        position: 'bottom',
        description: 'Validated content'
      },
      blocked: {
        type: TYPES.JSON,
        position: 'right',
        description: 'Blocked content details'
      }
    },

    metadata: {
      tags: ['ai', 'safety', 'moderation'],
      provider: 'custom',
      alternatives: ['guardrails-ai', 'nemo-guardrails']
    }
  },
};

// ============================================
// CONNECTION VALIDATION
// ============================================

/**
 * Check if a connection between two ports is valid
 * @param {string} sourceType - Output port type
 * @param {string} targetType - Input port type
 * @returns {boolean}
 */
export function isTypeCompatible(sourceType, targetType) {
  // Any type accepts anything
  if (targetType === TYPES.ANY) return true;

  // Check compatibility matrix
  const compatible = TYPE_COMPATIBILITY[sourceType];
  if (!compatible) return false;

  return compatible.includes(targetType);
}

/**
 * Get all valid target ports for a given source port
 * @param {string} sourceComponentId - Source component
 * @param {string} sourcePortId - Source port name
 * @returns {Array<{componentId: string, portId: string, spec: object}>}
 */
export function getValidTargets(sourceComponentId, sourcePortId) {
  const sourceSpec = COMPONENT_SPECS[sourceComponentId];
  if (!sourceSpec) return [];

  const sourcePort = sourceSpec.outputs[sourcePortId];
  if (!sourcePort) return [];

  const sourceType = sourcePort.type;
  const validTargets = [];

  for (const [compId, compSpec] of Object.entries(COMPONENT_SPECS)) {
    if (compId === sourceComponentId) continue; // No self-connections

    for (const [portId, portSpec] of Object.entries(compSpec.inputs)) {
      if (isTypeCompatible(sourceType, portSpec.type)) {
        validTargets.push({
          componentId: compId,
          portId,
          spec: portSpec,
        });
      }
    }
  }

  return validTargets;
}

/**
 * Validate an entire graph for type consistency
 * @param {Map} nodes - Map of node specs
 * @param {Map} edges - Map of edge specs
 * @returns {{valid: boolean, errors: Array}}
 */
export function validateGraph(nodes, edges) {
  const errors = [];

  for (const edge of edges.values()) {
    const sourceNode = nodes.get(edge.source.nodeId);
    const targetNode = nodes.get(edge.target.nodeId);

    if (!sourceNode || !targetNode) {
      errors.push({
        edgeId: edge.id,
        error: 'Invalid node reference',
      });
      continue;
    }

    const sourceSpec = COMPONENT_SPECS[sourceNode.componentId];
    const targetSpec = COMPONENT_SPECS[targetNode.componentId];

    if (!sourceSpec || !targetSpec) {
      errors.push({
        edgeId: edge.id,
        error: 'Unknown component type',
      });
      continue;
    }

    const sourcePort = sourceSpec.outputs[edge.sourcePortId];
    const targetPort = targetSpec.inputs[edge.targetPortId];

    if (!sourcePort || !targetPort) {
      errors.push({
        edgeId: edge.id,
        error: 'Invalid port reference',
      });
      continue;
    }

    if (!isTypeCompatible(sourcePort.type, targetPort.type)) {
      errors.push({
        edgeId: edge.id,
        sourceType: sourcePort.type,
        targetType: targetPort.type,
        error: `Type mismatch: ${sourcePort.type} -> ${targetPort.type}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get port position offsets for rendering
 * @param {string} position - Position string (top, bottom, left, right, etc.)
 * @param {number} nodeWidth - Node width
 * @param {number} nodeHeight - Node height
 * @returns {{x: number, y: number}}
 */
export function getPortOffset(position, nodeWidth, nodeHeight) {
  const halfW = nodeWidth / 2;
  const halfH = nodeHeight / 2;

  const positions = {
    'top': { x: 0, y: -halfH },
    'top-left': { x: -halfW / 2, y: -halfH },
    'top-right': { x: halfW / 2, y: -halfH },
    'bottom': { x: 0, y: halfH },
    'bottom-left': { x: -halfW / 2, y: halfH },
    'bottom-right': { x: halfW / 2, y: halfH },
    'left': { x: -halfW, y: 0 },
    'left-top': { x: -halfW, y: -halfH / 2 },
    'left-bottom': { x: -halfW, y: halfH / 2 },
    'right': { x: halfW, y: 0 },
    'right-top': { x: halfW, y: -halfH / 2 },
    'right-bottom': { x: halfW, y: halfH / 2 },
  };

  return positions[position] || { x: 0, y: halfH };
}

// ============================================
// HELPERS
// ============================================

/**
 * Get component spec by ID
 */
export function getComponentSpec(componentId) {
  return COMPONENT_SPECS[componentId] || null;
}

/**
 * Get all components in a category
 */
export function getComponentsByCategory(category) {
  return Object.values(COMPONENT_SPECS).filter(c => c.category === category);
}

/**
 * Get port color based on type
 */
export function getTypeColor(type) {
  const colors = {
    [TYPES.HTTP_REQUEST]: '#2196F3',
    [TYPES.HTTP_RESPONSE]: '#2196F3',
    [TYPES.JSON]: '#4CAF50',
    [TYPES.HTML]: '#E91E63',
    [TYPES.BINARY]: '#9E9E9E',
    [TYPES.STRING]: '#8BC34A',
    [TYPES.SQL_QUERY]: '#9C27B0',
    [TYPES.SQL_RESULT]: '#9C27B0',
    [TYPES.KV_OPERATION]: '#FF9800',
    [TYPES.KV_RESULT]: '#FF9800',
    [TYPES.WASM_CALL]: '#DEA584',
    [TYPES.WASM_RESULT]: '#DEA584',
    [TYPES.RENDER_COMMAND]: '#607D8B',
    [TYPES.STATIC_ASSET]: '#00BCD4',
    [TYPES.LLM_PROMPT]: '#10B981',
    [TYPES.LLM_RESPONSE]: '#10B981',
    [TYPES.EMBEDDING]: '#06B6D4',
    [TYPES.VECTOR_RESULTS]: '#8B5CF6',
    [TYPES.AGENT_ACTION]: '#F59E0B',
    [TYPES.TOOL_CALL]: '#EF4444',
    [TYPES.TOOL_RESULT]: '#EF4444',
    [TYPES.ANY]: '#FFFFFF',
  };
  return colors[type] || '#888888';
}
