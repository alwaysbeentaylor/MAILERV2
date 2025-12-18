// GODMODE Utility
// Maximum speed sending with all safety checks disabled
// ⚠️ USE WITH CAUTION - Can damage SMTP reputation

/**
 * SES TURBO MODE Configuration
 * Optimized for Amazon SES high-speed sending
 */
export const SES_TURBO_CONFIG = {
    // Speed profiles
    profiles: {
        normal: {
            name: 'Normaal',
            description: '20 emails/min - Veilig voor SMTP',
            delayMs: 3000,
            parallelSending: false,
            maxParallel: 1,
            skipQualityCheck: false,  // Do quality check
            skipHumanize: true        // Skip humanize for speed
        },
        turbo: {
            name: '🚀 SES Turbo',
            description: '120 emails/min - Geen quality check',
            delayMs: 500,
            parallelSending: false,
            maxParallel: 1,
            skipQualityCheck: true,   // Skip for speed!
            skipHumanize: true
        },
        max: {
            name: '⚡ SES MAX',
            description: '600 emails/min - Maximale snelheid',
            delayMs: 100,
            parallelSending: true,
            maxParallel: 5,
            skipQualityCheck: true,
            skipHumanize: true
        },
        godmode: {
            name: '🔥 GODMODE',
            description: 'ALLES uit - PARALLEL verzenden',
            delayMs: 0,
            parallelSending: true,
            maxParallel: 10,
            skipQualityCheck: true,
            skipHumanize: true
        }
    },
    // Default profile
    defaultProfile: 'normal'
};

/**
 * Get speed profile by name
 */
export function getSpeedProfile(profileName) {
    return SES_TURBO_CONFIG.profiles[profileName] || SES_TURBO_CONFIG.profiles.normal;
}

/**
 * GODMODE Configuration
 * All safety checks are disabled for maximum throughput
 */
export const GODMODE_CONFIG = {
    // Skip all checks
    skipRateLimits: true,
    skipWarmupWarnings: true,
    skipAiQualityCheck: true,

    // Minimal website analysis (only basic info)
    minimalScraping: true,
    scrapingTimeout: 3000, // 3 seconds max

    // Parallel sending
    parallelSending: true,
    maxParallel: 10, // 10 emails at once

    // No delays
    delayBetweenEmails: 0,

    // One-time SMTP check
    smtpCheckOnce: true,

    // No retry on error - just continue
    autoRetry: false,

    // Minimal logging for speed
    verboseLogging: false,

    // Cooldown after GODMODE (in minutes)
    cooldownMinutes: 60
};

/**
 * Test all SMTP accounts once and return working ones
 */
export async function testAllSmtps(smtpAccounts, testEndpoint = '/api/test-smtp') {
    console.log('🔥 GODMODE: Testing all SMTPs...');

    const results = await Promise.allSettled(
        smtpAccounts.map(async (account) => {
            try {
                const res = await fetch(testEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        smtpConfig: account,
                        testEmail: account.user,
                        quickTest: true // Just verify connection, don't send
                    })
                });
                const data = await res.json();
                return { account, success: data.success };
            } catch (e) {
                return { account, success: false, error: e.message };
            }
        })
    );

    const working = results
        .filter(r => r.status === 'fulfilled' && r.value.success)
        .map(r => r.value.account);

    console.log(`✅ GODMODE: ${working.length}/${smtpAccounts.length} SMTPs working`);

    return working;
}

/**
 * Distribute emails evenly across accounts
 */
export function distributeEmails(emails, smtpAccounts) {
    const batches = smtpAccounts.map(account => ({
        smtp: account,
        emails: []
    }));

    emails.forEach((email, index) => {
        const batchIndex = index % batches.length;
        batches[batchIndex].emails.push(email);
    });

    return batches.filter(b => b.emails.length > 0);
}

/**
 * Send a batch of emails in parallel
 */
export async function sendBatchParallel(emails, smtp, options = {}) {
    const {
        parallel = GODMODE_CONFIG.maxParallel,
        delay = GODMODE_CONFIG.delayBetweenEmails,
        sendEndpoint = '/api/send-email',
        onProgress
    } = options;

    const results = {
        sent: 0,
        failed: 0,
        errors: []
    };

    // Process in chunks
    for (let i = 0; i < emails.length; i += parallel) {
        const chunk = emails.slice(i, i + parallel);

        const chunkResults = await Promise.allSettled(
            chunk.map(async (email) => {
                const res = await fetch(sendEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...email,
                        smtpAccountId: smtp.id,
                        godmode: true // Flag for API to skip checks
                    })
                });
                return res.json();
            })
        );

        chunkResults.forEach((result, idx) => {
            if (result.status === 'fulfilled' && result.value.success) {
                results.sent++;
            } else {
                results.failed++;
                results.errors.push({
                    email: chunk[idx].toEmail,
                    error: result.reason?.message || result.value?.error || 'Unknown error'
                });
            }
        });

        // Progress callback
        if (onProgress) {
            onProgress({
                processed: i + chunk.length,
                total: emails.length,
                sent: results.sent,
                failed: results.failed
            });
        }

        // Optional delay between chunks (0 in GODMODE)
        if (delay > 0 && i + parallel < emails.length) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    return results;
}

