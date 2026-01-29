/**
 * Scene Behavior Tests (Static)
 *
 * Validates that key behavior fixes are present in scene.js.
 * Run with: bun test www/tests/scene-behavior.test.js
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

// ============================================
// LOAD SCENE.JS CONTENT
// ============================================

const path = require('path');
const fs = require('fs');

const scenePath = path.join(__dirname, '../scene.js');
const sceneContent = fs.readFileSync(scenePath, 'utf8');

function extractFunctionBody(content, functionName) {
    const start = content.indexOf(`function ${functionName}(`);
    if (start === -1) return null;

    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let bodyStart = -1;

    for (let i = start; i < content.length; i++) {
        const char = content[i];

        if (!inString) {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
            } else if (char === '{') {
                braceCount++;
                if (bodyStart === -1) bodyStart = i + 1;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    return content.slice(bodyStart, i);
                }
            }
        } else if (char === stringChar && content[i - 1] !== '\\') {
            inString = false;
        }
    }

    return null;
}

// ============================================
// TESTS
// ============================================

describe('Alternative Selection State', () => {
    test('applyAlternativeToComponent updates provider state and metrics', () => {
        const body = extractFunctionBody(sceneContent, 'applyAlternativeToComponent');
        assert(body, 'applyAlternativeToComponent not found');
        assert(body.includes('componentProviders[componentId] = alternative.provider'),
            'applyAlternativeToComponent should update componentProviders');
        assert(body.includes('updateMetrics()'),
            'applyAlternativeToComponent should update metrics');
    });

    test('transitionToStack resets custom selections for presets', () => {
        const body = extractFunctionBody(sceneContent, 'transitionToStack');
        assert(body, 'transitionToStack not found');
        assert(body.includes('selectedAlternatives = {}'),
            'transitionToStack should clear selectedAlternatives');
        assert(body.includes('componentProviders[id] = providerCode'),
            'transitionToStack should reset componentProviders');
    });
});

describe('Mixed Metrics', () => {
    test('calculateMixedMetrics uses component-level metrics helper', () => {
        const body = extractFunctionBody(sceneContent, 'calculateMixedMetrics');
        assert(body, 'calculateMixedMetrics not found');
        assert(body.includes('getComponentMetricsForSelection'),
            'calculateMixedMetrics should use getComponentMetricsForSelection');
    });

    test('helpers for selection metrics exist', () => {
        assert(sceneContent.includes('function getSelectedAlternative'),
            'getSelectedAlternative helper should exist');
        assert(sceneContent.includes('function getComponentMetricsForSelection'),
            'getComponentMetricsForSelection helper should exist');
        assert(sceneContent.includes('const PROVIDER_COMPONENT_IDS'),
            'PROVIDER_COMPONENT_IDS mapping should exist');
    });
});

describe('Compatibility Warnings', () => {
    test('showCompatibilityWarnings uses current component selection', () => {
        const body = extractFunctionBody(sceneContent, 'showCompatibilityWarnings');
        assert(body, 'showCompatibilityWarnings not found');
        assert(body.includes('getCurrentComponentAltId'),
            'showCompatibilityWarnings should use getCurrentComponentAltId');
    });
});

describe('Particle Latency', () => {
    test('createParticle uses selection-aware metrics for right side', () => {
        const body = extractFunctionBody(sceneContent, 'createParticle');
        assert(body, 'createParticle not found');
        assert(body.includes("side === 'right'") && body.includes('getComponentMetricsForSelection'),
            'Right-side particle latency should use getComponentMetricsForSelection');
    });
});

runTests();
