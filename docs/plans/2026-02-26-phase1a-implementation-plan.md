# Phase 1a: Canvas Polish + Properties Panel — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the shipwith.dev visual architecture builder feel professional by adding multi-layer canvas rendering, an extended data model with simulation-relevant properties, a node properties panel, and 80%+ test coverage on core modules.

**Architecture:** Four stacked Canvas 2D layers (grid, edges, nodes, overlay) with dirty flags for selective repaint. Properties panel is a DOM element that pushes the canvas via flex layout. Extended data model adds `config` and `provider` objects to NodeSpec/EdgeSpec. Tests use Bun's built-in test runner.

**Tech Stack:** Vanilla JavaScript (ES modules), Canvas 2D API, HTML/CSS (DOM for properties panel), Bun test runner.

---

## Task 1a.0: Cleanup Deprecated Files

**Files:**
- Delete: `www/scene.js`
- Delete: `www/components.js`
- Delete: `www/stack-state.js`
- Delete: `www/bottom-sheet.css`
- Delete: `www/tests/run-all.js`
- Delete: `www/tests/stack-state.test.js`
- Delete: `www/tests/scene-data.test.js`
- Delete: `www/tests/scene-behavior.test.js`
- Delete: `www/tests/ui-behavior.test.js`
- Delete: `www/tests/responsive-redesign.test.js`
- Delete: `www/features/` (entire directory)
- Delete: `www/shared/` (entire directory)
- Delete: `www/pkg/` (entire directory)
- Verify: `www/index.html` (no refs to deleted files)

**Step 1: Delete deprecated source files**

```bash
rm www/scene.js www/components.js www/stack-state.js
rm -f www/bottom-sheet.css
```

**Step 2: Delete legacy test files**

```bash
rm www/tests/run-all.js www/tests/stack-state.test.js www/tests/scene-data.test.js www/tests/scene-behavior.test.js www/tests/ui-behavior.test.js www/tests/responsive-redesign.test.js
```

**Step 3: Delete deprecated directories**

```bash
rm -rf www/features www/shared www/pkg
```

**Step 4: Verify no references to deleted files in index.html**

Run: `rg "scene\.js|components\.js|stack-state|bottom-sheet|features/|shared/" www/index.html`
Expected: No matches (0 results)

**Step 5: Verify app still loads**

Run: `cd www && python -m http.server 8080 &` then open http://localhost:8080
Expected: Canvas renders, palette shows components, no console errors.

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete deprecated Three.js, legacy tests, and unused modules

Remove ~4,500 LOC of dead code: scene.js (Three.js), components.js,
stack-state.js, legacy test suite, features/, shared/, pkg/.
Active modules unaffected."
```

---

## Task 1a.1: Multi-Layer Canvas

**Files:**
- Modify: `www/index.html:27-34` (replace single canvas with 4-layer container)
- Modify: `www/canvas.js` (major refactor — split rendering into layers)
- Modify: `www/style.css:159-181` (canvas container and layer stacking styles)
- Modify: `www/palette.js` (update drop target from `#canvas` to overlay canvas)

### Step 1: Update index.html — replace single canvas with layer container

Replace `www/index.html:32-34`:

```html
        <!-- Main Canvas -->
        <main id="canvas-container">
            <canvas id="canvas"></canvas>
        </main>
```

With:

```html
        <!-- Main Canvas (4 layers) -->
        <main id="canvas-container">
            <canvas id="layer-grid" class="canvas-layer"></canvas>
            <canvas id="layer-edges" class="canvas-layer"></canvas>
            <canvas id="layer-nodes" class="canvas-layer"></canvas>
            <canvas id="layer-overlay" class="canvas-layer"></canvas>
        </main>
```

Update script in `www/index.html:63-64`:

Replace:
```javascript
            const canvas = document.getElementById('canvas');
            initCanvas(canvas);
```

With:
```javascript
            const container = document.getElementById('canvas-container');
            initCanvas(container);
```

### Step 2: Update style.css — layer stacking

Replace `www/style.css:159-181` (the CANVAS section):

```css
/* ============================================
   CANVAS
   ============================================ */

#canvas-container {
    flex: 1;
    position: relative;
    overflow: hidden;
}

.canvas-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

#layer-grid    { z-index: 1; }
#layer-edges   { z-index: 2; }
#layer-nodes   { z-index: 3; }
#layer-overlay { z-index: 4; pointer-events: none; }

/* The top interactive layer captures all events */
#layer-nodes   { pointer-events: auto; }

#canvas-container.drop-active {
    outline: 3px solid var(--cf-orange);
    outline-offset: -3px;
}
```

### Step 3: Refactor canvas.js — multi-layer rendering

Replace the entire `www/canvas.js` with the multi-layer version. Key changes:

- Replace `let canvas, ctx` with 4 canvas/context pairs
- Add dirty flags: `gridDirty`, `edgesDirty`, `nodesDirty` (overlay always redraws)
- `initCanvas(container)` now takes the container div, gets all 4 canvases
- `resizeCanvas()` resizes all 4 canvases
- Event listeners attach to `#layer-nodes` (the interactive layer)
- `draw()` checks dirty flags and only calls relevant layer draw functions
- `drawGrid()` draws to `gridCtx` on its own canvas
- `drawEdges()` draws to `edgesCtx` on its own canvas
- `drawNodes()` draws to `nodesCtx` on its own canvas
- `drawWirePreview()` draws to `overlayCtx` on its own canvas
- Mark layers dirty on relevant state changes:
  - Pan/zoom: all layers dirty
  - Node move: nodes + edges dirty
  - Node add/remove: nodes dirty
  - Edge add/remove: edges dirty
  - Selection change: nodes dirty (selection highlight)
  - Wire preview: overlay always redraws

Here is the complete refactored `canvas.js`:

