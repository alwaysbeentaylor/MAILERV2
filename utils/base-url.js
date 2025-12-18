/**
 * Base URL Utility
 * Determines the correct absolute base URL for the environment
 */
export function getBaseUrl() {
    // 1. Manually configured base URL (highest priority)
    if (process.env.NEXT_PUBLIC_BASE_URL) {
        return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
    }

    // 2. Vercel deployment URL
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }

    // 3. Fallback for local development
    return 'http://localhost:3000';
}
