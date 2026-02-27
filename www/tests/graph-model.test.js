import { describe, test, expect } from 'bun:test';
import { GraphSpec, NodeSpec, EdgeSpec } from '../graph-model.js';

// ============================================
// NodeSpec
// ============================================
describe('NodeSpec', () => {
    test('generates a unique ID on construction', () => {
        const n1 = new NodeSpec('workers', { x: 100, y: 200 });
        const n2 = new NodeSpec('workers', { x: 100, y: 200 });
        expect(typeof n1.id).toBe('string');
        expect(n1.id.length).toBeGreaterThan(0);
        expect(n1.id).not.toBe(n2.id);
    });

    test('stores componentId', () => {
        const n = new NodeSpec('d1', { x: 50, y: 75 });
        expect(n.componentId).toBe('d1');
    });

    test('stores position as {x, y}', () => {
        const n = new NodeSpec('kv', { x: 300, y: 400 });
        expect(n.position).toEqual({ x: 300, y: 400 });
    });

    test('defaults position to {0, 0} when not provided', () => {
        const n = new NodeSpec('browser');
        expect(n.position).toEqual({ x: 0, y: 0 });
    });

    test('has default config with all 5 sections', () => {
        const n = new NodeSpec('workers');
        expect(n.config).toBeDefined();
        expect(n.config.capacity).toBeDefined();
        expect(n.config.scaling).toBeDefined();
        expect(n.config.reliability).toBeDefined();
        expect(n.config.cost).toBeDefined();
        expect(n.config.latency).toBeDefined();
    });

    test('config has correct default values', () => {
        const n = new NodeSpec('workers');
        expect(n.config.capacity.instances).toBe(1);
        expect(n.config.capacity.maxRPSPerInstance).toBe(1000);
        expect(n.config.scaling.autoScale).toBe(false);
        expect(n.config.scaling.minInstances).toBe(1);
        expect(n.config.scaling.maxInstances).toBe(10);
        expect(n.config.reliability.failureProbability).toBe(0.001);
        expect(n.config.reliability.circuitBreaker).toBe(false);
        expect(n.config.cost.perHour).toBe(0.05);
        expect(n.config.cost.currency).toBe('USD');
        expect(n.config.latency.baseMs).toBe(5);
        expect(n.config.latency.p95Multiplier).toBe(1.8);
    });

    test('has default provider with null id and name', () => {
        const n = new NodeSpec('workers');
        expect(n.provider).toBeDefined();
        expect(n.provider.id).toBeNull();
        expect(n.provider.name).toBeNull();
        expect(n.provider.alternatives).toEqual([]);
    });

    test('has locked=false by default', () => {
        const n = new NodeSpec('workers');
        expect(n.locked).toBe(false);
    });

    test('has alternativeId=null by default', () => {
        const n = new NodeSpec('workers');
        expect(n.alternativeId).toBeNull();
    });

    test('has empty metadata by default', () => {
        const n = new NodeSpec('workers');
        expect(n.metadata).toEqual({});
    });
});

// ============================================
// EdgeSpec
// ============================================
describe('EdgeSpec', () => {
    test('generates a unique ID on construction', () => {
        const e1 = new EdgeSpec('n1', 'response', 'n2', 'request');
        const e2 = new EdgeSpec('n1', 'response', 'n2', 'request');
        expect(typeof e1.id).toBe('string');
        expect(e1.id.length).toBeGreaterThan(0);
        expect(e1.id).not.toBe(e2.id);
    });

    test('stores source nodeId and portId', () => {
        const e = new EdgeSpec('nodeA', 'portOut', 'nodeB', 'portIn');
        expect(e.source).toEqual({ nodeId: 'nodeA', portId: 'portOut' });
    });

    test('stores target nodeId and portId', () => {
        const e = new EdgeSpec('nodeA', 'portOut', 'nodeB', 'portIn');
        expect(e.target).toEqual({ nodeId: 'nodeB', portId: 'portIn' });
    });

    test('has default config with protocol, sync, latencyMs, retryPolicy', () => {
        const e = new EdgeSpec('n1', 'p1', 'n2', 'p2');
        expect(e.config).toBeDefined();
        expect(e.config.protocol).toBe('HTTPS');
        expect(e.config.sync).toBe(true);
        expect(e.config.latencyMs).toBe(1);
        expect(e.config.retryPolicy).toBeDefined();
    });

    test('retryPolicy has correct defaults', () => {
        const e = new EdgeSpec('n1', 'p1', 'n2', 'p2');
        expect(e.config.retryPolicy.maxRetries).toBe(3);
        expect(e.config.retryPolicy.backoffMs).toBe(100);
        expect(e.config.retryPolicy.backoffMultiplier).toBe(2);
    });

    test('has label=null by default', () => {
        const e = new EdgeSpec('n1', 'p1', 'n2', 'p2');
        expect(e.config.label).toBeNull();
    });

    test('has empty metadata by default', () => {
        const e = new EdgeSpec('n1', 'p1', 'n2', 'p2');
        expect(e.metadata).toEqual({});
    });
});

