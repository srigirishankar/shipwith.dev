# Agentic AI Templates for shipwith.dev

## PRD for Ralph-Loop Autonomous Execution

**Task**: Add Agentic AI templates to the visual architecture builder
**Date**: 2025-01-31
**Status**: Ready for Implementation

---

## Overview

Add 7 new AI components to the palette and 3 pre-built templates (RAG Chatbot, Multi-Agent System, AI-Powered API) with an empty-canvas modal for template selection.

## Success Criteria

- All 7 AI components visible in palette and functional
- All 3 templates load correctly with nodes and edges
- Modal appears on empty canvas, closes on selection
- Type system extended with AI-specific types

---

## Stories

### Story 1: Add AI Types to Type System

**Description**: Extend the type system with 7 new AI-specific types and their compatibility rules.

**Files to modify**:
- `www/component-specs.js`

**Implementation**:
1. Add to `TYPES` constant (after `ANY: 'any'`):
```javascript
// AI-specific types
LLM_PROMPT: 'llm-prompt',
LLM_RESPONSE: 'llm-response',
EMBEDDING: 'embedding',
VECTOR_RESULTS: 'vector-results',
AGENT_ACTION: 'agent-action',
TOOL_CALL: 'tool-call',
TOOL_RESULT: 'tool-result',
```

2. Add to `TYPE_COMPATIBILITY` (before the `ANY` entry):
```javascript
[TYPES.LLM_PROMPT]: [TYPES.LLM_PROMPT, TYPES.STRING, TYPES.ANY],
[TYPES.LLM_RESPONSE]: [TYPES.LLM_RESPONSE, TYPES.STRING, TYPES.JSON, TYPES.ANY],
[TYPES.EMBEDDING]: [TYPES.EMBEDDING, TYPES.ANY],
[TYPES.VECTOR_RESULTS]: [TYPES.VECTOR_RESULTS, TYPES.JSON, TYPES.ANY],
[TYPES.AGENT_ACTION]: [TYPES.AGENT_ACTION, TYPES.TOOL_CALL, TYPES.JSON, TYPES.ANY],
[TYPES.TOOL_CALL]: [TYPES.TOOL_CALL, TYPES.JSON, TYPES.ANY],
[TYPES.TOOL_RESULT]: [TYPES.TOOL_RESULT, TYPES.JSON, TYPES.ANY],
```

3. Add to `getTypeColor()` colors object:
```javascript
[TYPES.LLM_PROMPT]: '#10B981',
[TYPES.LLM_RESPONSE]: '#10B981',
[TYPES.EMBEDDING]: '#06B6D4',
[TYPES.VECTOR_RESULTS]: '#8B5CF6',
[TYPES.AGENT_ACTION]: '#F59E0B',
[TYPES.TOOL_CALL]: '#EF4444',
[TYPES.TOOL_RESULT]: '#EF4444',
```

**Acceptance Criteria**:
- [ ] `TYPES.LLM_PROMPT` is defined and equals `'llm-prompt'`
- [ ] `TYPES.EMBEDDING` is defined and equals `'embedding'`
- [ ] `isTypeCompatible(TYPES.EMBEDDING, TYPES.EMBEDDING)` returns `true`
- [ ] `isTypeCompatible(TYPES.VECTOR_RESULTS, TYPES.JSON)` returns `true`
- [ ] `isTypeCompatible(TYPES.AGENT_ACTION, TYPES.TOOL_CALL)` returns `true`
- [ ] `getTypeColor(TYPES.LLM_PROMPT)` returns `'#10B981'`

**Verification**:
```bash
cd www && python -m http.server 8080
# Open http://localhost:8080
# In browser console:
import('./component-specs.js').then(m => {
  console.log('LLM_PROMPT:', m.TYPES.LLM_PROMPT);
  console.log('Compatible EMBEDDING->EMBEDDING:', m.isTypeCompatible(m.TYPES.EMBEDDING, m.TYPES.EMBEDDING));
  console.log('Compatible VECTOR_RESULTS->JSON:', m.isTypeCompatible(m.TYPES.VECTOR_RESULTS, m.TYPES.JSON));
  console.log('Color LLM_PROMPT:', m.getTypeColor(m.TYPES.LLM_PROMPT));
});
```

