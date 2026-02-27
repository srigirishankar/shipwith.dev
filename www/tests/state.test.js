import { describe, test, expect, beforeEach } from 'bun:test';
import { GraphSpec } from '../graph-model.js';
import { canvasState } from '../state.js';

// Reset singleton before each test
beforeEach(() => {
    canvasState.graph = new GraphSpec();
    canvasState.selectedNodeIds.clear();
    canvasState.selectedEdgeIds.clear();
    canvasState.pan = { x: 0, y: 0 };
    canvasState.zoom = 1;
    canvasState.mode = 'idle';
    canvasState.listeners.clear();
});

// ============================================
// addNode
// ============================================
describe('addNode', () => {
    test('creates node with spec properties', () => {
        const node = canvasState.addNode('workers', 100, 200);
        expect(node).not.toBeNull();
        expect(node.width).toBe(180);
        expect(node.height).toBe(120);
        expect(node.name).toBe('Cloudflare Workers');
        expect(node.componentId).toBe('workers');
        expect(node.position).toEqual({ x: 100, y: 200 });
    });

    test('returns null for unknown component', () => {
        const node = canvasState.addNode('nonexistent', 0, 0);
        expect(node).toBeNull();
    });

    test('adds node to graph', () => {
        expect(canvasState.graph.nodes.size).toBe(0);
        const node = canvasState.addNode('workers', 50, 50);
        expect(canvasState.graph.nodes.size).toBe(1);
        expect(canvasState.graph.nodes.get(node.id)).toBe(node);
    });

    test('node has config defaults', () => {
        const node = canvasState.addNode('d1', 0, 0);
        expect(node.config).toBeDefined();
        expect(node.config.capacity).toBeDefined();
        expect(node.config.scaling).toBeDefined();
        expect(node.config.reliability).toBeDefined();
        expect(node.config.cost).toBeDefined();
        expect(node.config.latency).toBeDefined();
    });

    test('node has provider populated from spec', () => {
        const node = canvasState.addNode('workers', 0, 0);
        expect(node.provider).toBeDefined();
        expect(node.provider.id).toBe('cloudflare');
        expect(node.provider.name).toBe('Cloudflare Workers');
        expect(node.provider.alternatives).toContain('lambda-edge');
    });

    test('node without provider in spec has null provider id', () => {
        const node = canvasState.addNode('wasm', 0, 0);
        expect(node.provider.id).toBeNull();
    });

    test('node has color from spec', () => {
        const node = canvasState.addNode('workers', 0, 0);
        expect(node.color).toBe('#F6821F');
    });

    test('node has role and icon from spec', () => {
        const node = canvasState.addNode('llm', 0, 0);
        expect(node.role).toBe('Language Model');
        expect(node.icon).toBe('🧠');
    });

    test('can add multiple nodes', () => {
        canvasState.addNode('workers', 0, 0);
        canvasState.addNode('d1', 100, 100);
        canvasState.addNode('kv', 200, 200);
        expect(canvasState.graph.nodes.size).toBe(3);
    });
});