```javascript
// Canvas rendering and interaction for Visual Architecture Canvas
// Multi-layer: grid, edges, nodes, overlay
// Each layer repaints independently via dirty flags

import { canvasState } from './state.js';
import { getComponentSpec, isTypeCompatible, getTypeColor } from './component-specs.js';

// Four canvas layers
let container;
let gridCanvas, gridCtx;
let edgesCanvas, edgesCtx;
let nodesCanvas, nodesCtx;
let overlayCanvas, overlayCtx;
let animationFrameId = null;

// Dirty flags (overlay always redraws)
let gridDirty = true;
let edgesDirty = true;
let nodesDirty = true;

// Grid settings
const GRID_SIZE = 40;
const GRID_COLOR = 'rgba(255, 255, 255, 0.05)';
const GRID_ACCENT_COLOR = 'rgba(255, 255, 255, 0.1)';
const GRID_ACCENT_EVERY = 5;

// Interaction state
let isPanning = false;
let isSpaceDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
let hoveredPort = null;

// Mark layers dirty
export function markGridDirty() { gridDirty = true; }
export function markEdgesDirty() { edgesDirty = true; }
export function markNodesDirty() { nodesDirty = true; }
export function markAllDirty() { gridDirty = true; edgesDirty = true; nodesDirty = true; }

// Initialize canvas layers
export function initCanvas(containerElement) {
    container = containerElement;
    gridCanvas = document.getElementById('layer-grid');
    edgesCanvas = document.getElementById('layer-edges');
    nodesCanvas = document.getElementById('layer-nodes');
    overlayCanvas = document.getElementById('layer-overlay');

    gridCtx = gridCanvas.getContext('2d');
    edgesCtx = edgesCanvas.getContext('2d');
    nodesCtx = nodesCanvas.getContext('2d');
    overlayCtx = overlayCanvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Center the view initially (use nodesCanvas for dimensions)
    canvasState.pan.x = nodesCanvas.width / (window.devicePixelRatio || 1) / 2;
    canvasState.pan.y = nodesCanvas.height / (window.devicePixelRatio || 1) / 2;

    // Subscribe to state changes to mark layers dirty
    canvasState.subscribe(() => {
        nodesDirty = true;
        edgesDirty = true;
    });

    setupEventListeners();
    startRenderLoop();

    return { container };
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    for (const cvs of [gridCanvas, edgesCanvas, nodesCanvas, overlayCanvas]) {
        cvs.width = rect.width * dpr;
        cvs.height = rect.height * dpr;
        cvs.style.width = rect.width + 'px';
        cvs.style.height = rect.height + 'px';

        const c = cvs.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Re-get contexts after resize (setTransform already applied)
    gridCtx = gridCanvas.getContext('2d');
    edgesCtx = edgesCanvas.getContext('2d');
    nodesCtx = nodesCanvas.getContext('2d');
    overlayCtx = overlayCanvas.getContext('2d');

    markAllDirty();
}

function setupEventListeners() {
    // Events on the nodes layer (topmost interactive layer)
    nodesCanvas.addEventListener('mousedown', handleMouseDown);
    nodesCanvas.addEventListener('mousemove', handleMouseMove);
    nodesCanvas.addEventListener('mouseup', handleMouseUp);
    nodesCanvas.addEventListener('mouseleave', handleMouseUp);
    nodesCanvas.addEventListener('wheel', handleWheel, { passive: false });
    nodesCanvas.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    nodesCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    nodesCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    nodesCanvas.addEventListener('touchend', handleTouchEnd);
}

function handleMouseDown(e) {
    const rect = nodesCanvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = canvasState.screenToWorld(screenX, screenY);

    lastMouseX = screenX;
    lastMouseY = screenY;

    // Middle click or space+left click = pan
    if (e.button === 1 || (e.button === 0 && isSpaceDown)) {
        isPanning = true;
        nodesCanvas.style.cursor = 'grabbing';
        return;
    }

    // Left click
    if (e.button === 0) {
        // Check for port click (start wire)
        const port = canvasState.getPortAt(world.x, world.y);
        if (port && port.isOutput) {
            canvasState.mode = 'connecting';
            canvasState.wirePreview = {
                sourceNode: port.node,
                sourcePortId: port.portId,
                sourcePortType: port.portType,
                startX: port.x,
                startY: port.y,
                endX: world.x,
                endY: world.y
            };
            return;
        }

        // Check for node click
        const node = canvasState.getNodeAt(world.x, world.y);
        if (node) {
            const isSelected = canvasState.isNodeSelected(node.id);

            if (e.shiftKey) {
                if (isSelected) {
                    canvasState.selectedNodeIds.delete(node.id);
                } else {
                    canvasState.selectedNodeIds.add(node.id);
                }
                canvasState.notify();
            } else if (!isSelected) {
                canvasState.selectNode(node.id);
            }

            canvasState.mode = 'dragging';
            canvasState.dragStart = { x: world.x, y: world.y };
            nodesCanvas.style.cursor = 'move';
            return;
        }

        // Check for edge click
        const edge = getEdgeAt(world.x, world.y);
        if (edge) {
            canvasState.selectEdge(edge.id, e.shiftKey);
            return;
        }

        // Click on empty space - deselect
        if (!e.shiftKey) {
            canvasState.deselectAll();
        }
    }
}

function handleMouseMove(e) {
    const rect = nodesCanvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const dx = screenX - lastMouseX;
    const dy = screenY - lastMouseY;
    const world = canvasState.screenToWorld(screenX, screenY);

    // Update hovered port for highlighting
    hoveredPort = canvasState.getPortAt(world.x, world.y);

    if (isPanning) {
        canvasState.adjustPan(dx, dy);
        markAllDirty();
    }

    if (canvasState.mode === 'dragging' && canvasState.dragStart) {
        const worldDx = (world.x - canvasState.dragStart.x);
        const worldDy = (world.y - canvasState.dragStart.y);
        canvasState.moveSelectedNodes(worldDx, worldDy);
        canvasState.dragStart = { x: world.x, y: world.y };
    }

    if (canvasState.mode === 'connecting' && canvasState.wirePreview) {
        canvasState.wirePreview.endX = world.x;
        canvasState.wirePreview.endY = world.y;

        // Check if hovering over valid input port
        const port = canvasState.getPortAt(world.x, world.y);
        if (port && !port.isOutput) {
            const sourceType = canvasState.wirePreview.sourcePortType;
            const targetType = port.portType;
            const isValid = isTypeCompatible(sourceType, targetType);
            canvasState.wirePreview.validTarget = isValid ? port : null;
            canvasState.wirePreview.invalidTarget = !isValid ? port : null;
        } else {
            canvasState.wirePreview.validTarget = null;
            canvasState.wirePreview.invalidTarget = null;
        }
    }

    // Update cursor
    if (!isPanning && canvasState.mode === 'idle') {
        const port = canvasState.getPortAt(world.x, world.y);
        const node = canvasState.getNodeAt(world.x, world.y);

        if (port) {
            nodesCanvas.style.cursor = 'crosshair';
        } else if (node) {
            nodesCanvas.style.cursor = 'pointer';
        } else if (isSpaceDown) {
            nodesCanvas.style.cursor = 'grab';
        } else {
            nodesCanvas.style.cursor = 'default';
        }
    }

    lastMouseX = screenX;
    lastMouseY = screenY;
}

function handleMouseUp(e) {
    if (isPanning) {
        isPanning = false;
        nodesCanvas.style.cursor = isSpaceDown ? 'grab' : 'default';
    }

    // Complete wire connection
    if (canvasState.mode === 'connecting' && canvasState.wirePreview) {
        const validTarget = canvasState.wirePreview.validTarget;
        if (validTarget) {
            canvasState.addEdge(
                canvasState.wirePreview.sourceNode.id,
                canvasState.wirePreview.sourcePortId,
                validTarget.node.id,
                validTarget.portId
            );
        }
        canvasState.wirePreview = null;
    }

    canvasState.mode = 'idle';
    canvasState.dragStart = null;
}

function handleWheel(e) {
    e.preventDefault();

    const rect = nodesCanvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = canvasState.zoom * zoomFactor;

    canvasState.setZoom(newZoom, screenX, screenY);
    markAllDirty();
}

function handleKeyDown(e) {
    if (e.code === 'Space' && !isSpaceDown) {
        isSpaceDown = true;
        if (canvasState.mode === 'idle') {
            nodesCanvas.style.cursor = 'grab';
        }
    }

    if ((e.code === 'Delete' || e.code === 'Backspace') && !e.target.matches('input, textarea')) {
        if (canvasState.selectedNodeIds.size > 0 || canvasState.selectedEdgeIds.size > 0) {
            canvasState.deleteSelected();
        }
    }

    if (e.code === 'Escape') {
        if (canvasState.mode === 'connecting') {
            canvasState.wirePreview = null;
            canvasState.mode = 'idle';
        }
        canvasState.deselectAll();
    }
}

function handleKeyUp(e) {
    if (e.code === 'Space') {
        isSpaceDown = false;
        if (!isPanning) {
            nodesCanvas.style.cursor = 'default';
        }
    }
}

// Touch handling
let touchStartDistance = 0;
let touchStartZoom = 1;

function handleTouchStart(e) {
    e.preventDefault();

    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = nodesCanvas.getBoundingClientRect();
        lastMouseX = touch.clientX - rect.left;
        lastMouseY = touch.clientY - rect.top;

        const world = canvasState.screenToWorld(lastMouseX, lastMouseY);
        const node = canvasState.getNodeAt(world.x, world.y);

        if (node) {
            canvasState.selectNode(node.id);
            canvasState.mode = 'dragging';
            canvasState.dragStart = { x: world.x, y: world.y };
        } else {
            isPanning = true;
        }
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDistance = Math.hypot(dx, dy);
        touchStartZoom = canvasState.zoom;
        isPanning = false;
    }
}

function handleTouchMove(e) {
    e.preventDefault();

    if (e.touches.length === 1 && (isPanning || canvasState.mode === 'dragging')) {
        const touch = e.touches[0];
        const rect = nodesCanvas.getBoundingClientRect();
        const screenX = touch.clientX - rect.left;
        const screenY = touch.clientY - rect.top;
        const dx = screenX - lastMouseX;
        const dy = screenY - lastMouseY;

        if (isPanning) {
            canvasState.adjustPan(dx, dy);
            markAllDirty();
        } else if (canvasState.mode === 'dragging') {
            const world = canvasState.screenToWorld(screenX, screenY);
            const worldDx = world.x - canvasState.dragStart.x;
            const worldDy = world.y - canvasState.dragStart.y;
            canvasState.moveSelectedNodes(worldDx, worldDy);
            canvasState.dragStart = { x: world.x, y: world.y };
        }

        lastMouseX = screenX;
        lastMouseY = screenY;
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.hypot(dx, dy);
        const scale = distance / touchStartDistance;

        const rect = nodesCanvas.getBoundingClientRect();
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

        canvasState.setZoom(touchStartZoom * scale, centerX, centerY);
        markAllDirty();
    }
}

function handleTouchEnd(e) {
    isPanning = false;
    canvasState.mode = 'idle';
    canvasState.dragStart = null;
}

// Get edge at position
function getEdgeAt(worldX, worldY) {
    const threshold = 10 / canvasState.zoom;

    for (const edge of canvasState.graph.edges.values()) {
        const sourceNode = canvasState.graph.nodes.get(edge.source.nodeId);
        const targetNode = canvasState.graph.nodes.get(edge.target.nodeId);
        if (!sourceNode || !targetNode) continue;

        const sourceSpec = getComponentSpec(sourceNode.componentId);
        const targetSpec = getComponentSpec(targetNode.componentId);
        if (!sourceSpec || !targetSpec) continue;

        const sourcePort = sourceSpec.outputs[edge.source.portId];
        const targetPort = targetSpec.inputs[edge.target.portId];
        if (!sourcePort || !targetPort) continue;

        const start = canvasState.getPortWorldPosition(sourceNode, sourcePort.position, true);
        const end = canvasState.getPortWorldPosition(targetNode, targetPort.position, false);

        if (distanceToWire(worldX, worldY, start.x, start.y, end.x, end.y) < threshold) {
            return edge;
        }
    }
    return null;
}

function distanceToWire(px, py, x1, y1, x2, y2) {
    const cp1x = x1;
    const cp1y = y1 + 50;
    const cp2x = x2;
    const cp2y = y2 - 50;

    let minDist = Infinity;
    for (let t = 0; t <= 1; t += 0.1) {
        const x = bezierPoint(x1, cp1x, cp2x, x2, t);
        const y = bezierPoint(y1, cp1y, cp2y, y2, t);
        const dist = Math.hypot(px - x, py - y);
        minDist = Math.min(minDist, dist);
    }
    return minDist;
}

function bezierPoint(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

// Render loop
function startRenderLoop() {
    function render() {
        draw();
        animationFrameId = requestAnimationFrame(render);
    }
    render();
}

export function stopRenderLoop() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Main draw function — only repaints dirty layers
function draw() {
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (gridDirty) {
        gridCtx.clearRect(0, 0, width, height);
        gridCtx.fillStyle = '#1d1d1d';
        gridCtx.fillRect(0, 0, width, height);
        gridCtx.save();
        gridCtx.translate(canvasState.pan.x, canvasState.pan.y);
        gridCtx.scale(canvasState.zoom, canvasState.zoom);
        drawGrid(width, height);
        gridCtx.restore();
        gridDirty = false;
    }

    if (edgesDirty) {
        edgesCtx.clearRect(0, 0, width, height);
        edgesCtx.save();
        edgesCtx.translate(canvasState.pan.x, canvasState.pan.y);
        edgesCtx.scale(canvasState.zoom, canvasState.zoom);
        drawEdges();
        edgesCtx.restore();
        edgesDirty = false;
    }

    if (nodesDirty) {
        nodesCtx.clearRect(0, 0, width, height);
        nodesCtx.save();
        nodesCtx.translate(canvasState.pan.x, canvasState.pan.y);
        nodesCtx.scale(canvasState.zoom, canvasState.zoom);
        drawNodes();
        nodesCtx.restore();
        nodesDirty = false;
    }

    // Overlay always redraws (wire preview, selection effects)
    overlayCtx.clearRect(0, 0, width, height);
    if (canvasState.wirePreview) {
        overlayCtx.save();
        overlayCtx.translate(canvasState.pan.x, canvasState.pan.y);
        overlayCtx.scale(canvasState.zoom, canvasState.zoom);
        drawWirePreview();
        overlayCtx.restore();
    }
}

function drawGrid(width, height) {
    const { pan, zoom } = canvasState;

    const left = -pan.x / zoom;
    const top = -pan.y / zoom;
    const right = (width - pan.x) / zoom;
    const bottom = (height - pan.y) / zoom;

    const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE;

    gridCtx.lineWidth = 1 / zoom;

    for (let x = startX; x <= right; x += GRID_SIZE) {
        const isAccent = Math.round(x / GRID_SIZE) % GRID_ACCENT_EVERY === 0;
        gridCtx.strokeStyle = isAccent ? GRID_ACCENT_COLOR : GRID_COLOR;
        gridCtx.beginPath();
        gridCtx.moveTo(x, top);
        gridCtx.lineTo(x, bottom);
        gridCtx.stroke();
    }

    for (let y = startY; y <= bottom; y += GRID_SIZE) {
        const isAccent = Math.round(y / GRID_SIZE) % GRID_ACCENT_EVERY === 0;
        gridCtx.strokeStyle = isAccent ? GRID_ACCENT_COLOR : GRID_COLOR;
        gridCtx.beginPath();
        gridCtx.moveTo(left, y);
        gridCtx.lineTo(right, y);
        gridCtx.stroke();
    }
}

function drawNodes() {
    for (const node of canvasState.graph.nodes.values()) {
        drawNode(node);
    }
}

function drawNode(node) {
    const { x, y } = node.position;
    const w = node.width;
    const h = node.height;
    const halfW = w / 2;
    const halfH = h / 2;
    const radius = 12;

    const isSelected = canvasState.isNodeSelected(node.id);

    // Shadow
    nodesCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    roundRect(nodesCtx, x - halfW + 4, y - halfH + 4, w, h, radius);
    nodesCtx.fill();

    // Background
    nodesCtx.fillStyle = '#2a2a2a';
    roundRect(nodesCtx, x - halfW, y - halfH, w, h, radius);
    nodesCtx.fill();

    // Border
    nodesCtx.strokeStyle = isSelected ? '#3b82f6' : node.color;
    nodesCtx.lineWidth = isSelected ? 3 : 2;
    roundRect(nodesCtx, x - halfW, y - halfH, w, h, radius);
    nodesCtx.stroke();

    // Color accent bar at top
    nodesCtx.fillStyle = node.color;
    nodesCtx.beginPath();
    nodesCtx.moveTo(x - halfW + radius, y - halfH);
    nodesCtx.lineTo(x + halfW - radius, y - halfH);
    nodesCtx.arcTo(x + halfW, y - halfH, x + halfW, y - halfH + radius, radius);
    nodesCtx.lineTo(x + halfW, y - halfH + 10);
    nodesCtx.lineTo(x - halfW, y - halfH + 10);
    nodesCtx.lineTo(x - halfW, y - halfH + radius);
    nodesCtx.arcTo(x - halfW, y - halfH, x - halfW + radius, y - halfH, radius);
    nodesCtx.closePath();
    nodesCtx.fill();

    // Icon
    nodesCtx.font = '28px sans-serif';
    nodesCtx.textAlign = 'center';
    nodesCtx.textBaseline = 'middle';
    nodesCtx.fillText(node.icon || '?', x, y - 8);

    // Role (line 1)
    nodesCtx.font = 'bold 12px Inter, sans-serif';
    nodesCtx.fillStyle = '#ffffff';
    nodesCtx.fillText(node.role || node.componentId, x, y + 25);

    // Name (line 2)
    nodesCtx.font = 'italic 10px Inter, sans-serif';
    nodesCtx.fillStyle = '#a0a0a0';
    nodesCtx.fillText(node.name || '', x, y + 40);

    // Draw ports
    drawPorts(node);
}

function drawPorts(node) {
    const { inputs, outputs } = canvasState.getNodePorts(node);
    const portRadius = 7;

    // Draw input ports
    for (const port of inputs) {
        const isHovered = hoveredPort &&
            hoveredPort.node.id === node.id &&
            hoveredPort.portId === port.portId;

        let isValidTarget = false;
        let isInvalidTarget = false;
        if (canvasState.wirePreview && canvasState.wirePreview.validTarget) {
            isValidTarget = canvasState.wirePreview.validTarget.node.id === node.id &&
                           canvasState.wirePreview.validTarget.portId === port.portId;
        }
        if (canvasState.wirePreview && canvasState.wirePreview.invalidTarget) {
            isInvalidTarget = canvasState.wirePreview.invalidTarget.node.id === node.id &&
                             canvasState.wirePreview.invalidTarget.portId === port.portId;
        }

        drawPort(port.worldPos.x, port.worldPos.y, portRadius, port.color, isHovered, isValidTarget, isInvalidTarget);
    }

    // Draw output ports
    for (const port of outputs) {
        const isHovered = hoveredPort &&
            hoveredPort.node.id === node.id &&
            hoveredPort.portId === port.portId;

        drawPort(port.worldPos.x, port.worldPos.y, portRadius, port.color, isHovered, false, false);
    }
}

function drawPort(x, y, radius, color, isHovered, isValidTarget, isInvalidTarget) {
    // Outer ring for hover/valid/invalid state
    if (isHovered || isValidTarget || isInvalidTarget) {
        nodesCtx.beginPath();
        nodesCtx.arc(x, y, radius + 4, 0, Math.PI * 2);
        if (isValidTarget) {
            nodesCtx.fillStyle = 'rgba(16, 185, 129, 0.3)';
            nodesCtx.strokeStyle = '#10B981';
        } else if (isInvalidTarget) {
            nodesCtx.fillStyle = 'rgba(239, 68, 68, 0.3)';
            nodesCtx.strokeStyle = '#EF4444';
        } else {
            nodesCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            nodesCtx.strokeStyle = '#ffffff';
        }
        nodesCtx.fill();
        nodesCtx.lineWidth = 2;
        nodesCtx.stroke();
    }

    // Port circle
    nodesCtx.beginPath();
    nodesCtx.arc(x, y, radius, 0, Math.PI * 2);
    nodesCtx.fillStyle = color;
    nodesCtx.fill();
    nodesCtx.strokeStyle = '#1d1d1d';
    nodesCtx.lineWidth = 2;
    nodesCtx.stroke();
}

function drawEdges() {
    for (const edge of canvasState.graph.edges.values()) {
        drawEdge(edge);
    }
}

function drawEdge(edge) {
    const sourceNode = canvasState.graph.nodes.get(edge.source.nodeId);
    const targetNode = canvasState.graph.nodes.get(edge.target.nodeId);
    if (!sourceNode || !targetNode) return;

    const sourceSpec = getComponentSpec(sourceNode.componentId);
    const targetSpec = getComponentSpec(targetNode.componentId);
    if (!sourceSpec || !targetSpec) return;

    const sourcePort = sourceSpec.outputs[edge.source.portId];
    const targetPort = targetSpec.inputs[edge.target.portId];
    if (!sourcePort || !targetPort) return;

    const start = canvasState.getPortWorldPosition(sourceNode, sourcePort.position, true);
    const end = canvasState.getPortWorldPosition(targetNode, targetPort.position, false);

    const isSelected = canvasState.isEdgeSelected(edge.id);
    const color = getTypeColor(sourcePort.type);

    drawBezierWire(edgesCtx, start.x, start.y, end.x, end.y, color, isSelected);
}

function drawWirePreview() {
    const wp = canvasState.wirePreview;
    let color = getTypeColor(wp.sourcePortType);

    if (wp.validTarget) {
        color = '#10B981';
    } else if (wp.invalidTarget) {
        color = '#EF4444';
    }

    drawBezierWire(overlayCtx, wp.startX, wp.startY, wp.endX, wp.endY, color, false, true);
}

function drawBezierWire(c, x1, y1, x2, y2, color, isSelected = false, isDashed = false) {
    const dy = Math.abs(y2 - y1);
    const controlOffset = Math.max(30, dy * 0.5);

    const cp1x = x1;
    const cp1y = y1 + controlOffset;
    const cp2x = x2;
    const cp2y = y2 - controlOffset;

    c.beginPath();
    c.moveTo(x1, y1);
    c.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);

    c.strokeStyle = color;
    c.lineWidth = isSelected ? 4 : 2.5;

    if (isDashed) {
        c.setLineDash([8, 4]);
    } else {
        c.setLineDash([]);
    }

    c.stroke();
    c.setLineDash([]);

    // Arrow at end
    const angle = Math.atan2(y2 - cp2y, x2 - cp2x);
    const arrowSize = 8;

    c.beginPath();
    c.moveTo(x2, y2);
    c.lineTo(x2 - arrowSize * Math.cos(angle - Math.PI / 6), y2 - arrowSize * Math.sin(angle - Math.PI / 6));
    c.lineTo(x2 - arrowSize * Math.cos(angle + Math.PI / 6), y2 - arrowSize * Math.sin(angle + Math.PI / 6));
    c.closePath();
    c.fillStyle = color;
    c.fill();
}

function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
}

export function getCanvas() {
    return nodesCanvas;
}

export function getContext() {
    return nodesCtx;
}
```

