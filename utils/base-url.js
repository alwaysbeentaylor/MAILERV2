/**
 * Base URL Utility
 * Determines the correct absolute base URL for the environment
 */
export function getBaseUrl() {
    let url = '';

    // 1. Manually configured base URL
    if (process.env.NEXT_PUBLIC_BASE_URL) {
        url = process.env.NEXT_PUBLIC_BASE_URL.trim().replace(/\/$/, '');
    }
    // 2. Vercel deployment URL
    else if (process.env.VERCEL_URL) {
        url = `https://${process.env.VERCEL_URL.trim()}`;
    }
    // 3. Fallback for local development
    else {
        url = 'http://localhost:3000';
    }

    url = url.trim();

    // Garandeer protocol
    if (url && !url.startsWith('http')) {
        url = `https://${url}`;
    }

    return url;
}
