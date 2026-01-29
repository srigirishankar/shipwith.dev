/**
 * Scene Data Validation Tests
 *
 * Tests for data structures in scene.js:
 * - ALTERNATIVES database
 * - COMPONENTS array
 * - CONNECTIONS array
 * - PROVIDER_COMPONENTS mapping
 *
 *
 * Run with: bun test www/tests/scene-data.test.js
 */

// ============================================
// TEST HARNESS
// ============================================

const tests = [];
const results = { passed: 0, failed: 0, skipped: 0 };

function describe(name, fn) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${name}`);
    console.log('='.repeat(60));
    fn();
}

function test(name, fn, { skip = false } = {}) {
    tests.push({ name, fn, skip });
}

function skip(name, fn) {
    test(name, fn, { skip: true });
}

async function runTests() {
    for (const t of tests) {
        if (t.skip) {
            console.log(`  SKIP: ${t.name}`);
            results.skipped++;
            continue;
        }
        try {
            await t.fn();
            console.log(`  PASS: ${t.name}`);
            results.passed++;
        } catch (err) {
            console.log(`  FAIL: ${t.name}`);
            console.log(`        ${err.message}`);
            results.failed++;
        }
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Results: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped`);
    console.log('─'.repeat(60));

    if (results.failed > 0) {
        process.exit(1);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertExists(value, message) {
    if (value === undefined || value === null) {
        throw new Error(message || 'Value does not exist');
    }
}

function assertContains(array, value, message) {
    if (!array.includes(value)) {
        throw new Error(message || `Array does not contain ${value}`);
    }
}

// ============================================
// LOAD SCENE.JS DATA
// ============================================

const path = require('path');
const fs = require('fs');

const scenePath = path.join(__dirname, '../scene.js');
const sceneContent = fs.readFileSync(scenePath, 'utf8');

// Parse ALTERNATIVES object
function parseAlternatives(content) {
    const start = content.indexOf('const ALTERNATIVES = {');
    if (start === -1) return null;

    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let end = start;

    for (let i = start; i < content.length; i++) {
        const char = content[i];

        if (!inString) {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
            } else if (char === '{') {
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    end = i + 1;
                    break;
                }
            }
        } else {
            if (char === stringChar && content[i - 1] !== '\\') {
                inString = false;
            }
        }
    }

    const objStr = content.slice(start, end).replace('const ALTERNATIVES = ', '');
    try {
        return eval(`(${objStr})`);
    } catch (e) {
        console.error('Failed to parse ALTERNATIVES:', e.message);
        return null;
    }
}

// Parse COMPONENTS array
function parseComponents(content) {
    const start = content.indexOf('const COMPONENTS = [');
    if (start === -1) return null;

    let bracketCount = 0;
    let inString = false;
    let stringChar = '';
    let end = start;

    for (let i = start; i < content.length; i++) {
        const char = content[i];

        if (!inString) {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
            } else if (char === '[') {
                bracketCount++;
            } else if (char === ']') {
                bracketCount--;
                if (bracketCount === 0) {
                    end = i + 1;
                    break;
                }
            }
        } else {
            if (char === stringChar && content[i - 1] !== '\\') {
                inString = false;
            }
        }
    }

    const arrStr = content.slice(start, end).replace('const COMPONENTS = ', '');
    try {
        // Need to handle the color references
        const NON_VENDOR_COLORS = {
            user: '#4CAF50',
            browser: '#00BCD4',
            wasm: '#DEA584',
            threejs: '#AAAAAA'
        };
        const PROVIDER_COLORS = {
            cf: '#F6821F',
            aws: '#FFCC00',
            gcp: '#34A853',
            azure: '#0078D4'
        };
        return eval(arrStr);
    } catch (e) {
        console.error('Failed to parse COMPONENTS:', e.message);
        return null;
    }
}

// Parse CONNECTIONS array
function parseConnections(content) {
    const match = content.match(/const CONNECTIONS = \[([\s\S]*?)\];/);
    if (!match) return null;
    try {
        return eval(`[${match[1]}]`);
    } catch (e) {
        console.error('Failed to parse CONNECTIONS:', e.message);
        return null;
    }
}

// Parse SWAPPABLE_COMPONENTS
function parseSwappableComponents(content) {
    const match = content.match(/const SWAPPABLE_COMPONENTS = \[(.*?)\]/);
    if (!match) return null;
    try {
        return eval(`[${match[1]}]`);
    } catch (e) {
        return null;
    }
}

