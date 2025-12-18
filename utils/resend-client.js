// Resend API Client
// Modern email API integration - https://resend.com
// Resend is known for excellent deliverability and developer experience

import { isApiEnabled } from './api-settings';

const RESEND_CONFIG = {
    apiKey: process.env.RESEND_API_KEY,
    baseUrl: 'https://api.resend.com',
    defaultFrom: 'SKYE <info@skye-unlimited.be>',
};

/**
 * Check if Resend is enabled (respects user settings)
 */
export function isResendEnabled() {
    // First check user settings toggle
    const userEnabled = isApiEnabled('resend');
    // Then check if API key is configured
    return userEnabled && RESEND_CONFIG.apiKey;
}

/**
 * Send email via Resend HTTP API
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content
 * @param {string} [options.from] - Sender email
 * @param {string} [options.fromName] - Sender name
 */
export async function sendEmailViaResend(options) {
    const { to, subject, html, text, from, fromName } = options;

    if (!isResendEnabled()) {
        throw new Error("Resend is not enabled or configured");
    }

    // Format the from address
    const fromEmail = from || 'info@skye-unlimited.be';
    const senderName = fromName || 'SKYE';
    const formattedFrom = `${senderName} <${fromEmail}>`;

    // Build request body
    const body = {
        from: formattedFrom,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html,
    };

    // Add text version if provided
    if (text) {
        body.text = text;
    }

    const url = `${RESEND_CONFIG.baseUrl}/emails`;

    console.log(`📨 Resend API: Sending to ${to}...`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_CONFIG.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`❌ Resend API Error:`, data);
            throw new Error(data.message || data.error?.message || `HTTP ${response.status}`);
        }

        console.log(`✅ Resend: Email sent! ID: ${data.id}`);
        return {
            success: true,
            messageId: data.id,
            provider: 'resend'
        };
    } catch (error) {
        console.error(`❌ Resend error:`, error.message);
        throw error;
    }
}

/**
 * Test Resend connection
 */
export async function testResendConnection() {
    if (!isResendEnabled()) {
        return { success: false, message: "Resend is not enabled" };
    }

    try {
        // Check domains to verify API key works
        const url = `${RESEND_CONFIG.baseUrl}/domains`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${RESEND_CONFIG.apiKey}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const domains = data.data || [];
            return {
                success: true,
                message: `Resend connected! ${domains.length} domain(s) configured`,
                domains: domains
            };
        } else {
            const error = await response.json();
            return {
                success: false,
                message: `Resend error: ${error.message || response.status}`
            };
        }
    } catch (error) {
        return {
            success: false,
            message: `Resend connection failed: ${error.message}`
        };
    }
}

/**
 * Get Resend API stats (emails sent, etc.)
 */
export async function getResendStats() {
    if (!isResendEnabled()) {
        return null;
    }

    try {
        // Get recent emails for stats
        const url = `${RESEND_CONFIG.baseUrl}/emails`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${RESEND_CONFIG.apiKey}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            return {
                recentEmails: data.data?.length || 0,
                provider: 'resend'
            };
        }
    } catch (error) {
        console.error('Error fetching Resend stats:', error);
    }
    return null;
}

/**
 * List received (inbound) emails from Resend
 * @returns {Promise<Array>} - List of received emails
 */
export async function listReceivedEmails() {
    if (!isResendEnabled()) {
        throw new Error("Resend is not enabled or configured");
    }

    try {
        const url = `${RESEND_CONFIG.baseUrl}/emails`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${RESEND_CONFIG.apiKey}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('❌ Error listing received emails:', error.message);
        throw error;
    }
}

/**
 * Get details of a specific email by ID
 * @param {string} emailId - Email ID
 * @returns {Promise<Object>} - Email details
 */
export async function getEmailById(emailId) {
    if (!isResendEnabled()) {
        throw new Error("Resend is not enabled or configured");
    }

    try {
        const url = `${RESEND_CONFIG.baseUrl}/emails/${emailId}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${RESEND_CONFIG.apiKey}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Error getting email:', error.message);
        throw error;
    }
}

/**
 * List INBOUND (received) emails from Resend
 * Uses the /emails/receiving endpoint for actual received emails
 * @returns {Promise<Array>} - List of received inbound emails
 */
export async function listInboundEmails() {
    if (!isResendEnabled()) {
        throw new Error("Resend is not enabled or configured");
    }

    try {
        const url = `${RESEND_CONFIG.baseUrl}/emails/receiving`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${RESEND_CONFIG.apiKey}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('❌ Error listing inbound emails:', error.message);
        throw error;
    }
}

/**
 * Get details of a specific INBOUND email by ID
 * @param {string} emailId - Inbound email ID
 * @returns {Promise<Object>} - Inbound email details including body
 */
export async function getInboundEmail(emailId) {
    if (!isResendEnabled()) {
        throw new Error("Resend is not enabled or configured");
    }

    try {
        const url = `${RESEND_CONFIG.baseUrl}/emails/receiving/${emailId}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${RESEND_CONFIG.apiKey}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Error getting inbound email:', error.message);
        throw error;
    }
}

export default {
    isResendEnabled,
    sendEmailViaResend,
    testResendConnection,
    getResendStats,
    listReceivedEmails,
    getEmailById,
    listInboundEmails,
    getInboundEmail,
    config: RESEND_CONFIG
};

// Export config for UI to check
export { RESEND_CONFIG };