/**
 * Main GODMODE batch function
 */
export async function godmodeBatch(emails, smtpAccounts, options = {}) {
    console.log('🔥🔥🔥 GODMODE ACTIVATED 🔥🔥🔥');
    console.log(`📧 Emails: ${emails.length}`);
    console.log(`📡 SMTPs: ${smtpAccounts.length}`);

    const startTime = Date.now();
    const { onProgress, skipSmtpTest = false } = options;

    // Step 1: Test all SMTPs (one-time check)
    let workingSmtps = smtpAccounts;
    if (!skipSmtpTest) {
        workingSmtps = await testAllSmtps(smtpAccounts);
        if (workingSmtps.length === 0) {
            return {
                success: false,
                reason: 'no_working_smtp',
                message: 'Geen werkende SMTP accounts gevonden'
            };
        }
    }

    // Step 2: Distribute emails
    const batches = distributeEmails(emails, workingSmtps);
    console.log(`📦 Batches: ${batches.length}`);

    // Step 3: FIRE! Send all batches in parallel
    const allResults = await Promise.allSettled(
        batches.map(batch =>
            sendBatchParallel(batch.emails, batch.smtp, {
                ...GODMODE_CONFIG,
                onProgress: (progress) => {
                    if (onProgress) {
                        onProgress({
                            smtp: batch.smtp.user,
                            ...progress
                        });
                    }
                }
            })
        )
    );

    // Step 4: Aggregate results
    const totals = {
        sent: 0,
        failed: 0,
        errors: []
    };

    allResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
            totals.sent += result.value.sent;
            totals.failed += result.value.failed;
            totals.errors.push(...result.value.errors);
        } else {
            // Entire batch failed
            totals.failed += batches[idx].emails.length;
            totals.errors.push({
                smtp: batches[idx].smtp.user,
                error: result.reason?.message || 'Batch failed'
            });
        }
    });

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`🏁 GODMODE COMPLETE`);
    console.log(`   ✅ Sent: ${totals.sent}`);
    console.log(`   ❌ Failed: ${totals.failed}`);
    console.log(`   ⏱️ Duration: ${duration.toFixed(1)}s`);
    console.log(`   📊 Speed: ${(totals.sent / duration).toFixed(1)} emails/sec`);

    return {
        success: true,
        sent: totals.sent,
        failed: totals.failed,
        total: emails.length,
        errors: totals.errors.slice(0, 10), // Only first 10 errors
        duration,
        speed: totals.sent / duration,
        smtpsUsed: workingSmtps.length
    };
}

/**
 * Apply cooldown to SMTP accounts after GODMODE
 */
export async function applyGodmodeCooldown(smtpAccounts, updateEndpoint = '/api/smtp-accounts') {
    console.log(`⏳ Applying ${GODMODE_CONFIG.cooldownMinutes} minute cooldown to ${smtpAccounts.length} accounts...`);

    const cooldownUntil = new Date(Date.now() + GODMODE_CONFIG.cooldownMinutes * 60 * 1000);

    for (const account of smtpAccounts) {
        try {
            await fetch(updateEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...account,
                    cooldownUntil: cooldownUntil.toISOString(),
                    lastGodmode: new Date().toISOString()
                })
            });
        } catch (e) {
            console.error(`Failed to set cooldown for ${account.user}:`, e.message);
        }
    }

    return { success: true, cooldownUntil };
}

/**
 * Get estimated time for GODMODE batch
 */
export function estimateGodmodeTime(emailCount, smtpCount) {
    const parallel = Math.min(GODMODE_CONFIG.maxParallel, smtpCount);
    const batchesNeeded = Math.ceil(emailCount / parallel);

    // Estimate ~0.5 seconds per batch
    const estimatedSeconds = batchesNeeded * 0.5;

    if (estimatedSeconds < 60) {
        return `~${Math.ceil(estimatedSeconds)} seconden`;
    } else if (estimatedSeconds < 3600) {
        return `~${Math.ceil(estimatedSeconds / 60)} minuten`;
    } else {
        return `~${(estimatedSeconds / 3600).toFixed(1)} uren`;
    }
}
