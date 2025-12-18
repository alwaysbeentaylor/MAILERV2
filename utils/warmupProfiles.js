// Warm-up Profile Configurations
// Defines the phases and limits for different warm-up strategies

export const WARMUP_PROFILES = {
    conservative: {
        id: 'conservative',
        name: '🐢 Voorzichtig',
        description: '8 weken - Best voor nieuwe domeinen',
        duration: 56, // days
        phases: [
            { days: 14, startLimit: 3, endLimit: 10 },
            { days: 14, startLimit: 12, endLimit: 30 },
            { days: 14, startLimit: 35, endLimit: 80 },
            { days: 14, startLimit: 90, endLimit: 200 }
        ]
    },
    standard: {
        id: 'standard',
        name: '🚶 Standaard',
        description: '4 weken - Meeste situaties',
        duration: 28,
        phases: [
            { days: 7, startLimit: 10, endLimit: 20 },
            { days: 7, startLimit: 25, endLimit: 50 },
            { days: 7, startLimit: 55, endLimit: 100 },
            { days: 7, startLimit: 110, endLimit: 200 }
        ]
    },
    aggressive: {
        id: 'aggressive',
        name: '🏃 Agressief',
        description: '2 weken - Bestaande warme domeinen',
        duration: 14,
        phases: [
            { days: 4, startLimit: 20, endLimit: 50 },
            { days: 5, startLimit: 55, endLimit: 100 },
            { days: 5, startLimit: 110, endLimit: 200 }
        ]
    },
    custom: {
        id: 'custom',
        name: '⚙️ Custom',
        description: 'Stel je eigen limieten in',
        duration: null,
        phases: []
    }
};

export const STARTING_POINTS = {
    new: {
        id: 'new',
        label: 'Gloednieuw',
        description: 'Nooit emails verstuurd',
        skipDays: 0
    },
    partial: {
        id: 'partial',
        label: 'Enigszins opgewarmd',
        description: '~50 emails/dag veilig',
        skipDays: 14
    },
    warm: {
        id: 'warm',
        label: 'Goed opgewarmd',
        description: '~100 emails/dag veilig',
        skipDays: 21
    },
    complete: {
        id: 'complete',
        label: 'Volledig opgewarmd',
        description: 'Geen limiet nodig',
        skipDays: -1 // -1 means no warmup needed
    }
};

/**
 * Calculate the daily limit based on profile, start date, and current day
 */
export function calculateDailyLimit(warmupData) {
    if (!warmupData.warmupEnabled) {
        return Infinity; // No limit
    }

    if (warmupData.customDailyLimit) {
        return warmupData.customDailyLimit;
    }

    const profile = WARMUP_PROFILES[warmupData.warmupProfile];
    if (!profile || warmupData.warmupProfile === 'custom') {
        return warmupData.customDailyLimit || 200;
    }

    const startDate = new Date(warmupData.warmupStartDate);
    const today = new Date();
    let daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

    // Apply starting point skip
    const startingPoint = STARTING_POINTS[warmupData.startingPoint] || STARTING_POINTS.new;
    if (startingPoint.skipDays === -1) {
        return Infinity; // Fully warmed, no limit
    }
    daysSinceStart += startingPoint.skipDays;

    // Find current phase
    let daysAccumulated = 0;
    for (const phase of profile.phases) {
        if (daysSinceStart < daysAccumulated + phase.days) {
            // We're in this phase
            const daysIntoPhase = daysSinceStart - daysAccumulated;
            const progress = daysIntoPhase / phase.days;
            const limit = Math.round(
                phase.startLimit + (phase.endLimit - phase.startLimit) * progress
            );
            return limit;
        }
        daysAccumulated += phase.days;
    }

    // Past all phases - return max limit
    const lastPhase = profile.phases[profile.phases.length - 1];
    return lastPhase?.endLimit || 200;
}

/**
 * Calculate current phase number (1-based)
 */
export function getCurrentPhase(warmupData) {
    if (!warmupData.warmupEnabled) return 0;

    const profile = WARMUP_PROFILES[warmupData.warmupProfile];
    if (!profile) return 0;

    const startDate = new Date(warmupData.warmupStartDate);
    const today = new Date();
    let daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

    const startingPoint = STARTING_POINTS[warmupData.startingPoint] || STARTING_POINTS.new;
    if (startingPoint.skipDays === -1) return profile.phases.length + 1;
    daysSinceStart += startingPoint.skipDays;

    let daysAccumulated = 0;
    for (let i = 0; i < profile.phases.length; i++) {
        daysAccumulated += profile.phases[i].days;
        if (daysSinceStart < daysAccumulated) {
            return i + 1;
        }
    }

    return profile.phases.length + 1; // Completed
}

/**
 * Calculate days until fully warmed
 */
export function getDaysRemaining(warmupData) {
    if (!warmupData.warmupEnabled) return 0;

    const profile = WARMUP_PROFILES[warmupData.warmupProfile];
    if (!profile) return 0;

    const startDate = new Date(warmupData.warmupStartDate);
    const today = new Date();
    let daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

    const startingPoint = STARTING_POINTS[warmupData.startingPoint] || STARTING_POINTS.new;
    if (startingPoint.skipDays === -1) return 0;
    daysSinceStart += startingPoint.skipDays;

    const totalDays = profile.phases.reduce((sum, p) => sum + p.days, 0);
    return Math.max(0, totalDays - daysSinceStart);
}

/**
 * Check if warm-up is complete
 */
export function isWarmupComplete(warmupData) {
    return getDaysRemaining(warmupData) === 0;
}
