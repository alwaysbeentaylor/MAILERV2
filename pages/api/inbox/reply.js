// Reply API - Send reply via Resend
import { sendEmailViaResend } from '../../../utils/resend-client';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, subject, content, format } = req.body;

    if (!to || !subject || !content) {
        return res.status(400).json({ error: 'Missing required fields: to, subject, content' });
    }

    try {
        // Build email options
        const emailOptions = {
            to: to,
            subject: subject,
            fromName: 'Hope',
        };

        // Set content based on format
        if (format === 'html') {
            emailOptions.html = content;
            // Also add plain text version
            emailOptions.text = content.replace(/<[^>]*>/g, '');
        } else {
            // Plain text - wrap in minimal HTML
            emailOptions.html = `<p>${content.replace(/\n/g, '<br>')}</p>`;
            emailOptions.text = content;
        }

        const result = await sendEmailViaResend(emailOptions);

        res.status(200).json({
            success: true,
            messageId: result.messageId,
            provider: result.provider
        });
    } catch (error) {
        console.error('Reply error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
