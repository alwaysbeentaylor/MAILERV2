// AWS SES Client - SMTP Mode
// Uses Amazon SES SMTP endpoint for email delivery
// Better deliverability than regular SMTP providers

import nodemailer from 'nodemailer';

// SES SMTP Configuration - DISABLED (AWS denied production access)
const SES_CONFIG = {
    enabled: false, // Disabled - use regular SMTP instead
    smtp: {
        host: 'email-smtp.eu-north-1.amazonaws.com', // EU North 1 SMTP endpoint (Stockholm)
        port: 587,
        secure: false, // Use STARTTLS
        auth: {
            user: 'AKIAWFOWJDPWCOKXCTFO', // SMTP Username
            pass: 'BFPmv14gkodszJryIIZ9vQ5b7wIKQk5gilu9e9scJEN1' // SMTP Password
        }
    },
    defaultFrom: 'info@skye-unlimited.be',
    defaultFromName: 'SKYE'
};

// Create transporter lazily
let sesTransporter = null;

function getTransporter() {
    if (!sesTransporter) {
        sesTransporter = nodemailer.createTransport({
            host: SES_CONFIG.smtp.host,
            port: SES_CONFIG.smtp.port,
            secure: SES_CONFIG.smtp.secure,
            auth: SES_CONFIG.smtp.auth,
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            // SES requires proper TLS
            tls: {
                ciphers: 'SSLv3'
            }
        });
    }
    return sesTransporter;
}

/**
 * Check if SES is enabled and configured
 */
export function isSESEnabled() {
    return SES_CONFIG.enabled && SES_CONFIG.smtp.auth.user && SES_CONFIG.smtp.auth.pass;
}

/**
 * Send email via AWS SES SMTP
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body content
 * @param {string} options.text - Plain text body (optional)
 * @param {string} options.from - Sender email (optional, uses default)
 * @param {string} options.fromName - Sender name (optional)
 * @param {string} options.replyTo - Reply-to address (optional)
 */
export async function sendEmailViaSES(options) {
    const { to, subject, html, text, from, fromName, replyTo } = options;

    if (!isSESEnabled()) {
        throw new Error("SES is not enabled or configured");
    }

    const transporter = getTransporter();

    // Format the From address
    const fromEmail = from || SES_CONFIG.defaultFrom;
    const senderName = fromName || SES_CONFIG.defaultFromName;
    const formattedFrom = senderName ? `"${senderName}" <${fromEmail}>` : fromEmail;

    try {
        const info = await transporter.sendMail({
            from: formattedFrom,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject: subject,
            text: text || '',
            html: html,
            ...(replyTo && { replyTo: Array.isArray(replyTo) ? replyTo.join(', ') : replyTo })
        });

        console.log(`✅ SES email sent successfully to ${to}, MessageId: ${info.messageId}`);
        return {
            success: true,
            messageId: info.messageId,
            provider: 'ses-smtp'
        };
    } catch (error) {
        console.error(`❌ SES SMTP error sending to ${to}:`, error.message);
        throw error;
    }
}

/**
 * Test SES SMTP connection
 */
export async function testSESConnection() {
    if (!isSESEnabled()) {
        return {
            success: false,
            message: "SES is not enabled"
        };
    }

    try {
        const transporter = getTransporter();
        await transporter.verify();
        return {
            success: true,
            message: `SES SMTP Connected! Host: ${SES_CONFIG.smtp.host}:${SES_CONFIG.smtp.port}`
        };
    } catch (error) {
        return {
            success: false,
            message: `SES Connection failed: ${error.message}`
        };
    }
}

export default {
    isSESEnabled,
    sendEmailViaSES,
    testSESConnection,
    config: SES_CONFIG
};
