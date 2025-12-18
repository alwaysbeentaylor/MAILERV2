/**
 * MX Record Validator
 * 
 * Validates that an email domain has valid MX records before sending.
 * Uses Node.js built-in dns module - no external API needed.
 */

import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

/**
 * Extract domain from email address
 * @param {string} email - Email address (e.g., "test@example.com")
 * @returns {string|null} - Domain or null if invalid
 */
export function getDomainFromEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const parts = email.trim().toLowerCase().split('@');
    if (parts.length !== 2 || !parts[1]) return null;
    return parts[1];
}

/**
 * Validate MX records for an email domain
 * 
 * @param {string} email - Email address to validate
 * @param {object} options - Options
 * @param {number} options.timeout - Timeout in ms (default 5000)
 * @returns {Promise<{
 *   valid: boolean,
 *   domain: string|null,
 *   mxRecords: Array<{exchange: string, priority: number}>|null,
 *   error: string|null
 * }>}
 */
export async function validateMX(email, options = {}) {
    const { timeout = 5000 } = options;

    const domain = getDomainFromEmail(email);

    if (!domain) {
        return {
            valid: false,
            domain: null,
            mxRecords: null,
            error: 'Ongeldig email formaat'
        };
    }

    console.log(`📧 MX check: ${domain}...`);

    try {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('MX lookup timeout')), timeout);
        });

        // Race between MX lookup and timeout
        const mxRecords = await Promise.race([
            resolveMx(domain),
            timeoutPromise
        ]);

        if (!mxRecords || mxRecords.length === 0) {
            console.log(`   ❌ Geen MX records voor ${domain}`);
            return {
                valid: false,
                domain,
                mxRecords: [],
                error: 'Domein heeft geen mail server (geen MX records)'
            };
        }

        // Sort by priority (lower = higher priority)
        mxRecords.sort((a, b) => a.priority - b.priority);

        console.log(`   ✅ MX OK: ${mxRecords[0].exchange} (${mxRecords.length} record${mxRecords.length > 1 ? 's' : ''})`);

        return {
            valid: true,
            domain,
            mxRecords: mxRecords.map(r => ({ exchange: r.exchange, priority: r.priority })),
            error: null
        };

    } catch (error) {
        const errorMsg = error.message || String(error);

        // Handle specific DNS errors
        if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
            console.log(`   ❌ Domein ${domain} bestaat niet of heeft geen MX`);
            return {
                valid: false,
                domain,
                mxRecords: null,
                error: 'Domein bestaat niet of heeft geen mail server'
            };
        }

        // For timeout or server errors - BE LENIENT and allow the email through
        // Better to try sending than to block valid emails due to DNS issues
        if (error.code === 'ETIMEOUT' || errorMsg.includes('timeout')) {
            console.log(`   ⚠️ MX lookup timeout voor ${domain} - email wordt toch toegestaan`);
            return {
                valid: true, // Allow through on timeout
                domain,
                mxRecords: null,
                error: null,
                warning: 'MX lookup timeout - email toch toegestaan'
            };
        }

        // ESERVFAIL = DNS server failed to respond - common with some providers
        if (error.code === 'ESERVFAIL' || error.code === 'ECONNREFUSED') {
            console.log(`   ⚠️ DNS server fout voor ${domain} - email wordt toch toegestaan`);
            return {
                valid: true, // Allow through on DNS server errors
                domain,
                mxRecords: null,
                error: null,
                warning: 'DNS server error - email toch toegestaan'
            };
        }

        // For any other error - be lenient and allow through
        console.log(`   ⚠️ MX check fout (${error.code || 'unknown'}): ${errorMsg} - email wordt toch toegestaan`);
        return {
            valid: true, // Default to allowing emails through
            domain,
            mxRecords: null,
            error: null,
            warning: `MX check overgeslagen wegens fout: ${errorMsg}`
        };
    }
}

/**
 * Quick check - just returns true/false
 * @param {string} email 
 * @returns {Promise<boolean>}
 */
export async function quickMXCheck(email) {
    const result = await validateMX(email, { timeout: 3000 });
    return result.valid;
}