// ============================================
// GraphSpec
// ============================================
describe('GraphSpec', () => {
    test('creates with empty node and edge maps', () => {
        const g = new GraphSpec();
        expect(g.nodes).toBeInstanceOf(Map);
        expect(g.edges).toBeInstanceOf(Map);
        expect(g.nodes.size).toBe(0);
        expect(g.edges.size).toBe(0);
    });

    test('has a unique ID', () => {
        const g1 = new GraphSpec();
        const g2 = new GraphSpec();
        expect(typeof g1.id).toBe('string');
        expect(g1.id.length).toBeGreaterThan(0);
        expect(g1.id).not.toBe(g2.id);
    });

    test('has version and default name', () => {
        const g = new GraphSpec();
        expect(g.version).toBe('1.0.0');
        expect(g.name).toBe('Untitled Architecture');
    });

    test('has metadata with created and modified timestamps', () => {
        const before = Date.now();
        const g = new GraphSpec();
        const after = Date.now();
        expect(g.metadata.created).toBeGreaterThanOrEqual(before);
        expect(g.metadata.created).toBeLessThanOrEqual(after);
        expect(g.metadata.modified).toBeGreaterThanOrEqual(before);
        expect(g.metadata.modified).toBeLessThanOrEqual(after);
    });

    test('addNode stores node by id', () => {
        const g = new GraphSpec();
        const n = new NodeSpec('workers', { x: 10, y: 20 });
        g.addNode(n);
        expect(g.nodes.size).toBe(1);
        expect(g.nodes.get(n.id)).toBe(n);
    });

    test('addNode updates modified timestamp', () => {
        const g = new GraphSpec();
        const oldModified = g.metadata.modified;
        // Small delay to ensure timestamp differs
        const n = new NodeSpec('workers');
        g.addNode(n);
        expect(g.metadata.modified).toBeGreaterThanOrEqual(oldModified);
    });

    test('removeNode deletes the node', () => {
        const g = new GraphSpec();
        const n = new NodeSpec('workers');
        g.addNode(n);
        expect(g.nodes.size).toBe(1);
        g.removeNode(n.id);
        expect(g.nodes.size).toBe(0);
        expect(g.nodes.get(n.id)).toBeUndefined();
    });

    test('removeNode also removes connected edges', () => {
        const g = new GraphSpec();
        const n1 = new NodeSpec('workers');
        const n2 = new NodeSpec('d1');
        const n3 = new NodeSpec('kv');
        g.addNode(n1);
        g.addNode(n2);
        g.addNode(n3);

        const e1 = new EdgeSpec(n1.id, 'sqlQuery', n2.id, 'query');
        const e2 = new EdgeSpec(n1.id, 'kvOp', n3.id, 'operation');
        const e3 = new EdgeSpec(n3.id, 'result', n2.id, 'query'); // unrelated to n1
        g.addEdge(e1);
        g.addEdge(e2);
        g.addEdge(e3);

        expect(g.edges.size).toBe(3);
        g.removeNode(n1.id);
        // e1 and e2 should be removed (connected to n1), e3 should remain
        expect(g.edges.size).toBe(1);
        expect(g.edges.has(e3.id)).toBe(true);
    });

    test('addEdge stores edge by id', () => {
        const g = new GraphSpec();
        const e = new EdgeSpec('n1', 'out', 'n2', 'in');
        g.addEdge(e);
        expect(g.edges.size).toBe(1);
        expect(g.edges.get(e.id)).toBe(e);
    });

    test('removeEdge deletes the edge', () => {
        const g = new GraphSpec();
        const e = new EdgeSpec('n1', 'out', 'n2', 'in');
        g.addEdge(e);
        expect(g.edges.size).toBe(1);
        g.removeEdge(e.id);
        expect(g.edges.size).toBe(0);
    });

    test('removeEdge updates modified timestamp', () => {
        const g = new GraphSpec();
        const e = new EdgeSpec('n1', 'out', 'n2', 'in');
        g.addEdge(e);
        const oldModified = g.metadata.modified;
        g.removeEdge(e.id);
        expect(g.metadata.modified).toBeGreaterThanOrEqual(oldModified);
    });

    test('multiple nodes can be added and retrieved', () => {
        const g = new GraphSpec();
        const n1 = new NodeSpec('workers');
        const n2 = new NodeSpec('d1');
        const n3 = new NodeSpec('kv');
        g.addNode(n1);
        g.addNode(n2);
        g.addNode(n3);
        expect(g.nodes.size).toBe(3);
        expect(g.nodes.get(n1.id).componentId).toBe('workers');
        expect(g.nodes.get(n2.id).componentId).toBe('d1');
        expect(g.nodes.get(n3.id).componentId).toBe('kv');
    });
});