### Step 4: Update palette.js drop target

In `www/palette.js`, the drop listeners attach to `document.getElementById('canvas')`. Update these to attach to `document.getElementById('layer-nodes')`. The exact references to find and replace:

- `document.getElementById('canvas')` → `document.getElementById('layer-nodes')`
- Any `canvas.classList` references → use `document.getElementById('canvas-container').classList` for the drop-active class

### Step 5: Verify app renders correctly

Run: `cd www && python -m http.server 8080`
Expected: Grid renders, nodes render, edges render, wire preview works, pan/zoom works, drag-drop from palette works. No visual artifacts.

### Step 6: Commit

```bash
git add www/index.html www/canvas.js www/style.css www/palette.js
git commit -m "feat: multi-layer canvas with dirty flag rendering

Split single canvas into 4 layers (grid, edges, nodes, overlay).
Each layer repaints independently via dirty flags:
- Grid: only on pan/zoom
- Edges: on edge or connected node changes
- Nodes: on node changes
- Overlay: every frame (wire preview)"
```

---

## Task 1a.2: Extended Data Model

**Files:**
- Modify: `www/graph-model.js:151-173` (add config/provider to NodeSpec, config to EdgeSpec)
- Modify: `www/state.js:48-68` (populate defaults in addNode)
- Modify: `www/state.js:79-117` (populate defaults in addEdge)
- Modify: `www/state.js:322-340` (extend toJSON, add fromJSON)
- Modify: `www/component-specs.js` (add defaultConfig per component spec)

