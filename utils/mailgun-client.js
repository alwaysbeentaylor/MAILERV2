// Mailgun API Client
// Direct HTTP API integration for email sending

import { isApiEnabled } from './api-settings';

const MAILGUN_CONFIG = {
    apiKey: process.env.MAILGUN_API_KEY,
    baseUrl: 'https://api.eu.mailgun.net/v3',
    domain: process.env.MAILGUN_DOMAIN || 'mail.skye-unlimited.be',
    defaultFrom: 'info@mail.skye-unlimited.be',
    defaultFromName: 'SKYE'
};

/**
 * Check if Mailgun is enabled (respects user settings)
 */
export function isMailgunEnabled() {
    // First check user settings toggle
    const userEnabled = isApiEnabled('mailgun');
    // Then check if API key is configured
    return userEnabled && MAILGUN_CONFIG.apiKey;
}

/**
 * Send email via Mailgun HTTP API
 */
export async function sendEmailViaMailgun(options) {
    const { to, subject, html, text, from, fromName } = options;

    if (!isMailgunEnabled()) {
        throw new Error("Mailgun is not enabled or configured");
    }

    // Bepaal het domein - gebruik sandbox of eigen domein
    const domain = MAILGUN_CONFIG.domain || `sandbox${MAILGUN_CONFIG.apiKey.split('-')[1]}.mailgun.org`;

    const fromEmail = from || MAILGUN_CONFIG.defaultFrom;
    const senderName = fromName || MAILGUN_CONFIG.defaultFromName;
    const formattedFrom = senderName ? `${senderName} <${fromEmail}>` : fromEmail;

    // Build form data
    const formData = new URLSearchParams();
    formData.append('from', formattedFrom);
    formData.append('to', Array.isArray(to) ? to.join(',') : to);
    formData.append('subject', subject);
    if (html) formData.append('html', html);
    if (text) formData.append('text', text);

    const url = `${MAILGUN_CONFIG.baseUrl}/${domain}/messages`;

    console.log(`📧 Mailgun API: Sending to ${to} via ${domain}...`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`api:${MAILGUN_CONFIG.apiKey}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`❌ Mailgun API Error:`, data);
            throw new Error(data.message || `HTTP ${response.status}`);
        }

        console.log(`✅ Mailgun: Email sent! ID: ${data.id}`);
        return {
            success: true,
            messageId: data.id,
            provider: 'mailgun'
        };
    } catch (error) {
        console.error(`❌ Mailgun error:`, error.message);
        throw error;
    }
}

/**
 * Test Mailgun connection
 */
export async function testMailgunConnection() {
    if (!isMailgunEnabled()) {
        return { success: false, message: "Mailgun is not enabled" };
    }

    try {
        const domain = MAILGUN_CONFIG.domain || `sandbox${MAILGUN_CONFIG.apiKey.split('-')[1]}.mailgun.org`;
        const url = `${MAILGUN_CONFIG.baseUrl}/${domain}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`api:${MAILGUN_CONFIG.apiKey}`).toString('base64')
            }
        });

        if (response.ok) {
            const data = await response.json();
            return {
                success: true,
                message: `Mailgun connected! Domain: ${data.domain?.name || domain}`,
                domain: data.domain
            };
        } else {
            const error = await response.json();
            return {
                success: false,
                message: `Mailgun error: ${error.message || response.status}`
            };
        }
    } catch (error) {
        return {
            success: false,
            message: `Mailgun connection failed: ${error.message}`
        };
    }
}

/**
 * Set custom domain (call this when user verifies their domain)
 */
export function setMailgunDomain(domain) {
    MAILGUN_CONFIG.domain = domain;
}

export default {
    isMailgunEnabled,
    sendEmailViaMailgun,
    testMailgunConnection,
    setMailgunDomain,
    config: MAILGUN_CONFIG
};

// Export config for UI to check
export { MAILGUN_CONFIG };
