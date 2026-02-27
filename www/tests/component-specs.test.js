import { describe, test, expect } from 'bun:test';
import {
    TYPES,
    TYPE_COMPATIBILITY,
    COMPONENT_SPECS,
    isTypeCompatible,
    getComponentSpec,
    getComponentsByCategory,
    getValidTargets,
    validateGraph,
    getTypeColor,
    getPortOffset,
} from '../component-specs.js';

// ============================================
// TYPES
// ============================================
describe('TYPES', () => {
    test('has 20+ types defined', () => {
        const typeCount = Object.keys(TYPES).length;
        expect(typeCount).toBeGreaterThanOrEqual(20);
    });

    test('all type values are lowercase strings', () => {
        for (const [key, value] of Object.entries(TYPES)) {
            expect(typeof value).toBe('string');
            expect(value).toBe(value.toLowerCase());
        }
    });

    test('includes core infrastructure types', () => {
        expect(TYPES.HTTP_REQUEST).toBe('http-request');
        expect(TYPES.HTTP_RESPONSE).toBe('http-response');
        expect(TYPES.SQL_QUERY).toBe('sql-query');
        expect(TYPES.SQL_RESULT).toBe('sql-result');
        expect(TYPES.KV_OPERATION).toBe('kv-operation');
        expect(TYPES.KV_RESULT).toBe('kv-result');
        expect(TYPES.WASM_CALL).toBe('wasm-call');
        expect(TYPES.WASM_RESULT).toBe('wasm-result');
        expect(TYPES.STATIC_ASSET).toBe('static-asset');
    });

    test('includes data types', () => {
        expect(TYPES.JSON).toBe('json');
        expect(TYPES.HTML).toBe('html');
        expect(TYPES.BINARY).toBe('binary');
        expect(TYPES.STRING).toBe('string');
    });

    test('includes AI-specific types', () => {
        expect(TYPES.LLM_PROMPT).toBe('llm-prompt');
        expect(TYPES.LLM_RESPONSE).toBe('llm-response');
        expect(TYPES.EMBEDDING).toBe('embedding');
        expect(TYPES.VECTOR_RESULTS).toBe('vector-results');
        expect(TYPES.AGENT_ACTION).toBe('agent-action');
        expect(TYPES.TOOL_CALL).toBe('tool-call');
        expect(TYPES.TOOL_RESULT).toBe('tool-result');
    });

    test('includes ANY wildcard type', () => {
        expect(TYPES.ANY).toBe('any');
    });

    test('all type keys are unique', () => {
        const values = Object.values(TYPES);
        const unique = new Set(values);
        expect(unique.size).toBe(values.length);
    });
});

// ============================================
// TYPE_COMPATIBILITY
// ============================================
describe('TYPE_COMPATIBILITY', () => {
    test('every TYPES value has an entry in TYPE_COMPATIBILITY', () => {
        for (const typeValue of Object.values(TYPES)) {
            expect(TYPE_COMPATIBILITY).toHaveProperty(typeValue);
        }
    });

    test('every type is compatible with itself', () => {
        for (const typeValue of Object.values(TYPES)) {
            const compatible = TYPE_COMPATIBILITY[typeValue];
            expect(compatible).toContain(typeValue);
        }
    });

    test('every type is compatible with ANY', () => {
        for (const typeValue of Object.values(TYPES)) {
            const compatible = TYPE_COMPATIBILITY[typeValue];
            expect(compatible).toContain(TYPES.ANY);
        }
    });

    test('ANY type is compatible with all types', () => {
        const anyCompatible = TYPE_COMPATIBILITY[TYPES.ANY];
        for (const typeValue of Object.values(TYPES)) {
            expect(anyCompatible).toContain(typeValue);
        }
    });

    test('SQL_RESULT is compatible with JSON', () => {
        expect(TYPE_COMPATIBILITY[TYPES.SQL_RESULT]).toContain(TYPES.JSON);
    });

    test('LLM_RESPONSE is compatible with STRING and JSON', () => {
        expect(TYPE_COMPATIBILITY[TYPES.LLM_RESPONSE]).toContain(TYPES.STRING);
        expect(TYPE_COMPATIBILITY[TYPES.LLM_RESPONSE]).toContain(TYPES.JSON);
    });

    test('AGENT_ACTION is compatible with TOOL_CALL and JSON', () => {
        expect(TYPE_COMPATIBILITY[TYPES.AGENT_ACTION]).toContain(TYPES.TOOL_CALL);
        expect(TYPE_COMPATIBILITY[TYPES.AGENT_ACTION]).toContain(TYPES.JSON);
    });

    test('HTML is compatible with STRING and STATIC_ASSET', () => {
        expect(TYPE_COMPATIBILITY[TYPES.HTML]).toContain(TYPES.STRING);
        expect(TYPE_COMPATIBILITY[TYPES.HTML]).toContain(TYPES.STATIC_ASSET);
    });
});

