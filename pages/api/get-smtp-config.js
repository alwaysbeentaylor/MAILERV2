// API Endpoint: Get SMTP Account with credentials (Server-side only)
// Dit endpoint geeft de volledige SMTP credentials terug voor server-side gebruik

import { getLocalData } from '../../utils/local-storage';

async function getKV() {
    // Check if KV environment variables are configured
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        return null;
    }

    try {
        const { kv } = await import('@vercel/kv');
        await kv.ping();
        return kv;
    } catch (e) {
        console.error('Get SMTP Config: KV connection failed:', e.message);
        return null;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { accountId } = req.body;

    if (!accountId) {
        return res.status(400).json({ success: false, error: 'accountId is verplicht' });
    }

    const kv = await getKV();
    const KV_KEY = 'smtp_accounts';

    try {
        let accounts = [];
        if (kv) {
            accounts = await kv.get(KV_KEY) || [];
        } else {
            accounts = getLocalData(KV_KEY, []);
        }

        const account = accounts.find(a => a.id === accountId);

        if (!account) {
            return res.status(404).json({ success: false, error: 'Account niet gevonden' });
        }

        // Return full credentials (only for server-side use)
        return res.status(200).json({
            success: true,
            smtpConfig: {
                host: account.host,
                port: account.port,
                user: account.user,
                pass: account.pass,
                fromName: account.fromName
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