**passes**: true

---

### Story 2: Add LLM API Component

**Description**: Add the LLM API component for language model inference.

**Files to modify**:
- `www/component-specs.js`

**Implementation**:
Add to `COMPONENT_SPECS` object (after `threejs`):

```javascript
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
```

**Acceptance Criteria**:
- [ ] `getComponentSpec('llm')` returns the LLM component spec
- [ ] LLM component has `prompt` input with type `LLM_PROMPT`
- [ ] LLM component has `context` input with type `JSON`
- [ ] LLM component has `response` output with type `LLM_RESPONSE`
- [ ] LLM component has icon `🧠` and color `#10B981`

**Verification**:
```javascript
// In browser console:
import('./component-specs.js').then(m => {
  const spec = m.getComponentSpec('llm');
  console.log('LLM exists:', !!spec);
  console.log('Has prompt input:', spec?.inputs?.prompt?.type);
  console.log('Has response output:', spec?.outputs?.response?.type);
  console.log('Icon:', spec?.icon);
});
```

**passes**: true

---

### Story 3: Add Vector DB Component

**Description**: Add the Vector Database component for semantic search.

**Files to modify**:
- `www/component-specs.js`

**Implementation**:
Add to `COMPONENT_SPECS` object:

```javascript
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
```

**Acceptance Criteria**:
- [ ] `getComponentSpec('vectordb')` returns the Vector DB spec
- [ ] VectorDB has `query` input with type `EMBEDDING`
- [ ] VectorDB has `results` output with type `VECTOR_RESULTS`

**Verification**:
```javascript
import('./component-specs.js').then(m => {
  const spec = m.getComponentSpec('vectordb');
  console.log('VectorDB exists:', !!spec);
  console.log('Query type:', spec?.inputs?.query?.type);
  console.log('Results type:', spec?.outputs?.results?.type);
});
```

**passes**: true

---

### Story 4: Add Agent Component

**Description**: Add the Agent Orchestrator component for autonomous task execution.

**Files to modify**:
- `www/component-specs.js`

**Implementation**:
Add to `COMPONENT_SPECS` object:

```javascript
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
```

**Acceptance Criteria**:
- [ ] `getComponentSpec('agent')` returns the Agent spec
- [ ] Agent has 3 inputs: `task`, `toolResult`, `memory`
- [ ] Agent has 3 outputs: `action`, `response`, `storeMemory`
- [ ] `action` output has type `AGENT_ACTION`

**Verification**:
```javascript
import('./component-specs.js').then(m => {
  const spec = m.getComponentSpec('agent');
  console.log('Agent exists:', !!spec);
  console.log('Inputs:', Object.keys(spec?.inputs || {}));
  console.log('Outputs:', Object.keys(spec?.outputs || {}));
  console.log('Action type:', spec?.outputs?.action?.type);
});
```

**passes**: true

---

### Story 5: Add Embedding, Tool, Memory, Guardrails Components

**Description**: Add the remaining 4 AI components to complete the palette.

**Files to modify**:
- `www/component-specs.js`

**Implementation**:
Add to `COMPONENT_SPECS` object:

```javascript
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
```

**Acceptance Criteria**:
- [ ] `getComponentSpec('embedding')` returns valid spec with `embedding` output
- [ ] `getComponentSpec('tool')` returns valid spec with `call` input and `result` output
- [ ] `getComponentSpec('memory')` returns valid spec with `store` input and `recall` output
- [ ] `getComponentSpec('guardrails')` returns valid spec with `validated` and `blocked` outputs
- [ ] All 7 AI components exist: llm, vectordb, agent, embedding, tool, memory, guardrails

