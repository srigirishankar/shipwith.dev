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