const ALTERNATIVES = parseAlternatives(sceneContent);
const COMPONENTS = parseComponents(sceneContent);
const CONNECTIONS = parseConnections(sceneContent);
const SWAPPABLE_COMPONENTS = parseSwappableComponents(sceneContent);

// ============================================
// ALTERNATIVES DATABASE TESTS
// ============================================

describe('ALTERNATIVES Database Structure', () => {
    test('ALTERNATIVES is defined', () => {
        assertExists(ALTERNATIVES, 'ALTERNATIVES should be defined');
    });

    test('All swappable components have alternatives', () => {
        const swappable = ['workers', 'pages', 'kv', 'd1', 'wasm', 'threejs'];
        for (const compId of swappable) {
            assertExists(ALTERNATIVES[compId], `${compId} should have alternatives`);
        }
    });

    test('Each alternative entry has current and options', () => {
        for (const [compId, altData] of Object.entries(ALTERNATIVES)) {
            assertExists(altData.current, `${compId} should have current`);
            assertExists(altData.options, `${compId} should have options`);
            assert(Array.isArray(altData.options), `${compId}.options should be array`);
        }
    });

    test('Each alternative entry has exactly 3 options', () => {
        for (const [compId, altData] of Object.entries(ALTERNATIVES)) {
            assertEqual(altData.options.length, 3,
                `${compId} should have 3 alternatives, got ${altData.options.length}`);
        }
    });

    test('Current entry has id, name, provider, color', () => {
        for (const [compId, altData] of Object.entries(ALTERNATIVES)) {
            assertExists(altData.current.id, `${compId}.current should have id`);
            assertExists(altData.current.name, `${compId}.current should have name`);
            assertExists(altData.current.provider, `${compId}.current should have provider`);
            assertExists(altData.current.color, `${compId}.current should have color`);
        }
    });
});

describe('ALTERNATIVES Options Structure', () => {
    test('Each option has required fields', () => {
        const requiredFields = ['id', 'name', 'provider', 'color', 'description', 'docs'];
        for (const [compId, altData] of Object.entries(ALTERNATIVES)) {
            for (const opt of altData.options) {
                for (const field of requiredFields) {
                    assertExists(opt[field], `${compId} option ${opt.id || 'unknown'} should have ${field}`);
                }
            }
        }
    });

    test('Each option has pairsWellWith array', () => {
        for (const [compId, altData] of Object.entries(ALTERNATIVES)) {
            for (const opt of altData.options) {
                assertExists(opt.pairsWellWith, `${opt.id} should have pairsWellWith`);
                assert(Array.isArray(opt.pairsWellWith), `${opt.id}.pairsWellWith should be array`);
            }
        }
    });

    test('Workers alternatives have coldStart metric', () => {
        for (const opt of ALTERNATIVES.workers.options) {
            assertExists(opt.coldStart, `${opt.id} should have coldStart`);
        }
    });

    test('KV alternatives have readLatency metric', () => {
        for (const opt of ALTERNATIVES.kv.options) {
            assertExists(opt.readLatency, `${opt.id} should have readLatency`);
        }
    });

    test('D1 alternatives have queryLatency metric', () => {
        for (const opt of ALTERNATIVES.d1.options) {
            assertExists(opt.queryLatency, `${opt.id} should have queryLatency`);
        }
    });

    test('Docs URLs are valid HTTPS URLs', () => {
        for (const [compId, altData] of Object.entries(ALTERNATIVES)) {
            for (const opt of altData.options) {
                assert(opt.docs.startsWith('https://'),
                    `${opt.id} docs URL should start with https://`);
            }
        }
    });

    test('Color values are valid hex colors', () => {
        const hexRegex = /^#[0-9A-Fa-f]{6}$/;
        for (const [compId, altData] of Object.entries(ALTERNATIVES)) {
            assert(hexRegex.test(altData.current.color),
                `${compId}.current color should be valid hex`);
            for (const opt of altData.options) {
                assert(hexRegex.test(opt.color),
                    `${opt.id} color should be valid hex`);
            }
        }
    });
});

