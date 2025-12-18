// QStash Client - Background Job Queue
import { Client } from "@upstash/qstash";

// Singleton client instance
let qstashClient = null;

/**
 * Get QStash client instance
 * @returns {Client|null} QStash client or null if not configured
 */
export function getQStashClient() {
    if (!process.env.QSTASH_TOKEN) {
        console.warn('⚠️ QSTASH_TOKEN niet gevonden - background jobs uitgeschakeld');
        return null;
    }

    if (!qstashClient) {
        qstashClient = new Client({
            token: process.env.QSTASH_TOKEN
        });
    }

    return qstashClient;
}

/**
 * Schedule an email to be sent later
 * @param {Object} emailData - Email configuration
 * @param {number} delaySeconds - Delay in seconds before sending
 * @returns {Promise<Object>} QStash message ID or error
 */
export async function scheduleEmail(emailData, delaySeconds = 0) {
    const client = getQStashClient();
    if (!client) {
        return { success: false, error: 'QStash niet geconfigureerd' };
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    try {
        const response = await client.publishJSON({
            url: `${baseUrl}/api/process-scheduled-email`,
            body: emailData,
            delay: delaySeconds
        });

        console.log(`📨 Email scheduled: ${response.messageId} (${delaySeconds}s delay)`);

        return {
            success: true,
            messageId: response.messageId,
            scheduledFor: new Date(Date.now() + delaySeconds * 1000).toISOString()
        };
    } catch (error) {
        console.error('❌ QStash scheduling failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Schedule a batch of emails with delays between them
 * @param {Array} emails - Array of email configurations
 * @param {number} delayBetween - Delay between emails in seconds
 * @param {number} startDelay - Initial delay before first email in seconds
 * @returns {Promise<Object>} Batch scheduling result
 */
export async function scheduleBatch(emails, delayBetween = 60, startDelay = 0) {
    const client = getQStashClient();
    if (!client) {
        return { success: false, error: 'QStash niet geconfigureerd' };
    }

    const results = [];

    for (let i = 0; i < emails.length; i++) {
        const delay = startDelay + (i * delayBetween);
        const result = await scheduleEmail(emails[i], delay);
        results.push({
            ...result,
            email: emails[i].toEmail,
            index: i
        });

        // Small pause to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
    }

    const successful = results.filter(r => r.success).length;

    return {
        success: successful > 0,
        total: emails.length,
        scheduled: successful,
        failed: emails.length - successful,
        results
    };
}

/**
 * Schedule warm-up emails for a specific SMTP account
 * @param {Object} smtpConfig - SMTP configuration
 * @param {number} emailsToSend - Number of warm-up emails to send
 * @param {number} spreadHours - Hours to spread emails over
 * @returns {Promise<Object>} Scheduling result
 */
export async function scheduleWarmup(smtpConfig, emailsToSend, spreadHours = 8) {
    const client = getQStashClient();
    if (!client) {
        return { success: false, error: 'QStash niet geconfigureerd' };
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const intervalSeconds = (spreadHours * 3600) / emailsToSend;

    const results = [];

    for (let i = 0; i < emailsToSend; i++) {
        const delay = Math.floor(i * intervalSeconds);

        try {
            const response = await client.publishJSON({
                url: `${baseUrl}/api/process-warmup-email`,
                body: {
                    smtpConfig,
                    warmupIndex: i,
                    totalEmails: emailsToSend
                },
                delay
            });

            results.push({
                success: true,
                messageId: response.messageId,
                scheduledFor: new Date(Date.now() + delay * 1000).toISOString()
            });
        } catch (error) {
            results.push({
                success: false,
                error: error.message,
                index: i
            });
        }

        // Small pause
        await new Promise(r => setTimeout(r, 50));
    }

    const successful = results.filter(r => r.success).length;

    return {
        success: successful > 0,
        total: emailsToSend,
        scheduled: successful,
        spreadOver: `${spreadHours} uur`,
        intervalMinutes: Math.round(intervalSeconds / 60),
        results
    };
}

/**
 * Verify QStash signature for incoming webhooks
 * @param {Object} req - Next.js request object
 * @returns {boolean} Whether signature is valid
 */
export async function verifySignature(req) {
    const { Receiver } = await import("@upstash/qstash");

    if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
        console.warn('⚠️ QStash signing keys niet gevonden - skip verificatie in development');
        return process.env.NODE_ENV === 'development';
    }

    const receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY
    });

    const signature = req.headers['upstash-signature'];
    const body = JSON.stringify(req.body);

    try {
        await receiver.verify({
            signature,
            body
        });
        return true;
    } catch (error) {
        console.error('❌ QStash signature verification failed:', error);
        return false;
    }
}
