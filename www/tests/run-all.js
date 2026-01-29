#!/usr/bin/env node
/**
 * Test Runner - Run All Test Suites
 *
 * Runs all test files in sequence and reports combined results.
 * Usage: bun test www/tests/run-all.js
 *        OR: node www/tests/run-all.js
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const testsDir = __dirname;

// Test files to run (in order)
const testFiles = [
    'stack-state.test.js',
    'scene-data.test.js',
    'ui-behavior.test.js',
    'responsive-redesign.test.js',
    'scene-behavior.test.js'
];

console.log('\n' + '╔' + '═'.repeat(58) + '╗');
console.log('║' + ' '.repeat(15) + 'SHIPWITH.DEV TEST SUITE' + ' '.repeat(20) + '║');
console.log('╚' + '═'.repeat(58) + '╝\n');

let totalPassed = 0;
let totalFailed = 0;
let totalSkipped = 0;
let failedSuites = [];

for (const file of testFiles) {
    const filePath = path.join(testsDir, file);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipping ${file} (not found)`);
        continue;
    }

    console.log(`\n${'━'.repeat(60)}`);
    console.log(`📋 Running: ${file}`);
    console.log('━'.repeat(60));

    try {
        // Run the test file
        const result = spawnSync('node', [filePath], {
            cwd: path.dirname(filePath),
            encoding: 'utf8',
            timeout: 30000
        });

        // Output the test results
        if (result.stdout) {
            console.log(result.stdout);
        }
        if (result.stderr && !result.stderr.includes('ExperimentalWarning')) {
            console.error(result.stderr);
        }

        // Parse results from output
        const output = result.stdout || '';
        const resultsMatch = output.match(/Results: (\d+) passed, (\d+) failed, (\d+) skipped/);
        if (resultsMatch) {
            const passed = parseInt(resultsMatch[1], 10);
            const failed = parseInt(resultsMatch[2], 10);
            const skipped = parseInt(resultsMatch[3], 10);

            totalPassed += passed;
            totalFailed += failed;
            totalSkipped += skipped;

            if (failed > 0) {
                failedSuites.push(file);
            }
        }

        if (result.status !== 0 && !resultsMatch) {
            console.log(`❌ ${file} exited with code ${result.status}`);
            failedSuites.push(file);
        }
    } catch (err) {
        console.log(`❌ Error running ${file}: ${err.message}`);
        failedSuites.push(file);
    }
}

// Final summary
console.log('\n' + '╔' + '═'.repeat(58) + '╗');
console.log('║' + ' '.repeat(20) + 'FINAL SUMMARY' + ' '.repeat(25) + '║');
console.log('╠' + '═'.repeat(58) + '╣');

const passedStr = `  ✅ Passed:  ${totalPassed}`;
const failedStr = `  ❌ Failed:  ${totalFailed}`;
const skippedStr = `  ⏭️  Skipped: ${totalSkipped}`;

console.log('║' + passedStr + ' '.repeat(58 - passedStr.length) + '║');
console.log('║' + failedStr + ' '.repeat(58 - failedStr.length) + '║');
console.log('║' + skippedStr + ' '.repeat(58 - skippedStr.length) + '║');
console.log('╚' + '═'.repeat(58) + '╝');

if (failedSuites.length > 0) {
    console.log('\n❌ Failed suites:');
    failedSuites.forEach(suite => console.log(`   - ${suite}`));
    process.exit(1);
} else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
}