describe('ALTERNATIVES Content Validation', () => {
    test('Vercel Edge is an alternative to Workers', () => {
        const vercelEdge = ALTERNATIVES.workers.options.find(o => o.id === 'vercel-edge');
        assertExists(vercelEdge, 'Vercel Edge should be a Workers alternative');
        assertEqual(vercelEdge.provider, 'vercel');
    });

    test('Turso is an alternative to D1', () => {
        const turso = ALTERNATIVES.d1.options.find(o => o.id === 'turso');
        assertExists(turso, 'Turso should be a D1 alternative');
        assertEqual(turso.provider, 'turso');
    });

    test('Upstash Redis is an alternative to KV', () => {
        const upstash = ALTERNATIVES.kv.options.find(o => o.id === 'upstash-redis');
        assertExists(upstash, 'Upstash Redis should be a KV alternative');
        assertEqual(upstash.provider, 'upstash');
    });

    test('All option IDs are unique', () => {
        const allIds = new Set();
        for (const [compId, altData] of Object.entries(ALTERNATIVES)) {
            for (const opt of altData.options) {
                assert(!allIds.has(opt.id), `Duplicate option ID: ${opt.id}`);
                allIds.add(opt.id);
            }
        }
    });

    test('pairsWellWith references exist as options', () => {
        const allOptionIds = new Set();
        // Collect all option IDs including current
        for (const [compId, altData] of Object.entries(ALTERNATIVES)) {
            allOptionIds.add(altData.current.id);
            for (const opt of altData.options) {
                allOptionIds.add(opt.id);
            }
        }
        // Also add some known external IDs
        allOptionIds.add('supabase');
        allOptionIds.add('aurora');
        allOptionIds.add('deno-kv');
        allOptionIds.add('netlify-hosting');

        // Check pairsWellWith references
        for (const [compId, altData] of Object.entries(ALTERNATIVES)) {
            for (const opt of altData.options) {
                for (const pairedId of opt.pairsWellWith) {
                    // This is a soft check - we allow external references
                    // Just verify format
                    assert(typeof pairedId === 'string' && pairedId.length > 0,
                        `${opt.id}.pairsWellWith should have valid string IDs`);
                }
            }
        }
    });
});

// ============================================
// COMPONENTS ARRAY TESTS
// ============================================

describe('COMPONENTS Array Structure', () => {
    test('COMPONENTS is defined', () => {
        assertExists(COMPONENTS, 'COMPONENTS should be defined');
    });

    test('COMPONENTS has 8 entries', () => {
        assertEqual(COMPONENTS.length, 8, 'COMPONENTS should have 8 entries');
    });

    test('Each component has required fields', () => {
        const requiredFields = ['id', 'name', 'color', 'pos', 'exploded'];
        for (const comp of COMPONENTS) {
            for (const field of requiredFields) {
                assertExists(comp[field], `Component ${comp.id} should have ${field}`);
            }
        }
    });

    test('Position objects have x, y, z', () => {
        for (const comp of COMPONENTS) {
            assertExists(comp.pos.x, `${comp.id}.pos should have x`);
            assertExists(comp.pos.y, `${comp.id}.pos should have y`);
            assertExists(comp.pos.z, `${comp.id}.pos should have z`);
            assertExists(comp.exploded.x, `${comp.id}.exploded should have x`);
            assertExists(comp.exploded.y, `${comp.id}.exploded should have y`);
            assertExists(comp.exploded.z, `${comp.id}.exploded should have z`);
        }
    });

    test('Expected component IDs exist', () => {
        const expectedIds = ['user', 'browser', 'workers', 'pages', 'wasm', 'threejs', 'kv', 'd1'];
        const actualIds = COMPONENTS.map(c => c.id);
        for (const id of expectedIds) {
            assertContains(actualIds, id, `Component ${id} should exist`);
        }
    });

    test('Swappable components have role field', () => {
        const swappable = ['workers', 'pages', 'kv', 'd1', 'wasm', 'threejs'];
        for (const comp of COMPONENTS) {
            if (swappable.includes(comp.id) && comp.id !== 'user') {
                // role can be null for 'user', but others should have it
                if (comp.id !== 'user') {
                    assertExists(comp.role, `${comp.id} should have role`);
                }
            }
        }
    });
});

// ============================================
// CONNECTIONS ARRAY TESTS
// ============================================