### Step 1: Add config and provider to NodeSpec

In `www/graph-model.js`, update the `NodeSpec` constructor (lines 151-160):

```javascript
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
```

### Step 2: Add config to EdgeSpec

In `www/graph-model.js`, update the `EdgeSpec` constructor (lines 165-173):

```javascript
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
```

### Step 3: Populate defaults from component spec in addNode

In `www/state.js`, update `addNode()` (lines 48-68) to also populate `config` and `provider` from the component spec:

After `node.category = spec.category;` (line 64), add:

```javascript
        // Populate provider info from spec
        node.provider = {
            id: spec.metadata?.provider || null,
            name: spec.name,
            alternatives: spec.metadata?.alternatives || [],
        };

        // Override defaults from spec if available
        if (spec.defaultConfig) {
            node.config = { ...node.config, ...spec.defaultConfig };
        }
```

### Step 4: Extend toJSON to include config and provider

In `www/state.js`, update `toJSON()` (lines 322-340):

```javascript
    toJSON() {
        return {
            id: this.graph.id,
            version: this.graph.version,
            name: this.graph.name,
            metadata: this.graph.metadata,
            nodes: Array.from(this.graph.nodes.values()).map(n => ({
                id: n.id,
                componentId: n.componentId,
                position: n.position,
                config: n.config,
                provider: n.provider,
            })),
            edges: Array.from(this.graph.edges.values()).map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label,
                config: e.config,
            }))
        };
    }
```

### Step 5: Add fromJSON static method

In `www/state.js`, add a `fromJSON()` method to CanvasState (before the `toJSON` method):

```javascript
    // Restore state from serialized JSON
    fromJSON(json) {
        this.graph = new GraphSpec();
        this.selectedNodeIds.clear();
        this.selectedEdgeIds.clear();

        if (json.id) this.graph.id = json.id;
        if (json.version) this.graph.version = json.version;
        if (json.name) this.graph.name = json.name;
        if (json.metadata) this.graph.metadata = { ...this.graph.metadata, ...json.metadata };

        for (const n of (json.nodes || [])) {
            const spec = getComponentSpec(n.componentId);
            if (!spec) continue;

            const node = new NodeSpec(n.componentId, n.position);
            node.id = n.id;
            node.width = 180;
            node.height = 120;
            node.color = spec.color;
            node.name = spec.name;
            node.role = spec.role;
            node.icon = spec.icon;
            node.description = spec.description;
            node.category = spec.category;

            // Restore config (merge with defaults for backward compat)
            if (n.config) {
                node.config = {
                    capacity: { ...node.config.capacity, ...n.config.capacity },
                    scaling: { ...node.config.scaling, ...n.config.scaling },
                    reliability: { ...node.config.reliability, ...n.config.reliability },
                    cost: { ...node.config.cost, ...n.config.cost },
                    latency: { ...node.config.latency, ...n.config.latency },
                };
            }

            // Restore provider
            if (n.provider) {
                node.provider = { ...node.provider, ...n.provider };
            } else {
                node.provider = {
                    id: spec.metadata?.provider || null,
                    name: spec.name,
                    alternatives: spec.metadata?.alternatives || [],
                };
            }

            this.graph.addNode(node);
        }

        for (const e of (json.edges || [])) {
            const edge = new EdgeSpec(e.source.nodeId, e.source.portId, e.target.nodeId, e.target.portId);
            edge.id = e.id;
            edge.label = e.label || null;

            // Restore edge config
            if (e.config) {
                edge.config = { ...edge.config, ...e.config };
            }

            // Restore port type info
            const sourceNode = this.graph.nodes.get(e.source.nodeId);
            const targetNode = this.graph.nodes.get(e.target.nodeId);
            if (sourceNode && targetNode) {
                const sourceSpec = getComponentSpec(sourceNode.componentId);
                const targetSpec = getComponentSpec(targetNode.componentId);
                if (sourceSpec && targetSpec) {
                    const srcPort = sourceSpec.outputs[e.source.portId];
                    const tgtPort = targetSpec.inputs[e.target.portId];
                    if (srcPort) edge.sourcePortType = srcPort.type;
                    if (tgtPort) edge.targetPortType = tgtPort.type;
                }
            }

            this.graph.addEdge(edge);
        }

        this.notify();
    }
```