// ============================================
// addEdge
// ============================================
describe('addEdge', () => {
    test('creates edge between compatible ports', () => {
        const worker = canvasState.addNode('workers', 0, 0);
        const db = canvasState.addNode('d1', 0, 200);
        // workers output: sqlQuery (SQL_QUERY) -> d1 input: query (SQL_QUERY)
        const edge = canvasState.addEdge(worker.id, 'sqlQuery', db.id, 'query');
        expect(edge).not.toBeNull();
        expect(edge.source.nodeId).toBe(worker.id);
        expect(edge.source.portId).toBe('sqlQuery');
        expect(edge.target.nodeId).toBe(db.id);
        expect(edge.target.portId).toBe('query');
    });

    test('adds edge to graph', () => {
        const worker = canvasState.addNode('workers', 0, 0);
        const db = canvasState.addNode('d1', 0, 200);
        const edge = canvasState.addEdge(worker.id, 'sqlQuery', db.id, 'query');
        expect(canvasState.graph.edges.size).toBe(1);
        expect(canvasState.graph.edges.get(edge.id)).toBe(edge);
    });

    test('returns null for invalid source node ID', () => {
        const db = canvasState.addNode('d1', 0, 0);
        const edge = canvasState.addEdge('nonexistent', 'sqlQuery', db.id, 'query');
        expect(edge).toBeNull();
    });

    test('returns null for invalid target node ID', () => {
        const worker = canvasState.addNode('workers', 0, 0);
        const edge = canvasState.addEdge(worker.id, 'sqlQuery', 'nonexistent', 'query');
        expect(edge).toBeNull();
    });

    test('returns null for invalid port IDs', () => {
        const worker = canvasState.addNode('workers', 0, 0);
        const db = canvasState.addNode('d1', 0, 200);
        const edge = canvasState.addEdge(worker.id, 'nonexistent', db.id, 'query');
        expect(edge).toBeNull();
    });

    test('returns null for incompatible types', () => {
        const worker = canvasState.addNode('workers', 0, 0);
        const db = canvasState.addNode('d1', 0, 200);
        // workers output: response (HTTP_RESPONSE) -> d1 input: query (SQL_QUERY) should fail
        const edge = canvasState.addEdge(worker.id, 'response', db.id, 'query');
        expect(edge).toBeNull();
    });

    test('stores port type info on edge', () => {
        const worker = canvasState.addNode('workers', 0, 0);
        const db = canvasState.addNode('d1', 0, 200);
        const edge = canvasState.addEdge(worker.id, 'sqlQuery', db.id, 'query');
        expect(edge.sourcePortType).toBe('sql-query');
        expect(edge.targetPortType).toBe('sql-query');
    });

    test('compatible related types connect (workers kvOp to kv operation)', () => {
        const worker = canvasState.addNode('workers', 0, 0);
        const kv = canvasState.addNode('kv', 200, 0);
        const edge = canvasState.addEdge(worker.id, 'kvOp', kv.id, 'operation');
        expect(edge).not.toBeNull();
    });
});

// ============================================
// Selection
// ============================================
describe('Selection', () => {
    test('selectNode adds node to selection', () => {
        const node = canvasState.addNode('workers', 0, 0);
        canvasState.selectNode(node.id);
        expect(canvasState.selectedNodeIds.has(node.id)).toBe(true);
        expect(canvasState.isNodeSelected(node.id)).toBe(true);
    });

    test('selectNode clears previous selection by default', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 100, 100);
        canvasState.selectNode(n1.id);
        canvasState.selectNode(n2.id);
        expect(canvasState.selectedNodeIds.size).toBe(1);
        expect(canvasState.isNodeSelected(n1.id)).toBe(false);
        expect(canvasState.isNodeSelected(n2.id)).toBe(true);
    });

    test('selectNode with additive=true keeps previous selection', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 100, 100);
        canvasState.selectNode(n1.id);
        canvasState.selectNode(n2.id, true);
        expect(canvasState.selectedNodeIds.size).toBe(2);
        expect(canvasState.isNodeSelected(n1.id)).toBe(true);
        expect(canvasState.isNodeSelected(n2.id)).toBe(true);
    });

    test('selectNode clears edge selection', () => {
        const worker = canvasState.addNode('workers', 0, 0);
        const db = canvasState.addNode('d1', 0, 200);
        const edge = canvasState.addEdge(worker.id, 'sqlQuery', db.id, 'query');
        canvasState.selectEdge(edge.id);
        expect(canvasState.selectedEdgeIds.size).toBe(1);
        canvasState.selectNode(worker.id);
        expect(canvasState.selectedEdgeIds.size).toBe(0);
    });

    test('deselectAll clears all selections', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 100, 0);
        const edge = canvasState.addEdge(n1.id, 'sqlQuery', n2.id, 'query');
        canvasState.selectNode(n1.id);
        canvasState.selectNode(n2.id, true);
        canvasState.selectEdge(edge.id, true);
        canvasState.deselectAll();
        expect(canvasState.selectedNodeIds.size).toBe(0);
        expect(canvasState.selectedEdgeIds.size).toBe(0);
    });

    test('deleteSelected removes selected nodes and edges', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 0, 200);
        const edge = canvasState.addEdge(n1.id, 'sqlQuery', n2.id, 'query');

        canvasState.selectNode(n1.id);
        canvasState.deleteSelected();

        expect(canvasState.graph.nodes.size).toBe(1);
        expect(canvasState.graph.nodes.has(n1.id)).toBe(false);
        expect(canvasState.graph.nodes.has(n2.id)).toBe(true);
        // Edge connected to n1 should also be removed
        expect(canvasState.graph.edges.size).toBe(0);
        expect(canvasState.selectedNodeIds.size).toBe(0);
    });

    test('deleteSelected removes selected edges', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 0, 200);
        const edge = canvasState.addEdge(n1.id, 'sqlQuery', n2.id, 'query');

        canvasState.selectEdge(edge.id);
        canvasState.deleteSelected();

        expect(canvasState.graph.nodes.size).toBe(2);
        expect(canvasState.graph.edges.size).toBe(0);
        expect(canvasState.selectedEdgeIds.size).toBe(0);
    });

    test('selectEdge works', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 0, 200);
        const edge = canvasState.addEdge(n1.id, 'sqlQuery', n2.id, 'query');
        canvasState.selectEdge(edge.id);
        expect(canvasState.isEdgeSelected(edge.id)).toBe(true);
    });
});

