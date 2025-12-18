// Domain Verification Utility
// Simple domain/URL verification using DNS lookup

/**
 * Extract domain from URL
 * @param {string} url - Full URL
 * @returns {string|null} - Extracted domain or null
 */
export function getDomainFromUrl(url) {
    if (!url) return null;

    try {
        // Add protocol if missing
        let fullUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            fullUrl = 'https://' + url;
        }

        const urlObj = new URL(fullUrl);
        return urlObj.hostname;
    } catch (error) {
        // Try simple extraction
        const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
        return match ? match[1] : null;
    }
}

/**
 * Verify if a domain is reachable
 * @param {string} domain - Domain to verify
 * @returns {Promise<Object>} - Verification result
 */
export async function verifyDomain(domain) {
    if (!domain) {
        return { valid: false, error: 'Geen domein opgegeven' };
    }

    try {
        // Try to fetch the domain
        const url = `https://${domain.replace(/^(https?:\/\/)?(www\.)?/, '')}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; DomainVerifier/1.0)'
            }
        });

        clearTimeout(timeoutId);

        return {
            valid: true,
            domain: domain,
            statusCode: response.status,
            reachable: response.ok
        };
    } catch (error) {
        // Try without SSL
        try {
            const httpUrl = `http://${domain.replace(/^(https?:\/\/)?(www\.)?/, '')}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(httpUrl, {
                method: 'HEAD',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            return {
                valid: true,
                domain: domain,
                statusCode: response.status,
                reachable: response.ok,
                httpOnly: true
            };
        } catch (httpError) {
            return {
                valid: false,
                domain: domain,
                error: error.message,
                reachable: false
            };
        }
    }
}

/**
 * Verify domain from a website URL
 * @param {string} websiteUrl - Full website URL
 * @returns {Promise<Object>} - Verification result
 */
export async function verifyWebsiteDomain(websiteUrl) {
    const domain = getDomainFromUrl(websiteUrl);
    if (!domain) {
        return { valid: false, error: 'Ongeldige URL' };
    }

    const result = await verifyDomain(domain);
    result.originalUrl = websiteUrl;
    return result;
}

export default {
    getDomainFromUrl,
    verifyDomain,
    verifyWebsiteDomain
};