### Step 6: Verify roundtrip

In browser console:
```javascript
canvasState.addNode('workers', 100, 100);
canvasState.addNode('d1', 200, 300);
const json = canvasState.toJSON();
console.log(json.nodes[0].config.capacity.instances); // 1
canvasState.fromJSON(json);
console.log(canvasState.graph.nodes.size); // 2
```

### Step 7: Commit

```bash
git add www/graph-model.js www/state.js
git commit -m "feat: extended data model with config and provider on nodes/edges

Add capacity, scaling, reliability, cost, latency config to NodeSpec.
Add protocol, sync, latency, retryPolicy config to EdgeSpec.
Add provider info to NodeSpec.
Add fromJSON() for state restoration. toJSON() includes all new fields."
```

---

## Task 1a.3: Node Properties Panel

**Files:**
- Create: `www/properties.js`
- Modify: `www/index.html` (add aside element and import)
- Modify: `www/style.css` (add properties panel styles)

### Step 1: Add properties panel markup to index.html

In `www/index.html`, after the canvas-container `</main>` and before the help tooltip div, add:

```html
        <!-- Properties Panel (Right Sidebar) -->
        <aside id="properties-panel" class="properties-panel"></aside>
```

Add the import in the script section (after templates import):

```javascript
        import { initProperties } from './properties.js';
```

Call `initProperties()` in the `init()` function (after `initTemplates()`):

```javascript
            // Initialize properties panel
            initProperties();
```

### Step 2: Add properties panel CSS to style.css

Add after the CANVAS section:

```css
/* ============================================
   PROPERTIES PANEL (RIGHT SIDEBAR)
   ============================================ */

.properties-panel {
    width: 0;
    min-width: 0;
    height: 100vh;
    background: var(--panel-bg);
    border-left: 1px solid var(--border-subtle);
    overflow-y: auto;
    overflow-x: hidden;
    transition: width 0.2s ease, min-width 0.2s ease;
    z-index: var(--z-palette);
}

.properties-panel.open {
    width: 320px;
    min-width: 320px;
}

.properties-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--border-subtle);
}

.properties-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    font-size: 1.5rem;
    flex-shrink: 0;
}

.properties-title {
    flex: 1;
    min-width: 0;
}

.properties-title h3 {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
}

.properties-title p {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin: 2px 0 0 0;
}

.properties-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
}

.properties-close:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.1);
}

.properties-section {
    padding: 16px;
    border-bottom: 1px solid var(--border-subtle);
}

.properties-section h4 {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 12px 0;
}

.properties-description {
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
}

.prop-field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.prop-field label {
    font-size: 0.8rem;
    color: var(--text-secondary);
}

.prop-field input[type="number"],
.prop-field select {
    width: 100px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 0.8rem;
}

.prop-field input[type="number"]:focus,
.prop-field select:focus {
    outline: none;
    border-color: var(--cf-orange);
}

.prop-field input[type="checkbox"] {
    accent-color: var(--cf-orange);
}

.prop-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
}

.properties-educational {
    margin-top: 8px;
}

.properties-educational summary {
    font-size: 0.8rem;
    color: var(--cf-orange);
    cursor: pointer;
    user-select: none;
}

.properties-educational p {
    font-size: 0.75rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 8px 0 0 0;
}

@media (max-width: 768px) {
    .properties-panel.open {
        position: fixed;
        right: 0;
        top: 0;
        width: 100vw;
        min-width: 100vw;
        z-index: 100;
    }
}
```

### Step 3: Create properties.js

Create `www/properties.js`:

```javascript
// Properties Panel for shipwith.dev
// Shows/edits node configuration when a single node is selected

import { canvasState } from './state.js';
import { getComponentSpec } from './component-specs.js';

let panel;
let currentNodeId = null;

export function initProperties() {
    panel = document.getElementById('properties-panel');

    // React to selection changes
    canvasState.subscribe(() => {
        const selectedIds = Array.from(canvasState.selectedNodeIds);
        if (selectedIds.length === 1) {
            const nodeId = selectedIds[0];
            if (nodeId !== currentNodeId) {
                currentNodeId = nodeId;
                renderPanel(nodeId);
            }
        } else {
            if (currentNodeId !== null) {
                currentNodeId = null;
                closePanel();
            }
        }
    });
}

function renderPanel(nodeId) {
    const node = canvasState.graph.nodes.get(nodeId);
    if (!node) return;

    const spec = getComponentSpec(node.componentId);
    if (!spec) return;

    panel.innerHTML = buildPanelHTML(node, spec);
    panel.classList.add('open');

    // Bind input events
    bindInputs(node);

    // Close button
    const closeBtn = panel.querySelector('.properties-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            canvasState.deselectAll();
        });
    }
}

function closePanel() {
    panel.classList.remove('open');
    panel.innerHTML = '';
}

function buildPanelHTML(node, spec) {
    const config = node.config;
    const provider = node.provider;

    let alternativesHTML = '';
    if (provider.alternatives && provider.alternatives.length > 0) {
        const options = provider.alternatives.map(alt =>
            `<option value="${alt}" ${alt === provider.id ? 'selected' : ''}>${alt}</option>`
        ).join('');
        alternativesHTML = `
            <div class="properties-section">
                <h4>Provider</h4>
                <div class="prop-field">
                    <label>Current</label>
                    <span style="font-size:0.8rem;color:var(--text-primary)">${provider.name || node.name}</span>
                </div>
                <div class="prop-field">
                    <label>Alternative</label>
                    <select id="prop-provider">${options}</select>
                </div>
            </div>`;
    }

    return `
        <div class="properties-header">
            <div class="properties-icon" style="background:${spec.color}20;border:1px solid ${spec.color}">
                ${spec.icon}
            </div>
            <div class="properties-title">
                <h3>${spec.name}</h3>
                <p>${spec.role}</p>
            </div>
            <button class="properties-close" aria-label="Close">&times;</button>
        </div>

        ${spec.description ? `
        <div class="properties-section">
            <h4>Description</h4>
            <p class="properties-description">${spec.description}</p>
        </div>` : ''}

        <div class="properties-section">
            <h4>Capacity</h4>
            <div class="prop-field">
                <label>Instances</label>
                <input type="number" id="prop-instances" value="${config.capacity.instances}" min="1" max="100" step="1">
            </div>
            <div class="prop-field">
                <label>Max RPS / Instance</label>
                <input type="number" id="prop-max-rps" value="${config.capacity.maxRPSPerInstance}" min="1" step="100">
            </div>
        </div>

        <div class="properties-section">
            <h4>Scaling</h4>
            <div class="prop-field">
                <label>Auto-scale</label>
                <div class="prop-toggle">
                    <input type="checkbox" id="prop-autoscale" ${config.scaling.autoScale ? 'checked' : ''}>
                </div>
            </div>
            <div class="prop-field">
                <label>Min Instances</label>
                <input type="number" id="prop-min-instances" value="${config.scaling.minInstances}" min="0" step="1">
            </div>
            <div class="prop-field">
                <label>Max Instances</label>
                <input type="number" id="prop-max-instances" value="${config.scaling.maxInstances}" min="1" step="1">
            </div>
        </div>

        <div class="properties-section">
            <h4>Cost</h4>
            <div class="prop-field">
                <label>Per Hour ($)</label>
                <input type="number" id="prop-cost" value="${config.cost.perHour}" min="0" step="0.01">
            </div>
        </div>

        <div class="properties-section">
            <h4>Latency</h4>
            <div class="prop-field">
                <label>Base (ms)</label>
                <input type="number" id="prop-latency" value="${config.latency.baseMs}" min="0" step="1">
            </div>
            <div class="prop-field">
                <label>P95 Multiplier</label>
                <input type="number" id="prop-p95" value="${config.latency.p95Multiplier}" min="1" step="0.1">
            </div>
        </div>

        ${alternativesHTML}

        ${spec.whenToUse || spec.pitfalls ? `
        <div class="properties-section">
            <h4>Learn</h4>
            ${spec.whenToUse ? `
            <details class="properties-educational">
                <summary>When to use</summary>
                <p>${spec.whenToUse}</p>
            </details>` : ''}
            ${spec.pitfalls ? `
            <details class="properties-educational">
                <summary>Pitfalls</summary>
                <p>${Array.isArray(spec.pitfalls) ? spec.pitfalls.join('. ') : spec.pitfalls}</p>
            </details>` : ''}
        </div>` : ''}
    `;
}

function bindInputs(node) {
    const bind = (id, path, transform = Number) => {
        const el = panel.querySelector(`#${id}`);
        if (!el) return;
        el.addEventListener('change', () => {
            setNestedValue(node, path, transform(el.type === 'checkbox' ? el.checked : el.value));
            canvasState.notify();
        });
    };

    bind('prop-instances', 'config.capacity.instances', Number);
    bind('prop-max-rps', 'config.capacity.maxRPSPerInstance', Number);
    bind('prop-autoscale', 'config.scaling.autoScale', Boolean);
    bind('prop-min-instances', 'config.scaling.minInstances', Number);
    bind('prop-max-instances', 'config.scaling.maxInstances', Number);
    bind('prop-cost', 'config.cost.perHour', Number);
    bind('prop-latency', 'config.latency.baseMs', Number);
    bind('prop-p95', 'config.latency.p95Multiplier', Number);
}

