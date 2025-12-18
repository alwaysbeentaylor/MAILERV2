// Smart SMTP Rotator
// Automatically selects the best SMTP account for sending based on capacity, warmup status, and health

import { checkRateLimit, getUsage } from './rate-limiter';
import { getSmtpAdvice, getWarmupStatus } from './smtp-advisor';

// Rotation modes
export const ROTATION_MODES = {
    AUTO: 'auto',           // System chooses best account
    ROUND_ROBIN: 'round_robin', // Each account in turn
    PRIORITY: 'priority',   // Warmest accounts first
    BALANCED: 'balanced'    // Spread load evenly
};

// Track last used account for round-robin
let lastUsedIndex = 0;

/**
 * Calculate a score for an SMTP account
 * Higher score = better choice
 */
async function calculateSmtpScore(account, options = {}) {
    const { preferWarm = true } = options;
    let score = 0;

    // Get advice and usage
    const advice = await getSmtpAdvice(account);
    const usage = await getUsage(account.id);

    // Base score from warmup status
    const statusScores = {
        hot: 100,
        warm: 75,
        warming_week3: 60,
        warming_week2: 50,
        warming_week1: 35,
        cold: 20
    };
    score += statusScores[advice.status] || 0;

    // Capacity bonus (more remaining = higher score)
    const dailyLimit = account.dailyLimit || 50;
    const remainingCapacity = dailyLimit - (usage.daily || 0);
    const capacityPercent = remainingCapacity / dailyLimit;
    score += capacityPercent * 50;

    // Health score bonus
    score += (advice.healthScore / 100) * 30;

    // Active bonus
    if (account.active) score += 20;

    // Recent error penalty
    if (account.lastError) {
        const hoursSinceError = (Date.now() - new Date(account.lastError).getTime()) / (1000 * 60 * 60);
        if (hoursSinceError < 24) score -= 30;
        else if (hoursSinceError < 72) score -= 15;
    }

    // Low usage bonus (for spreading warmup)
    if (!preferWarm && usage.daily < 10) {
        score += 15;
    }

    return {
        account,
        score,
        advice,
        usage,
        remainingDaily: remainingCapacity
    };
}

/**
 * Select the best SMTP account for sending
 */
export async function selectBestSmtp(smtpAccounts, options = {}) {
    const {
        mode = ROTATION_MODES.AUTO,
        excludeIds = [],
        preferWarm = true,
        count = 1 // How many accounts to return
    } = options;

    if (!smtpAccounts || smtpAccounts.length === 0) {
        return {
            success: false,
            reason: 'no_accounts',
            message: 'Geen SMTP accounts beschikbaar'
        };
    }

    // Filter available accounts
    const availableAccounts = [];

    for (const account of smtpAccounts) {
        // Skip excluded
        if (excludeIds.includes(account.id)) continue;

        // Skip inactive
        if (!account.active) continue;

        // Check rate limit
        const limit = await checkRateLimit(
            account.id,
            account.hourlyLimit || 10,
            account.dailyLimit || 50
        );

        if (limit.allowed) {
            const scored = await calculateSmtpScore(account, { preferWarm });
            availableAccounts.push(scored);
        }
    }

    if (availableAccounts.length === 0) {
        return {
            success: false,
            reason: 'no_capacity',
            message: 'Alle accounts hebben hun limiet bereikt of zijn inactief'
        };
    }

    // Select based on mode
    let selected;

    switch (mode) {
        case ROTATION_MODES.ROUND_ROBIN:
            // Simple rotation
            lastUsedIndex = (lastUsedIndex + 1) % availableAccounts.length;
            selected = [availableAccounts[lastUsedIndex]];
            break;

        case ROTATION_MODES.PRIORITY:
            // Sort by warmup status first, then score
            availableAccounts.sort((a, b) => {
                const statusOrder = { hot: 5, warm: 4, warming_week3: 3, warming_week2: 2, warming_week1: 1, cold: 0 };
                const statusDiff = (statusOrder[b.advice.status] || 0) - (statusOrder[a.advice.status] || 0);
                if (statusDiff !== 0) return statusDiff;
                return b.score - a.score;
            });
            selected = availableAccounts.slice(0, count);
            break;

        case ROTATION_MODES.BALANCED:
            // Sort by remaining capacity (most remaining first)
            availableAccounts.sort((a, b) => b.remainingDaily - a.remainingDaily);
            selected = availableAccounts.slice(0, count);
            break;

        case ROTATION_MODES.AUTO:
        default:
            // Sort by overall score
            availableAccounts.sort((a, b) => b.score - a.score);
            selected = availableAccounts.slice(0, count);
            break;
    }

    return {
        success: true,
        mode,
        selected: selected.map(s => ({
            id: s.account.id,
            email: s.account.user,
            score: Math.round(s.score),
            status: s.advice.status,
            statusEmoji: s.advice.statusEmoji,
            remainingDaily: s.remainingDaily,
            healthScore: s.advice.healthScore
        })),
        // Primary selection
        primary: {
            id: selected[0].account.id,
            email: selected[0].account.user,
            score: Math.round(selected[0].score),
            status: selected[0].advice.status
        },
        // Full account object for use
        account: selected[0].account,
        // Summary stats
        stats: {
            totalAvailable: availableAccounts.length,
            totalAccounts: smtpAccounts.length
        }
    };
}

