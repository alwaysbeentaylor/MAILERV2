// Inbox API Route - List INBOUND (received) emails with thread detection
import { listInboundEmails, getInboundEmail } from '../../../utils/resend-client';

// Database uses CommonJS, so we use dynamic import with fallback
let getAllEmails = async () => [];
try {
    const db = require('../../../utils/database');
    getAllEmails = db.getAllEmails || (async () => []);
} catch (e) {
    console.log('Database not available for thread matching');
}
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get INBOUND emails from Resend (emails received on your @skye-unlimited.be)
        const inboundEmails = await listInboundEmails();

        // Get our sent emails from database for thread matching
        let sentEmails = [];
        try {
            sentEmails = await getAllEmails();
        } catch (e) {
            console.log('Could not load sent emails from database:', e.message);
        }

        // Process inbound emails and detect replies
        const processedEmails = inboundEmails.map(email => {
            // Check if this is a reply to one of our sent emails
            const isReply = detectReply(email, sentEmails);

            return {
                id: email.id,
                from: email.from,
                to: email.to,
                subject: email.subject,
                created_at: email.created_at,
                last_event: email.last_event,
                isReply: isReply.isReply,
                originalEmailId: isReply.originalEmailId,
                originalEmail: isReply.originalEmail
            };
        });

        // Sort by date, newest first
        processedEmails.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.status(200).json({
            success: true,
            emails: processedEmails,
            count: processedEmails.length
        });
    } catch (error) {
        console.error('Inbox API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Detect if an email is a reply to one of our sent emails
 * Uses subject line matching (Re: prefix) and email address matching
 */
function detectReply(inboundEmail, sentEmails) {
    const subject = (inboundEmail.subject || '').toLowerCase();
    const fromAddress = Array.isArray(inboundEmail.from)
        ? inboundEmail.from[0]
        : inboundEmail.from;

    // Check for Re: prefix
    const isReplySubject = subject.startsWith('re:') || subject.startsWith('aw:') || subject.startsWith('antw:');

    if (!isReplySubject) {
        return { isReply: false, originalEmailId: null, originalEmail: null };
    }

    // Extract the original subject without Re: prefix
    const cleanSubject = subject
        .replace(/^(re:|aw:|antw:|fw:|fwd:)\s*/gi, '')
        .trim();

    // Try to find matching sent email
    const matchedEmail = sentEmails.find(sent => {
        const sentSubject = (sent.subject || '').toLowerCase().trim();
        const sentTo = sent.toEmail || sent.to;

        // Match by subject similarity and recipient
        const subjectMatch = sentSubject.includes(cleanSubject) || cleanSubject.includes(sentSubject);
        const addressMatch = fromAddress && sentTo &&
            (fromAddress.includes(sentTo) || sentTo.includes(fromAddress) ||
                fromAddress.toLowerCase() === sentTo.toLowerCase());

        return subjectMatch || addressMatch;
    });

    if (matchedEmail) {
        return {
            isReply: true,
            originalEmailId: matchedEmail.id || matchedEmail.messageId,
            originalEmail: {
                id: matchedEmail.id || matchedEmail.messageId,
                subject: matchedEmail.subject,
                body: matchedEmail.body || matchedEmail.htmlBody,
                to: matchedEmail.toEmail || matchedEmail.to,
                sent_at: matchedEmail.sentAt || matchedEmail.created_at
            }
        };
    }

    // It's a reply but we couldn't find the original
    return { isReply: true, originalEmailId: null, originalEmail: null };
}