// ============================================
// isTypeCompatible
// ============================================
describe('isTypeCompatible', () => {
    test('same type is always compatible', () => {
        expect(isTypeCompatible(TYPES.HTTP_REQUEST, TYPES.HTTP_REQUEST)).toBe(true);
        expect(isTypeCompatible(TYPES.SQL_QUERY, TYPES.SQL_QUERY)).toBe(true);
        expect(isTypeCompatible(TYPES.LLM_PROMPT, TYPES.LLM_PROMPT)).toBe(true);
    });

    test('ANY target accepts everything', () => {
        for (const typeValue of Object.values(TYPES)) {
            expect(isTypeCompatible(typeValue, TYPES.ANY)).toBe(true);
        }
    });

    test('ANY source connects to anything', () => {
        for (const typeValue of Object.values(TYPES)) {
            expect(isTypeCompatible(TYPES.ANY, typeValue)).toBe(true);
        }
    });

    test('incompatible types reject', () => {
        expect(isTypeCompatible(TYPES.HTTP_REQUEST, TYPES.SQL_QUERY)).toBe(false);
        expect(isTypeCompatible(TYPES.SQL_QUERY, TYPES.KV_OPERATION)).toBe(false);
        expect(isTypeCompatible(TYPES.BINARY, TYPES.SQL_RESULT)).toBe(false);
    });

    test('related types are compatible (SQL_RESULT to JSON)', () => {
        expect(isTypeCompatible(TYPES.SQL_RESULT, TYPES.JSON)).toBe(true);
    });

    test('related types are compatible (LLM_RESPONSE to STRING)', () => {
        expect(isTypeCompatible(TYPES.LLM_RESPONSE, TYPES.STRING)).toBe(true);
    });

    test('related types are compatible (JSON to STRING)', () => {
        expect(isTypeCompatible(TYPES.JSON, TYPES.STRING)).toBe(true);
    });

    test('returns false for unknown source type', () => {
        expect(isTypeCompatible('nonexistent', TYPES.JSON)).toBe(false);
    });
});