// ============================================
// Coordinate conversion
// ============================================
describe('Coordinate conversion', () => {
    test('screenToWorld with no pan/zoom returns same coords', () => {
        const result = canvasState.screenToWorld(100, 200);
        expect(result).toEqual({ x: 100, y: 200 });
    });

    test('screenToWorld with pan offsets correctly', () => {
        canvasState.pan = { x: 50, y: 100 };
        const result = canvasState.screenToWorld(150, 300);
        // (150 - 50) / 1 = 100, (300 - 100) / 1 = 200
        expect(result).toEqual({ x: 100, y: 200 });
    });

    test('screenToWorld with zoom scales correctly', () => {
        canvasState.zoom = 2;
        const result = canvasState.screenToWorld(200, 400);
        // (200 - 0) / 2 = 100, (400 - 0) / 2 = 200
        expect(result).toEqual({ x: 100, y: 200 });
    });

    test('screenToWorld with pan and zoom', () => {
        canvasState.pan = { x: 50, y: 100 };
        canvasState.zoom = 2;
        const result = canvasState.screenToWorld(250, 500);
        // (250 - 50) / 2 = 100, (500 - 100) / 2 = 200
        expect(result).toEqual({ x: 100, y: 200 });
    });

    test('worldToScreen reverses screenToWorld', () => {
        canvasState.pan = { x: 30, y: 70 };
        canvasState.zoom = 1.5;
        const world = canvasState.screenToWorld(300, 400);
        const screen = canvasState.worldToScreen(world.x, world.y);
        expect(screen.x).toBeCloseTo(300);
        expect(screen.y).toBeCloseTo(400);
    });

    test('worldToScreen with no pan/zoom returns same coords', () => {
        const result = canvasState.worldToScreen(100, 200);
        expect(result).toEqual({ x: 100, y: 200 });
    });

    test('worldToScreen with pan and zoom', () => {
        canvasState.pan = { x: 50, y: 100 };
        canvasState.zoom = 2;
        // worldX * zoom + panX = 100 * 2 + 50 = 250
        // worldY * zoom + panY = 200 * 2 + 100 = 500
        const result = canvasState.worldToScreen(100, 200);
        expect(result).toEqual({ x: 250, y: 500 });
    });
});

// ============================================
// getNodeAt
// ============================================
describe('getNodeAt', () => {
    test('returns null when no nodes exist', () => {
        expect(canvasState.getNodeAt(100, 100)).toBeNull();
    });

    test('returns node when clicking within its bounds', () => {
        const node = canvasState.addNode('workers', 200, 300);
        // Node is 180x120, centered at (200, 300)
        // Bounds: x [110, 290], y [240, 360]
        const found = canvasState.getNodeAt(200, 300);
        expect(found).toBe(node);
    });

    test('returns null when clicking outside node bounds', () => {
        canvasState.addNode('workers', 200, 300);
        // Outside bounds
        const found = canvasState.getNodeAt(0, 0);
        expect(found).toBeNull();
    });

    test('returns node at edge of bounds', () => {
        const node = canvasState.addNode('workers', 200, 300);
        // Right at the left edge: x = 200 - 90 = 110
        const found = canvasState.getNodeAt(110, 300);
        expect(found).toBe(node);
    });

    test('returns topmost (last added) node when overlapping', () => {
        const n1 = canvasState.addNode('workers', 200, 300);
        const n2 = canvasState.addNode('d1', 200, 300); // same position
        // getNodeAt reverses the array, so last added = first checked
        const found = canvasState.getNodeAt(200, 300);
        expect(found).toBe(n2);
    });
});

