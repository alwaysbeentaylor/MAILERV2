// API Endpoint: Schedule Warmup Emails via QStash
// Dit endpoint plant warmup emails in voor een SMTP account

import { scheduleWarmup, getQStashClient } from '../../utils/qstash';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        smtpConfig,
        emailsToSend = 5,
        spreadHours = 8,
        startDelayMinutes = 0
    } = req.body;

    // Validate SMTP config
    if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
        return res.status(400).json({
            error: 'SMTP configuratie onvolledig',
            details: 'host, user en pass zijn verplicht'
        });
    }

    // Check if QStash is configured
    const client = getQStashClient();
    if (!client) {
        return res.status(503).json({
            error: 'Background jobs niet beschikbaar',
            details: 'QStash is niet geconfigureerd. Voeg QSTASH_TOKEN toe aan je environment variables.',
            hint: 'Ga naar upstash.com om een gratis QStash account aan te maken'
        });
    }

    // Validate limits
    const maxEmailsPerDay = smtpConfig.maxPerDay || 50;
    if (emailsToSend > maxEmailsPerDay) {
        return res.status(400).json({
            error: 'Te veel emails',
            details: `Maximum ${maxEmailsPerDay} emails per dag voor dit account`,
            requested: emailsToSend
        });
    }

    console.log(`\n🔥 Scheduling warmup for ${smtpConfig.user}...`);
    console.log(`   Emails: ${emailsToSend}`);
    console.log(`   Spread over: ${spreadHours} hours`);

    try {
        const result = await scheduleWarmup(smtpConfig, emailsToSend, spreadHours);

        console.log(`   ✅ Scheduled: ${result.scheduled}/${result.total}`);
        console.log(`   📊 Interval: every ${result.intervalMinutes} minutes`);

        // Calculate timing
        const firstEmailAt = new Date(Date.now() + startDelayMinutes * 60 * 1000);
        const lastEmailAt = new Date(firstEmailAt.getTime() + spreadHours * 3600 * 1000);

        return res.status(200).json({
            success: result.success,
            message: `${result.scheduled} warmup emails ingepland`,
            scheduled: result.scheduled,
            total: result.total,
            timing: {
                firstEmailAt: firstEmailAt.toISOString(),
                lastEmailAt: lastEmailAt.toISOString(),
                intervalMinutes: result.intervalMinutes,
                spreadOver: result.spreadOver
            },
            smtpUser: smtpConfig.user
        });

    } catch (error) {
        console.error('❌ Error scheduling warmup:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
