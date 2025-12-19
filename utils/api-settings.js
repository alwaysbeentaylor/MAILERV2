// API Settings - User-configurable toggles
// This file stores runtime API settings that can be toggled via the UI

import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'api-settings.json');

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
 * Ensure data directory exists
 */
function ensureDataDir() {
    const dataDir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

/**
 * Load current settings from file
 */
export function loadApiSettings() {
    try {
        ensureDataDir();
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
 * Save settings to file
 */
export function saveApiSettings(settings) {
    try {
        ensureDataDir();
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving API settings:', error.message);
        return false;
    }
}

/**
 * Update a single setting
 */
export function updateApiSetting(key, value) {
    const settings = loadApiSettings();
    settings[key] = value;
    return saveApiSettings(settings);
}

/**
 * Check if a specific API is enabled
 */
export function isApiEnabled(apiName) {
    const settings = loadApiSettings();
    switch (apiName) {
        case 'resend':
            return settings.resendEnabled;
        case 'mailgun':
            return settings.mailgunEnabled;
        case 'openai':
            return settings.openaiEnabled;
        case 'websiteAnalysis':
            return settings.websiteAnalysisEnabled;
        case 'mxValidation':
            return settings.mxValidationEnabled;
        case 'dryRun':
            return settings.dryRunMode;
        default:
            return true;
    }
}

export default {
    loadApiSettings,
    saveApiSettings,
    updateApiSetting,
    isApiEnabled,
    DEFAULT_SETTINGS
};
