# Graph Model & Port Types - Ralph PRD

**Task**: GraphModelPhase1
**Date**: 2026-01-31
**Scope**: Phase 1 of Visual Architecture Builder

---

## Overview

Create the foundational graph data model for shipwith.dev's visual architecture builder. This phase establishes typed ports, node/edge specifications, and basic port rendering.

## Out of Scope

- Edge drawing interactions (Phase 2)
- Component palette drag/drop (Phase 3)
- Serialization/URL sharing (Phase 4)
- Enhanced metrics dashboard (Phase 5)
- Any changes to Rust/WASM code
- Mobile touch gestures

## Technical Context

- **Stack**: Vanilla JS + Three.js (no build step for www/)
- **Key file**: `www/scene.js` - main rendering logic
- **Existing patterns**: See `COMPONENTS` array and `createLabelTexture()` function

## Verification Method

For each story:
1. Run `cd www && python -m http.server 8080`
2. Open `http://localhost:8080` in browser
3. Verify visual/functional criteria
4. Check browser console for errors

---

## Stories

### Story 1: Create graph-model.js with PORT_TYPES

**File**: `www/graph-model.js` (create)

**Description**: Create the graph model module with port type definitions representing data flows in web architectures.

**Acceptance Criteria**:
- [ ] File `www/graph-model.js` exists
- [ ] `PORT_TYPES` object exported with 8 port types: HTTP_IN, HTTP_OUT, SQL_QUERY, SQL_RESULT, KV_OP, STATIC, WASM_CALL, RENDER
- [ ] Each port type has: `id` (string), `label` (string), `color` (hex string)
- [ ] No console errors when loading the page with `<script src="graph-model.js">` in index.html

**Implementation**:
```javascript
// www/graph-model.js
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
```

**Verification**: Load page, check console for import errors, verify `window.PORT_TYPES` accessible (if exposed).

```yaml
passes: true
```

---

### Story 2: Add COMPONENT_PORTS definitions

**File**: `www/graph-model.js` (modify)

**Description**: Define input/output ports for each of the 6 existing components.

**Acceptance Criteria**:
- [ ] `COMPONENT_PORTS` object exported with keys: workers, pages, kv, d1, wasm, threejs
- [ ] Each component has `inputs` and `outputs` arrays
- [ ] Each port entry has `type` (references PORT_TYPES id) and `position` (top, bottom, left, right)
- [ ] Port definitions match the data flow logic (e.g., workers outputs SQL queries, d1 inputs SQL queries)

**Implementation**:
```javascript
export const COMPONENT_PORTS = {
  workers: {
    inputs: [{ type: 'http-in', position: 'top' }],
    outputs: [
      { type: 'http-out', position: 'top' },
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
```

**Verification**: No console errors, data structure is valid JSON when logged.

```yaml
passes: true
```

---

### Story 3: Add GraphSpec, NodeSpec, EdgeSpec classes

**File**: `www/graph-model.js` (modify)

**Description**: Create serializable spec classes for representing graphs, nodes, and edges.

**Acceptance Criteria**:
- [ ] `GraphSpec` class with: id (UUID), version, name, nodes (Map), edges (Map), metadata (created, modified, author, description)
- [ ] `NodeSpec` class with: id (UUID), componentId, alternativeId, position {x, y}, locked, metadata
- [ ] `EdgeSpec` class with: id (UUID), source {nodeId, portId}, target {nodeId, portId}, label, metadata
- [ ] All classes exported
- [ ] `new GraphSpec()` creates valid instance with UUID

**Implementation**:
```javascript
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

export class NodeSpec {
  constructor(componentId, position = { x: 0, y: 0 }) {
    this.id = crypto.randomUUID();
    this.componentId = componentId;
    this.alternativeId = null;
    this.position = { x: position.x, y: position.y };
    this.locked = false;
    this.metadata = {};
  }
}

export class EdgeSpec {
  constructor(sourceNodeId, sourcePortId, targetNodeId, targetPortId) {
    this.id = crypto.randomUUID();
    this.source = { nodeId: sourceNodeId, portId: sourcePortId };
    this.target = { nodeId: targetNodeId, portId: targetPortId };
    this.label = null;
    this.metadata = {};
  }
}
```

**Verification**: In browser console, run:
```javascript
const g = new GraphSpec();
const n = new NodeSpec('workers', {x: 0, y: 2});
g.addNode(n);
console.log(g.nodes.size === 1); // true
```

```yaml
passes: true
```

---

### Story 4: Add connection validation function

**File**: `www/graph-model.js` (modify)

**Description**: Add function to validate if two port types can be connected.

**Acceptance Criteria**:
- [ ] `COMPATIBLE_TYPES` object maps output port types to valid input port types
- [ ] `isValidConnection(sourcePortType, targetPortType)` function exported
- [ ] Returns `true` for valid connections (e.g., 'http-out' -> 'http-in')
- [ ] Returns `false` for invalid connections (e.g., 'http-out' -> 'sql-q')
- [ ] `getCompatibleInputs(outputPortType)` helper function returns array of valid inputs