// ============================================
// moveSelectedNodes
// ============================================
describe('moveSelectedNodes', () => {
    test('moves selected nodes by delta', () => {
        const node = canvasState.addNode('workers', 100, 200);
        canvasState.selectNode(node.id);
        canvasState.moveSelectedNodes(50, -30);
        expect(node.position).toEqual({ x: 150, y: 170 });
    });

    test('does not move unselected nodes', () => {
        const n1 = canvasState.addNode('workers', 100, 200);
        const n2 = canvasState.addNode('d1', 300, 400);
        canvasState.selectNode(n1.id);
        canvasState.moveSelectedNodes(50, 50);
        expect(n1.position).toEqual({ x: 150, y: 250 });
        expect(n2.position).toEqual({ x: 300, y: 400 });
    });

    test('moves multiple selected nodes', () => {
        const n1 = canvasState.addNode('workers', 100, 200);
        const n2 = canvasState.addNode('d1', 300, 400);
        canvasState.selectNode(n1.id);
        canvasState.selectNode(n2.id, true);
        canvasState.moveSelectedNodes(10, 20);
        expect(n1.position).toEqual({ x: 110, y: 220 });
        expect(n2.position).toEqual({ x: 310, y: 420 });
    });

    test('does nothing when nothing is selected', () => {
        const node = canvasState.addNode('workers', 100, 200);
        canvasState.moveSelectedNodes(50, 50);
        expect(node.position).toEqual({ x: 100, y: 200 });
    });
});

