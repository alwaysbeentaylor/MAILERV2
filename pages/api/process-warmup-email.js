// API Endpoint: Process Warmup Email (QStash Callback)
// Dit endpoint wordt aangeroepen door QStash voor email warming

import { verifySignature } from '../../utils/qstash';
import nodemailer from 'nodemailer';

export const config = {
    api: {
        bodyParser: true
    }
};

// Warmup email templates - variatie om spam filters te vermijden
const WARMUP_TEMPLATES = [
    {
        subject: "Re: Meeting volgende week",
        body: "Hoi,\n\nBedankt voor je bericht. Ik kijk even in mijn agenda en kom er zo snel mogelijk op terug.\n\nGroeten"
    },
    {
        subject: "Vraag over project",
        body: "Hey,\n\nIk had nog een vraag over het project waar we het over hadden. Kun je me even bellen wanneer je tijd hebt?\n\nBedankt!"
    },
    {
        subject: "Re: Document ontvangen",
        body: "Bedankt voor het doorsturen van het document. Ik heb het ontvangen en zal het deze week bekijken.\n\nMet vriendelijke groet"
    },
    {
        subject: "Update planning",
        body: "Hallo,\n\nEven een snelle update over de planning. Alles loopt volgens schema. Ik hou je op de hoogte van verdere ontwikkelingen.\n\nGroeten"
    },
    {
        subject: "Re: Afspraak bevestiging",
        body: "Perfect, dat komt goed uit. Dan zie ik je volgende week.\n\nTot dan!"
    }
];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify QStash signature in production
    if (process.env.NODE_ENV === 'production') {
        const isValid = await verifySignature(req);
        if (!isValid) {
            console.error('❌ Invalid QStash signature');
            return res.status(401).json({ error: 'Unauthorized - Invalid signature' });
        }
    }

    const { smtpConfig, warmupIndex, totalEmails } = req.body;

    if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
        return res.status(400).json({ error: 'Invalid SMTP configuration' });
    }

    console.log(`\n🔥 Processing warmup email ${warmupIndex + 1}/${totalEmails}...`);
    console.log(`   SMTP: ${smtpConfig.host}`);
    console.log(`   User: ${smtpConfig.user}`);

    try {
        // Create transporter with provided SMTP config
        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: parseInt(smtpConfig.port) || 587,
            secure: parseInt(smtpConfig.port) === 465,
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass
            },
            connectionTimeout: 15000,
            greetingTimeout: 15000
        });

        // Pick a random template
        const template = WARMUP_TEMPLATES[warmupIndex % WARMUP_TEMPLATES.length];

        // For warmup, we send to ourselves or a warmup partner
        // In real implementation, you would have warmup partners
        const warmupEmail = smtpConfig.warmupEmail || smtpConfig.user;

        const mailOptions = {
            from: smtpConfig.fromName
                ? `"${smtpConfig.fromName}" <${smtpConfig.user}>`
                : smtpConfig.user,
            to: warmupEmail,
            subject: template.subject,
            text: template.body,
            // Add some variation to avoid spam detection
            headers: {
                'X-Warmup-Index': warmupIndex.toString(),
                'X-Priority': '3'
            }
        };

        const info = await transporter.sendMail(mailOptions);

        console.log(`   ✅ Warmup email ${warmupIndex + 1} sent: ${info.messageId}`);

        // TODO: In production, update warmup stats in KV storage
        // await updateWarmupStats(smtpConfig.user, { sent: 1 });

        return res.status(200).json({
            success: true,
            warmupIndex,
            totalEmails,
            messageId: info.messageId,
            sentTo: warmupEmail
        });

    } catch (error) {
        console.error(`❌ Warmup email ${warmupIndex + 1} failed:`, error);

        return res.status(500).json({
            success: false,
            warmupIndex,
            totalEmails,
            error: error.message
        });
    }
}
