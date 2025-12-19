import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'api-settings.json');
const KV_KEY_SETTINGS = 'api_settings';

// Default settings
const DEFAULT_SETTINGS = {
    resendEnabled: true,        // Toggle Resend API for sending emails (primary)
    mailgunEnabled: true,       // Toggle Mailgun API for sending emails (fallback)
    openaiEnabled: true,        // Toggle OpenAI API for email generation
    websiteAnalysisEnabled: true, // Toggle website scraping/analysis
    mxValidationEnabled: true,  // Toggle MX record validation before sending
    dryRunMode: false,          // Global dry-run mode (no actual sends)
    resendDefaultFrom: 'info@skye-unlimited.be', // Default sender for Resend
};

/**
 * Get Vercel KV client
 */
async function getKV() {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        return null;
    }
    try {
        const { kv } = await import('@vercel/kv');
        return kv;
    } catch (e) {
        return null;
    }
}

/**
 * Load current settings (Async version for server-side)
 */
export async function loadApiSettingsAsync() {
    try {
        const kv = await getKV();
        if (kv) {
            const settings = await kv.get(KV_KEY_SETTINGS);
            if (settings) return { ...DEFAULT_SETTINGS, ...settings };
        }

        // Fallback to local file for dev
        if (fs.existsSync(SETTINGS_FILE)) {
            const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
        }
    } catch (error) {
        console.error('Error loading API settings:', error.message);
    }
    return { ...DEFAULT_SETTINGS };
}

/**
 * Sync version for legacy support (reads from file only)
 */
export function loadApiSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
        }
    } catch (error) {
        // Silent fail
    }
    return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to KV and file
 */
export async function saveApiSettings(settings) {
    try {
        // Save to KV
        const kv = await getKV();
        if (kv) {
            await kv.set(KV_KEY_SETTINGS, settings);
        }

        // Also save to file for local persistence/fallback
        const dataDir = path.dirname(SETTINGS_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving API settings:', error.message);
        return false;
    }
}

/**
 * Check if a specific API is enabled (Async version)
 */
export async function isApiEnabledAsync(apiName) {
    const settings = await loadApiSettingsAsync();
    const key = `${apiName}Enabled`;
    if (settings[key] !== undefined) return settings[key];
    if (apiName === 'dryRun') return settings.dryRunMode;
    return true; // Default
}

/**
 * Legacy sync check
 */
export function isApiEnabled(apiName) {
    const settings = loadApiSettings();
    switch (apiName) {
        case 'resend': return settings.resendEnabled;
        case 'mailgun': return settings.mailgunEnabled;
        case 'openai': return settings.openaiEnabled;
        case 'websiteAnalysis': return settings.websiteAnalysisEnabled;
        case 'mxValidation': return settings.mxValidationEnabled;
        case 'dryRun': return settings.dryRunMode;
        default: return true;
    }
}

export default {
    loadApiSettings,
    loadApiSettingsAsync,
    saveApiSettings,
    isApiEnabled,
    isApiEnabledAsync,
    DEFAULT_SETTINGS
};