**Verification**:
```javascript
import('./component-specs.js').then(m => {
  const aiComponents = ['llm', 'vectordb', 'agent', 'embedding', 'tool', 'memory', 'guardrails'];
  aiComponents.forEach(id => {
    const spec = m.getComponentSpec(id);
    console.log(`${id}: ${spec ? '✓' : '✗'} (icon: ${spec?.icon})`);
  });
});
```

**Visual Verification**:
1. Open http://localhost:8080 in browser
2. Check left palette shows all 7 AI components with correct icons
3. Drag each component to canvas and verify it appears correctly

**passes**: true

---

### Story 6: Create templates.js with Template Definitions

**Description**: Create the new templates.js file with 3 template definitions and the loadTemplate function.

**Files to create**:
- `www/templates.js`

**Implementation**:
Create `www/templates.js` with the following content:

```javascript
// templates.js - Template definitions and loader for shipwith.dev

import { canvasState } from './state.js';

// ============================================
// TEMPLATE DEFINITIONS
// ============================================

export const TEMPLATES = {
  'rag-chatbot': {
    id: 'rag-chatbot',
    name: 'RAG Chatbot',
    description: 'AI chatbot with knowledge base retrieval',
    icon: '💬',
    category: 'ai',
    difficulty: 'intermediate',

    nodes: [
      { tempId: 'user', componentId: 'user', x: 100, y: 300 },
      { tempId: 'browser', componentId: 'browser', x: 300, y: 300 },
      { tempId: 'workers', componentId: 'workers', x: 550, y: 300 },
      { tempId: 'embed', componentId: 'embedding', x: 800, y: 100 },
      { tempId: 'vectordb', componentId: 'vectordb', x: 1000, y: 100 },
      { tempId: 'llm', componentId: 'llm', x: 1000, y: 350 }
    ],

    edges: [
      { source: { tempId: 'user', portId: 'request' }, target: { tempId: 'browser', portId: 'response' } },
      { source: { tempId: 'browser', portId: 'request' }, target: { tempId: 'workers', portId: 'request' } },
      { source: { tempId: 'embed', portId: 'embedding' }, target: { tempId: 'vectordb', portId: 'query' } },
      { source: { tempId: 'vectordb', portId: 'results' }, target: { tempId: 'llm', portId: 'context' } }
    ]
  },

  'multi-agent': {
    id: 'multi-agent',
    name: 'Multi-Agent System',
    description: 'Orchestrator agent with tools and memory',
    icon: '🤖',
    category: 'ai',
    difficulty: 'advanced',

    nodes: [
      { tempId: 'user', componentId: 'user', x: 100, y: 300 },
      { tempId: 'browser', componentId: 'browser', x: 300, y: 300 },
      { tempId: 'agent', componentId: 'agent', x: 550, y: 300 },
      { tempId: 'tool1', componentId: 'tool', x: 800, y: 100 },
      { tempId: 'tool2', componentId: 'tool', x: 1000, y: 100 },
      { tempId: 'llm', componentId: 'llm', x: 800, y: 350 },
      { tempId: 'memory', componentId: 'memory', x: 1050, y: 350 }
    ],

    edges: [
      { source: { tempId: 'user', portId: 'request' }, target: { tempId: 'browser', portId: 'response' } },
      { source: { tempId: 'agent', portId: 'action' }, target: { tempId: 'tool1', portId: 'call' } },
      { source: { tempId: 'tool1', portId: 'result' }, target: { tempId: 'agent', portId: 'toolResult' } },
      { source: { tempId: 'agent', portId: 'storeMemory' }, target: { tempId: 'memory', portId: 'store' } },
      { source: { tempId: 'memory', portId: 'recall' }, target: { tempId: 'agent', portId: 'memory' } }
    ]
  },

  'ai-api': {
    id: 'ai-api',
    name: 'AI-Powered API',
    description: 'Production API with safety, caching, and logging',
    icon: '⚡',
    category: 'ai',
    difficulty: 'intermediate',

    nodes: [
      { tempId: 'user', componentId: 'user', x: 100, y: 250 },
      { tempId: 'workers', componentId: 'workers', x: 350, y: 250 },
      { tempId: 'guardrails', componentId: 'guardrails', x: 600, y: 100 },
      { tempId: 'llm', componentId: 'llm', x: 850, y: 100 },
      { tempId: 'kv', componentId: 'kv', x: 1100, y: 100 },
      { tempId: 'd1', componentId: 'd1', x: 600, y: 400 }
    ],

    edges: [
      { source: { tempId: 'user', portId: 'request' }, target: { tempId: 'workers', portId: 'request' } },
      { source: { tempId: 'guardrails', portId: 'validated' }, target: { tempId: 'llm', portId: 'prompt' } },
      { source: { tempId: 'workers', portId: 'sqlQuery' }, target: { tempId: 'd1', portId: 'query' } },
      { source: { tempId: 'workers', portId: 'kvOp' }, target: { tempId: 'kv', portId: 'operation' } }
    ]
  }
};

// ============================================
// TEMPLATE LOADER
// ============================================

/**
 * Load a template onto the canvas
 * @param {string} templateId - ID of the template to load
 * @param {Object} options - Loading options
 * @returns {{ success: boolean, nodesCreated: number, edgesCreated: number, errors: string[] }}
 */
export function loadTemplate(templateId, options = {}) {
  const { clearExisting = true, offsetX = 0, offsetY = 0 } = options;

  const template = TEMPLATES[templateId];
  if (!template) {
    return {
      success: false,
      nodesCreated: 0,
      edgesCreated: 0,
      errors: [`Template not found: ${templateId}`]
    };
  }

  const errors = [];
  const nodeMap = new Map();

  // Clear existing canvas if requested
  if (clearExisting) {
    for (const nodeId of Array.from(canvasState.graph.nodes.keys())) {
      canvasState.graph.removeNode(nodeId);
    }
    canvasState.selectedNodeIds.clear();
    canvasState.selectedEdgeIds.clear();
  }

  // Create all nodes first
  for (const nodeSpec of template.nodes) {
    const x = nodeSpec.x + offsetX;
    const y = nodeSpec.y + offsetY;

    const node = canvasState.addNode(nodeSpec.componentId, x, y);
    if (node) {
      nodeMap.set(nodeSpec.tempId, node.id);
      if (nodeSpec.label) {
        node.name = nodeSpec.label;
      }
    } else {
      errors.push(`Failed to create node: ${nodeSpec.tempId} (${nodeSpec.componentId})`);
    }
  }

  // Create all edges
  let edgesCreated = 0;
  for (const edgeSpec of template.edges) {
    const sourceNodeId = nodeMap.get(edgeSpec.source.tempId);
    const targetNodeId = nodeMap.get(edgeSpec.target.tempId);

    if (!sourceNodeId || !targetNodeId) {
      errors.push(`Edge node not found: ${edgeSpec.source.tempId} -> ${edgeSpec.target.tempId}`);
      continue;
    }

    const edge = canvasState.addEdge(
      sourceNodeId,
      edgeSpec.source.portId,
      targetNodeId,
      edgeSpec.target.portId
    );

    if (edge) {
      edgesCreated++;
    } else {
      errors.push(
        `Failed to create edge: ${edgeSpec.source.tempId}.${edgeSpec.source.portId} -> ` +
        `${edgeSpec.target.tempId}.${edgeSpec.target.portId}`
      );
    }
  }

  // Center the view on the template
  centerViewOnGraph();

  // Notify listeners
  canvasState.notify();

  return {
    success: errors.length === 0,
    nodesCreated: nodeMap.size,
    edgesCreated,
    errors
  };
}

/**
 * Center the canvas view on all nodes
 */
function centerViewOnGraph() {
  const nodes = Array.from(canvasState.graph.nodes.values());
  if (nodes.length === 0) return;

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const node of nodes) {
    const halfW = node.width / 2;
    const halfH = node.height / 2;
    minX = Math.min(minX, node.position.x - halfW);
    minY = Math.min(minY, node.position.y - halfH);
    maxX = Math.max(maxX, node.position.x + halfW);
    maxY = Math.max(maxY, node.position.y + halfH);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const canvas = document.getElementById('canvas');
  const rect = canvas?.getBoundingClientRect() || { width: 1200, height: 800 };

  canvasState.pan.x = rect.width / 2 - centerX * canvasState.zoom;
  canvasState.pan.y = rect.height / 2 - centerY * canvasState.zoom;
}

/**
 * Get all available templates
 */
export function getTemplateList() {
  return Object.values(TEMPLATES).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    icon: t.icon,
    category: t.category,
    difficulty: t.difficulty,
    nodeCount: t.nodes.length,
    edgeCount: t.edges.length
  }));
}
```