// ============================================
// getComponentSpec
// ============================================
describe('getComponentSpec', () => {
    test('returns spec for valid component ID', () => {
        const spec = getComponentSpec('workers');
        expect(spec).not.toBeNull();
        expect(spec.id).toBe('workers');
        expect(spec.name).toBe('Cloudflare Workers');
    });

    test('returns null for unknown component ID', () => {
        expect(getComponentSpec('nonexistent')).toBeNull();
        expect(getComponentSpec('')).toBeNull();
        expect(getComponentSpec(undefined)).toBeNull();
    });

    test('all specs have required fields', () => {
        for (const [id, spec] of Object.entries(COMPONENT_SPECS)) {
            expect(spec.id).toBe(id);
            expect(typeof spec.name).toBe('string');
            expect(spec.name.length).toBeGreaterThan(0);
            expect(typeof spec.icon).toBe('string');
            expect(typeof spec.color).toBe('string');
            expect(spec.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
            expect(typeof spec.category).toBe('string');
            expect(typeof spec.inputs).toBe('object');
            expect(typeof spec.outputs).toBe('object');
        }
    });

    test('all port types reference valid TYPES values', () => {
        const validTypes = new Set(Object.values(TYPES));

        for (const [compId, spec] of Object.entries(COMPONENT_SPECS)) {
            for (const [portId, portSpec] of Object.entries(spec.inputs)) {
                expect(validTypes.has(portSpec.type)).toBe(true);
            }
            for (const [portId, portSpec] of Object.entries(spec.outputs)) {
                expect(validTypes.has(portSpec.type)).toBe(true);
            }
        }
    });

    test('all port specs have a position field', () => {
        for (const spec of Object.values(COMPONENT_SPECS)) {
            for (const portSpec of Object.values(spec.inputs)) {
                expect(typeof portSpec.position).toBe('string');
            }
            for (const portSpec of Object.values(spec.outputs)) {
                expect(typeof portSpec.position).toBe('string');
            }
        }
    });
});

// ============================================
// COMPONENT_SPECS
// ============================================
describe('COMPONENT_SPECS', () => {
    test('has at least 15 components', () => {
        const count = Object.keys(COMPONENT_SPECS).length;
        expect(count).toBeGreaterThanOrEqual(15);
    });

    test('includes infrastructure components', () => {
        expect(COMPONENT_SPECS.workers).toBeDefined();
        expect(COMPONENT_SPECS.pages).toBeDefined();
        expect(COMPONENT_SPECS.kv).toBeDefined();
        expect(COMPONENT_SPECS.d1).toBeDefined();
    });

    test('includes client components', () => {
        expect(COMPONENT_SPECS.user).toBeDefined();
        expect(COMPONENT_SPECS.browser).toBeDefined();
    });

    test('includes AI components', () => {
        expect(COMPONENT_SPECS.llm).toBeDefined();
        expect(COMPONENT_SPECS.vectordb).toBeDefined();
        expect(COMPONENT_SPECS.agent).toBeDefined();
        expect(COMPONENT_SPECS.embedding).toBeDefined();
        expect(COMPONENT_SPECS.tool).toBeDefined();
        expect(COMPONENT_SPECS.memory).toBeDefined();
        expect(COMPONENT_SPECS.guardrails).toBeDefined();
    });

    test('user component has no inputs and an HTTP_REQUEST output', () => {
        const user = COMPONENT_SPECS.user;
        expect(Object.keys(user.inputs).length).toBe(0);
        expect(user.outputs.request.type).toBe(TYPES.HTTP_REQUEST);
    });

    test('workers component has request input and response output', () => {
        const workers = COMPONENT_SPECS.workers;
        expect(workers.inputs.request.type).toBe(TYPES.HTTP_REQUEST);
        expect(workers.outputs.response.type).toBe(TYPES.HTTP_RESPONSE);
    });
});

// ============================================
// getComponentsByCategory
// ============================================
describe('getComponentsByCategory', () => {
    test('returns components for valid category', () => {
        const compute = getComponentsByCategory('compute');
        expect(compute.length).toBeGreaterThan(0);
        for (const c of compute) {
            expect(c.category).toBe('compute');
        }
    });

    test('returns empty array for unknown category', () => {
        expect(getComponentsByCategory('nonexistent')).toEqual([]);
    });

    test('returns AI components', () => {
        const ai = getComponentsByCategory('ai');
        expect(ai.length).toBeGreaterThanOrEqual(3);
    });
});

// ============================================
// getValidTargets
// ============================================
describe('getValidTargets', () => {
    test('returns valid targets for workers response port', () => {
        const targets = getValidTargets('workers', 'response');
        expect(targets.length).toBeGreaterThan(0);
        // Browser has an HTTP_RESPONSE input
        const browserTarget = targets.find(t => t.componentId === 'browser');
        expect(browserTarget).toBeDefined();
    });

    test('returns empty for unknown component', () => {
        expect(getValidTargets('nonexistent', 'foo')).toEqual([]);
    });

    test('returns empty for unknown port', () => {
        expect(getValidTargets('workers', 'nonexistent')).toEqual([]);
    });

    test('does not include self-connections', () => {
        const targets = getValidTargets('workers', 'response');
        const selfTarget = targets.find(t => t.componentId === 'workers');
        expect(selfTarget).toBeUndefined();
    });
});

// ============================================
// validateGraph
// ============================================
describe('validateGraph', () => {
    test('returns valid for empty graph', () => {
        const result = validateGraph(new Map(), new Map());
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    test('reports error for invalid node reference', () => {
        const nodes = new Map();
        const edges = new Map();
        edges.set('e1', {
            id: 'e1',
            source: { nodeId: 'missing', portId: 'response' },
            target: { nodeId: 'also-missing', portId: 'request' },
        });
        const result = validateGraph(nodes, edges);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].error).toBe('Invalid node reference');
    });
});

// ============================================
// getTypeColor
// ============================================
describe('getTypeColor', () => {
    test('returns hex color string for known types', () => {
        for (const typeValue of Object.values(TYPES)) {
            const color = getTypeColor(typeValue);
            expect(typeof color).toBe('string');
            expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
    });

    test('returns fallback color for unknown type', () => {
        const color = getTypeColor('nonexistent');
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(color).toBe('#888888');
    });

    test('HTTP types have same color', () => {
        expect(getTypeColor(TYPES.HTTP_REQUEST)).toBe(getTypeColor(TYPES.HTTP_RESPONSE));
    });

    test('SQL types have same color', () => {
        expect(getTypeColor(TYPES.SQL_QUERY)).toBe(getTypeColor(TYPES.SQL_RESULT));
    });
});

// ============================================
// getPortOffset
// ============================================
describe('getPortOffset', () => {
    // Standard node: 180x120
    const w = 180;
    const h = 120;

    test('top returns center top edge', () => {
        const offset = getPortOffset('top', w, h);
        expect(offset.x).toBe(0);
        expect(offset.y).toBe(-60);
    });

    test('bottom returns center bottom edge', () => {
        const offset = getPortOffset('bottom', w, h);
        expect(offset.x).toBe(0);
        expect(offset.y).toBe(60);
    });

    test('left returns center left edge', () => {
        const offset = getPortOffset('left', w, h);
        expect(offset.x).toBe(-90);
        expect(offset.y).toBe(0);
    });

    test('right returns center right edge', () => {
        const offset = getPortOffset('right', w, h);
        expect(offset.x).toBe(90);
        expect(offset.y).toBe(0);
    });

    test('top-left returns left quarter of top edge', () => {
        const offset = getPortOffset('top-left', w, h);
        expect(offset.x).toBe(-45);
        expect(offset.y).toBe(-60);
    });

    test('top-right returns right quarter of top edge', () => {
        const offset = getPortOffset('top-right', w, h);
        expect(offset.x).toBe(45);
        expect(offset.y).toBe(-60);
    });

    test('bottom-left returns left quarter of bottom edge', () => {
        const offset = getPortOffset('bottom-left', w, h);
        expect(offset.x).toBe(-45);
        expect(offset.y).toBe(60);
    });

    test('bottom-right returns right quarter of bottom edge', () => {
        const offset = getPortOffset('bottom-right', w, h);
        expect(offset.x).toBe(45);
        expect(offset.y).toBe(60);
    });

    test('left-top returns upper half of left edge', () => {
        const offset = getPortOffset('left-top', w, h);
        expect(offset.x).toBe(-90);
        expect(offset.y).toBe(-30);
    });

    test('left-bottom returns lower half of left edge', () => {
        const offset = getPortOffset('left-bottom', w, h);
        expect(offset.x).toBe(-90);
        expect(offset.y).toBe(30);
    });

    test('right-top returns upper half of right edge', () => {
        const offset = getPortOffset('right-top', w, h);
        expect(offset.x).toBe(90);
        expect(offset.y).toBe(-30);
    });

    test('right-bottom returns lower half of right edge', () => {
        const offset = getPortOffset('right-bottom', w, h);
        expect(offset.x).toBe(90);
        expect(offset.y).toBe(30);
    });

    test('unknown position returns default (center bottom)', () => {
        const offset = getPortOffset('nonexistent', w, h);
        expect(offset.x).toBe(0);
        expect(offset.y).toBe(60);
    });
});
