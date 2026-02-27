// Persistence layer for shipwith.dev
// Auto-saves to localStorage on state changes (debounced),
// auto-restores on init, and provides JSON export/import.

import { canvasState } from './state.js';

const STORAGE_KEY = 'shipwith:graph';
let saveTimeout = null;

export function initPersistence() {
    // Restore BEFORE subscribing so that the restored state doesn't
    // trigger a redundant save back to the same localStorage entry.
    restore();

    // Auto-save on state changes (debounced 500ms)
    canvasState.subscribe(() => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(save, 500);
    });
}

function save() {
    try {
        const json = canvasState.toJSON();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
    } catch (e) {
        console.warn('[shipwith] Save failed:', e.message);
    }
}

function restore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const json = JSON.parse(raw);
            canvasState.fromJSON(json);
        }
    } catch (e) {
        console.warn('[shipwith] Restore failed:', e.message);
    }
}

export function exportGraph() {
    const json = canvasState.toJSON();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (json.name || 'architecture').replace(/[^a-zA-Z0-9_\- ]/g, '_');
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importGraph() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onerror = () => {
            alert('Failed to read the selected file.');
        };
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target.result);
                if (!json || typeof json !== 'object') {
                    throw new Error('Invalid file: expected a JSON object');
                }
                if (json.nodes && !Array.isArray(json.nodes)) {
                    throw new Error('Invalid file: "nodes" must be an array');
                }
                if (json.edges && !Array.isArray(json.edges)) {
                    throw new Error('Invalid file: "edges" must be an array');
                }
                canvasState.fromJSON(json);
                save();
            } catch (err) {
                console.error('[shipwith] Import failed:', err.message);
                alert('Import failed: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

export function newCanvas() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    canvasState.fromJSON({ nodes: [], edges: [] });
    localStorage.removeItem(STORAGE_KEY);
}
