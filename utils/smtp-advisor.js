// SMTP Advisor Utility
// Geeft smart advies over SMTP accounts: warmup status, limieten, provider detectie

// Provider limits database
const PROVIDER_LIMITS = {
    'smtp.gmail.com': {
        name: 'Gmail',
        daily: 500,
        hourly: 100,
        notes: 'Gratis Gmail limiet. Workspace: 2000/dag.',
        warmupDays: 14
    },
    'smtp.office365.com': {
        name: 'Outlook/365',
        daily: 300,
        hourly: 30,
        notes: 'Microsoft 365 limiet voor gratis accounts.',
        warmupDays: 21
    },
    'smtp.sendgrid.net': {
        name: 'SendGrid',
        daily: 100,
        hourly: 100,
        notes: 'Free tier. Betaald: onbeperkt.',
        warmupDays: 7
    },
    'smtp.mailgun.org': {
        name: 'Mailgun',
        daily: 300,
        hourly: 100,
        notes: 'Sandbox mode. Verify domain voor meer.',
        warmupDays: 7
    },
    'smtp.zoho.com': {
        name: 'Zoho',
        daily: 250,
        hourly: 50,
        notes: 'Zoho Mail gratis limiet.',
        warmupDays: 14
    },
    'mail.privateemail.com': {
        name: 'Namecheap Private Email',
        daily: 500,
        hourly: 50,
        notes: 'Namecheap hosting email.',
        warmupDays: 14
    },
    'smtp.hostinger.com': {
        name: 'Hostinger',
        daily: 500,
        hourly: 100,
        notes: 'Hostinger email hosting.',
        warmupDays: 14
    }
};

// Warmup schedules based on status
const WARMUP_SCHEDULES = {
    cold: { hourly: 2, daily: 5, description: 'Nieuwe account, zeer voorzichtig' },
    warming_week1: { hourly: 3, daily: 10, description: 'Week 1: Langzaam opbouwen' },
    warming_week2: { hourly: 5, daily: 20, description: 'Week 2: Geleidelijk verhogen' },
    warming_week3: { hourly: 8, daily: 35, description: 'Week 3: Bijna warm' },
    warm: { hourly: 10, daily: 50, description: 'Account is warm' },
    hot: { hourly: 20, daily: 100, description: 'Volledig opgewarmd account' }
};

/**
 * Detecteer provider op basis van SMTP host
 */
export function detectProvider(host) {
    if (!host) return null;

    const hostLower = host.toLowerCase();

    // Check direct match first
    if (PROVIDER_LIMITS[hostLower]) {
        return { ...PROVIDER_LIMITS[hostLower], host: hostLower };
    }

    // Check partial matches
    if (hostLower.includes('gmail')) {
        return { ...PROVIDER_LIMITS['smtp.gmail.com'], host: 'smtp.gmail.com' };
    }
    if (hostLower.includes('office365') || hostLower.includes('outlook') || hostLower.includes('microsoft')) {
        return { ...PROVIDER_LIMITS['smtp.office365.com'], host: 'smtp.office365.com' };
    }
    if (hostLower.includes('sendgrid')) {
        return { ...PROVIDER_LIMITS['smtp.sendgrid.net'], host: 'smtp.sendgrid.net' };
    }
    if (hostLower.includes('mailgun')) {
        return { ...PROVIDER_LIMITS['smtp.mailgun.org'], host: 'smtp.mailgun.org' };
    }
    if (hostLower.includes('zoho')) {
        return { ...PROVIDER_LIMITS['smtp.zoho.com'], host: 'smtp.zoho.com' };
    }

    // Unknown provider - return sensible defaults
    return {
        name: 'Custom SMTP',
        daily: 200,
        hourly: 20,
        notes: 'Onbekende provider - gebruik voorzichtige limieten.',
        warmupDays: 21,
        host: hostLower
    };
}

/**
 * Calculate days since a date
 */