/**
 * Distribute emails across multiple SMTP accounts
 * Useful for batch sending
 */
export async function distributeEmails(emails, smtpAccounts, options = {}) {
    const { mode = ROTATION_MODES.BALANCED } = options;

    // Get all available accounts with capacity
    const available = [];

    for (const account of smtpAccounts) {
        if (!account.active) continue;

        const limit = await checkRateLimit(
            account.id,
            account.hourlyLimit || 10,
            account.dailyLimit || 50
        );

        if (limit.allowed && limit.remaining) {
            available.push({
                account,
                remaining: limit.remaining.daily,
                assigned: []
            });
        }
    }

    if (available.length === 0) {
        return {
            success: false,
            reason: 'no_capacity',
            message: 'Geen accounts met capaciteit beschikbaar'
        };
    }

    // Calculate total capacity
    const totalCapacity = available.reduce((sum, a) => sum + a.remaining, 0);

    if (emails.length > totalCapacity) {
        return {
            success: false,
            reason: 'insufficient_capacity',
            message: `Niet genoeg capaciteit: ${emails.length} emails, ${totalCapacity} beschikbaar`,
            totalCapacity
        };
    }

    // Distribute emails
    let emailIndex = 0;

    // Sort by remaining capacity
    available.sort((a, b) => b.remaining - a.remaining);

    for (const email of emails) {
        // Find account with most remaining capacity
        let bestIdx = 0;
        let bestRemaining = -1;

        for (let i = 0; i < available.length; i++) {
            const accountRemaining = available[i].remaining - available[i].assigned.length;
            if (accountRemaining > bestRemaining) {
                bestRemaining = accountRemaining;
                bestIdx = i;
            }
        }

        available[bestIdx].assigned.push(email);
    }

    return {
        success: true,
        batches: available
            .filter(a => a.assigned.length > 0)
            .map(a => ({
                smtpId: a.account.id,
                smtpEmail: a.account.user,
                emails: a.assigned,
                count: a.assigned.length
            })),
        summary: {
            totalEmails: emails.length,
            accountsUsed: available.filter(a => a.assigned.length > 0).length,
            distribution: available
                .filter(a => a.assigned.length > 0)
                .map(a => ({ email: a.account.user, count: a.assigned.length }))
        }
    };
}

/**
 * Get rotation status for all accounts
 */
export async function getRotationStatus(smtpAccounts) {
    const scored = [];

    for (const account of smtpAccounts) {
        try {
            const s = await calculateSmtpScore(account);
            scored.push({
                id: account.id,
                email: account.user,
                score: Math.round(s.score),
                status: s.advice.status,
                statusEmoji: s.advice.statusEmoji,
                remainingDaily: s.remainingDaily,
                active: account.active
            });
        } catch (e) {
            scored.push({
                id: account.id,
                email: account.user,
                score: 0,
                error: e.message
            });
        }
    }

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    return {
        accounts: scored,
        recommended: scored[0] || null,
        totalCapacity: scored.reduce((sum, a) => sum + (a.remainingDaily || 0), 0)
    };
}