**Acceptance Criteria**:
- [ ] File `www/templates.js` exists
- [ ] `TEMPLATES` object contains 3 templates: `rag-chatbot`, `multi-agent`, `ai-api`
- [ ] `loadTemplate('rag-chatbot')` returns `{ success: true, nodesCreated: 6, ... }`
- [ ] After loading, `canvasState.graph.nodes.size` equals template node count
- [ ] Edges are created (edgesCreated > 0)

**Verification**:
```javascript
// In browser console:
import('./templates.js').then(m => {
  console.log('Templates:', Object.keys(m.TEMPLATES));
  console.log('Template list:', m.getTemplateList());

  // Test loading
  const result = m.loadTemplate('rag-chatbot');
  console.log('Load result:', result);
  console.log('Nodes on canvas:', canvasState.graph.nodes.size);
  console.log('Edges on canvas:', canvasState.graph.edges.size);
});
```

**Visual Verification**:
1. Open browser console
2. Run the verification script above
3. Verify nodes appear on canvas
4. Verify edges connect nodes (bezier curves visible)

**passes**: true

---

### Story 7: Add Template Modal UI to templates.js

**Description**: Add modal UI functions to templates.js for showing template picker on empty canvas.

**Files to modify**:
- `www/templates.js`

**Implementation**:
Add to the end of `www/templates.js`:

