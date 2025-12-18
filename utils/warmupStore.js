// Warm-up Storage Utility
// Uses localStorage to persist warm-up data per SMTP account

import {
    calculateDailyLimit,
    getCurrentPhase,
    getDaysRemaining,
    isWarmupComplete,
    WARMUP_PROFILES
} from './warmupProfiles';

const WARMUP_KEY = 'skyeWarmupData';

/**
 * Get all warm-up data
 */
function getAllWarmupData() {
    if (typeof window === 'undefined') return {};
    try {
        const data = localStorage.getItem(WARMUP_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error('Error loading warmup data:', e);
        return {};
    }
}

/**
 * Save all warm-up data
 */
function saveAllWarmupData(data) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WARMUP_KEY, JSON.stringify(data));
}

/**
 * Get warm-up status for a specific SMTP account
 */
export function getWarmupStatus(accountId) {
    const allData = getAllWarmupData();
    const data = allData[accountId] || createDefaultWarmupData();

    // Check if we need to reset daily counter (new day)
    const today = new Date().toISOString().split('T')[0];
    if (data.todayDate !== today) {
        // Save yesterday's stats to history
        if (data.todayDate && data.todaySent > 0) {
            data.history = data.history || [];
            data.history.push({
                date: data.todayDate,
                sent: data.todaySent,
                limit: data.dailyLimit,
                phase: getCurrentPhase(data)
            });
            // Keep only last 30 days
            if (data.history.length > 30) {
                data.history = data.history.slice(-30);
            }
        }
        // Reset for new day
        data.todayDate = today;
        data.todaySent = 0;

        // Recalculate daily limit
        data.dailyLimit = calculateDailyLimit(data);

        // Check if weekend reduction applies
        const dayOfWeek = new Date().getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        if (isWeekend && data.reduceOnWeekends) {
            data.dailyLimit = Math.round(data.dailyLimit * 0.5);
        }

        // Save updated data
        allData[accountId] = data;
        saveAllWarmupData(allData);
    }

    // Calculate current phase
    data.currentPhase = getCurrentPhase(data);
    data.daysRemaining = getDaysRemaining(data);
    data.isComplete = isWarmupComplete(data);

    return data;
}

/**
 * Create default warm-up data structure
 */
function createDefaultWarmupData() {
    return {
        warmupEnabled: false,
        warmupProfile: 'standard',
        warmupStartDate: null,
        startingPoint: 'new',
        targetDailyLimit: 200,
        customDailyLimit: null,
        reduceOnWeekends: true,
        isPaused: false,
        pausedAt: null,
        dailyLimit: 200,
        todaySent: 0,
        todayDate: new Date().toISOString().split('T')[0],
        totalSent: 0,
        history: []
    };
}

/**
 * Initialize warm-up for an SMTP account
 */
export function initializeWarmup(accountId, settings) {
    const allData = getAllWarmupData();
    const today = new Date().toISOString().split('T')[0];

    const warmupData = {
        warmupEnabled: true,
        warmupProfile: settings.profile || 'standard',
        warmupStartDate: today,
        startingPoint: settings.startingPoint || 'new',
        targetDailyLimit: settings.targetLimit || 200,
        customDailyLimit: settings.customLimit || null,
        reduceOnWeekends: settings.reduceOnWeekends !== false,
        isPaused: false,
        pausedAt: null,
        dailyLimit: 10, // Will be recalculated
        todaySent: 0,
        todayDate: today,
        totalSent: 0,
        history: []
    };

    // Calculate initial limit
    warmupData.dailyLimit = calculateDailyLimit(warmupData);

    allData[accountId] = warmupData;
    saveAllWarmupData(allData);

    return warmupData;
}

/**
 * Update warm-up settings
 */
export function updateWarmupSettings(accountId, updates) {
    const allData = getAllWarmupData();
    const current = allData[accountId] || createDefaultWarmupData();

    const updated = { ...current, ...updates };

    // Recalculate limit if profile/settings changed
    if (updates.warmupProfile || updates.customDailyLimit !== undefined ||
        updates.startingPoint || updates.warmupEnabled !== undefined) {
        updated.dailyLimit = calculateDailyLimit(updated);
    }

    allData[accountId] = updated;
    saveAllWarmupData(allData);

    return updated;
}

/**
 * Increment daily sent counter
 */
export function incrementDailySent(accountId) {
    const allData = getAllWarmupData();
    const data = getWarmupStatus(accountId); // This handles day reset

    data.todaySent += 1;
    data.totalSent += 1;

    allData[accountId] = data;
    saveAllWarmupData(allData);

    return data;
}

/**
 * Check if account can send more emails today
 */
export function canSendEmail(accountId) {
    const data = getWarmupStatus(accountId);

    if (!data.warmupEnabled) return { allowed: true, remaining: Infinity };
    if (data.isPaused) return { allowed: false, remaining: 0, reason: 'Warm-up gepauzeerd' };

    const remaining = Math.max(0, data.dailyLimit - data.todaySent);

    return {
        allowed: remaining > 0,
        remaining,
        todaySent: data.todaySent,
        dailyLimit: data.dailyLimit,
        reason: remaining === 0 ? 'Dagelijks limiet bereikt' : null
    };
}

/**
 * Get remaining emails for today
 */
export function getRemainingToday(accountId) {
    const data = getWarmupStatus(accountId);
    if (!data.warmupEnabled) return Infinity;
    return Math.max(0, data.dailyLimit - data.todaySent);
}

/**
 * Pause warm-up
 */
export function pauseWarmup(accountId) {
    return updateWarmupSettings(accountId, {
        isPaused: true,
        pausedAt: new Date().toISOString()
    });
}

/**
 * Resume warm-up
 */
export function resumeWarmup(accountId) {
    return updateWarmupSettings(accountId, {
        isPaused: false,
        pausedAt: null
    });
}

/**
 * Disable warm-up for account
 */
export function disableWarmup(accountId) {
    return updateWarmupSettings(accountId, {
        warmupEnabled: false
    });
}

/**
 * Delete warm-up data for account
 */
export function deleteWarmupData(accountId) {
    const allData = getAllWarmupData();
    delete allData[accountId];
    saveAllWarmupData(allData);
}

/**
 * Get warm-up summary for display
 */
export function getWarmupSummary(accountId) {
    const data = getWarmupStatus(accountId);
    const profile = WARMUP_PROFILES[data.warmupProfile];

    return {
        enabled: data.warmupEnabled,
        paused: data.isPaused,
        profileName: profile?.name || 'Custom',
        currentPhase: data.currentPhase,
        totalPhases: profile?.phases?.length || 0,
        dailyLimit: data.dailyLimit,
        todaySent: data.todaySent,
        remaining: Math.max(0, data.dailyLimit - data.todaySent),
        progress: data.dailyLimit > 0 ? Math.round((data.todaySent / data.dailyLimit) * 100) : 0,
        daysRemaining: data.daysRemaining,
        isComplete: data.isComplete,
        totalSent: data.totalSent
    };
}
