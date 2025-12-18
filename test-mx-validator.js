/**
 * Test script voor MX Validator
 * Run: node test-mx-validator.js
 */

import { validateMX, quickMXCheck } from './utils/mx-validator.js';

async function test() {
    console.log('🧪 MX Validator Test\n');
    console.log('='.repeat(50));

    // Test cases
    const testCases = [
        // Valid domains (should pass)
        { email: 'test@gmail.com', expected: true, label: 'Gmail' },
        { email: 'test@outlook.com', expected: true, label: 'Outlook' },
        { email: 'test@hotmail.com', expected: true, label: 'Hotmail' },

        // Invalid domains (should fail)
        { email: 'test@asdfghjkl123456789.com', expected: false, label: 'Fake domain' },
        { email: 'test@this-domain-does-not-exist-xyz.nl', expected: false, label: 'Non-existent NL' },

        // Edge cases
        { email: '', expected: false, label: 'Empty email' },
        { email: 'invalid-email', expected: false, label: 'No @ sign' },
    ];

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`\n📧 Testing: ${testCase.label} (${testCase.email || '(empty)'})`);

        const result = await validateMX(testCase.email);
        const success = result.valid === testCase.expected;

        if (success) {
            console.log(`   ✅ PASS - valid: ${result.valid}`);
            passed++;
        } else {
            console.log(`   ❌ FAIL - expected ${testCase.expected}, got ${result.valid}`);
            failed++;
        }

        if (result.mxRecords?.length) {
            console.log(`   📬 MX: ${result.mxRecords[0].exchange}`);
        }
        if (result.error) {
            console.log(`   ⚠️ Error: ${result.error}`);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('🎉 All tests passed!\n');
    } else {
        console.log('⚠️ Some tests failed!\n');
        process.exit(1);
    }
}

test().catch(console.error);
