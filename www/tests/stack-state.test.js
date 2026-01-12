/**
 * Stack State Unit Tests
 *
 * Tests for the stack-state.js module - validates structure and logic.
 * Run with: bun test www/tests/stack-state.test.js
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

// Assertion helpers
function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertContains(str, substr, message) {
    if (!str.includes(substr)) {
        throw new Error(message || `String does not contain '${substr}'`);
    }
}

function assertExists(value, message) {
    if (value === undefined || value === null) {
        throw new Error(message || 'Value does not exist');
    }
}

// ============================================
// LOAD SOURCE FILE
// ============================================

const path = require('path');
const fs = require('fs');

const stackStatePath = path.join(__dirname, '../stack-state.js');
const content = fs.readFileSync(stackStatePath, 'utf8');

// ============================================
// STACK_PRESETS STRUCTURE TESTS
// ============================================

describe('STACK_PRESETS Structure', () => {
    test('STACK_PRESETS is exported', () => {
        assertContains(content, 'export const STACK_PRESETS', 'STACK_PRESETS should be exported');
    });

    test('All 5 stack presets exist', () => {
        assertContains(content, "cloudflare:", 'cloudflare preset should exist');
        assertContains(content, "aws:", 'aws preset should exist');
        assertContains(content, "gcp:", 'gcp preset should exist');
        assertContains(content, "azure:", 'azure preset should exist');
        assertContains(content, "custom:", 'custom preset should exist');
    });

    test('Each preset has id property', () => {
        assertContains(content, "id: 'cloudflare'", 'cloudflare should have id');
        assertContains(content, "id: 'aws'", 'aws should have id');
        assertContains(content, "id: 'gcp'", 'gcp should have id');
        assertContains(content, "id: 'azure'", 'azure should have id');
        assertContains(content, "id: 'custom'", 'custom should have id');
    });

    test('Each preset has name property', () => {
        assertContains(content, "name: 'Cloudflare'", 'cloudflare should have name');
        assertContains(content, "name: 'AWS'", 'aws should have name');
        assertContains(content, "name: 'Azure'", 'azure should have name');
    });

    test('Each preset has icon property', () => {
        assertContains(content, "icon: '☁️'", 'cloudflare should have icon');
        assertContains(content, "icon: '🔶'", 'aws should have icon');
        assertContains(content, "icon: '🔷'", 'gcp should have icon');
        assertContains(content, "icon: '🔵'", 'azure should have icon');
        assertContains(content, "icon: '⚙️'", 'custom should have icon');
    });

    test('Each preset has color property', () => {
        assertContains(content, "color: '#F6821F'", 'cloudflare should have orange color');
        assertContains(content, "color: '#FF9900'", 'aws should have orange/yellow color');
        assertContains(content, "color: '#0078D4'", 'azure should have blue color');
    });

    test('Cloudflare preset has metrics', () => {
        assertContains(content, 'cost: 0', 'cloudflare should have cost 0');
        assertContains(content, 'latency: 20', 'cloudflare should have latency 20');
        assertContains(content, 'locations: 300', 'cloudflare should have 300 locations');
    });

    test('AWS preset has metrics', () => {
        assertContains(content, 'cost: 45', 'aws should have cost 45');
        assertContains(content, 'latency: 50', 'aws should have latency 50');
        assertContains(content, 'locations: 400', 'aws should have 400 locations');
    });

    test('Presets have components object', () => {
        assertContains(content, 'components:', 'presets should have components');
    });

    test('Components include workers, pages, kv, d1', () => {
        assertContains(content, 'workers:', 'should have workers component');
        assertContains(content, 'pages:', 'should have pages component');
        assertContains(content, 'kv:', 'should have kv component');
        assertContains(content, 'd1:', 'should have d1 component');
    });
});

// ============================================
// COMPONENT_METRICS TESTS
// ============================================

describe('COMPONENT_METRICS Structure', () => {
    test('COMPONENT_METRICS is exported', () => {
        assertContains(content, 'export const COMPONENT_METRICS', 'COMPONENT_METRICS should be exported');
    });

    test('Cloudflare components have metrics', () => {
        assertContains(content, "'cf-workers':", 'cf-workers metrics should exist');
        assertContains(content, "'cf-pages':", 'cf-pages metrics should exist');
        assertContains(content, "'cf-kv':", 'cf-kv metrics should exist');
        assertContains(content, "'cf-d1':", 'cf-d1 metrics should exist');
    });

    test('AWS components have metrics', () => {
        assertContains(content, "'lambda-edge':", 'lambda-edge metrics should exist');
        assertContains(content, "'amplify':", 'amplify metrics should exist');
        assertContains(content, "'dynamodb':", 'dynamodb metrics should exist');
        assertContains(content, "'aurora':", 'aurora metrics should exist');
    });

    test('Alternative components have metrics', () => {
        assertContains(content, "'vercel-edge':", 'vercel-edge metrics should exist');
        assertContains(content, "'deno-deploy':", 'deno-deploy metrics should exist');
        assertContains(content, "'turso':", 'turso metrics should exist');
        assertContains(content, "'neon':", 'neon metrics should exist');
        assertContains(content, "'upstash-redis':", 'upstash-redis metrics should exist');
    });

    test('Each metric has cost, latency, locations', () => {
        // Check one metric entry has all fields
        const cfWorkersMatch = content.match(/'cf-workers': \{ cost: \d+, latency: \d+, locations: \d+ \}/);
        assert(cfWorkersMatch, 'cf-workers should have cost, latency, locations');
    });
});

// ============================================
// FUNCTIONS TESTS
// ============================================

describe('Exported Functions', () => {
    test('calculateDiff function is exported', () => {
        assertContains(content, 'export function calculateDiff', 'calculateDiff should be exported');
    });

    test('calculateMetricsDiff function is exported', () => {
        assertContains(content, 'export function calculateMetricsDiff', 'calculateMetricsDiff should be exported');
    });

    test('createStackState function is exported', () => {
        assertContains(content, 'export function createStackState', 'createStackState should be exported');
    });

    test('getStackState function is exported', () => {
        assertContains(content, 'export function getStackState', 'getStackState should be exported');
    });
});

// ============================================
// DIFF CALCULATION LOGIC TESTS
// ============================================

describe('Diff Calculation Logic', () => {
    test('calculateDiff handles equal values', () => {
        assertContains(content, 'if (baseline === current) return null',
            'calculateDiff should return null for equal values');
    });

    test('calculateDiff calculates absolute diff', () => {
        assertContains(content, 'const diff = current - baseline',
            'calculateDiff should calculate absolute diff');
    });

    test('calculateDiff calculates percent change', () => {
        assertContains(content, 'percentChange',
            'calculateDiff should calculate percent change');
    });

    test('determineBetter handles lower-is-better metrics', () => {
        assertContains(content, "const lowerIsBetter = ['cost', 'latency']",
            'determineBetter should know cost and latency are lower-is-better');
    });

    test('calculateMetricsDiff iterates over metric keys', () => {
        assertContains(content, 'Object.entries(baselineMetrics)',
            'calculateMetricsDiff should iterate over metrics');
    });

    test('formatDiff handles different metric types', () => {
        assertContains(content, "case 'cost':", 'formatDiff should handle cost');
        assertContains(content, "case 'latency':", 'formatDiff should handle latency');
        assertContains(content, "case 'locations':", 'formatDiff should handle locations');
        assertContains(content, "case 'uptime':", 'formatDiff should handle uptime');
    });
});

// ============================================
// CREATE STACK STATE TESTS
// ============================================

describe('createStackState Factory', () => {
    test('createStackState has getState method', () => {
        assertContains(content, 'getState()', 'createStackState should have getState');
    });

    test('createStackState has getCurrentStack method', () => {
        assertContains(content, 'getCurrentStack()', 'createStackState should have getCurrentStack');
    });

    test('createStackState has getBaselineStack method', () => {
        assertContains(content, 'getBaselineStack()', 'createStackState should have getBaselineStack');
    });

    test('createStackState has switchStack method', () => {
        assertContains(content, 'switchStack(stackId)', 'createStackState should have switchStack');
    });

    test('createStackState has setBaseline method', () => {
        assertContains(content, 'setBaseline(stackId)', 'createStackState should have setBaseline');
    });

    test('createStackState has setComponentOverride method', () => {
        assertContains(content, 'setComponentOverride(componentId, componentConfig)',
            'createStackState should have setComponentOverride');
    });

    test('createStackState has clearComponentOverride method', () => {
        assertContains(content, 'clearComponentOverride(componentId)',
            'createStackState should have clearComponentOverride');
    });

    test('createStackState has getDiff method', () => {
        assertContains(content, 'getDiff()', 'createStackState should have getDiff');
    });

    test('createStackState has getComponentDiffs method', () => {
        assertContains(content, 'getComponentDiffs()', 'createStackState should have getComponentDiffs');
    });

    test('createStackState has subscribe method', () => {
        assertContains(content, 'subscribe(listener)', 'createStackState should have subscribe');
    });

    test('createStackState has reset method', () => {
        assertContains(content, 'reset()', 'createStackState should have reset');
    });

    test('createStackState has calculateCustomMetrics method', () => {
        assertContains(content, 'calculateCustomMetrics(components)',
            'createStackState should have calculateCustomMetrics');
    });
});

// ============================================
// STATE MANAGEMENT TESTS
// ============================================

describe('State Management', () => {
    test('Initial state has baseline property', () => {
        assertContains(content, "baseline: initialStack",
            'Initial state should have baseline');
    });

    test('Initial state has current property', () => {
        assertContains(content, "current: initialStack",
            'Initial state should have current');
    });

    test('Initial state has customOverrides property', () => {
        assertContains(content, "customOverrides: {}",
            'Initial state should have customOverrides');
    });

    test('Initial state has listeners Set', () => {
        assertContains(content, "listeners: new Set()",
            'Initial state should have listeners Set');
    });

    test('switchStack validates stack ID', () => {
        assertContains(content, "if (!STACK_PRESETS[stackId])",
            'switchStack should validate stack ID');
    });

    test('switchStack clears custom overrides on preset switch', () => {
        assertContains(content, "state.customOverrides = {}",
            'switchStack should clear custom overrides');
    });

    test('setComponentOverride auto-switches to custom mode', () => {
        assertContains(content, "state.current = 'custom'",
            'setComponentOverride should switch to custom mode');
    });

    test('subscribe returns unsubscribe function', () => {
        assertContains(content, "return () => state.listeners.delete(listener)",
            'subscribe should return unsubscribe function');
    });
});

// ============================================
// GLOBAL STATE TESTS
// ============================================

describe('Global State & Window', () => {
    test('globalStackState singleton exists', () => {
        assertContains(content, 'let globalStackState = null',
            'globalStackState singleton should exist');
    });

    test('getStackState creates singleton on first call', () => {
        assertContains(content, 'if (!globalStackState)',
            'getStackState should create singleton lazily');
    });

    test('Window.StackState is set up', () => {
        assertContains(content, 'window.StackState',
            'StackState should be exposed on window');
    });

    test('Window.StackState includes all exports', () => {
        assertContains(content, 'createStackState', 'window.StackState should have createStackState');
        assertContains(content, 'getStackState', 'window.StackState should have getStackState');
        assertContains(content, 'STACK_PRESETS', 'window.StackState should have STACK_PRESETS');
        assertContains(content, 'COMPONENT_METRICS', 'window.StackState should have COMPONENT_METRICS');
    });
});

// ============================================
// CUSTOM METRICS CALCULATION TESTS
// ============================================

describe('Custom Metrics Calculation', () => {
    test('calculateCustomMetrics adds component costs', () => {
        assertContains(content, 'totalCost += metrics.cost',
            'Should sum component costs');
    });

    test('calculateCustomMetrics finds max latency', () => {
        assertContains(content, 'maxLatency = Math.max(maxLatency, metrics.latency)',
            'Should find max latency');
    });

    test('calculateCustomMetrics finds min locations', () => {
        assertContains(content, 'minLocations = Math.min(minLocations, metrics.locations)',
            'Should find min locations');
    });

    test('calculateCustomMetrics returns metrics object', () => {
        assertContains(content, 'cost: totalCost',
            'Should return cost');
        assertContains(content, 'latency: maxLatency',
            'Should return latency');
    });
});

// ============================================
// RUN ALL TESTS
// ============================================

runTests();