**Implementation**:
```javascript
export const COMPATIBLE_TYPES = {
  'http-out': ['http-in'],
  'sql-r': ['sql-q'],      // Note: result connects back to query consumers
  'kv-op': ['kv-op'],
  'static': ['http-in'],   // Static assets serve HTTP
  'wasm': ['wasm'],
  'render': ['render'],
};

export function isValidConnection(sourcePortType, targetPortType) {
  const compatible = COMPATIBLE_TYPES[sourcePortType] || [];
  return compatible.includes(targetPortType);
}

export function getCompatibleInputs(outputPortType) {
  return COMPATIBLE_TYPES[outputPortType] || [];
}
```

**Verification**: In browser console:
```javascript
console.log(isValidConnection('http-out', 'http-in')); // true
console.log(isValidConnection('http-out', 'sql-q'));   // false
console.log(isValidConnection('sql-r', 'sql-q'));      // true
```

```yaml
passes: true
```

---

### Story 5: Add graph-model.js to index.html

**File**: `www/index.html` (modify)

**Description**: Import graph-model.js as ES module in index.html.

**Acceptance Criteria**:
- [ ] `<script type="module">` imports from graph-model.js
- [ ] Exports accessible for use in scene.js
- [ ] No console errors on page load
- [ ] Page still renders correctly (existing functionality preserved)

**Implementation**: Add to index.html before scene.js:
```html
<script type="module">
  import { PORT_TYPES, COMPONENT_PORTS, GraphSpec, NodeSpec, EdgeSpec, isValidConnection } from './graph-model.js';
  window.GraphModel = { PORT_TYPES, COMPONENT_PORTS, GraphSpec, NodeSpec, EdgeSpec, isValidConnection };
</script>
```

**Verification**:
1. Page loads without errors
2. Existing 3D visualization works
3. `window.GraphModel.PORT_TYPES` returns object in console

```yaml
passes: true
```

---

### Story 6: Render port indicators on component cards

**File**: `www/scene.js` (modify)

**Description**: Extend `createLabelTexture()` to draw colored port dots on component card edges.

**Acceptance Criteria**:
- [ ] Each component shows colored dots at port positions
- [ ] Input ports shown on top/left edges
- [ ] Output ports shown on bottom/right edges
- [ ] Port colors match PORT_TYPES definitions
- [ ] Ports visible but subtle (small circles, ~8px radius)
- [ ] Existing label text still renders correctly

**Implementation approach**:
1. In `createLabelTexture()`, after drawing text, draw port circles
2. Use `COMPONENT_PORTS[componentId]` to get port definitions
3. Map position names ('top', 'bottom-left', etc.) to canvas coordinates
4. Draw filled circles with port type colors

**Key coordinates** (512x512 canvas):
- top: (256, 30)
- bottom: (256, 480)
- left: (30, 256)
- right: (480, 256)
- bottom-left: (128, 480)
- bottom-right: (384, 480)

**Verification**:
1. Open page, click "How It Works" to explode components
2. Each component card shows colored dots at edges
3. Workers shows 1 blue dot (top), 3 dots (bottom area)
4. D1 shows 1 purple dot (top), 1 purple dot (bottom)

```yaml
passes: true
```

---

### Story 7: Store port hitboxes in mesh.userData

**File**: `www/scene.js` (modify)

**Description**: Store port position data in mesh.userData for future raycasting.

**Acceptance Criteria**:
- [ ] Each component mesh has `mesh.userData.ports` array
- [ ] Each port entry has: `{ type, position, worldOffset, isInput }`
- [ ] `worldOffset` is relative 3D offset from component center
- [ ] Data available for both left and right column components

**Implementation approach**:
1. After creating mesh in component creation, add ports data
2. Calculate 3D offsets based on card size and port position name
3. Store in userData for use by future raycasting

**Verification**: In console after page load:
```javascript
// Find a component mesh and check userData
scene.children.find(c => c.userData?.componentId === 'workers')?.userData.ports
// Should return array of port objects
```

```yaml
passes: true
```

---

## Progress Tracking

| Story | Status |
|-------|--------|
| 1. PORT_TYPES | complete |
| 2. COMPONENT_PORTS | complete |
| 3. Spec classes | complete |
| 4. Validation function | complete |
| 5. Import in HTML | complete |
| 6. Port rendering | complete |
| 7. Port hitboxes | complete |

---

## Completion Signal

When ALL stories pass verification, output:

```
<promise>COMPLETE</promise>
```

---

## Ralph Command

```
/ralph-loop:ralph-loop "Read GraphModelPhase1-2026-01-31-RalphPRD.md and implement all stories sequentially. For each story:
1. Read the acceptance criteria carefully
2. Implement the code changes
3. Start local server: cd www && python -m http.server 8080
4. Verify in browser at http://localhost:8080
5. Check browser console for errors
6. If verification passes, commit with message 'feat(graph-model): [story description]'
7. Mark story as passes: true
8. Move to next story

Output <promise>COMPLETE</promise> when ALL 7 stories pass." --max-iterations 12 --completion-promise "COMPLETE"
```