```javascript
// ============================================
// MODAL UI
// ============================================

let modalElement = null;

/**
 * Show the template picker modal
 */
export function showTemplateModal() {
  if (modalElement) {
    modalElement.classList.add('visible');
    return;
  }

  modalElement = document.createElement('div');
  modalElement.id = 'template-modal';
  modalElement.className = 'template-modal visible';
  modalElement.innerHTML = `
    <div class="template-modal-backdrop"></div>
    <div class="template-modal-content">
      <h2>Choose a Template</h2>
      <p>Start with a pre-built architecture or create from scratch</p>

      <div class="template-grid">
        ${Object.values(TEMPLATES).map(t => `
          <button class="template-card" data-template-id="${t.id}">
            <div class="template-icon">${t.icon}</div>
            <div class="template-info">
              <h3>${t.name}</h3>
              <p>${t.description}</p>
              <span class="template-meta">${t.nodes.length} components</span>
            </div>
          </button>
        `).join('')}
      </div>

      <button class="template-blank-btn">
        Start with Blank Canvas
      </button>
    </div>
  `;

  document.body.appendChild(modalElement);

  // Event listeners
  modalElement.querySelector('.template-modal-backdrop').addEventListener('click', hideTemplateModal);
  modalElement.querySelector('.template-blank-btn').addEventListener('click', hideTemplateModal);

  modalElement.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      const templateId = card.dataset.templateId;
      const result = loadTemplate(templateId);
      console.log(`[templates] Loaded "${templateId}":`, result);
      hideTemplateModal();
    });
  });
}

/**
 * Hide the template picker modal
 */
export function hideTemplateModal() {
  if (modalElement) {
    modalElement.classList.remove('visible');
  }
}

/**
 * Initialize template system - show modal if canvas is empty
 */
export function initTemplates() {
  setTimeout(() => {
    if (canvasState.graph.nodes.size === 0) {
      showTemplateModal();
    }
  }, 100);
}
```

