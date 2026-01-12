/**
 * Responsive Redesign Test Suite
 *
 * Test gates for each phase of the single-pane responsive redesign.
 * Run with: bun test www/tests/responsive-redesign.test.js
 */

// Simple test harness (no external deps needed)
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
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertExists(value, message) {
    if (value === undefined || value === null) {
        throw new Error(message || 'Value does not exist');
    }
}

// ============================================
// PHASE 1: Test Infrastructure & Baseline
// ============================================

describe('Phase 1: Test Infrastructure', () => {
    test('Test harness runs correctly', () => {
        assert(true, 'Basic assertion works');
    });

    test('assertEqual works', () => {
        assertEqual(1, 1, 'Numbers equal');
        assertEqual('a', 'a', 'Strings equal');
    });
});

// ============================================
// PHASE 2: Stack State Model
// ============================================

describe('Phase 2: Stack State Model', () => {
    // Import the state model (will be created)
    const fs = require('fs');
    const path = require('path');

    test('stackState.js exists', () => {
        const filePath = path.join(__dirname, '../stack-state.js');
        assert(fs.existsSync(filePath), 'stack-state.js should exist');
    });

    test('createStackState returns valid object', () => {
        // Dynamic import to test the module
        const stackStatePath = path.join(__dirname, '../stack-state.js');
        if (!fs.existsSync(stackStatePath)) {
            throw new Error('stack-state.js not yet created');
        }

        const content = fs.readFileSync(stackStatePath, 'utf8');
        assert(content.includes('createStackState'), 'Should export createStackState');
        assert(content.includes('baseline'), 'Should have baseline property');
        assert(content.includes('current'), 'Should have current property');
    });

    test('Stack presets are defined', () => {
        const stackStatePath = path.join(__dirname, '../stack-state.js');
        const content = fs.readFileSync(stackStatePath, 'utf8');

        assert(content.includes('cloudflare'), 'Should have cloudflare preset');
        assert(content.includes('aws'), 'Should have aws preset');
        assert(content.includes('gcp'), 'Should have gcp preset');
        assert(content.includes('azure'), 'Should have azure preset');
    });

    test('Diff calculation logic exists', () => {
        const stackStatePath = path.join(__dirname, '../stack-state.js');
        const content = fs.readFileSync(stackStatePath, 'utf8');

        assert(content.includes('calculateDiff'), 'Should have calculateDiff function');
    });
});

// ============================================
// PHASE 3: Stack Toggle UI Component
// ============================================

describe('Phase 3: Stack Toggle UI', () => {
    const fs = require('fs');
    const path = require('path');

    test('index.html has stack-toggle element', () => {
        const htmlPath = path.join(__dirname, '../index.html');
        const content = fs.readFileSync(htmlPath, 'utf8');

        assert(content.includes('stack-toggle'), 'Should have stack-toggle element');
    });

    test('style.css has stack-toggle styles', () => {
        const cssPath = path.join(__dirname, '../style.css');
        const content = fs.readFileSync(cssPath, 'utf8');

        assert(content.includes('.stack-toggle'), 'Should have .stack-toggle styles');
    });

    test('Stack toggle has all provider options', () => {
        const htmlPath = path.join(__dirname, '../index.html');
        const content = fs.readFileSync(htmlPath, 'utf8');

        assert(content.includes('data-stack="cloudflare"'), 'Should have cloudflare option');
        assert(content.includes('data-stack="aws"'), 'Should have aws option');
        assert(content.includes('data-stack="gcp"'), 'Should have gcp option');
        assert(content.includes('data-stack="azure"'), 'Should have azure option');
    });
});

// ============================================
// PHASE 4: Single-Pane Rendering
// ============================================

describe('Phase 4: Single-Pane Rendering', () => {
    const fs = require('fs');
    const path = require('path');

    test('scene.js has single-pane mode flag', () => {
        const scenePath = path.join(__dirname, '../scene.js');
        const content = fs.readFileSync(scenePath, 'utf8');

        assert(content.includes('SINGLE_PANE_MODE'), 'Should have SINGLE_PANE_MODE flag');
    });

    test('Split-screen divider is hidden in single-pane mode', () => {
        const cssPath = path.join(__dirname, '../style.css');
        const content = fs.readFileSync(cssPath, 'utf8');

        assert(
            content.includes('#center-divider') && content.includes('display: none'),
            'Center divider should be hideable'
        );
    });

    test('Camera uses full viewport in single-pane mode', () => {
        const scenePath = path.join(__dirname, '../scene.js');
        const content = fs.readFileSync(scenePath, 'utf8');

        // In single-pane mode, should use full viewport width
        assert(
            content.includes('fullViewportWidth') || content.includes('SINGLE_PANE'),
            'Should calculate for full viewport'
        );
    });
});

// ============================================
// PHASE 5: Bottom Sheet / Inline Comparison Panel
// ============================================

