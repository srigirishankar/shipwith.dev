# shipwith.dev

Interactive visual architecture builder for web apps. Drag cloud components onto a canvas and connect them to design your stack.

**[Live Demo →](https://shipwith.dev)**

## What Is This?

A Unit-like visual programming canvas for designing web architecture diagrams. Drag components from a palette, drop them on the canvas, and connect ports to build your architecture.

![Architecture Canvas Preview](docs/preview.png)

## Features

- **Drag & Drop Components** - Cloud infrastructure and AI components
- **Type-Safe Connections** - Ports are typed (HTTP, SQL, LLM, Embedding, etc.) and only compatible types connect
- **Visual Feedback** - Green glow for valid connections, red for invalid
- **Pan & Zoom** - Navigate large diagrams with ease
- **Multi-Select** - Shift+click to select multiple nodes
- **Pre-built Templates** - Start with RAG Chatbot, Multi-Agent System, or AI-Powered API
- **Template Modal** - Choose a template or start blank on empty canvas

## Quick Start

```bash
# Clone the repo
git clone https://github.com/srigirishankar/shipwith.dev.git
cd shipwith.dev

# Serve locally
cd www && python -m http.server 8080

# Open http://localhost:8080
```

No build step required - it's vanilla JavaScript with ES modules.

## Usage

### Templates

On first load (empty canvas), a template modal appears with three options:

| Template | Description | Components |
|----------|-------------|------------|
| **RAG Chatbot** | AI chatbot with knowledge base retrieval | User, Browser, Workers, Embeddings, VectorDB, LLM |
| **Multi-Agent System** | Orchestrator agent with tools and memory | User, Browser, Agent, Tool (x2), LLM, Memory |
| **AI-Powered API** | Production API with safety and caching | User, Workers, Guardrails, LLM, KV, D1 |

Or click "Start with Blank Canvas" to build from scratch.

### Adding Components

1. Drag a component from the left palette onto the canvas
2. The component appears with its typed input/output ports

### Connecting Components

1. Click and drag from an **output port** (bottom/sides of a node)
2. Drag to an **input port** (top of another node)
3. Release when the port glows **green** (valid connection)
4. If the port glows **red**, the types are incompatible

### Navigation

| Action | Mouse | Keyboard |
|--------|-------|----------|
| Pan | Middle-click drag | Space + drag |
| Zoom | Scroll wheel | - |
| Select | Click | - |
| Multi-select | Shift + click | - |
| Delete | - | Delete / Backspace |
| Cancel | - | Escape |

## Architecture

```
www/
├── index.html          # Entry point
├── style.css           # Layout & styling (including template modal)
├── canvas.js           # Canvas rendering, pan/zoom, interactions
├── palette.js          # Left sidebar with draggable components
├── state.js            # Graph state management (nodes, edges, selection)
├── component-specs.js  # Component definitions with typed ports
├── templates.js        # Template definitions and modal UI
└── graph-model.js      # GraphSpec, NodeSpec, EdgeSpec classes
```

## Components

### Cloud Infrastructure

| Component | Icon | Role | Inputs | Outputs |
|-----------|------|------|--------|---------|
| **User** | 👤 | Entry point | - | HTTP request |
| **Browser** | 🌐 | Web client | HTTP response, HTML | HTTP request, WASM call |
| **Workers** | ⚡ | Edge compute | HTTP request, KV result, SQL result | HTTP response, KV op, SQL query |
| **Pages** | 📄 | Static hosting | HTTP request | Static asset, HTML |
| **KV** | 🔑 | Key-value store | KV operation | KV result |
| **D1** | 🗄️ | SQL database | SQL query | SQL result |
| **WASM** | 🦀 | Computation | WASM call | WASM result, Render command |
| **Three.js** | 🎮 | 3D graphics | Render command | - |

### AI Components

| Component | Icon | Role | Inputs | Outputs |
|-----------|------|------|--------|---------|
| **LLM API** | 🧠 | Language Model | Prompt, Context (JSON) | Response, Usage (JSON) |
| **Vector DB** | 📊 | Semantic Search | Query (Embedding), Upsert (JSON) | Results |
| **Agent** | 🤖 | Orchestrator | Task (JSON), Tool Result, Memory (JSON) | Action, Response, Store Memory |
| **Embeddings** | 🔢 | Text Encoder | Text (String) | Embedding |
| **Tool** | 🔧 | Function Call | Call | Result |
| **Memory** | 💾 | Conversation History | Store (JSON), Query (String) | Recall (JSON) |
| **Guardrails** | 🛡️ | Safety Filter | Content, Rules (JSON) | Validated, Blocked (JSON) |

## Type System

Inspired by [Unit](https://github.com/samuelmtimbo/unit)'s visual programming approach, each component has typed inputs and outputs.

### Infrastructure Types

| Type | Color | Description |
|------|-------|-------------|
| `http-request` | Blue | HTTP request from client |
| `http-response` | Blue | HTTP response to client |
| `sql-query` | Purple | SQL query to database |
| `sql-result` | Purple | Query result set |
| `kv-operation` | Orange | KV get/put/delete |
| `kv-result` | Orange | KV operation result |
| `wasm-call` | Rust | WASM function call |
| `render-command` | Gray | Graphics render command |
| `static-asset` | Cyan | Static file (HTML, CSS, JS) |
| `json` | Green | JSON data |
| `string` | Light Green | String data |

### AI Types

| Type | Color | Description |
|------|-------|-------------|
| `llm-prompt` | Emerald | Prompt/messages to send to LLM |
| `llm-response` | Emerald | Model response text |
| `embedding` | Cyan | Vector embedding |
| `vector-results` | Purple | Similar documents with scores |
| `agent-action` | Amber | Next action (tool call or answer) |
| `tool-call` | Red | Tool invocation request |
| `tool-result` | Red | Tool execution result |

### Type Compatibility

Connections are validated using a compatibility matrix:

```javascript
// AI type connections
Embeddings[embedding] → VectorDB[query]  ✓
VectorDB[results] → LLM[context]  ✓ (vector-results → json)
Agent[action] → Tool[call]  ✓ (agent-action → tool-call)
Tool[result] → Agent[toolResult]  ✓

// Invalid connections
LLM[response] → D1[query]  ✗
```

## Templates

### Loading Templates Programmatically

```javascript
import { loadTemplate, getTemplateList } from './templates.js';

// Get available templates
getTemplateList();
// Returns: [{ id, name, description, icon, nodeCount, edgeCount }, ...]

// Load a template
const result = loadTemplate('rag-chatbot');
// Returns: { success: true, nodesCreated: 6, edgesCreated: 4, errors: [] }

// Load with options
loadTemplate('multi-agent', {
  clearExisting: false,  // Don't clear canvas first
  offsetX: 500,          // Offset position
  offsetY: 0
});
```

### Template Modal

```javascript
import { showTemplateModal, hideTemplateModal, initTemplates } from './templates.js';

// Show modal manually
showTemplateModal();

// Hide modal
hideTemplateModal();

// Auto-show if canvas is empty (called on init)
initTemplates();
```

## Development

### Console API

```javascript
// Access state
window.canvasState

// Get node/edge counts
canvasState.graph.nodes.size
canvasState.graph.edges.size

// Export as JSON
JSON.stringify(canvasState.toJSON(), null, 2)

// Check AI components
import('./component-specs.js').then(m => {
  ['llm', 'vectordb', 'agent', 'embedding', 'tool', 'memory', 'guardrails'].forEach(id => {
    console.log(`${id}: ${m.getComponentSpec(id) ? '✓' : '✗'}`);
  });
});
```

### Adding New Components

1. Add spec to `component-specs.js`:

```javascript
export const COMPONENT_SPECS = {
  // ...existing components

  myNewComponent: {
    id: 'myNewComponent',
    name: 'My Component',
    role: 'Does Something',
    icon: '🆕',
    color: '#FF5733',
    category: 'compute',

    inputs: {
      data: { type: TYPES.JSON, position: 'top' },
    },
    outputs: {
      result: { type: TYPES.JSON, position: 'bottom' },
    },

    metadata: {
      tags: ['custom'],
    },
  },
};
```

2. The component automatically appears in the palette.

### Adding New Types

1. Add to `TYPES` in `component-specs.js`:

```javascript
export const TYPES = {
  // ...existing types
  MY_TYPE: 'my-type',
};
```

2. Add compatibility rules:

```javascript
export const TYPE_COMPATIBILITY = {
  // ...existing rules
  [TYPES.MY_TYPE]: [TYPES.MY_TYPE, TYPES.ANY],
};
```

3. Add color:

```javascript
export function getTypeColor(type) {
  const colors = {
    // ...existing colors
    [TYPES.MY_TYPE]: '#FF5733',
  };
  return colors[type] || '#888888';
}
```

### Adding New Templates

Add to `TEMPLATES` in `templates.js`:

```javascript
export const TEMPLATES = {
  // ...existing templates

  'my-template': {
    id: 'my-template',
    name: 'My Template',
    description: 'Description here',
    icon: '🆕',
    category: 'custom',
    difficulty: 'beginner',

    nodes: [
      { tempId: 'node1', componentId: 'user', x: 100, y: 300 },
      { tempId: 'node2', componentId: 'llm', x: 400, y: 300 },
    ],

    edges: [
      // Use tempId to reference nodes
      { source: { tempId: 'node1', portId: 'request' }, target: { tempId: 'node2', portId: 'prompt' } },
    ]
  }
};
```

## Tech Stack

- **Vanilla JavaScript** - No frameworks, ES modules
- **Canvas 2D API** - Hardware-accelerated rendering
- **Cloudflare Pages** - Static hosting

## Roadmap

- [ ] Save/load diagrams to localStorage
- [ ] Export as PNG/SVG
- [ ] Undo/redo
- [ ] Copy/paste nodes
- [ ] Component grouping
- [ ] Cost/latency calculation
- [ ] Real-time collaboration
- [x] AI components (LLM, Vector DB, Agent, etc.)
- [x] Pre-built templates
- [x] Template selection modal

## Inspiration

- [Unit](https://github.com/samuelmtimbo/unit) - Visual programming system with typed ports
- [Excalidraw](https://excalidraw.com) - Whiteboard-style canvas UX
- [tldraw](https://tldraw.com) - Infinite canvas paradigm

## License

MIT