function getDaysSince(dateStr) {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determine warmup status based on account age and emails sent
 */
export function getWarmupStatus(smtpAccount) {
    const daysSinceCreated = getDaysSince(smtpAccount.createdAt);
    const totalSent = smtpAccount.emailsSentTotal || 0;

    // Status logic
    if (daysSinceCreated < 7 || totalSent < 50) {
        return 'cold';
    }
    if (daysSinceCreated < 14 || totalSent < 150) {
        return 'warming_week1';
    }
    if (daysSinceCreated < 21 || totalSent < 350) {
        return 'warming_week2';
    }
    if (daysSinceCreated < 30 || totalSent < 700) {
        return 'warming_week3';
    }
    if (totalSent < 2000) {
        return 'warm';
    }
    return 'hot';
}

/**
 * Get status emoji and label
 */
export function getStatusDisplay(status) {
    const displays = {
        cold: { emoji: '❄️', label: 'Koud', color: '#3b82f6' },
        warming_week1: { emoji: '🌡️', label: 'Warming W1', color: '#f59e0b' },
        warming_week2: { emoji: '🌡️', label: 'Warming W2', color: '#f59e0b' },
        warming_week3: { emoji: '🌡️', label: 'Warming W3', color: '#f59e0b' },
        warm: { emoji: '🔥', label: 'Warm', color: '#22c55e' },
        hot: { emoji: '💥', label: 'Hot', color: '#ef4444' }
    };
    return displays[status] || displays.cold;
}

/**
 * Calculate health score (0-100)
 */
export function calculateHealthScore(smtpAccount, provider) {
    let score = 50; // Base score

    const status = getWarmupStatus(smtpAccount);

    // Warmup status bonus
    const statusScores = {
        cold: 20,
        warming_week1: 35,
        warming_week2: 50,
        warming_week3: 65,
        warm: 80,
        hot: 95
    };
    score = statusScores[status] || 50;

    // Adjust for recent errors
    if (smtpAccount.lastError) {
        const hoursSinceError = (Date.now() - new Date(smtpAccount.lastError).getTime()) / (1000 * 60 * 60);
        if (hoursSinceError < 24) {
            score -= 20;
        } else if (hoursSinceError < 72) {
            score -= 10;
        }
    }

    // Adjust for usage ratio
    const dailyUsage = smtpAccount.emailsSentToday || 0;
    const dailyLimit = smtpAccount.dailyLimit || provider?.daily || 50;
    const usageRatio = dailyUsage / dailyLimit;

    if (usageRatio > 0.8) {
        score -= 10; // Near limit
    } else if (usageRatio > 0.5) {
        score -= 5;
    }

    return Math.max(0, Math.min(100, score));
}

/**
 * Generate comprehensive SMTP advice
 */
export async function getSmtpAdvice(smtpAccount) {
    const provider = detectProvider(smtpAccount.host);
    const status = getWarmupStatus(smtpAccount);
    const statusDisplay = getStatusDisplay(status);
    const schedule = WARMUP_SCHEDULES[status];
    const healthScore = calculateHealthScore(smtpAccount, provider);

    const advice = {
        // Account info
        accountId: smtpAccount.id,
        email: smtpAccount.user,

        // Provider info
        provider: provider?.name || 'Custom',
        providerLimits: provider ? {
            daily: provider.daily,
            hourly: provider.hourly,
            notes: provider.notes
        } : null,

        // Warmup status
        status: status,
        statusEmoji: statusDisplay.emoji,
        statusLabel: statusDisplay.label,
        statusColor: statusDisplay.color,

        // Health score
        healthScore: healthScore,
        healthLevel: healthScore >= 80 ? 'excellent' :
            healthScore >= 60 ? 'good' :
                healthScore >= 40 ? 'fair' : 'poor',

        // Recommended limits
        recommended: {
            hourly: Math.min(schedule.hourly, provider?.hourly || 100),
            daily: Math.min(schedule.daily, provider?.daily || 500),
            description: schedule.description
        },

        // Current usage
        usage: {
            today: smtpAccount.emailsSentToday || 0,
            total: smtpAccount.emailsSentTotal || 0,
            hourlyLimit: smtpAccount.hourlyLimit || schedule.hourly,
            dailyLimit: smtpAccount.dailyLimit || schedule.daily
        },

        // Warnings
        warnings: [],

        // Suggested actions
        actions: []
    };

    // Generate warnings
    if (status === 'cold') {
        advice.warnings.push('❄️ Dit account is nog koud en moet worden opgewarmd voor betrouwbare verzending.');
        advice.actions.push({
            type: 'warmup',
            label: '🔥 Start Warmup',
            description: 'Begin met het opwarmen van dit account'
        });
    }

    if (status.startsWith('warming')) {
        advice.warnings.push('🌡️ Account is bezig met opwarmen. Respecteer de aanbevolen limieten.');
    }

    if (provider) {
        const providerMax = provider.daily;
        if (advice.recommended.daily > providerMax) {
            advice.recommended.daily = providerMax;
            advice.warnings.push(`⚠️ ${provider.name} limiet: maximaal ${providerMax} emails per dag.`);
        }
    }

    // Check if near daily limit
    const dailyUsage = smtpAccount.emailsSentToday || 0;
    const dailyLimit = smtpAccount.dailyLimit || advice.recommended.daily;
    const usagePercent = Math.round((dailyUsage / dailyLimit) * 100);

    if (usagePercent >= 90) {
        advice.warnings.push(`🚦 Dagelijkse limiet bijna bereikt (${usagePercent}% gebruikt).`);
    } else if (usagePercent >= 75) {
        advice.warnings.push(`📊 ${usagePercent}% van dagelijkse limiet gebruikt.`);
    }

    // Check for recent errors
    if (smtpAccount.lastError) {
        const hoursSinceError = (Date.now() - new Date(smtpAccount.lastError).getTime()) / (1000 * 60 * 60);
        if (hoursSinceError < 24) {
            advice.warnings.push('⚠️ Recente verzend fout gedetecteerd. Check SMTP instellingen.');
            advice.actions.push({
                type: 'settings',
                label: '⚙️ Check Instellingen',
                description: 'Controleer SMTP configuratie'
            });
        }
    }

    // Add general settings action if no other actions
    if (advice.actions.length === 0) {
        advice.actions.push({
            type: 'settings',
            label: '⚙️ Instellingen',
            description: 'Pas limieten aan'
        });
    }

    return advice;
}

/**
 * Get advice for multiple SMTP accounts
 */
export async function getBulkSmtpAdvice(smtpAccounts) {
    const advices = await Promise.all(
        smtpAccounts.map(acc => getSmtpAdvice(acc))
    );

    // Calculate totals
    const totalDailyCapacity = advices.reduce((sum, a) => sum + a.recommended.daily, 0);
    const totalUsedToday = advices.reduce((sum, a) => sum + a.usage.today, 0);
    const totalRemainingToday = totalDailyCapacity - totalUsedToday;

    return {
        accounts: advices,
        summary: {
            total: advices.length,
            byStatus: {
                cold: advices.filter(a => a.status === 'cold').length,
                warming: advices.filter(a => a.status.startsWith('warming')).length,
                warm: advices.filter(a => a.status === 'warm').length,
                hot: advices.filter(a => a.status === 'hot').length
            },
            capacity: {
                totalDaily: totalDailyCapacity,
                usedToday: totalUsedToday,
                remainingToday: totalRemainingToday
            },
            averageHealthScore: Math.round(
                advices.reduce((sum, a) => sum + a.healthScore, 0) / advices.length
            )
        }
    };
}

export { PROVIDER_LIMITS, WARMUP_SCHEDULES };
