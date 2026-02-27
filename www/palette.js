// Palette sidebar for Visual Architecture Canvas
// Displays draggable component cards

import { COMPONENT_SPECS } from './component-specs.js';
import { canvasState } from './state.js';
import { getCanvas } from './canvas.js';

// Get components array from specs
const COMPONENTS = Object.values(COMPONENT_SPECS);

let paletteElement = null;
let dragGhost = null;
let dragComponentId = null;

export function initPalette(container) {
    paletteElement = container;
    renderPalette();
    setupDragListeners();
}

function renderPalette() {
    paletteElement.innerHTML = `
        <div class="palette-header">
            <h2>Components</h2>
            <p class="palette-hint">Drag to canvas</p>
        </div>
        <div class="palette-list">
            ${COMPONENTS.map(c => `
                <div class="palette-item" data-component-id="${c.id}" draggable="true">
                    <div class="palette-icon" style="background: ${c.color}20; border-color: ${c.color}">
                        <span>${c.icon}</span>
                    </div>
                    <div class="palette-info">
                        <span class="palette-role">${c.role || c.name}</span>
                        <span class="palette-name">${c.name}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function setupDragListeners() {
    // Palette item drag start
    paletteElement.addEventListener('dragstart', handleDragStart);
    paletteElement.addEventListener('dragend', handleDragEnd);

    // Canvas drop zone
    const canvas = getCanvas();
    if (canvas) {
        canvas.addEventListener('dragover', handleDragOver);
        canvas.addEventListener('drop', handleDrop);
        canvas.addEventListener('dragleave', handleDragLeave);
    }
}

function handleDragStart(e) {
    const item = e.target.closest('.palette-item');
    if (!item) return;

    dragComponentId = item.dataset.componentId;

    // Set drag data
    e.dataTransfer.setData('text/plain', dragComponentId);
    e.dataTransfer.effectAllowed = 'copy';

    // Create custom drag image
    createDragGhost(item, e);

    // Add dragging class
    item.classList.add('dragging');
}

function createDragGhost(item, e) {
    // Create ghost element
    dragGhost = item.cloneNode(true);
    dragGhost.classList.add('drag-ghost');
    dragGhost.style.position = 'fixed';
    dragGhost.style.pointerEvents = 'none';
    dragGhost.style.zIndex = '1000';
    dragGhost.style.opacity = '0.8';
    dragGhost.style.transform = 'scale(1.05)';
    document.body.appendChild(dragGhost);

    // Position ghost
    updateGhostPosition(e.clientX, e.clientY);

    // Hide default drag image
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);

    // Track mouse for ghost
    document.addEventListener('drag', handleDrag);
}

function handleDrag(e) {
    if (e.clientX === 0 && e.clientY === 0) return; // Firefox bug
    updateGhostPosition(e.clientX, e.clientY);
}

function updateGhostPosition(x, y) {
    if (!dragGhost) return;
    dragGhost.style.left = (x - 60) + 'px';
    dragGhost.style.top = (y - 30) + 'px';
}

function handleDragEnd(e) {
    // Clean up
    if (dragGhost) {
        dragGhost.remove();
        dragGhost = null;
    }
    document.removeEventListener('drag', handleDrag);

    // Remove dragging class
    const items = paletteElement.querySelectorAll('.palette-item');
    items.forEach(item => item.classList.remove('dragging'));

    // Remove drop zone highlight
    const container = document.getElementById('canvas-container');
    if (container) {
        container.classList.remove('drop-active');
    }

    dragComponentId = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const container = document.getElementById('canvas-container');
    if (container) {
        container.classList.add('drop-active');
    }
}

function handleDragLeave(e) {
    const container = document.getElementById('canvas-container');
    if (container) {
        container.classList.remove('drop-active');
    }
}

function handleDrop(e) {
    e.preventDefault();

    const container = document.getElementById('canvas-container');
    if (container) {
        container.classList.remove('drop-active');
    }

    const componentId = e.dataTransfer.getData('text/plain');
    if (!componentId) return;

    // Get drop position in world coordinates
    const canvas = getCanvas();
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = canvasState.screenToWorld(screenX, screenY);

    // Add node at drop position
    const node = canvasState.addNode(componentId, world.x, world.y);
    if (node) {
        // Select the newly created node
        canvasState.selectNode(node.id);
    }
}

// Re-initialize if canvas wasn't ready
export function reconnectCanvas() {
    const canvas = getCanvas();
    if (canvas) {
        canvas.removeEventListener('dragover', handleDragOver);
        canvas.removeEventListener('drop', handleDrop);
        canvas.removeEventListener('dragleave', handleDragLeave);

        canvas.addEventListener('dragover', handleDragOver);
        canvas.addEventListener('drop', handleDrop);
        canvas.addEventListener('dragleave', handleDragLeave);
    }
}
