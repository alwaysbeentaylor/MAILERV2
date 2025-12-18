// QStash Client - Background Job Queue
import { Client } from "@upstash/qstash";
import { getBaseUrl } from "./base-url";


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
        const token = process.env.QSTASH_TOKEN.replace(/['"]/g, '').trim();
        qstashClient = new Client({
            token: token
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

    const baseUrl = getBaseUrl();
    const targetUrl = `${baseUrl}/api/process-scheduled-email`;

    try {
        // Validate URL
        new URL(targetUrl);

        const response = await client.publishJSON({
            url: targetUrl,
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

    const baseUrl = getBaseUrl();

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
 * @param {Buffer} buffer - The raw body buffer
 * @returns {Promise<{isValid: boolean, error?: string, debug?: string}>} Verification result
 */
export async function verifySignature(req, buffer) {
    // Check voor nood-bypass
    if (process.env.QSTASH_DEBUG_BYPASS === 'true') {
        console.warn('⚠️ QSTASH_DEBUG_BYPASS IS ACTIEF - Beveiliging tijdelijk uitgeschakeld voor debugging');
        return { isValid: true };
    }

    const { Receiver } = await import("@upstash/qstash");

    const currentKey = (process.env.QSTASH_CURRENT_SIGNING_KEY || "").replace(/['"]/g, '').trim();
    const nextKey = (process.env.QSTASH_NEXT_SIGNING_KEY || "").replace(/['"]/g, '').trim();

    const mask = (s) => s ? `${s.substring(0, 4)}...${s.substring(s.length - 4)}` : 'MISSING';

    // Waarschuwing als keys incompleet lijken (Upstash keys zijn meestal 64 karakters)
    let lengthWarning = "";
    if (currentKey && currentKey.length < 60) {
        lengthWarning = ` ⚠️ WAARSCHUWING: CUR key lijkt te kort (${currentKey.length} karakters). Heb je de volledige sleutel gekopieerd?`;
    }

    const debugInfo = `Keys: CUR=${mask(currentKey)}, NXT=${mask(nextKey)} (lens: ${currentKey.length}/${nextKey.length})${lengthWarning}`;

    if (!currentKey && !nextKey) {
        return {
            isValid: process.env.NODE_ENV === 'development',
            error: 'Geen signing keys gevonden op Vercel',
            debug: debugInfo
        };
    }

    const receiver = new Receiver({
        currentSigningKey: currentKey || nextKey,
        nextSigningKey: nextKey || currentKey
    });

    const signature = req.headers['upstash-signature'];
    if (!signature) {
        return { isValid: false, error: 'Upstash-Signature header ontbreekt', debug: debugInfo };
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers['host'];
    const reconstructedUrl = `${protocol}://${host}${req.url}`;

    try {
        await receiver.verify({
            signature,
            body: buffer,
            url: reconstructedUrl
        });
        return { isValid: true };
    } catch (error) {
        console.error('❌ QStash verificatie mislukt:', error.message);

        // Fallback: Probeer zonder URL (sommige proxy configuraties veranderen de URL)
        try {
            await receiver.verify({ signature, body: buffer });
            console.log('✅ Signature OK (zonder URL check)');
            return { isValid: true };
        } catch (retryError) {
            return {
                isValid: false,
                error: `Mislukt: ${retryError.message}`,
                debug: `${debugInfo}, Sig=${signature.substring(0, 8)}...`
            };
        }
    }
}
