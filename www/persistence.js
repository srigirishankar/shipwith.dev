// Persistence layer for shipwith.dev
// Auto-saves to localStorage on state changes (debounced),
// auto-restores on init, and provides JSON export/import.

import { canvasState } from './state.js';

const STORAGE_KEY = 'shipwith:graph';
let saveTimeout = null;

export function initPersistence() {
    // Auto-restore from localStorage
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
    a.download = `${json.name || 'architecture'}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importGraph() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target.result);
                canvasState.fromJSON(json);
                save(); // Persist imported state
            } catch (err) {
                console.error('[shipwith] Import failed:', err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

export function newCanvas() {
    canvasState.fromJSON({ nodes: [], edges: [] });
    localStorage.removeItem(STORAGE_KEY);
}
