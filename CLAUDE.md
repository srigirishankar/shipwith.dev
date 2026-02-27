# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

shipwith.dev is a visual architecture builder for web apps. Users drag cloud components onto a canvas and connect typed ports to design their stack.

## Preferences

- **Use Bun** over npm/npx (e.g., `bunx` instead of `npx`)
- **Cloudflare** for hosting and edge compute
- **Vanilla JS** - No frameworks, ES modules only

## Build Commands

```bash
# Local development server (no build needed)
cd www && python -m http.server 8080

# Manual deployment to Cloudflare Pages
bunx wrangler deploy
```

## Architecture

**Tech Stack:**
- Vanilla JavaScript with ES modules
- Canvas 2D API for rendering
- Cloudflare Pages for hosting

**Project Structure:**
```
www/
├── index.html          # Entry point, imports modules
├── style.css           # Layout & component styles
├── canvas.js           # Canvas rendering, pan/zoom, event handling
├── palette.js          # Left sidebar with draggable components
├── state.js            # Graph state management (CanvasState singleton)
├── component-specs.js  # Component definitions with typed ports
├── graph-model.js      # GraphSpec, NodeSpec, EdgeSpec classes
├── components.js       # Legacy component definitions (deprecated)
└── scene.js            # Legacy Three.js scene (deprecated)
```

## Core Modules

### canvas.js - Rendering & Interaction

Main render loop using Canvas 2D API.

**Key functions:**
- `initCanvas(element)` - Initialize canvas with event listeners
- `draw()` - Main render function (called via requestAnimationFrame)
- `drawGrid()` - Subtle grid background
- `drawNodes()` - Render all nodes with ports
- `drawEdges()` - Render bezier wire connections
- `drawWirePreview()` - Preview wire during connection drag

**Event handling:**
- Pan: middle-click drag or space+drag
- Zoom: scroll wheel (zooms toward cursor)
- Node selection: click
- Wire creation: drag from output port to input port
- Delete: Delete/Backspace key

### state.js - Graph State Management

Singleton `canvasState` manages all state.

**Key properties:**
```javascript
canvasState.graph          // GraphSpec instance
canvasState.graph.nodes    // Map<id, NodeSpec>
canvasState.graph.edges    // Map<id, EdgeSpec>
canvasState.selectedNodeIds // Set<id>
canvasState.selectedEdgeIds // Set<id>
canvasState.pan            // { x, y }
canvasState.zoom           // number (0.25 - 4)
canvasState.mode           // 'idle' | 'dragging' | 'connecting' | 'panning'
canvasState.wirePreview    // Preview wire during connection
```

**Key methods:**
```javascript
canvasState.addNode(componentId, x, y)      // Add node at position
canvasState.addEdge(srcNodeId, srcPortId, tgtNodeId, tgtPortId)
canvasState.removeNode(nodeId)
canvasState.removeEdge(edgeId)
canvasState.selectNode(nodeId, additive)
canvasState.deleteSelected()
canvasState.getNodeAt(worldX, worldY)       // Hit testing
canvasState.getPortAt(worldX, worldY)       // Port hit testing
canvasState.screenToWorld(screenX, screenY) // Coordinate conversion
canvasState.getNodePorts(node)              // Get typed ports for rendering
```

### component-specs.js - Type System