describe('Phase 5: Bottom Sheet Component', () => {
    const fs = require('fs');
    const path = require('path');

    test('bottom-sheet.css exists', () => {
        const cssPath = path.join(__dirname, '../bottom-sheet.css');
        assert(fs.existsSync(cssPath), 'bottom-sheet.css should exist');
    });

    test('Bottom sheet has mobile styles', () => {
        const cssPath = path.join(__dirname, '../bottom-sheet.css');
        const content = fs.readFileSync(cssPath, 'utf8');

        assert(content.includes('@media'), 'Should have media queries');
        assert(content.includes('768px') || content.includes('mobile'), 'Should have mobile breakpoint');
    });

    test('Bottom sheet has drag handle', () => {
        const htmlPath = path.join(__dirname, '../index.html');
        const content = fs.readFileSync(htmlPath, 'utf8');

        assert(
            content.includes('sheet-handle') || content.includes('drag-handle'),
            'Should have drag handle for mobile'
        );
    });

    test('Comparison metrics display inline', () => {
        const htmlPath = path.join(__dirname, '../index.html');
        const content = fs.readFileSync(htmlPath, 'utf8');

        assert(content.includes('comparison-inline'), 'Should have inline comparison element');
    });
});

// ============================================
// PHASE 6: Stack Transition Animations
// ============================================

describe('Phase 6: Stack Transitions', () => {
    const fs = require('fs');
    const path = require('path');

    test('Transition animation function exists', () => {
        const scenePath = path.join(__dirname, '../scene.js');
        const content = fs.readFileSync(scenePath, 'utf8');

        assert(
            content.includes('transitionToStack') || content.includes('animateStackSwitch'),
            'Should have stack transition function'
        );
    });

    test('Color transition logic exists', () => {
        const scenePath = path.join(__dirname, '../scene.js');
        const content = fs.readFileSync(scenePath, 'utf8');

        assert(
            content.includes('lerpColor') || content.includes('colorTransition'),
            'Should have color lerp/transition logic'
        );
    });
});

// ============================================
// PHASE 7: Diff Badges & Live Summary
// ============================================

describe('Phase 7: Diff Badges & Summary Bar', () => {
    const fs = require('fs');
    const path = require('path');

    test('Diff badge styles exist', () => {
        const cssPath = path.join(__dirname, '../style.css');
        const content = fs.readFileSync(cssPath, 'utf8');

        assert(content.includes('.diff-badge'), 'Should have .diff-badge styles');
    });

    test('Summary bar element exists', () => {
        const htmlPath = path.join(__dirname, '../index.html');
        const content = fs.readFileSync(htmlPath, 'utf8');

        assert(content.includes('summary-bar'), 'Should have summary-bar element');
    });

    test('Summary bar shows cost diff', () => {
        const htmlPath = path.join(__dirname, '../index.html');
        const content = fs.readFileSync(htmlPath, 'utf8');

        assert(
            content.includes('summary-cost') || content.includes('cost-diff'),
            'Should show cost difference'
        );
    });
});

// ============================================
// PHASE 8: Mobile Responsive Layout
// ============================================

describe('Phase 8: Mobile Responsive', () => {
    const fs = require('fs');
    const path = require('path');

    test('Mobile viewport meta tag exists', () => {
        const htmlPath = path.join(__dirname, '../index.html');
        const content = fs.readFileSync(htmlPath, 'utf8');

        assert(
            content.includes('viewport') && content.includes('width=device-width'),
            'Should have proper viewport meta'
        );
    });

    test('Touch events are handled', () => {
        const scenePath = path.join(__dirname, '../scene.js');
        const content = fs.readFileSync(scenePath, 'utf8');

        assert(content.includes('touchstart'), 'Should handle touchstart');
        assert(content.includes('touchend'), 'Should handle touchend');
    });

    test('Stack toggle is accessible on mobile', () => {
        const cssPath = path.join(__dirname, '../style.css');
        const content = fs.readFileSync(cssPath, 'utf8');

        // Stack toggle should be visible and have adequate touch targets
        assert(
            content.includes('.stack-toggle') && content.includes('min-height'),
            'Stack toggle should have minimum touch target size'
        );
    });

    test('Bottom sheet works on mobile', () => {
        const cssPath = path.join(__dirname, '../bottom-sheet.css');
        const content = fs.readFileSync(cssPath, 'utf8');

        assert(
            content.includes('max-height: 80vh') || content.includes('max-height: 90vh'),
            'Bottom sheet should have max height for mobile'
        );
    });

    test('Old split-screen elements are hidden on mobile', () => {
        const cssPath = path.join(__dirname, '../style.css');
        const content = fs.readFileSync(cssPath, 'utf8');

        // The old comparison table and column labels should be handled
        assert(
            content.includes('#column-labels') &&
            (content.includes('display: none') || content.includes('hidden')),
            'Old column labels should be hideable'
        );
    });
});

// ============================================
// Run all tests
// ============================================

runTests();
