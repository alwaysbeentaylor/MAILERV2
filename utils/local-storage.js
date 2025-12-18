// Local File Storage Utility
// Slaat data op in JSON bestanden voor development (persistent)
// Op Vercel (read-only filesystem) valt het terug op in-memory storage

// In-memory fallback voor Vercel
const memoryStore = new Map();

// Check if we're on Vercel (read-only filesystem)
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// Safely import fs (may fail on some edge runtimes)
let fs = null;
let path = null;
let DATA_DIR = '';

if (!isVercel) {
    try {
        fs = require('fs');
        path = require('path');
        DATA_DIR = path.join(process.cwd(), '.local-data');
    } catch (e) {
        console.log('Local storage: fs not available, using memory store');
    }
}

// Zorg dat de data directory bestaat
function ensureDataDir() {
    if (!fs || !DATA_DIR) return false;

    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            console.log('📁 Local data directory created:', DATA_DIR);
        }
        return true;
    } catch (error) {
        console.log('Cannot create data dir (read-only filesystem):', error.message);
        return false;
    }
}

// Get file path for a specific key
function getFilePath(key) {
    if (!path) return null;
    return path.join(DATA_DIR, `${key}.json`);
}

/**
 * Get data from local storage
 * @param {string} key - The storage key
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {any} The stored data or default value
 */
export function getLocalData(key, defaultValue = null) {
    // On Vercel or if fs unavailable, use memory store
    if (isVercel || !fs) {
        return memoryStore.has(key) ? memoryStore.get(key) : defaultValue;
    }

    if (!ensureDataDir()) {
        return memoryStore.has(key) ? memoryStore.get(key) : defaultValue;
    }

    const filePath = getFilePath(key);

    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error(`Error reading local data for ${key}:`, error.message);
    }

    return defaultValue;
}

/**
 * Save data to local storage
 * @param {string} key - The storage key
 * @param {any} data - The data to store
 * @returns {boolean} Success status
 */
export function setLocalData(key, data) {
    // Always store in memory as fallback
    memoryStore.set(key, data);

    // On Vercel or if fs unavailable, only use memory
    if (isVercel || !fs) {
        return true;
    }

    if (!ensureDataDir()) {
        return true; // Still return true because we stored in memory
    }

    const filePath = getFilePath(key);

    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing local data for ${key}:`, error.message);
        return true; // Still true because we have memory fallback
    }
}

/**
 * Delete data from local storage
 * @param {string} key - The storage key
 * @returns {boolean} Success status
 */
export function deleteLocalData(key) {
    memoryStore.delete(key);

    if (isVercel || !fs) {
        return true;
    }

    const filePath = getFilePath(key);

    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return true;
    } catch (error) {
        console.error(`Error deleting local data for ${key}:`, error.message);
        return true;
    }
}

/**
 * List all stored keys
 * @returns {string[]} Array of stored keys
 */
export function listLocalKeys() {
    if (isVercel || !fs) {
        return Array.from(memoryStore.keys());
    }

    if (!ensureDataDir()) {
        return Array.from(memoryStore.keys());
    }

    try {
        const files = fs.readdirSync(DATA_DIR);
        return files
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
    } catch (error) {
        console.error('Error listing local data keys:', error.message);
        return Array.from(memoryStore.keys());
    }
}

// Export default object for convenience
export default {
    get: getLocalData,
    set: setLocalData,
    delete: deleteLocalData,
    list: listLocalKeys
};
