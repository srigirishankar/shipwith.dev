// Canvas rendering and interaction for Visual Architecture Canvas
// Multi-layer canvas: grid, edges, nodes, overlay
// Each layer has independent dirty-flag rendering

import { canvasState } from './state.js';
import { getComponentSpec, isTypeCompatible, getTypeColor } from './component-specs.js';

// 4 canvas/context pairs
let gridCanvas, gridCtx;
let edgesCanvas, edgesCtx;
let nodesCanvas, nodesCtx;
let overlayCanvas, overlayCtx;

let container = null;
let animationFrameId = null;
let resizeObserver = null;

// Dirty flags (overlay always redraws)
let gridDirty = true;
let edgesDirty = true;
let nodesDirty = true;

// Grid settings
const GRID_SIZE = 40;
const GRID_COLOR = 'rgba(255, 255, 255, 0.05)';
const GRID_ACCENT_COLOR = 'rgba(255, 255, 255, 0.1)';
const GRID_ACCENT_EVERY = 5;

// Context menu handler (named so it can be removed)
function preventContextMenu(e) { e.preventDefault(); }

// Interaction state
let isPanning = false;
let isSpaceDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
let hoveredPort = null;

// ─── Dirty-flag helpers ──────────────────────────────────────────

function markAllDirty() {
    gridDirty = true;
    edgesDirty = true;
    nodesDirty = true;
}

function markNodesDirty() {
    nodesDirty = true;
}

function markEdgesDirty() {
    edgesDirty = true;
}

function markNodesAndEdgesDirty() {
    nodesDirty = true;
    edgesDirty = true;
}

// ─── Initialization ──────────────────────────────────────────────

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

    // Observe container size changes (e.g. properties panel open/close)
    resizeObserver = new ResizeObserver(() => {
        resizeCanvas();
        markAllDirty();
    });
    resizeObserver.observe(container);

    // Center the view initially (use nodesCanvas for dimensions, all are same size)
    canvasState.pan.x = nodesCanvas.width / (window.devicePixelRatio || 1) / 2;
    canvasState.pan.y = nodesCanvas.height / (window.devicePixelRatio || 1) / 2;

    setupEventListeners();

    // Subscribe to canvasState changes to auto-mark dirty flags
    canvasState.subscribe(() => {
        markNodesAndEdgesDirty();
    });

    markAllDirty();
    startRenderLoop();

    return { canvas: nodesCanvas, ctx: nodesCtx };
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    const canvases = [gridCanvas, edgesCanvas, nodesCanvas, overlayCanvas];

    for (const cvs of canvases) {
        cvs.width = rect.width * dpr;
        cvs.height = rect.height * dpr;
        cvs.style.width = rect.width + 'px';
        cvs.style.height = rect.height + 'px';
    }

    // Setting canvas.width/height resets context state, so re-acquire contexts
    gridCtx = gridCanvas.getContext('2d');
    edgesCtx = edgesCanvas.getContext('2d');
    nodesCtx = nodesCanvas.getContext('2d');
    overlayCtx = overlayCanvas.getContext('2d');

    // Apply DPR scaling via setTransform (not cumulative like scale())
    gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    edgesCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nodesCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    markAllDirty();
}

// ─── Event listeners ─────────────────────────────────────────────
// All events attach to nodesCanvas (the interactive layer, z-index: 3)

function setupEventListeners() {
    nodesCanvas.addEventListener('mousedown', handleMouseDown);
    nodesCanvas.addEventListener('mousemove', handleMouseMove);
    nodesCanvas.addEventListener('mouseup', handleMouseUp);
    nodesCanvas.addEventListener('mouseleave', handleMouseUp);
    nodesCanvas.addEventListener('wheel', handleWheel, { passive: false });
    nodesCanvas.addEventListener('contextmenu', preventContextMenu);

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
        // moveSelectedNodes calls notify() which triggers our subscriber
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

        // Wire preview changes need nodes dirty too (for port highlight)
        markNodesDirty();
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
            // deleteSelected calls notify() which triggers our subscriber
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

// ─── Edge hit testing ────────────────────────────────────────────

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

// ─── Render loop ─────────────────────────────────────────────────

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

export function destroyCanvas() {
    stopRenderLoop();

    // Remove canvas event listeners
    if (nodesCanvas) {
        nodesCanvas.removeEventListener('mousedown', handleMouseDown);
        nodesCanvas.removeEventListener('mousemove', handleMouseMove);
        nodesCanvas.removeEventListener('mouseup', handleMouseUp);
        nodesCanvas.removeEventListener('mouseleave', handleMouseUp);
        nodesCanvas.removeEventListener('wheel', handleWheel);
        nodesCanvas.removeEventListener('contextmenu', preventContextMenu);
        nodesCanvas.removeEventListener('touchstart', handleTouchStart);
        nodesCanvas.removeEventListener('touchmove', handleTouchMove);
        nodesCanvas.removeEventListener('touchend', handleTouchEnd);
    }

    // Remove window event listeners
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('resize', resizeCanvas);

    // Disconnect ResizeObserver
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
}

// ─── Main draw function (dirty-flag gated) ───────────────────────

function draw() {
    const rect = nodesCanvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Grid layer
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

    // Edges layer
    if (edgesDirty) {
        edgesCtx.clearRect(0, 0, width, height);
        edgesCtx.save();
        edgesCtx.translate(canvasState.pan.x, canvasState.pan.y);
        edgesCtx.scale(canvasState.zoom, canvasState.zoom);
        drawEdges();
        edgesCtx.restore();
        edgesDirty = false;
    }

    // Nodes layer
    if (nodesDirty) {
        nodesCtx.clearRect(0, 0, width, height);
        nodesCtx.save();
        nodesCtx.translate(canvasState.pan.x, canvasState.pan.y);
        nodesCtx.scale(canvasState.zoom, canvasState.zoom);
        drawNodes();
        nodesCtx.restore();
        nodesDirty = false;
    }

    // Overlay layer (always redraws - wire preview)
    overlayCtx.clearRect(0, 0, width, height);
    if (canvasState.wirePreview) {
        overlayCtx.save();
        overlayCtx.translate(canvasState.pan.x, canvasState.pan.y);
        overlayCtx.scale(canvasState.zoom, canvasState.zoom);
        drawWirePreview();
        overlayCtx.restore();
    }
}

// ─── Grid drawing (uses gridCtx) ────────────────────────────────

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

// ─── Node drawing (uses nodesCtx) ───────────────────────────────

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

        // Check if this port is a valid connection target during wire preview
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

// ─── Edge drawing (uses edgesCtx) ───────────────────────────────

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

// ─── Wire preview (uses overlayCtx) ─────────────────────────────

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

// ─── Shared drawing utilities (take context parameter) ───────────

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

// ─── Exports (backward compat) ──────────────────────────────────

export function getCanvas() {
    return nodesCanvas;
}

export function getContext() {
    return nodesCtx;
}