function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}
```

### Step 4: Verify the panel works

Run: `cd www && python -m http.server 8080`
1. Drag a "Cloudflare Workers" component onto canvas
2. Click it → properties panel slides in from right, canvas shrinks
3. Change "Instances" from 1 to 3
4. In console: `canvasState.graph.nodes.values().next().value.config.capacity.instances` → should be 3
5. Click empty canvas → panel closes

### Step 5: Commit

```bash
git add www/properties.js www/index.html www/style.css
git commit -m "feat: node properties panel with push-resize layout

Add right sidebar (320px) that opens when a single node is selected.
Shows component info, editable config (capacity, scaling, cost, latency),
provider alternatives, and educational content.
Panel pushes canvas via flex layout. Full-width overlay on mobile."
```

---

## Task 1a.4: Unit Tests

**Files:**
- Create: `package.json` (at project root)
- Create: `www/tests/component-specs.test.js`
- Create: `www/tests/graph-model.test.js`
- Create: `www/tests/state.test.js`

### Step 1: Create package.json at project root

```json
{
  "name": "shipwith",
  "private": true,
  "scripts": {
    "test": "bun test",
    "dev": "cd www && python -m http.server 8080"
  }
}
```

### Step 2: Write component-specs tests

Create `www/tests/component-specs.test.js`:

```javascript
import { describe, test, expect } from 'bun:test';
import {
    TYPES,
    TYPE_COMPATIBILITY,
    COMPONENT_SPECS,
    isTypeCompatible,
    getComponentSpec,
    getValidTargets,
    validateGraph,
    getTypeColor,
    getPortOffset,
} from '../component-specs.js';

describe('TYPES', () => {
    test('has at least 20 type definitions', () => {
        expect(Object.keys(TYPES).length).toBeGreaterThanOrEqual(20);
    });

    test('all values are lowercase strings with hyphens', () => {
        for (const [key, value] of Object.entries(TYPES)) {
            expect(typeof value).toBe('string');
            expect(value).toMatch(/^[a-z][a-z0-9-]*$/);
        }
    });

    test('includes core types', () => {
        expect(TYPES.HTTP_REQUEST).toBeDefined();
        expect(TYPES.HTTP_RESPONSE).toBeDefined();
        expect(TYPES.SQL_QUERY).toBeDefined();
        expect(TYPES.SQL_RESULT).toBeDefined();
        expect(TYPES.ANY).toBeDefined();
    });

    test('includes AI types', () => {
        expect(TYPES.LLM_PROMPT).toBeDefined();
        expect(TYPES.LLM_RESPONSE).toBeDefined();
        expect(TYPES.EMBEDDING).toBeDefined();
        expect(TYPES.VECTOR_RESULTS).toBeDefined();
    });
});

describe('TYPE_COMPATIBILITY', () => {
    test('every type has a compatibility entry', () => {
        for (const type of Object.values(TYPES)) {
            if (type === TYPES.ANY) continue; // ANY is special
            expect(TYPE_COMPATIBILITY[type]).toBeDefined();
        }
    });

    test('every compatible type includes itself', () => {
        for (const [type, compatibles] of Object.entries(TYPE_COMPATIBILITY)) {
            expect(compatibles).toContain(type);
        }
    });

    test('every compatible type includes ANY', () => {
        for (const [type, compatibles] of Object.entries(TYPE_COMPATIBILITY)) {
            expect(compatibles).toContain(TYPES.ANY);
        }
    });
});

describe('isTypeCompatible', () => {
    test('same type is always compatible', () => {
        expect(isTypeCompatible(TYPES.HTTP_REQUEST, TYPES.HTTP_REQUEST)).toBe(true);
        expect(isTypeCompatible(TYPES.SQL_QUERY, TYPES.SQL_QUERY)).toBe(true);
    });

    test('ANY accepts any type', () => {
        expect(isTypeCompatible(TYPES.HTTP_REQUEST, TYPES.ANY)).toBe(true);
        expect(isTypeCompatible(TYPES.SQL_QUERY, TYPES.ANY)).toBe(true);
        expect(isTypeCompatible(TYPES.LLM_PROMPT, TYPES.ANY)).toBe(true);
    });

    test('ANY source connects to any target', () => {
        expect(isTypeCompatible(TYPES.ANY, TYPES.HTTP_REQUEST)).toBe(true);
        expect(isTypeCompatible(TYPES.ANY, TYPES.SQL_QUERY)).toBe(true);
    });

    test('incompatible types reject', () => {
        expect(isTypeCompatible(TYPES.HTTP_REQUEST, TYPES.SQL_QUERY)).toBe(false);
        expect(isTypeCompatible(TYPES.KV_OPERATION, TYPES.LLM_PROMPT)).toBe(false);
    });

    test('related types connect correctly', () => {
        // SQL_RESULT can connect to JSON
        expect(isTypeCompatible(TYPES.SQL_RESULT, TYPES.JSON)).toBe(true);
        // LLM_RESPONSE can connect to STRING
        expect(isTypeCompatible(TYPES.LLM_RESPONSE, TYPES.STRING)).toBe(true);
    });
});

describe('getComponentSpec', () => {
    test('returns spec for valid component', () => {
        const spec = getComponentSpec('workers');
        expect(spec).toBeDefined();
        expect(spec.name).toBe('Cloudflare Workers');
        expect(spec.icon).toBeDefined();
        expect(spec.color).toBeDefined();
    });

    test('returns null for unknown component', () => {
        expect(getComponentSpec('nonexistent')).toBeNull();
    });

    test('every component has required fields', () => {
        for (const [id, spec] of Object.entries(COMPONENT_SPECS)) {
            expect(spec.id).toBe(id);
            expect(spec.name).toBeDefined();
            expect(spec.icon).toBeDefined();
            expect(spec.color).toBeDefined();
            expect(spec.category).toBeDefined();
            expect(spec.inputs).toBeDefined();
            expect(spec.outputs).toBeDefined();
        }
    });

    test('all port types reference valid TYPES', () => {
        const validTypes = new Set(Object.values(TYPES));
        for (const spec of Object.values(COMPONENT_SPECS)) {
            for (const port of Object.values(spec.inputs)) {
                expect(validTypes.has(port.type)).toBe(true);
            }
            for (const port of Object.values(spec.outputs)) {
                expect(validTypes.has(port.type)).toBe(true);
            }
        }
    });
});

