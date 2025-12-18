// API Endpoint: Get SMTP Account Advice
// Returns smart recommendations for SMTP accounts

import { getSmtpAdvice, getBulkSmtpAdvice } from '../../utils/smtp-advisor';

// Memory store fallback (same as smtp-accounts.js)
let memoryStore = {};

async function getKV() {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        return null;
    }
    try {
        const { kv } = await import('@vercel/kv');
        await kv.ping();
        return kv;
    } catch (e) {
        return null;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { accountId, accountIds } = req.body;

    const kv = await getKV();
    const KV_KEY = 'smtp_accounts';

    try {
        let accounts = [];
        if (kv) {
            accounts = await kv.get(KV_KEY) || [];
        } else {
            accounts = memoryStore[KV_KEY] || [];
        }

        // Single account advice
        if (accountId) {
            const account = accounts.find(a => a.id === accountId);

            if (!account) {
                return res.status(404).json({
                    success: false,
                    error: 'Account niet gevonden'
                });
            }

            const advice = await getSmtpAdvice(account);

            return res.status(200).json({
                success: true,
                advice
            });
        }

        // Multiple accounts advice
        if (accountIds && Array.isArray(accountIds)) {
            const selectedAccounts = accounts.filter(a => accountIds.includes(a.id));
            const bulkAdvice = await getBulkSmtpAdvice(selectedAccounts);

            return res.status(200).json({
                success: true,
                ...bulkAdvice
            });
        }

        // All accounts advice (if no specific ID provided)
        const bulkAdvice = await getBulkSmtpAdvice(accounts);

        return res.status(200).json({
            success: true,
            ...bulkAdvice
        });

    } catch (error) {
        console.error('SMTP Advice error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
