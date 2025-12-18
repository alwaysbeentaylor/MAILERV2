// Rate Limiter Utility
// Tracks and enforces email sending limits per SMTP account

// In-memory rate tracking (for dev)
// In production this uses Vercel KV
let memoryRateLimits = {};

async function getKV() {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        return null;
    }
    try {
        const { kv } = await import('@vercel/kv');
        await kv.ping();
        return kv;
    } catch (e) {
        return null;
    }
}

/**
 * Get the current hour and day keys for rate limiting
 */
function getTimeKeys() {
    const now = new Date();
    const hourKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    return { hourKey, dayKey };
}

/**
 * Get current usage for an SMTP account
 */
export async function getUsage(smtpId) {
    const kv = await getKV();
    const { hourKey, dayKey } = getTimeKeys();

    const hourlyKey = `rate:${smtpId}:hour:${hourKey}`;
    const dailyKey = `rate:${smtpId}:day:${dayKey}`;

    let hourly = 0;
    let daily = 0;

    if (kv) {
        hourly = await kv.get(hourlyKey) || 0;
        daily = await kv.get(dailyKey) || 0;
    } else {
        hourly = memoryRateLimits[hourlyKey] || 0;
        daily = memoryRateLimits[dailyKey] || 0;
    }

    return { hourly, daily };
}

/**
 * Check if an SMTP account can send more emails
 */
export async function checkRateLimit(smtpId, hourlyLimit = 10, dailyLimit = 50) {
    const usage = await getUsage(smtpId);

    if (usage.hourly >= hourlyLimit) {
        const now = new Date();
        const minutesUntilNextHour = 60 - now.getMinutes();

        return {
            allowed: false,
            reason: 'hourly_limit',
            message: `Hourly limiet bereikt (${usage.hourly}/${hourlyLimit})`,
            resetIn: minutesUntilNextHour,
            resetUnit: 'minutes'
        };
    }

    if (usage.daily >= dailyLimit) {
        const now = new Date();
        const hoursUntilMidnight = 24 - now.getHours();

        return {
            allowed: false,
            reason: 'daily_limit',
            message: `Daily limiet bereikt (${usage.daily}/${dailyLimit})`,
            resetIn: hoursUntilMidnight,
            resetUnit: 'hours'
        };
    }

    return {
        allowed: true,
        usage: usage,
        remaining: {
            hourly: hourlyLimit - usage.hourly,
            daily: dailyLimit - usage.daily
        }
    };
}

/**
 * Record a sent email for rate limiting
 */
export async function recordEmailSent(smtpId) {
    const kv = await getKV();
    const { hourKey, dayKey } = getTimeKeys();

    const hourlyKey = `rate:${smtpId}:hour:${hourKey}`;
    const dailyKey = `rate:${smtpId}:day:${dayKey}`;

    if (kv) {
        // Increment with expiry
        await kv.incr(hourlyKey);
        await kv.expire(hourlyKey, 3600); // 1 hour

        await kv.incr(dailyKey);
        await kv.expire(dailyKey, 86400); // 24 hours
    } else {
        memoryRateLimits[hourlyKey] = (memoryRateLimits[hourlyKey] || 0) + 1;
        memoryRateLimits[dailyKey] = (memoryRateLimits[dailyKey] || 0) + 1;
    }

    return { success: true };
}

/**
 * Get rate limit status for multiple accounts
 */
export async function getBulkRateLimitStatus(smtpAccounts) {
    const statuses = [];

    for (const account of smtpAccounts) {
        const status = await checkRateLimit(
            account.id,
            account.hourlyLimit || 10,
            account.dailyLimit || 50
        );

        statuses.push({
            id: account.id,
            email: account.user,
            ...status
        });
    }

    return {
        accounts: statuses,
        summary: {
            total: statuses.length,
            available: statuses.filter(s => s.allowed).length,
            atLimit: statuses.filter(s => !s.allowed).length
        }
    };
}

/**
 * Reset rate limits for an account (admin function)
 */
export async function resetRateLimits(smtpId) {
    const kv = await getKV();
    const { hourKey, dayKey } = getTimeKeys();

    const hourlyKey = `rate:${smtpId}:hour:${hourKey}`;
    const dailyKey = `rate:${smtpId}:day:${dayKey}`;

    if (kv) {
        await kv.del(hourlyKey);
        await kv.del(dailyKey);
    } else {
        delete memoryRateLimits[hourlyKey];
        delete memoryRateLimits[dailyKey];
    }

    return { success: true };
}
