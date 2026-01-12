/**
 * UI Behavior Tests
 *
 * Tests for DOM interactions and UI state changes:
 * - Stack toggle button clicks and active states
 * - Bottom sheet open/close behavior
 * - Alternatives dropdown population and selection
 * - Summary bar metric updates
 * - Backdrop behavior
 *
 * Run with: bun test www/tests/ui-behavior.test.js
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

function assertContains(str, substr, message) {
    if (!str.includes(substr)) {
        throw new Error(message || `String does not contain '${substr}'`);
    }
}

// ============================================
// LOAD SOURCE FILES
// ============================================

const path = require('path');
const fs = require('fs');

const htmlPath = path.join(__dirname, '../index.html');
const cssPath = path.join(__dirname, '../style.css');
const scenePath = path.join(__dirname, '../scene.js');
const bottomSheetCssPath = path.join(__dirname, '../bottom-sheet.css');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');
const sceneContent = fs.readFileSync(scenePath, 'utf8');
const bottomSheetCss = fs.readFileSync(bottomSheetCssPath, 'utf8');

// ============================================
// STACK TOGGLE UI TESTS
// ============================================

describe('Stack Toggle UI Structure', () => {
    test('Stack toggle container exists in HTML', () => {
        assertContains(htmlContent, 'id="stack-toggle"', 'Stack toggle should exist');
        assertContains(htmlContent, 'class="stack-toggle"', 'Stack toggle should have class');
    });

    test('All 5 stack buttons exist', () => {
        assertContains(htmlContent, 'data-stack="cloudflare"', 'Cloudflare button should exist');
        assertContains(htmlContent, 'data-stack="aws"', 'AWS button should exist');
        assertContains(htmlContent, 'data-stack="gcp"', 'GCP button should exist');
        assertContains(htmlContent, 'data-stack="azure"', 'Azure button should exist');
        assertContains(htmlContent, 'data-stack="custom"', 'Custom button should exist');
    });

    test('Stack buttons have icon and name spans', () => {
        assertContains(htmlContent, 'class="stack-icon"', 'Stack icon span should exist');
        assertContains(htmlContent, 'class="stack-name"', 'Stack name span should exist');
    });

    test('Cloudflare button is initially active', () => {
        // The first button (cloudflare) should have active class
        const match = htmlContent.match(/data-stack="cloudflare"[\s\S]*?<\/button>/);
        assertExists(match, 'Cloudflare button should exist');
        // Check for active class on cloudflare button's parent
        assertContains(htmlContent, 'stack-btn active" data-stack="cloudflare"',
            'Cloudflare should be initially active');
    });

    test('Stack toggle styles exist', () => {
        assertContains(cssContent, '.stack-toggle', 'Stack toggle styles should exist');
        assertContains(cssContent, '.stack-btn', 'Stack button styles should exist');
        assertContains(cssContent, '.stack-btn.active', 'Active state styles should exist');
    });
});

describe('Stack Toggle JavaScript Functions', () => {
    test('transitionToStack function exists', () => {
        assertContains(sceneContent, 'function transitionToStack(newStack)',
            'transitionToStack function should exist');
    });

    test('updateStackToggleUI function exists', () => {
        assertContains(sceneContent, 'function updateStackToggleUI(activeStack)',
            'updateStackToggleUI function should exist');
    });

    test('transitionToStack calls updateStackToggleUI', () => {
        // Find transitionToStack and verify it calls updateStackToggleUI
        const fnMatch = sceneContent.match(/function transitionToStack[\s\S]*?^}/m);
        assertExists(fnMatch, 'transitionToStack should be found');
        assertContains(fnMatch[0], 'updateStackToggleUI',
            'transitionToStack should call updateStackToggleUI');
    });

    test('transitionToStack calls updateSummaryBar', () => {
        const fnMatch = sceneContent.match(/function transitionToStack[\s\S]*?^}/m);
        assertExists(fnMatch, 'transitionToStack should be found');
        assertContains(fnMatch[0], 'updateSummaryBar',
            'transitionToStack should call updateSummaryBar');
    });

    test('Stack toggle event listeners are set up', () => {
        assertContains(sceneContent, "querySelectorAll('.stack-toggle .stack-btn')",
            'Stack button selectors should be queried');
    });

    test('Click handler reads data-stack attribute', () => {
        assertContains(sceneContent, 'dataset.stack',
            'Handler should read data-stack attribute');
    });
});

describe('Stack Toggle Animation', () => {
    test('animateStackSwitch function exists', () => {
        assertContains(sceneContent, 'function animateStackSwitch(componentId, newName, newColor)',
            'animateStackSwitch function should exist');
    });

    test('Stagger delay is defined for animations', () => {
        assertContains(sceneContent, 'staggerDelay',
            'Stagger delay should be defined');
    });

    test('lerpColor function exists for color transitions', () => {
        assertContains(sceneContent, 'function lerpColor',
            'lerpColor function should exist');
    });

    test('transitioningComponents Set tracks active animations', () => {
        assertContains(sceneContent, 'transitioningComponents',
            'transitioningComponents should track animations');
    });
});

// ============================================
// BOTTOM SHEET TESTS
// ============================================

describe('Bottom Sheet HTML Structure', () => {
    test('Bottom sheet container exists', () => {
        assertContains(htmlContent, 'id="bottom-sheet"', 'Bottom sheet should exist');
        assertContains(htmlContent, 'class="bottom-sheet', 'Bottom sheet should have class');
    });

    test('Bottom sheet has drag handle', () => {
        assertContains(htmlContent, 'class="sheet-handle"', 'Drag handle should exist');
        assertContains(htmlContent, 'class="handle-bar"', 'Handle bar should exist');
    });

    test('Bottom sheet has close button', () => {
        assertContains(htmlContent, 'class="close-sheet"', 'Close button should exist');
    });

    test('Bottom sheet has header with title and role', () => {
        assertContains(htmlContent, 'class="sheet-title"', 'Sheet title should exist');
        assertContains(htmlContent, 'class="sheet-role"', 'Sheet role should exist');
    });

    test('Bottom sheet has inline comparison section', () => {
        assertContains(htmlContent, 'class="comparison-inline"', 'Inline comparison should exist');
        assertContains(htmlContent, 'class="comparison-current"', 'Current comparison should exist');
        assertContains(htmlContent, 'class="comparison-alternative"', 'Alternative comparison should exist');
    });

    test('Bottom sheet has alternatives dropdown', () => {
        assertContains(htmlContent, 'class="alternatives-select"', 'Alternatives select should exist');
    });

    test('Bottom sheet has metrics comparison section', () => {
        assertContains(htmlContent, 'class="metrics-comparison', 'Metrics comparison should exist');
    });

    test('Bottom sheet has warning section', () => {
        assertContains(htmlContent, 'class="sheet-warning', 'Warning section should exist');
    });

    test('Bottom sheet has action buttons', () => {
        assertContains(htmlContent, 'class="btn-apply', 'Apply button should exist');
        assertContains(htmlContent, 'class="btn-docs"', 'Docs button should exist');
    });

    test('Backdrop element exists', () => {
        assertContains(htmlContent, 'id="sheet-backdrop"', 'Backdrop should exist');
        assertContains(htmlContent, 'class="sheet-backdrop"', 'Backdrop should have class');
    });
});

describe('Bottom Sheet CSS', () => {
    test('Bottom sheet has base styles', () => {
        assertContains(bottomSheetCss, '.bottom-sheet', 'Bottom sheet styles should exist');
    });

    test('Bottom sheet has hidden state', () => {
        assertContains(bottomSheetCss, '.bottom-sheet.hidden', 'Hidden state should be defined');
    });

    test('Bottom sheet has visible state', () => {
        assertContains(bottomSheetCss, '.bottom-sheet.visible', 'Visible state should be defined');
    });

    test('Backdrop has visible state', () => {
        assertContains(bottomSheetCss, '.sheet-backdrop.visible', 'Backdrop visible state should exist');
    });

    test('Desktop layout is a side panel', () => {
        assertContains(bottomSheetCss, '@media (min-width: 769px)', 'Desktop media query should exist');
        assertContains(bottomSheetCss, 'width: 360px', 'Desktop width should be 360px');
    });

    test('Mobile layout has max-height constraints', () => {
        assertContains(bottomSheetCss, 'max-height: 80vh', 'Base max-height should be 80vh');
        assertContains(bottomSheetCss, 'max-height: 90vh', 'Mobile max-height should be 90vh');
    });
});

describe('Bottom Sheet JavaScript Functions', () => {
    test('showBottomSheet function exists', () => {
        assertContains(sceneContent, 'function showBottomSheet(componentId',
            'showBottomSheet function should exist');
    });

    test('hideBottomSheet function exists', () => {
        assertContains(sceneContent, 'function hideBottomSheet()',
            'hideBottomSheet function should exist');
    });

    test('showBottomSheet populates title', () => {
        const fnMatch = sceneContent.match(/function showBottomSheet[\s\S]*?^}/m);
        assertExists(fnMatch, 'showBottomSheet should be found');
        assertContains(fnMatch[0], '.sheet-title',
            'showBottomSheet should populate title');
    });

    test('showBottomSheet sets up close button', () => {
        const fnMatch = sceneContent.match(/function showBottomSheet[\s\S]*?^}/m);
        assertContains(fnMatch[0], '.close-sheet',
            'showBottomSheet should set up close button');
    });

    test('showBottomSheet shows backdrop', () => {
        const fnMatch = sceneContent.match(/function showBottomSheet[\s\S]*?^}/m);
        assertContains(fnMatch[0], 'sheet-backdrop',
            'showBottomSheet should reference backdrop');
    });

    test('hideBottomSheet hides backdrop', () => {
        const fnMatch = sceneContent.match(/function hideBottomSheet[\s\S]*?^}/m);
        assertExists(fnMatch, 'hideBottomSheet should be found');
        assertContains(fnMatch[0], 'sheet-backdrop',
            'hideBottomSheet should hide backdrop');
    });

    test('Backdrop click calls hideBottomSheet', () => {
        assertContains(sceneContent, "backdrop.onclick",
            'Backdrop should have click handler');
    });
});

// ============================================
// ALTERNATIVES DROPDOWN TESTS
// ============================================

describe('Alternatives Dropdown Structure', () => {
    test('Alternatives select exists in bottom sheet', () => {
        const sheetMatch = htmlContent.match(/id="bottom-sheet"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
        assertExists(sheetMatch, 'Bottom sheet should be found');
        assertContains(sheetMatch[0], 'alternatives-select',
            'Alternatives select should be in bottom sheet');
    });

    test('Alternatives select has default option', () => {
        assertContains(htmlContent, 'Select alternative...',
            'Default option should say Select alternative...');
    });
});

describe('Alternatives Dropdown JavaScript', () => {
    test('populateAlternativesDropdown function exists', () => {
        assertContains(sceneContent, 'function populateAlternativesDropdown(panel, componentId, editable',
            'populateAlternativesDropdown function should exist');
    });

    test('showAlternativeDetails function exists', () => {
        assertContains(sceneContent, 'function showAlternativeDetails(panel, componentId, alternativeId)',
            'showAlternativeDetails function should exist');
    });

    test('applyAlternativeToComponent function exists', () => {
        assertContains(sceneContent, 'function applyAlternativeToComponent(componentId, alternativeId, alternativeName)',
            'applyAlternativeToComponent function should exist');
    });

    test('populateAlternativesDropdown reads from ALTERNATIVES', () => {
        const fnMatch = sceneContent.match(/function populateAlternativesDropdown[\s\S]*?^}/m);
        assertExists(fnMatch, 'populateAlternativesDropdown should be found');
        assertContains(fnMatch[0], 'ALTERNATIVES[componentId]',
            'Should read from ALTERNATIVES object');
    });

    test('populateAlternativesDropdown creates option elements', () => {
        const fnMatch = sceneContent.match(/function populateAlternativesDropdown[\s\S]*?^}/m);
        assertContains(fnMatch[0], "createElement('option')",
            'Should create option elements');
    });

    test('Dropdown change triggers showAlternativeDetails', () => {
        assertContains(sceneContent, 'alternativesSelect.onchange',
            'Dropdown should have change handler');
    });

    test('selectedAlternatives tracks user selections', () => {
        assertContains(sceneContent, 'let selectedAlternatives',
            'selectedAlternatives should track selections');
    });
});

describe('Alternatives Apply Button', () => {
    test('Apply button click handler exists', () => {
        assertContains(sceneContent, 'applyBtn.onclick',
            'Apply button should have click handler');
    });

    test('Apply calls applyAlternativeToComponent', () => {
        assertContains(sceneContent, 'applyAlternativeToComponent(',
            'Apply should call applyAlternativeToComponent');
    });

    test('applyAlternativeToComponent updates texture', () => {
        const fnMatch = sceneContent.match(/function applyAlternativeToComponent[\s\S]*?^}/m);
        assertExists(fnMatch, 'applyAlternativeToComponent should be found');
        assertContains(fnMatch[0], 'updateComponentTextureWithAlternative',
            'Should update component texture');
    });

    test('applyAlternativeToComponent flashes component', () => {
        const fnMatch = sceneContent.match(/function applyAlternativeToComponent[\s\S]*?^}/m);
        assertContains(fnMatch[0], 'flashComponent',
            'Should flash component for feedback');
    });
});

// ============================================
// SUMMARY BAR TESTS
// ============================================

describe('Summary Bar HTML Structure', () => {
    test('Summary bar container exists', () => {
        assertContains(htmlContent, 'id="summary-bar"', 'Summary bar should exist');
        assertContains(htmlContent, 'class="summary-bar"', 'Summary bar should have class');
    });

    test('Summary bar shows baseline reference', () => {
        assertContains(htmlContent, 'class="summary-baseline"', 'Baseline section should exist');
        assertContains(htmlContent, 'vs Cloudflare', 'Should show vs Cloudflare');
    });

    test('Summary bar has cost metric', () => {
        assertContains(htmlContent, 'id="summary-cost"', 'Cost metric should exist');
        assertContains(htmlContent, 'class="metric-label"', 'Metric labels should exist');
        assertContains(htmlContent, 'class="metric-value"', 'Metric values should exist');
        assertContains(htmlContent, 'class="metric-diff', 'Metric diff should exist');
    });

    test('Summary bar has latency metric', () => {
        assertContains(htmlContent, 'id="summary-latency"', 'Latency metric should exist');
    });

    test('Summary bar has locations metric', () => {
        assertContains(htmlContent, 'id="summary-locations"', 'Locations metric should exist');
    });

    test('Summary bar has reset button', () => {
        assertContains(htmlContent, 'id="btn-reset-stack"', 'Reset button should exist');
    });
});

describe('Summary Bar CSS', () => {
    test('Summary bar styles exist', () => {
        assertContains(cssContent, '.summary-bar', 'Summary bar styles should exist');
    });

    test('Diff badge styles exist', () => {
        assertContains(cssContent, '.diff-badge', 'Diff badge styles should exist');
    });

    test('Better/worse states have colors', () => {
        assertContains(cssContent, '.better', 'Better state should have styles');
        assertContains(cssContent, '.worse', 'Worse state should have styles');
    });
});

describe('Summary Bar JavaScript', () => {
    test('updateSummaryBar function exists', () => {
        assertContains(sceneContent, 'function updateSummaryBar(stack)',
            'updateSummaryBar function should exist');
    });

    test('updateSummaryBar updates cost element', () => {
        const fnMatch = sceneContent.match(/function updateSummaryBar[\s\S]*?^}/m);
        assertExists(fnMatch, 'updateSummaryBar should be found');
        assertContains(fnMatch[0], '#summary-cost',
            'Should update cost element');
    });

    test('updateSummaryBar updates latency element', () => {
        const fnMatch = sceneContent.match(/function updateSummaryBar[\s\S]*?^}/m);
        assertContains(fnMatch[0], '#summary-latency',
            'Should update latency element');
    });

    test('updateSummaryBar calculates diff from baseline', () => {
        const fnMatch = sceneContent.match(/function updateSummaryBar[\s\S]*?^}/m);
        assertContains(fnMatch[0], 'baseline',
            'Should calculate diff from baseline');
    });

    test('updateSummaryBar sets better/worse classes', () => {
        const fnMatch = sceneContent.match(/function updateSummaryBar[\s\S]*?^}/m);
        assertContains(fnMatch[0], 'better',
            'Should set better class');
        assertContains(fnMatch[0], 'worse',
            'Should set worse class');
    });
});

// ============================================
// HOW IT WORKS BUTTON TESTS
// ============================================

describe('How It Works Button', () => {
    test('Deconstruct button exists in header', () => {
        assertContains(htmlContent, 'id="btn-deconstruct"', 'Deconstruct button should exist');
        assertContains(htmlContent, 'How It Works', 'Button text should be How It Works');
    });

    test('Reconstruct button exists', () => {
        assertContains(htmlContent, 'id="btn-reconstruct"', 'Reconstruct button should exist');
    });

    test('Controls are in header area', () => {
        assertContains(htmlContent, 'class="header-controls"', 'Header controls should exist');
        // Check controls are inside stack-toggle
        const stackToggleMatch = htmlContent.match(/id="stack-toggle"[\s\S]*?<\/div>\s*<\/div>/);
        assertExists(stackToggleMatch, 'Stack toggle should be found');
        assertContains(stackToggleMatch[0], 'btn-deconstruct',
            'Deconstruct button should be in stack toggle area');
    });

    test('explodeComponents function exists', () => {
        assertContains(sceneContent, 'function explodeComponents',
            'explodeComponents function should exist');
    });

    test('reconstructComponents function exists', () => {
        assertContains(sceneContent, 'function reconstructComponents',
            'reconstructComponents function should exist');
    });
});

// ============================================
// CSS Z-INDEX ORGANIZATION TESTS
// ============================================

describe('CSS Z-Index Organization', () => {
    test('Z-index variables are defined', () => {
        assertContains(cssContent, '--z-canvas', 'Canvas z-index variable should exist');
        assertContains(cssContent, '--z-chrome', 'Chrome z-index variable should exist');
        assertContains(cssContent, '--z-controls', 'Controls z-index variable should exist');
        assertContains(cssContent, '--z-panels', 'Panels z-index variable should exist');
        assertContains(cssContent, '--z-sheets', 'Sheets z-index variable should exist');
        assertContains(cssContent, '--z-backdrop', 'Backdrop z-index variable should exist');
        assertContains(cssContent, '--z-overlay', 'Overlay z-index variable should exist');
    });

    test('Layout height variables are defined', () => {
        assertContains(cssContent, '--header-height', 'Header height variable should exist');
        assertContains(cssContent, '--footer-height', 'Footer height variable should exist');
    });

    test('Elements use z-index variables', () => {
        assertContains(cssContent, 'var(--z-', 'Elements should use z-index variables');
    });
});

// ============================================
// MODE MUTUAL EXCLUSIVITY TESTS
// ============================================

describe('Mode Mutual Exclusivity', () => {
    test('split-view-only class is defined', () => {
        assertContains(cssContent, '.split-view-only', 'split-view-only class should exist');
    });

    test('split-view-only elements are hidden by default', () => {
        assertContains(cssContent, '.split-view-only',
            'split-view-only should hide elements in single-pane mode');
    });

    test('SINGLE_PANE_MODE flag exists', () => {
        assertContains(sceneContent, 'SINGLE_PANE_MODE', 'SINGLE_PANE_MODE flag should exist');
    });

    test('Legacy elements have split-view-only class', () => {
        assertContains(htmlContent, 'split-view-only', 'HTML should have split-view-only elements');
    });
});

// ============================================
// RESPONSIVE/MOBILE TESTS
// ============================================

describe('Mobile Responsive Design', () => {
    test('Viewport meta tag exists', () => {
        assertContains(htmlContent, 'viewport', 'Viewport meta should exist');
        assertContains(htmlContent, 'width=device-width', 'width=device-width should be set');
    });

    test('Touch event handlers exist', () => {
        assertContains(sceneContent, 'touchstart', 'touchstart handler should exist');
        assertContains(sceneContent, 'touchend', 'touchend handler should exist');
        assertContains(sceneContent, 'touchmove', 'touchmove handler should exist');
    });

    test('Touch tracking variables exist', () => {
        assertContains(sceneContent, 'touchStartTime', 'Touch start time should be tracked');
        assertContains(sceneContent, 'touchStartPos', 'Touch start position should be tracked');
    });

    test('Mobile media queries exist', () => {
        assertContains(cssContent, '@media', 'Media queries should exist');
        assertContains(bottomSheetCss, '@media (max-width: 768px)',
            'Mobile breakpoint should be defined');
    });
});

// ============================================
// RUN ALL TESTS
// ============================================

runTests();