// ============================================
// toJSON / fromJSON
// ============================================
describe('toJSON / fromJSON', () => {
    test('toJSON includes graph metadata', () => {
        const json = canvasState.toJSON();
        expect(json.id).toBeDefined();
        expect(json.version).toBe('1.0.0');
        expect(json.name).toBe('Untitled Architecture');
        expect(json.metadata).toBeDefined();
    });

    test('toJSON includes config and provider for nodes', () => {
        const node = canvasState.addNode('workers', 100, 200);
        const json = canvasState.toJSON();
        const nodeJson = json.nodes[0];
        expect(nodeJson.config).toBeDefined();
        expect(nodeJson.config.capacity).toBeDefined();
        expect(nodeJson.provider).toBeDefined();
        expect(nodeJson.provider.id).toBe('cloudflare');
    });

    test('toJSON includes config for edges', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 0, 200);
        canvasState.addEdge(n1.id, 'sqlQuery', n2.id, 'query');
        const json = canvasState.toJSON();
        const edgeJson = json.edges[0];
        expect(edgeJson.config).toBeDefined();
        expect(edgeJson.config.protocol).toBe('HTTPS');
        expect(edgeJson.config.retryPolicy).toBeDefined();
    });

    test('roundtrip preserves nodes', () => {
        canvasState.addNode('workers', 100, 200);
        canvasState.addNode('d1', 300, 400);
        const json = canvasState.toJSON();

        canvasState.fromJSON(json);
        expect(canvasState.graph.nodes.size).toBe(2);

        const nodes = Array.from(canvasState.graph.nodes.values());
        const workerNode = nodes.find(n => n.componentId === 'workers');
        const dbNode = nodes.find(n => n.componentId === 'd1');
        expect(workerNode).toBeDefined();
        expect(workerNode.position).toEqual({ x: 100, y: 200 });
        expect(workerNode.name).toBe('Cloudflare Workers');
        expect(workerNode.width).toBe(180);
        expect(dbNode).toBeDefined();
        expect(dbNode.position).toEqual({ x: 300, y: 400 });
    });

    test('roundtrip preserves edges', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 0, 200);
        const edge = canvasState.addEdge(n1.id, 'sqlQuery', n2.id, 'query');
        const json = canvasState.toJSON();

        canvasState.fromJSON(json);
        expect(canvasState.graph.edges.size).toBe(1);
        const restoredEdge = Array.from(canvasState.graph.edges.values())[0];
        expect(restoredEdge.source.portId).toBe('sqlQuery');
        expect(restoredEdge.target.portId).toBe('query');
    });

    test('roundtrip preserves config', () => {
        const node = canvasState.addNode('workers', 0, 0);
        node.config.capacity.instances = 5;
        node.config.scaling.autoScale = true;

        const json = canvasState.toJSON();
        canvasState.fromJSON(json);

        const restored = Array.from(canvasState.graph.nodes.values())[0];
        expect(restored.config.capacity.instances).toBe(5);
        expect(restored.config.scaling.autoScale).toBe(true);
    });

    test('roundtrip preserves provider', () => {
        canvasState.addNode('workers', 0, 0);
        const json = canvasState.toJSON();
        canvasState.fromJSON(json);

        const restored = Array.from(canvasState.graph.nodes.values())[0];
        expect(restored.provider.id).toBe('cloudflare');
        expect(restored.provider.alternatives).toContain('lambda-edge');
    });

    test('handles old format without config (derives defaults)', () => {
        const json = {
            id: 'test-graph',
            version: '1.0.0',
            name: 'Legacy Graph',
            nodes: [
                {
                    id: 'n1',
                    componentId: 'workers',
                    position: { x: 50, y: 75 },
                    // No config or provider
                }
            ],
            edges: []
        };

        canvasState.fromJSON(json);
        const node = canvasState.graph.nodes.get('n1');
        expect(node).toBeDefined();
        // Should have default config
        expect(node.config).toBeDefined();
        expect(node.config.capacity.instances).toBe(1);
        expect(node.config.scaling.autoScale).toBe(false);
        // Should derive provider from spec
        expect(node.provider.id).toBe('cloudflare');
        expect(node.provider.name).toBe('Cloudflare Workers');
    });

    test('handles old format edges without config', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 0, 200);
        const json = {
            id: 'test',
            version: '1.0.0',
            name: 'Test',
            nodes: [
                { id: n1.id, componentId: 'workers', position: { x: 0, y: 0 } },
                { id: n2.id, componentId: 'd1', position: { x: 0, y: 200 } },
            ],
            edges: [
                {
                    id: 'e1',
                    source: { nodeId: n1.id, portId: 'sqlQuery' },
                    target: { nodeId: n2.id, portId: 'query' },
                    // No config
                }
            ]
        };

        canvasState.fromJSON(json);
        const edge = canvasState.graph.edges.get('e1');
        expect(edge).toBeDefined();
        expect(edge.config.protocol).toBe('HTTPS');
        expect(edge.config.retryPolicy.maxRetries).toBe(3);
    });

    test('fromJSON clears selections', () => {
        const node = canvasState.addNode('workers', 0, 0);
        canvasState.selectNode(node.id);
        expect(canvasState.selectedNodeIds.size).toBe(1);

        canvasState.fromJSON(canvasState.toJSON());
        expect(canvasState.selectedNodeIds.size).toBe(0);
        expect(canvasState.selectedEdgeIds.size).toBe(0);
    });

    test('fromJSON skips nodes with unknown componentId', () => {
        const json = {
            nodes: [
                { id: 'n1', componentId: 'nonexistent', position: { x: 0, y: 0 } }
            ],
            edges: []
        };
        canvasState.fromJSON(json);
        expect(canvasState.graph.nodes.size).toBe(0);
    });

    test('toJSON serializes edge source and target correctly', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 0, 200);
        canvasState.addEdge(n1.id, 'sqlQuery', n2.id, 'query');
        const json = canvasState.toJSON();
        expect(json.edges[0].source).toEqual({ nodeId: n1.id, portId: 'sqlQuery' });
        expect(json.edges[0].target).toEqual({ nodeId: n2.id, portId: 'query' });
    });
});

// ============================================
// subscribe / unsubscribe
// ============================================
describe('subscribe / unsubscribe', () => {
    test('calls listener on notify', () => {
        let callCount = 0;
        canvasState.subscribe(() => { callCount++; });
        canvasState.notify();
        expect(callCount).toBe(1);
        canvasState.notify();
        expect(callCount).toBe(2);
    });

    test('calls listener with state on addNode', () => {
        let received = null;
        canvasState.subscribe((state) => { received = state; });
        canvasState.addNode('workers', 0, 0);
        expect(received).toBe(canvasState);
    });

    test('unsubscribe stops notifications', () => {
        let callCount = 0;
        const unsub = canvasState.subscribe(() => { callCount++; });
        canvasState.notify();
        expect(callCount).toBe(1);

        unsub();
        canvasState.notify();
        expect(callCount).toBe(1); // Should not have been called again
    });

    test('multiple listeners all get notified', () => {
        let a = 0, b = 0;
        canvasState.subscribe(() => { a++; });
        canvasState.subscribe(() => { b++; });
        canvasState.notify();
        expect(a).toBe(1);
        expect(b).toBe(1);
    });

    test('addNode triggers notification', () => {
        let notified = false;
        canvasState.subscribe(() => { notified = true; });
        canvasState.addNode('workers', 0, 0);
        expect(notified).toBe(true);
    });

    test('removeNode triggers notification', () => {
        const node = canvasState.addNode('workers', 0, 0);
        let notified = false;
        canvasState.subscribe(() => { notified = true; });
        canvasState.removeNode(node.id);
        expect(notified).toBe(true);
    });

    test('selectNode triggers notification', () => {
        const node = canvasState.addNode('workers', 0, 0);
        let notified = false;
        canvasState.subscribe(() => { notified = true; });
        canvasState.selectNode(node.id);
        expect(notified).toBe(true);
    });

    test('deselectAll triggers notification', () => {
        let notified = false;
        canvasState.subscribe(() => { notified = true; });
        canvasState.deselectAll();
        expect(notified).toBe(true);
    });
});

