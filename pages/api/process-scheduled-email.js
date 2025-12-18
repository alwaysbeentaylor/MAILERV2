// API Endpoint: Process Scheduled Email (QStash Callback)
// Dit endpoint wordt aangeroepen door QStash wanneer een email moet worden verstuurd

import { verifySignature } from '../../utils/qstash';
import { getBaseUrl } from '../../utils/base-url';


export const config = {
    api: {
        bodyParser: false
    }
};

async function getRawBody(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Read raw body for signature verification
    const rawBody = await getRawBody(req);
    let emailData = {};
    try {
        emailData = JSON.parse(rawBody);
    } catch (e) {
        console.error('Failed to parse body:', e);
    }

    // Verify QStash signature in production
    if (process.env.NODE_ENV === 'production') {
        const isValid = await verifySignature(req, rawBody);
        if (!isValid) {
            console.error('❌ Invalid QStash signature');
            return res.status(401).json({ error: 'Unauthorized - Invalid signature' });
        }
    }

    console.log(`\n📬 Processing scheduled email...`);
    console.log(`   To: ${emailData.toEmail}`);
    console.log(`   Business: ${emailData.businessName}`);

    try {
        // Call the actual send-email endpoint
        const baseUrl = getBaseUrl();


        const response = await fetch(`${baseUrl}/api/send-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...emailData,
                dryRun: false
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log(`   ✅ Email sent successfully!`);
            return res.status(200).json({
                success: true,
                emailId: result.emailId,
                sentTo: emailData.toEmail
            });
        } else {
            console.error(`   ❌ Email failed:`, result.error);
            return res.status(500).json({
                success: false,
                error: result.error || 'Email sending failed'
            });
        }
    } catch (error) {
        console.error('❌ Error processing scheduled email:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