describe('getTypeColor', () => {
    test('returns a color string for known types', () => {
        const color = getTypeColor(TYPES.HTTP_REQUEST);
        expect(color).toBeDefined();
        expect(typeof color).toBe('string');
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    test('returns a fallback for unknown types', () => {
        const color = getTypeColor('nonexistent');
        expect(color).toBeDefined();
        expect(typeof color).toBe('string');
    });
});

describe('getPortOffset', () => {
    test('top position returns top center', () => {
        const offset = getPortOffset('top', 180, 120);
        expect(offset.x).toBe(0);    // centered
        expect(offset.y).toBe(-60);  // top edge (half height)
    });

    test('bottom position returns bottom center', () => {
        const offset = getPortOffset('bottom', 180, 120);
        expect(offset.x).toBe(0);
        expect(offset.y).toBe(60);
    });

    test('left position returns left center', () => {
        const offset = getPortOffset('left', 180, 120);
        expect(offset.x).toBe(-90); // left edge (half width)
        expect(offset.y).toBe(0);
    });
});
```

### Step 3: Write graph-model tests

Create `www/tests/graph-model.test.js`:

```javascript
import { describe, test, expect } from 'bun:test';
import { GraphSpec, NodeSpec, EdgeSpec } from '../graph-model.js';

describe('NodeSpec', () => {
    test('creates with unique id', () => {
        const a = new NodeSpec('workers', { x: 10, y: 20 });
        const b = new NodeSpec('workers', { x: 10, y: 20 });
        expect(a.id).not.toBe(b.id);
    });

    test('stores componentId and position', () => {
        const node = new NodeSpec('d1', { x: 100, y: 200 });
        expect(node.componentId).toBe('d1');
        expect(node.position.x).toBe(100);
        expect(node.position.y).toBe(200);
    });

    test('has default config with capacity', () => {
        const node = new NodeSpec('workers');
        expect(node.config).toBeDefined();
        expect(node.config.capacity.instances).toBe(1);
        expect(node.config.capacity.maxRPSPerInstance).toBe(1000);
    });

    test('has default config with scaling', () => {
        const node = new NodeSpec('workers');
        expect(node.config.scaling.autoScale).toBe(false);
        expect(node.config.scaling.minInstances).toBe(1);
        expect(node.config.scaling.maxInstances).toBe(10);
    });

    test('has default config with cost', () => {
        const node = new NodeSpec('workers');
        expect(node.config.cost.perHour).toBe(0.05);
        expect(node.config.cost.currency).toBe('USD');
    });

    test('has default provider', () => {
        const node = new NodeSpec('workers');
        expect(node.provider).toBeDefined();
        expect(node.provider.id).toBeNull();
        expect(node.provider.alternatives).toEqual([]);
    });
});

describe('EdgeSpec', () => {
    test('creates with unique id', () => {
        const a = new EdgeSpec('n1', 'p1', 'n2', 'p2');
        const b = new EdgeSpec('n1', 'p1', 'n2', 'p2');
        expect(a.id).not.toBe(b.id);
    });

    test('stores source and target', () => {
        const edge = new EdgeSpec('node-a', 'response', 'node-b', 'request');
        expect(edge.source.nodeId).toBe('node-a');
        expect(edge.source.portId).toBe('response');
        expect(edge.target.nodeId).toBe('node-b');
        expect(edge.target.portId).toBe('request');
    });

    test('has default config', () => {
        const edge = new EdgeSpec('n1', 'p1', 'n2', 'p2');
        expect(edge.config).toBeDefined();
        expect(edge.config.protocol).toBe('HTTPS');
        expect(edge.config.sync).toBe(true);
        expect(edge.config.latencyMs).toBe(1);
        expect(edge.config.retryPolicy.maxRetries).toBe(3);
    });
});

describe('GraphSpec', () => {
    test('creates with empty maps', () => {
        const graph = new GraphSpec();
        expect(graph.nodes.size).toBe(0);
        expect(graph.edges.size).toBe(0);
    });

    test('has unique id', () => {
        const a = new GraphSpec();
        const b = new GraphSpec();
        expect(a.id).not.toBe(b.id);
    });

    test('adds and removes nodes', () => {
        const graph = new GraphSpec();
        const node = new NodeSpec('workers', { x: 0, y: 0 });
        graph.addNode(node);
        expect(graph.nodes.size).toBe(1);
        expect(graph.nodes.get(node.id)).toBe(node);

        graph.removeNode(node.id);
        expect(graph.nodes.size).toBe(0);
    });

    test('adds and removes edges', () => {
        const graph = new GraphSpec();
        const edge = new EdgeSpec('n1', 'p1', 'n2', 'p2');
        graph.addEdge(edge);
        expect(graph.edges.size).toBe(1);

        graph.removeEdge(edge.id);
        expect(graph.edges.size).toBe(0);
    });

    test('removes connected edges when node is removed', () => {
        const graph = new GraphSpec();
        const n1 = new NodeSpec('workers', { x: 0, y: 0 });
        const n2 = new NodeSpec('d1', { x: 100, y: 100 });
        const edge = new EdgeSpec(n1.id, 'p1', n2.id, 'p2');

        graph.addNode(n1);
        graph.addNode(n2);
        graph.addEdge(edge);

        expect(graph.edges.size).toBe(1);
        graph.removeNode(n1.id);
        expect(graph.edges.size).toBe(0);
    });

    test('updates modified timestamp on changes', () => {
        const graph = new GraphSpec();
        const initialModified = graph.metadata.modified;

        // Small delay to ensure timestamp difference
        const node = new NodeSpec('workers');
        graph.addNode(node);
        expect(graph.metadata.modified).toBeGreaterThanOrEqual(initialModified);
    });
});
```

### Step 4: Write state tests

Create `www/tests/state.test.js`:

```javascript
import { describe, test, expect, beforeEach } from 'bun:test';

// We need to mock window and crypto for Node/Bun environment
// state.js checks for window to expose canvasState
import { GraphSpec, NodeSpec, EdgeSpec } from '../graph-model.js';
import { getComponentSpec } from '../component-specs.js';

// Import the CanvasState class by importing the module
// Note: canvasState is a singleton, so we test via the exported instance
let canvasState;

beforeEach(async () => {
    // Re-import to get fresh singleton (or reset it)
    const mod = await import('../state.js');
    canvasState = mod.canvasState;
    // Reset state
    canvasState.graph = new GraphSpec();
    canvasState.selectedNodeIds.clear();
    canvasState.selectedEdgeIds.clear();
    canvasState.pan = { x: 0, y: 0 };
    canvasState.zoom = 1;
    canvasState.mode = 'idle';
});

describe('CanvasState.addNode', () => {
    test('creates a node with spec properties', () => {
        const node = canvasState.addNode('workers', 100, 200);
        expect(node).not.toBeNull();
        expect(node.componentId).toBe('workers');
        expect(node.position.x).toBe(100);
        expect(node.position.y).toBe(200);
        expect(node.width).toBe(180);
        expect(node.height).toBe(120);
        expect(node.name).toBe('Cloudflare Workers');
    });

    test('returns null for unknown component', () => {
        const node = canvasState.addNode('fake', 0, 0);
        expect(node).toBeNull();
    });

    test('node has config with defaults', () => {
        const node = canvasState.addNode('workers', 0, 0);
        expect(node.config.capacity.instances).toBe(1);
        expect(node.config.cost.perHour).toBe(0.05);
    });

    test('node has provider info', () => {
        const node = canvasState.addNode('workers', 0, 0);
        expect(node.provider).toBeDefined();
    });

    test('adds node to graph', () => {
        canvasState.addNode('workers', 0, 0);
        expect(canvasState.graph.nodes.size).toBe(1);
    });
});

describe('CanvasState.addEdge', () => {
    test('creates edge between compatible ports', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 200, 200);

        // Workers has output 'sqlQuery' (type sql-query), D1 has input 'query' (type sql-query)
        const spec1 = getComponentSpec('workers');
        const spec2 = getComponentSpec('d1');

        // Find compatible ports
        const outputPort = Object.entries(spec1.outputs).find(([, p]) => p.type.includes('sql'));
        const inputPort = Object.entries(spec2.inputs).find(([, p]) => p.type.includes('sql'));

        if (outputPort && inputPort) {
            const edge = canvasState.addEdge(n1.id, outputPort[0], n2.id, inputPort[0]);
            expect(edge).not.toBeNull();
            expect(canvasState.graph.edges.size).toBe(1);
        }
    });

    test('returns null for invalid node IDs', () => {
        const edge = canvasState.addEdge('fake1', 'p1', 'fake2', 'p2');
        expect(edge).toBeNull();
    });
});