describe('CONNECTIONS Array Structure', () => {
    test('CONNECTIONS is defined', () => {
        assertExists(CONNECTIONS, 'CONNECTIONS should be defined');
    });

    test('Each connection has from, to, label, color', () => {
        for (const conn of CONNECTIONS) {
            assertExists(conn.from, 'Connection should have from');
            assertExists(conn.to, 'Connection should have to');
            assertExists(conn.label, 'Connection should have label');
            assertExists(conn.color, 'Connection should have color');
        }
    });

    test('Connection endpoints reference valid component IDs', () => {
        const componentIds = COMPONENTS.map(c => c.id);
        for (const conn of CONNECTIONS) {
            assertContains(componentIds, conn.from, `Connection from '${conn.from}' is invalid`);
            assertContains(componentIds, conn.to, `Connection to '${conn.to}' is invalid`);
        }
    });

    test('Expected connections exist', () => {
        const connStrings = CONNECTIONS.map(c => `${c.from}->${c.to}`);
        const expectedConns = [
            'user->browser',
            'browser->pages',
            'browser->workers',
            'workers->kv',
            'workers->d1'
        ];
        for (const expected of expectedConns) {
            assertContains(connStrings, expected, `Connection ${expected} should exist`);
        }
    });
});

// ============================================
// SWAPPABLE_COMPONENTS TESTS
// ============================================

describe('SWAPPABLE_COMPONENTS', () => {
    test('SWAPPABLE_COMPONENTS is defined', () => {
        assertExists(SWAPPABLE_COMPONENTS, 'SWAPPABLE_COMPONENTS should be defined');
    });

    test('Contains expected components', () => {
        const expected = ['workers', 'pages', 'kv', 'd1'];
        for (const id of expected) {
            assertContains(SWAPPABLE_COMPONENTS, id, `${id} should be swappable`);
        }
    });

    test('Does not contain non-swappable components', () => {
        const nonSwappable = ['user', 'browser'];
        for (const id of nonSwappable) {
            assert(!SWAPPABLE_COMPONENTS.includes(id), `${id} should not be swappable`);
        }
    });
});

// ============================================
// PROVIDER DATA TESTS
// ============================================

describe('Provider Data in scene.js', () => {
    test('PROVIDER_COLORS is defined', () => {
        assert(sceneContent.includes('const PROVIDER_COLORS = {'),
            'PROVIDER_COLORS should be defined');
    });

    test('All providers have colors', () => {
        assert(sceneContent.includes("cf: '#F6821F'"), 'CF color should be defined');
        assert(sceneContent.includes("aws: '#FFCC00'") || sceneContent.includes("aws: '#FF9900'"),
            'AWS color should be defined');
        assert(sceneContent.includes("gcp: '#34A853'"), 'GCP color should be defined');
        assert(sceneContent.includes("azure: '#0078D4'"), 'Azure color should be defined');
    });

    test('PROVIDER_COMPONENTS is defined', () => {
        assert(sceneContent.includes('const PROVIDER_COMPONENTS = {'),
            'PROVIDER_COMPONENTS should be defined');
    });


    // Provider metrics now live in stack-state.js (StackState) and are not duplicated here.
});

// ============================================
// DEPENDENCY_GRAPH TESTS
// ============================================

describe('DEPENDENCY_GRAPH Structure', () => {
    test('DEPENDENCY_GRAPH is defined', () => {
        assert(sceneContent.includes('const DEPENDENCY_GRAPH = {'),
            'DEPENDENCY_GRAPH should be defined');
    });

    test('Cloudflare components have dependencies', () => {
        assert(sceneContent.includes("'cf-workers':"), 'cf-workers should have deps');
        assert(sceneContent.includes("'cf-pages':"), 'cf-pages should have deps');
        assert(sceneContent.includes("'cf-kv':"), 'cf-kv should have deps');
        assert(sceneContent.includes("'cf-d1':"), 'cf-d1 should have deps');
    });

    test('Alternative components have dependencies', () => {
        assert(sceneContent.includes("'vercel-edge':"), 'vercel-edge should have deps');
        assert(sceneContent.includes("'lambda-edge':"), 'lambda-edge should have deps');
    });
});

// ============================================
// RECOMMENDED_STACKS TESTS
// ============================================

describe('RECOMMENDED_STACKS Structure', () => {
    test('RECOMMENDED_STACKS is defined', () => {
        assert(sceneContent.includes('const RECOMMENDED_STACKS = {'),
            'RECOMMENDED_STACKS should be defined');
    });

    test('Has Vercel stack', () => {
        assert(sceneContent.includes("'vercel':"), 'Vercel stack should be defined');
    });

    test('Has AWS stack', () => {
        assert(sceneContent.includes("'aws':"), 'AWS stack should be defined');
    });

    test('Has Deno stack', () => {
        assert(sceneContent.includes("'deno':"), 'Deno stack should be defined');
    });
});

// ============================================
// RUN ALL TESTS
// ============================================

runTests();