Defines components with typed input/output ports. Inspired by [Unit](https://github.com/samuelmtimbo/unit).

**Type definitions:**
```javascript
export const TYPES = {
  HTTP_REQUEST: 'http-request',
  HTTP_RESPONSE: 'http-response',
  SQL_QUERY: 'sql-query',
  SQL_RESULT: 'sql-result',
  KV_OPERATION: 'kv-operation',
  KV_RESULT: 'kv-result',
  WASM_CALL: 'wasm-call',
  WASM_RESULT: 'wasm-result',
  RENDER_COMMAND: 'render-command',
  STATIC_ASSET: 'static-asset',
  ANY: 'any',
};
```

**Component spec structure:**
```javascript
export const COMPONENT_SPECS = {
  workers: {
    id: 'workers',
    name: 'Cloudflare Workers',
    role: 'Edge Functions',
    icon: '⚡',
    color: '#F6821F',
    category: 'compute',

    inputs: {
      request: { type: TYPES.HTTP_REQUEST, position: 'top' },
      kvResult: { type: TYPES.KV_RESULT, position: 'left' },
      sqlResult: { type: TYPES.SQL_RESULT, position: 'left-bottom' },
    },

    outputs: {
      response: { type: TYPES.HTTP_RESPONSE, position: 'top' },
      kvOp: { type: TYPES.KV_OPERATION, position: 'bottom-right' },
      sqlQuery: { type: TYPES.SQL_QUERY, position: 'bottom-left' },
    },

    metadata: {
      tags: ['compute', 'edge', 'serverless'],
      provider: 'cloudflare',
      alternatives: ['lambda-edge', 'vercel-edge'],
    },
  },
  // ... other components
};
```

**Key functions:**
```javascript
isTypeCompatible(sourceType, targetType)  // Validate connection
getComponentSpec(componentId)             // Get spec by ID
getTypeColor(type)                        // Get port color
getPortOffset(position, width, height)    // Get port screen offset
```

### palette.js - Component Palette

Left sidebar with draggable component cards.

**Key functions:**
- `initPalette(container)` - Render palette and setup drag listeners
- `handleDragStart/End` - Manage drag state
- `handleDrop` - Create node at drop position

### graph-model.js - Data Structures

Core graph classes (kept from original implementation).

```javascript
class GraphSpec {
  nodes: Map<id, NodeSpec>
  edges: Map<id, EdgeSpec>
  addNode(node) / removeNode(nodeId)
  addEdge(edge) / removeEdge(edgeId)
}

class NodeSpec {
  id, componentId, position, width, height, color, name, role, icon
}

class EdgeSpec {
  id, source: { nodeId, portId }, target: { nodeId, portId }
}
```

## Port Positions

Ports are positioned relative to node bounds:

| Position | Location |
|----------|----------|
| `top` | Center top edge |
| `top-left` | Left quarter of top edge |
| `top-right` | Right quarter of top edge |
| `bottom` | Center bottom edge |
| `bottom-left` | Left quarter of bottom edge |
| `bottom-right` | Right quarter of bottom edge |
| `left` | Center left edge |
| `left-top` | Upper half of left edge |
| `left-bottom` | Lower half of left edge |
| `right` | Center right edge |

## Connection Validation

Connections are validated using `TYPE_COMPATIBILITY` matrix:

```javascript
export const TYPE_COMPATIBILITY = {
  [TYPES.HTTP_REQUEST]: [TYPES.HTTP_REQUEST, TYPES.ANY],
  [TYPES.SQL_QUERY]: [TYPES.SQL_QUERY, TYPES.ANY],
  [TYPES.SQL_RESULT]: [TYPES.SQL_RESULT, TYPES.JSON, TYPES.ANY],
  // ...
};
```

**Valid connection:** source type's compatible array includes target type
**Invalid connection:** shown with red highlight during drag

## Adding New Components

1. Add spec to `COMPONENT_SPECS` in `component-specs.js`
2. Component automatically appears in palette
3. No other changes needed

## Adding New Types

1. Add to `TYPES` constant
2. Add to `TYPE_COMPATIBILITY` matrix
3. Add color to `getTypeColor()` function

## Debugging

```javascript
// In browser console
window.canvasState                    // Access state
canvasState.graph.nodes.size          // Node count
canvasState.graph.edges.size          // Edge count
JSON.stringify(canvasState.toJSON())  // Export graph
```

## Legacy Code (Deprecated)

The following files are from the old Three.js implementation and are no longer used:

- `scene.js` - Three.js 3D scene (replaced by canvas.js)
- `components.js` - Old component definitions (replaced by component-specs.js)
- `bottom-sheet.css` - Bottom sheet styles
- Various feature folders in `www/features/`

These can be removed in a future cleanup.
