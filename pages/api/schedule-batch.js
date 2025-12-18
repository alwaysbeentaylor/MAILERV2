// API Endpoint: Schedule Batch Emails via QStash
// Dit endpoint plant een batch emails in die later worden verstuurd

import { scheduleBatch, getQStashClient } from '../../utils/qstash';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        leads,
        emailTone = 'professional',
        delayBetweenSeconds = 60,
        startDelaySeconds = 0,
        sessionPrompt = '',
        smtpConfig = null
    } = req.body;

    // Validate input
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({
            error: 'Geen leads opgegeven',
            details: 'leads moet een array zijn met minimaal 1 lead'
        });
    }

    // Check if QStash is configured
    const client = getQStashClient();
    if (!client) {
        return res.status(503).json({
            error: 'Background jobs niet beschikbaar',
            details: 'QStash is niet geconfigureerd. Voeg QSTASH_TOKEN toe aan je environment variables.',
            fallback: 'Gebruik /api/send-batch-stream voor real-time verzending'
        });
    }

    console.log(`\n📋 Scheduling batch of ${leads.length} emails...`);
    console.log(`   Delay between: ${delayBetweenSeconds}s`);
    console.log(`   Start delay: ${startDelaySeconds}s`);
    console.log(`   Tone: ${emailTone}`);

    try {
        // Prepare email data for each lead
        const emailsToSchedule = leads.map(lead => ({
            toEmail: lead.email || lead.toEmail,
            businessName: lead.businessName || lead.bedrijfsnaam || lead.business,
            websiteUrl: lead.websiteUrl || lead.website || lead.url,
            contactPerson: lead.contactPerson || lead.contact || '',
            emailTone: lead.tone || emailTone,
            sessionPrompt,
            smtpConfig,
            // Extra metadata
            knowledgeFile: lead.knowledgeFile || null,
            niche: lead.niche || null
        }));

        // Schedule all emails via QStash
        const result = await scheduleBatch(
            emailsToSchedule,
            delayBetweenSeconds,
            startDelaySeconds
        );

        console.log(`   ✅ Scheduled: ${result.scheduled}/${result.total}`);

        // Calculate when first and last email will be sent
        const firstEmailAt = new Date(Date.now() + startDelaySeconds * 1000);
        const lastEmailAt = new Date(Date.now() + (startDelaySeconds + (leads.length - 1) * delayBetweenSeconds) * 1000);

        return res.status(200).json({
            success: result.success,
            message: `${result.scheduled} emails ingepland`,
            scheduled: result.scheduled,
            failed: result.failed,
            total: result.total,
            timing: {
                firstEmailAt: firstEmailAt.toISOString(),
                lastEmailAt: lastEmailAt.toISOString(),
                totalDuration: `${Math.round((result.total * delayBetweenSeconds) / 60)} minuten`
            },
            // Don't expose full results to client in production
            ...(process.env.NODE_ENV === 'development' ? { details: result.results } : {})
        });

    } catch (error) {
        console.error('❌ Error scheduling batch:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
