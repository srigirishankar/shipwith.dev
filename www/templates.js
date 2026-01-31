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