// ============================================
// Pan/Zoom controls
// ============================================
describe('Pan/Zoom controls', () => {
    test('setPan updates pan coordinates', () => {
        canvasState.setPan(100, 200);
        expect(canvasState.pan).toEqual({ x: 100, y: 200 });
    });

    test('adjustPan adds to current pan', () => {
        canvasState.pan = { x: 50, y: 100 };
        canvasState.adjustPan(10, 20);
        expect(canvasState.pan).toEqual({ x: 60, y: 120 });
    });

    test('setZoom clamps to min', () => {
        canvasState.setZoom(0.01);
        expect(canvasState.zoom).toBe(0.25);
    });

    test('setZoom clamps to max', () => {
        canvasState.setZoom(100);
        expect(canvasState.zoom).toBe(4);
    });

    test('setZoom with valid value', () => {
        canvasState.setZoom(2);
        expect(canvasState.zoom).toBe(2);
    });
});

// ============================================
// getNodePorts
// ============================================
describe('getNodePorts', () => {
    test('returns inputs and outputs for valid node', () => {
        const node = canvasState.addNode('workers', 200, 300);
        const ports = canvasState.getNodePorts(node);
        expect(ports.inputs.length).toBeGreaterThan(0);
        expect(ports.outputs.length).toBeGreaterThan(0);
    });

    test('each port has portId, type, color, worldPos', () => {
        const node = canvasState.addNode('workers', 200, 300);
        const ports = canvasState.getNodePorts(node);
        for (const port of [...ports.inputs, ...ports.outputs]) {
            expect(port.portId).toBeDefined();
            expect(port.type).toBeDefined();
            expect(port.color).toBeDefined();
            expect(port.worldPos).toBeDefined();
            expect(typeof port.worldPos.x).toBe('number');
            expect(typeof port.worldPos.y).toBe('number');
        }
    });

    test('returns empty for node with unknown componentId', () => {
        const node = canvasState.addNode('workers', 0, 0);
        node.componentId = 'nonexistent'; // Sabotage it
        const ports = canvasState.getNodePorts(node);
        expect(ports.inputs).toEqual([]);
        expect(ports.outputs).toEqual([]);
    });
});

// ============================================
// removeNode / removeEdge
// ============================================
describe('removeNode / removeEdge', () => {
    test('removeNode removes node from graph', () => {
        const node = canvasState.addNode('workers', 0, 0);
        canvasState.removeNode(node.id);
        expect(canvasState.graph.nodes.size).toBe(0);
    });

    test('removeNode clears node from selection', () => {
        const node = canvasState.addNode('workers', 0, 0);
        canvasState.selectNode(node.id);
        canvasState.removeNode(node.id);
        expect(canvasState.selectedNodeIds.has(node.id)).toBe(false);
    });

    test('removeEdge removes edge from graph', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 0, 200);
        const edge = canvasState.addEdge(n1.id, 'sqlQuery', n2.id, 'query');
        canvasState.removeEdge(edge.id);
        expect(canvasState.graph.edges.size).toBe(0);
    });

    test('removeEdge clears edge from selection', () => {
        const n1 = canvasState.addNode('workers', 0, 0);
        const n2 = canvasState.addNode('d1', 0, 200);
        const edge = canvasState.addEdge(n1.id, 'sqlQuery', n2.id, 'query');
        canvasState.selectEdge(edge.id);
        canvasState.removeEdge(edge.id);
        expect(canvasState.selectedEdgeIds.has(edge.id)).toBe(false);
    });
});