**Acceptance Criteria**:
- [ ] `showTemplateModal()` function exists and is exported
- [ ] `hideTemplateModal()` function exists and is exported
- [ ] `initTemplates()` function exists and is exported
- [ ] Calling `showTemplateModal()` creates a modal element in DOM
- [ ] Modal has 3 template cards and a blank canvas button

**Verification**:
```javascript
import('./templates.js').then(m => {
  m.showTemplateModal();
  console.log('Modal visible:', document.querySelector('.template-modal.visible') !== null);
  console.log('Template cards:', document.querySelectorAll('.template-card').length);
  m.hideTemplateModal();
});
```

**passes**: true

---

### Story 8: Add Template Modal CSS Styles

**Description**: Add CSS styles for the template modal to style.css.

**Files to modify**:
- `www/style.css`

**Implementation**:
Add to the end of `www/style.css`:

```css
/* ============================================
   TEMPLATE MODAL
   ============================================ */

.template-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
}

.template-modal.visible {
  opacity: 1;
  visibility: visible;
}

.template-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.template-modal-content {
  position: relative;
  background: #2a2a2a;
  border-radius: 16px;
  padding: 32px;
  max-width: 700px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.template-modal-content h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
}

.template-modal-content > p {
  margin: 0 0 24px 0;
  color: #a0a0a0;
  font-size: 14px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background: #1d1d1d;
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.template-card:hover {
  background: #333;
  border-color: #3b82f6;
  transform: translateY(-2px);
}

.template-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.template-info h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.template-info p {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #a0a0a0;
  line-height: 1.4;
}

.template-meta {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.template-blank-btn {
  display: block;
  width: 100%;
  padding: 14px;
  background: transparent;
  border: 2px dashed #444;
  border-radius: 8px;
  color: #888;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.template-blank-btn:hover {
  border-color: #666;
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

@media (max-width: 600px) {
  .template-modal-content {
    padding: 20px;
    margin: 16px;
  }

  .template-grid {
    grid-template-columns: 1fr;
  }
}
```

**Acceptance Criteria**:
- [ ] `.template-modal` class defined with `position: fixed` and `z-index: 1000`
- [ ] `.template-modal.visible` class shows modal (`opacity: 1`, `visibility: visible`)
- [ ] `.template-card` class has hover styles with border color change
- [ ] `.template-blank-btn` class styled with dashed border

**Verification**:
1. Open http://localhost:8080 in browser
2. In console, run `import('./templates.js').then(m => m.showTemplateModal())`
3. Verify modal has dark backdrop with blur
4. Verify template cards have correct styling
5. Hover over cards and verify blue border appears
6. Click backdrop or "Start with Blank Canvas" and verify modal closes

**passes**: true

---

### Story 9: Integrate Templates into index.html

**Description**: Import templates.js and call initTemplates() on page load.

**Files to modify**:
- `www/index.html`

**Implementation**:
Modify the `<script type="module">` block in index.html:

1. Add import at the top:
```javascript
import { initTemplates } from './templates.js';
```

2. Call initTemplates() at the end of init():
```javascript
function init() {
    // ... existing init code ...

    // Initialize templates (shows modal if canvas is empty)
    initTemplates();

    console.log('[shipwith.dev] Architecture Builder initialized');
    // ...
}
```

**Acceptance Criteria**:
- [ ] `templates.js` is imported in index.html
- [ ] `initTemplates()` is called during initialization
- [ ] On fresh page load with empty canvas, modal appears automatically
- [ ] Clicking a template loads it and closes modal
- [ ] Clicking "Start with Blank Canvas" closes modal without loading

