// Canvas rendering and interaction for Visual Architecture Canvas
// Handles pan, zoom, grid, and orchestrates rendering of nodes/wires

import { canvasState } from './state.js';
import { getComponentSpec, isTypeCompatible, getTypeColor } from './component-specs.js';

let canvas, ctx;
let animationFrameId = null;

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

// Initialize canvas
export function initCanvas(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Center the view initially
    canvasState.pan.x = canvas.width / 2;
    canvasState.pan.y = canvas.height / 2;

    setupEventListeners();
    startRenderLoop();

    return { canvas, ctx };
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);

    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
}

function setupEventListeners() {
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
}

function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = canvasState.screenToWorld(screenX, screenY);

    lastMouseX = screenX;
    lastMouseY = screenY;

    // Middle click or space+left click = pan
    if (e.button === 1 || (e.button === 0 && isSpaceDown)) {
        isPanning = true;
        canvas.style.cursor = 'grabbing';
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
            canvas.style.cursor = 'move';
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
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const dx = screenX - lastMouseX;
    const dy = screenY - lastMouseY;
    const world = canvasState.screenToWorld(screenX, screenY);

    // Update hovered port for highlighting
    hoveredPort = canvasState.getPortAt(world.x, world.y);

    if (isPanning) {
        canvasState.adjustPan(dx, dy);
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
            canvas.style.cursor = 'crosshair';
        } else if (node) {
            canvas.style.cursor = 'pointer';
        } else if (isSpaceDown) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'default';
        }
    }

    lastMouseX = screenX;
    lastMouseY = screenY;
}

function handleMouseUp(e) {
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = isSpaceDown ? 'grab' : 'default';
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

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = canvasState.zoom * zoomFactor;

    canvasState.setZoom(newZoom, screenX, screenY);
}

function handleKeyDown(e) {
    if (e.code === 'Space' && !isSpaceDown) {
        isSpaceDown = true;
        if (canvasState.mode === 'idle') {
            canvas.style.cursor = 'grab';
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
            canvas.style.cursor = 'default';
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
        const rect = canvas.getBoundingClientRect();
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
        const rect = canvas.getBoundingClientRect();
        const screenX = touch.clientX - rect.left;
        const screenY = touch.clientY - rect.top;
        const dx = screenX - lastMouseX;
        const dy = screenY - lastMouseY;

        if (isPanning) {
            canvasState.adjustPan(dx, dy);
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

        const rect = canvas.getBoundingClientRect();
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

        canvasState.setZoom(touchStartZoom * scale, centerX, centerY);
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

// Main draw function
function draw() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    ctx.fillStyle = '#1d1d1d';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(canvasState.pan.x, canvasState.pan.y);
    ctx.scale(canvasState.zoom, canvasState.zoom);

    drawGrid(width, height);
    drawEdges();

    if (canvasState.wirePreview) {
        drawWirePreview();
    }

    drawNodes();

    ctx.restore();
}

function drawGrid(width, height) {
    const { pan, zoom } = canvasState;

    const left = -pan.x / zoom;
    const top = -pan.y / zoom;
    const right = (width - pan.x) / zoom;
    const bottom = (height - pan.y) / zoom;

    const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE;

    ctx.lineWidth = 1 / zoom;

    for (let x = startX; x <= right; x += GRID_SIZE) {
        const isAccent = Math.round(x / GRID_SIZE) % GRID_ACCENT_EVERY === 0;
        ctx.strokeStyle = isAccent ? GRID_ACCENT_COLOR : GRID_COLOR;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
    }

    for (let y = startY; y <= bottom; y += GRID_SIZE) {
        const isAccent = Math.round(y / GRID_SIZE) % GRID_ACCENT_EVERY === 0;
        ctx.strokeStyle = isAccent ? GRID_ACCENT_COLOR : GRID_COLOR;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    roundRect(ctx, x - halfW + 4, y - halfH + 4, w, h, radius);
    ctx.fill();

    // Background
    ctx.fillStyle = '#2a2a2a';
    roundRect(ctx, x - halfW, y - halfH, w, h, radius);
    ctx.fill();

    // Border
    ctx.strokeStyle = isSelected ? '#3b82f6' : node.color;
    ctx.lineWidth = isSelected ? 3 : 2;
    roundRect(ctx, x - halfW, y - halfH, w, h, radius);
    ctx.stroke();

    // Color accent bar at top
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.moveTo(x - halfW + radius, y - halfH);
    ctx.lineTo(x + halfW - radius, y - halfH);
    ctx.arcTo(x + halfW, y - halfH, x + halfW, y - halfH + radius, radius);
    ctx.lineTo(x + halfW, y - halfH + 10);
    ctx.lineTo(x - halfW, y - halfH + 10);
    ctx.lineTo(x - halfW, y - halfH + radius);
    ctx.arcTo(x - halfW, y - halfH, x - halfW + radius, y - halfH, radius);
    ctx.closePath();
    ctx.fill();

    // Icon
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.icon || '?', x, y - 8);

    // Role (line 1)
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(node.role || node.componentId, x, y + 25);

    // Name (line 2)
    ctx.font = 'italic 10px Inter, sans-serif';
    ctx.fillStyle = '#a0a0a0';
    ctx.fillText(node.name || '', x, y + 40);

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
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        if (isValidTarget) {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
            ctx.strokeStyle = '#10B981';
        } else if (isInvalidTarget) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
            ctx.strokeStyle = '#EF4444';
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeStyle = '#ffffff';
        }
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Port circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#1d1d1d';
    ctx.lineWidth = 2;
    ctx.stroke();
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

    drawBezierWire(start.x, start.y, end.x, end.y, color, isSelected);
}

function drawWirePreview() {
    const wp = canvasState.wirePreview;
    let color = getTypeColor(wp.sourcePortType);

    if (wp.validTarget) {
        color = '#10B981';
    } else if (wp.invalidTarget) {
        color = '#EF4444';
    }

    drawBezierWire(wp.startX, wp.startY, wp.endX, wp.endY, color, false, true);
}

function drawBezierWire(x1, y1, x2, y2, color, isSelected = false, isDashed = false) {
    const dy = Math.abs(y2 - y1);
    const controlOffset = Math.max(30, dy * 0.5);

    const cp1x = x1;
    const cp1y = y1 + controlOffset;
    const cp2x = x2;
    const cp2y = y2 - controlOffset;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);

    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 4 : 2.5;

    if (isDashed) {
        ctx.setLineDash([8, 4]);
    } else {
        ctx.setLineDash([]);
    }

    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow at end
    const angle = Math.atan2(y2 - cp2y, x2 - cp2x);
    const arrowSize = 8;

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - arrowSize * Math.cos(angle - Math.PI / 6), y2 - arrowSize * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - arrowSize * Math.cos(angle + Math.PI / 6), y2 - arrowSize * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

export function getCanvas() {
    return canvas;
}

export function getContext() {
    return ctx;
}