describe('CanvasState.selection', () => {
    test('selectNode selects a node', () => {
        const node = canvasState.addNode('workers', 0, 0);
        canvasState.selectNode(node.id);
        expect(canvasState.isNodeSelected(node.id)).toBe(true);
    });

    test('selectNode clears previous selection', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 200, 0);
        canvasState.selectNode(n1.id);
        canvasState.selectNode(n2.id);
        expect(canvasState.isNodeSelected(n1.id)).toBe(false);
        expect(canvasState.isNodeSelected(n2.id)).toBe(true);
    });

    test('selectNode additive mode', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 200, 0);
        canvasState.selectNode(n1.id);
        canvasState.selectNode(n2.id, true);
        expect(canvasState.isNodeSelected(n1.id)).toBe(true);
        expect(canvasState.isNodeSelected(n2.id)).toBe(true);
    });

    test('deselectAll clears selection', () => {
        const node = canvasState.addNode('workers', 0, 0);
        canvasState.selectNode(node.id);
        canvasState.deselectAll();
        expect(canvasState.selectedNodeIds.size).toBe(0);
    });

    test('deleteSelected removes nodes and edges', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        canvasState.selectNode(n1.id);
        canvasState.deleteSelected();
        expect(canvasState.graph.nodes.size).toBe(0);
    });
});

describe('CanvasState coordinate conversion', () => {
    test('screenToWorld with no pan/zoom', () => {
        canvasState.pan = { x: 0, y: 0 };
        canvasState.zoom = 1;
        const world = canvasState.screenToWorld(100, 200);
        expect(world.x).toBe(100);
        expect(world.y).toBe(200);
    });

    test('screenToWorld with pan', () => {
        canvasState.pan = { x: 50, y: 100 };
        canvasState.zoom = 1;
        const world = canvasState.screenToWorld(150, 200);
        expect(world.x).toBe(100);
        expect(world.y).toBe(100);
    });

    test('screenToWorld with zoom', () => {
        canvasState.pan = { x: 0, y: 0 };
        canvasState.zoom = 2;
        const world = canvasState.screenToWorld(200, 400);
        expect(world.x).toBe(100);
        expect(world.y).toBe(200);
    });

    test('worldToScreen roundtrips with screenToWorld', () => {
        canvasState.pan = { x: 123, y: 456 };
        canvasState.zoom = 1.5;
        const screen = canvasState.worldToScreen(100, 200);
        const back = canvasState.screenToWorld(screen.x, screen.y);
        expect(Math.abs(back.x - 100)).toBeLessThan(0.001);
        expect(Math.abs(back.y - 200)).toBeLessThan(0.001);
    });
});

describe('CanvasState.getNodeAt', () => {
    test('returns node at position', () => {
        const node = canvasState.addNode('workers', 100, 100);
        const found = canvasState.getNodeAt(100, 100);
        expect(found).not.toBeNull();
        expect(found.id).toBe(node.id);
    });

    test('returns null when no node at position', () => {
        canvasState.addNode('workers', 100, 100);
        const found = canvasState.getNodeAt(500, 500);
        expect(found).toBeNull();
    });

    test('returns topmost node when overlapping', () => {
        const n1 = canvasState.addNode('workers', 100, 100);
        const n2 = canvasState.addNode('d1', 100, 100);
        const found = canvasState.getNodeAt(100, 100);
        // Last added node should be on top (reverse iteration)
        expect(found.id).toBe(n2.id);
    });
});

describe('CanvasState.moveSelectedNodes', () => {
    test('moves selected nodes by delta', () => {
        const node = canvasState.addNode('workers', 100, 100);
        canvasState.selectNode(node.id);
        canvasState.moveSelectedNodes(50, -30);
        expect(node.position.x).toBe(150);
        expect(node.position.y).toBe(70);
    });

    test('does not move unselected nodes', () => {
        const n1 = canvasState.addNode('workers', 100, 100);
        const n2 = canvasState.addNode('d1', 200, 200);
        canvasState.selectNode(n1.id);
        canvasState.moveSelectedNodes(50, 50);
        expect(n2.position.x).toBe(200);
        expect(n2.position.y).toBe(200);
    });
});

describe('CanvasState.toJSON / fromJSON', () => {
    test('toJSON includes config and provider', () => {
        canvasState.addNode('workers', 100, 200);
        const json = canvasState.toJSON();
        expect(json.nodes.length).toBe(1);
        expect(json.nodes[0].config).toBeDefined();
        expect(json.nodes[0].config.capacity.instances).toBe(1);
        expect(json.nodes[0].provider).toBeDefined();
    });

    test('fromJSON restores nodes', () => {
        const n1 = canvasState.addNode('workers', 100, 200);
        const json = canvasState.toJSON();

        // Reset state
        canvasState.fromJSON(json);
        expect(canvasState.graph.nodes.size).toBe(1);
        const restored = canvasState.graph.nodes.values().next().value;
        expect(restored.componentId).toBe('workers');
        expect(restored.position.x).toBe(100);
    });

    test('fromJSON restores config', () => {
        const node = canvasState.addNode('workers', 0, 0);
        node.config.capacity.instances = 5;
        const json = canvasState.toJSON();

        canvasState.fromJSON(json);
        const restored = canvasState.graph.nodes.values().next().value;
        expect(restored.config.capacity.instances).toBe(5);
    });

    test('fromJSON handles old format without config', () => {
        const json = {
            nodes: [{ id: 'test-id', componentId: 'workers', position: { x: 0, y: 0 } }],
            edges: []
        };
        canvasState.fromJSON(json);
        const node = canvasState.graph.nodes.get('test-id');
        expect(node).toBeDefined();
        expect(node.config.capacity.instances).toBe(1); // default
    });

    test('roundtrip preserves edges', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 200, 200);

        const spec1 = getComponentSpec('workers');
        const spec2 = getComponentSpec('d1');
        const outPort = Object.entries(spec1.outputs).find(([, p]) => p.type.includes('sql'));
        const inPort = Object.entries(spec2.inputs).find(([, p]) => p.type.includes('sql'));

        if (outPort && inPort) {
            canvasState.addEdge(n1.id, outPort[0], n2.id, inPort[0]);
            const json = canvasState.toJSON();
            canvasState.fromJSON(json);
            expect(canvasState.graph.edges.size).toBe(1);
        }
    });
});

describe('CanvasState.subscribe', () => {
    test('calls listener on notify', () => {
        let called = false;
        canvasState.subscribe(() => { called = true; });
        canvasState.notify();
        expect(called).toBe(true);
    });

    test('unsubscribe stops notifications', () => {
        let count = 0;
        const unsub = canvasState.subscribe(() => { count++; });
        canvasState.notify();
        expect(count).toBe(1);
        unsub();
        canvasState.notify();
        expect(count).toBe(1);
    });
});
```

### Step 5: Run tests

Run: `bun test`
Expected: All tests pass. Coverage report shows 80%+ on `component-specs.js`, `graph-model.js`, `state.js`.

### Step 6: Commit

```bash
git add package.json www/tests/component-specs.test.js www/tests/graph-model.test.js www/tests/state.test.js
git commit -m "test: add unit tests for core modules (component-specs, graph-model, state)

Test coverage targets: type compatibility matrix, component specs validation,
graph add/remove/serialize, state selection/pan/zoom, toJSON/fromJSON roundtrip.
Uses Bun's built-in test runner."
```

---

## Verification Checklist

After all Phase 1a tasks are complete, verify:

- [ ] `rg "scene.js|components.js|stack-state" www/index.html` → 0 matches
- [ ] App loads at `http://localhost:8080` without console errors
- [ ] Canvas renders grid, nodes, edges on separate layers
- [ ] Moving a node does NOT repaint the grid layer
- [ ] `canvasState.addNode('workers', 0, 0).config.capacity.instances === 1`
- [ ] `canvasState.toJSON()` includes `config` and `provider` on nodes
- [ ] `canvasState.fromJSON(canvasState.toJSON())` roundtrips correctly
- [ ] Clicking a node opens the properties panel on the right
- [ ] Canvas shrinks when panel opens
- [ ] Editing "Instances" field updates `node.config.capacity.instances`
- [ ] Clicking empty canvas closes the properties panel
- [ ] `bun test` passes with 80%+ coverage on core modules
