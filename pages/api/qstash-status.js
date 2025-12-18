// API Endpoint: Check QStash Status & Configuration
// Handig om te verifiëren of background jobs werken

import { getQStashClient } from '../../utils/qstash';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const client = getQStashClient();

    const status = {
        qstashConfigured: !!client,
        qstashToken: !!process.env.QSTASH_TOKEN,
        signingKeysConfigured: !!(process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY),
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        environment: process.env.NODE_ENV || 'development'
    };

    // If QStash is configured, try to verify connection
    if (client) {
        try {
            // QStash doesn't have a direct "ping" but we can check the client exists
            status.status = 'ready';
            status.message = 'QStash is geconfigureerd en klaar voor gebruik';
        } catch (error) {
            status.status = 'error';
            status.message = error.message;
        }
    } else {
        status.status = 'not_configured';
        status.message = 'QStash is niet geconfigureerd. Background jobs zijn uitgeschakeld.';
        status.setup = {
            step1: 'Ga naar https://console.upstash.com en maak een account aan',
            step2: 'Maak een nieuwe QStash instance aan',
            step3: 'Kopieer je QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY en QSTASH_NEXT_SIGNING_KEY',
            step4: 'Voeg deze toe als Environment Variables in Vercel'
        };
    }

    return res.status(200).json(status);
}