**Verification**:
1. Open http://localhost:8080 in a fresh browser tab (or incognito)
2. Verify template modal appears automatically
3. Click "RAG Chatbot" template
4. Verify 6 nodes appear on canvas with edges
5. Refresh page
6. Verify modal appears again (state not persisted)
7. Click "Start with Blank Canvas"
8. Verify empty canvas, modal closed

**passes**: true

---

### Story 10: End-to-End Verification

**Description**: Verify all features work together correctly.

**Files to verify**:
- All modified files

**Acceptance Criteria**:
- [ ] All 7 AI components visible in palette: 🧠 LLM, 📊 VectorDB, 🤖 Agent, 🔢 Embeddings, 🔧 Tool, 💾 Memory, 🛡️ Guardrails
- [ ] Dragging any AI component to canvas works
- [ ] Template modal appears on fresh page load
- [ ] "RAG Chatbot" template loads 6 nodes and creates edges
- [ ] "Multi-Agent System" template loads 7 nodes and creates edges
- [ ] "AI-Powered API" template loads 6 nodes and creates edges
- [ ] Type-compatible connections show green glow (e.g., Embedding → VectorDB)
- [ ] Canvas view auto-centers on loaded template

**Verification**:
```bash
cd www && python -m http.server 8080
# Open http://localhost:8080
```

1. Fresh page load → modal appears
2. Count AI components in palette (should be 7 new ones)
3. Click "RAG Chatbot" → verify 6 nodes, edges visible
4. Delete all nodes (select all, press Delete)
5. Refresh → modal appears
6. Click "Multi-Agent System" → verify 7 nodes
7. Drag Embedding component near VectorDB
8. Try connecting Embedding output to VectorDB query input → should show green glow
9. Complete connection → edge should be created

**Console verification**:
```javascript
// Check all AI components exist
['llm', 'vectordb', 'agent', 'embedding', 'tool', 'memory', 'guardrails'].forEach(id => {
  const spec = window.canvasState && import('./component-specs.js').then(m => {
    console.log(`${id}: ${m.getComponentSpec(id) ? '✓' : '✗'}`);
  });
});

// Check templates load
import('./templates.js').then(m => {
  ['rag-chatbot', 'multi-agent', 'ai-api'].forEach(id => {
    m.loadTemplate(id);
    console.log(`${id}: nodes=${canvasState.graph.nodes.size}, edges=${canvasState.graph.edges.size}`);
  });
});
```

**passes**: true

---

## Progress Tracking

| Story | Status |
|-------|--------|
| 1. Add AI Types | `passes: true` |
| 2. Add LLM Component | `passes: true` |
| 3. Add Vector DB Component | `passes: true` |
| 4. Add Agent Component | `passes: true` |
| 5. Add Remaining 4 Components | `passes: true` |
| 6. Create templates.js | `passes: true` |
| 7. Add Modal UI | `passes: true` |
| 8. Add Modal CSS | `passes: true` |
| 9. Integrate into index.html | `passes: true` |
| 10. End-to-End Verification | `passes: true` |

---

## Ralph-Loop Command

```
/ralph-loop:ralph-loop "Read AgenticAITemplates2025-01-31RalphPRD.md and implement all stories sequentially. For each story:
1. Read acceptance criteria carefully
2. Implement the changes as specified
3. Run verification commands in browser console
4. If all criteria pass, mark story complete and commit
5. Move to next story

Stories must be completed in order (1-10). Update progress after each story. Output <promise>COMPLETE</promise> when ALL 10 stories pass verification." --max-iterations 20 --completion-promise "COMPLETE"
```

---

## Notes

- **Type Compatibility**: Some edges in templates may fail due to type mismatches between HTTP and AI types. This is expected - skip incompatible edges as documented.
- **No Tests Required**: This is a vanilla JS project without a test framework. Verification is done via browser console and visual inspection.
- **Local Server**: Always run `cd www && python -m http.server 8080` for testing.
