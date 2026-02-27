// Properties Panel for shipwith.dev
// Shows/edits node configuration when a single node is selected

import { canvasState } from './state.js';
import { getComponentSpec } from './component-specs.js';

/** Escape user-controlled strings before injecting into innerHTML */
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

let panel;
let currentNodeId = null;
let currentEdgeId = null;

export function initProperties() {
    panel = document.getElementById('properties-panel');

    // React to selection changes
    canvasState.subscribe(() => {
        const selectedNodeArr = Array.from(canvasState.selectedNodeIds);
        const selectedEdgeArr = Array.from(canvasState.selectedEdgeIds);

        if (selectedNodeArr.length === 1) {
            const nodeId = selectedNodeArr[0];
            if (nodeId !== currentNodeId || currentEdgeId !== null) {
                currentNodeId = nodeId;
                currentEdgeId = null;
                renderPanel(nodeId);
            }
        } else if (selectedEdgeArr.length === 1) {
            const edgeId = selectedEdgeArr[0];
            if (edgeId !== currentEdgeId || currentNodeId !== null) {
                currentEdgeId = edgeId;
                currentNodeId = null;
                renderEdgePanel(edgeId);
            }
        } else {
            if (currentNodeId !== null || currentEdgeId !== null) {
                currentNodeId = null;
                currentEdgeId = null;
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

// ─── Edge panel ─────────────────────────────────────────────────

function renderEdgePanel(edgeId) {
    const edge = canvasState.graph.edges.get(edgeId);
    if (!edge) return;

    const sourceNode = canvasState.graph.nodes.get(edge.source.nodeId);
    const targetNode = canvasState.graph.nodes.get(edge.target.nodeId);
    if (!sourceNode || !targetNode) return;

    const sourceSpec = getComponentSpec(sourceNode.componentId);
    const targetSpec = getComponentSpec(targetNode.componentId);

    const sourcePortType = edge.sourcePortType || 'unknown';
    const targetPortType = edge.targetPortType || 'unknown';

    panel.innerHTML = buildEdgePanelHTML(edge, sourceNode, targetNode, sourceSpec, targetSpec, sourcePortType, targetPortType);
    panel.classList.add('open');

    bindEdgeInputs(edge);

    const closeBtn = panel.querySelector('.properties-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            canvasState.deselectAll();
        });
    }
}

function buildEdgePanelHTML(edge, sourceNode, targetNode, sourceSpec, targetSpec, sourcePortType, targetPortType) {
    const cfg = edge.config;
    const retry = cfg.retryPolicy;

    const sourceName = sourceSpec ? sourceSpec.name : sourceNode.name;
    const targetName = targetSpec ? targetSpec.name : targetNode.name;

    return `
        <div class="properties-header">
            <div class="properties-icon" style="background:rgba(59,130,246,0.1);border:1px solid #3b82f6;font-size:1.25rem;">
                &#10230;
            </div>
            <div class="properties-title">
                <h3>${escapeHTML(sourceName)} &rarr; ${escapeHTML(targetName)}</h3>
                <p>${escapeHTML(sourcePortType)} &rarr; ${escapeHTML(targetPortType)}</p>
            </div>
            <button class="properties-close" aria-label="Close">&times;</button>
        </div>

        <div class="properties-section">
            <h4>Connection</h4>
            <div class="prop-field">
                <label>Protocol</label>
                <select id="edge-protocol">
                    <option value="HTTPS" ${cfg.protocol === 'HTTPS' ? 'selected' : ''}>HTTPS</option>
                    <option value="HTTP" ${cfg.protocol === 'HTTP' ? 'selected' : ''}>HTTP</option>
                    <option value="gRPC" ${cfg.protocol === 'gRPC' ? 'selected' : ''}>gRPC</option>
                    <option value="WebSocket" ${cfg.protocol === 'WebSocket' ? 'selected' : ''}>WebSocket</option>
                    <option value="TCP" ${cfg.protocol === 'TCP' ? 'selected' : ''}>TCP</option>
                </select>
            </div>
            <div class="prop-field">
                <label>Mode</label>
                <select id="edge-sync">
                    <option value="true" ${cfg.sync ? 'selected' : ''}>Synchronous</option>
                    <option value="false" ${!cfg.sync ? 'selected' : ''}>Asynchronous</option>
                </select>
            </div>
            <div class="prop-field">
                <label>Latency (ms)</label>
                <input type="number" id="edge-latency" value="${cfg.latencyMs}" min="0" step="1">
            </div>
        </div>

        <div class="properties-section">
            <h4>Retry Policy</h4>
            <div class="prop-field">
                <label>Max Retries</label>
                <input type="number" id="edge-retries" value="${retry.maxRetries}" min="0" max="10">
            </div>
            <div class="prop-field">
                <label>Backoff (ms)</label>
                <input type="number" id="edge-backoff" value="${retry.backoffMs}" min="0">
            </div>
            <div class="prop-field">
                <label>Backoff Multiplier</label>
                <input type="number" id="edge-backoff-mult" value="${retry.backoffMultiplier}" min="1" step="0.1">
            </div>
        </div>

        <div class="properties-section">
            <h4>Label</h4>
            <div class="prop-field">
                <label>Wire Label</label>
                <input type="text" id="edge-label" value="${escapeHTML(edge.config.label || '')}" maxlength="40" placeholder="e.g., REST API">
            </div>
        </div>
    `;
}

function bindEdgeInputs(edge) {
    const bindEl = (id, setter) => {
        const el = panel.querySelector(`#${id}`);
        if (!el) return;
        el.addEventListener('change', () => {
            setter(el);
            canvasState.notify();
        });
        // Also fire on input for text fields (immediate feedback)
        if (el.type === 'text') {
            el.addEventListener('input', () => {
                setter(el);
                canvasState.notify();
            });
        }
    };

    bindEl('edge-protocol', (el) => { edge.config.protocol = el.value; });
    bindEl('edge-sync', (el) => { edge.config.sync = el.value === 'true'; });
    bindEl('edge-latency', (el) => {
        const val = Number(el.value);
        if (!Number.isNaN(val)) edge.config.latencyMs = val;
    });
    bindEl('edge-retries', (el) => {
        const val = Number(el.value);
        if (!Number.isNaN(val)) edge.config.retryPolicy.maxRetries = val;
    });
    bindEl('edge-backoff', (el) => {
        const val = Number(el.value);
        if (!Number.isNaN(val)) edge.config.retryPolicy.backoffMs = val;
    });
    bindEl('edge-backoff-mult', (el) => {
        const val = Number(el.value);
        if (!Number.isNaN(val)) edge.config.retryPolicy.backoffMultiplier = val;
    });
    bindEl('edge-label', (el) => { edge.config.label = el.value || null; });
}

// ─── Node panel ─────────────────────────────────────────────────

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
