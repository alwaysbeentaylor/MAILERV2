// API Endpoint: SMTP Accounts CRUD
// Slaat SMTP accounts op in Vercel KV (productie) of lokaal JSON bestand (development)

import { getLocalData, setLocalData } from '../../utils/local-storage';

// Helper to get KV client (if available and configured)
async function getKV() {
    // Check if KV environment variables are configured
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.log('SMTP Accounts: KV not configured, using local file storage');
        return null;
    }

    try {
        // Try to import Vercel KV
        const { kv } = await import('@vercel/kv');
        // Test if KV is actually working by doing a simple ping
        await kv.ping();
        return kv;
    } catch (e) {
        console.error('SMTP Accounts: KV connection failed, using local file storage:', e.message);
        return null;
    }
}

export default async function handler(req, res) {
    const kv = await getKV();
    const KV_KEY = 'smtp_accounts';

    // GET - Lijst alle SMTP accounts
    if (req.method === 'GET') {
        try {
            let accounts = [];

            if (kv) {
                accounts = await kv.get(KV_KEY) || [];
            } else {
                accounts = getLocalData(KV_KEY, []);
            }

            // Check if full credentials are requested (for internal sync)
            const includeCredentials = req.query.full === 'true';

            if (includeCredentials) {
                // Return full accounts including passwords (for campaigns sync)
                return res.status(200).json({
                    success: true,
                    accounts: accounts,
                    source: kv ? 'kv' : 'local-file'
                });
            }

            // Strip passwords voor veiligheid (alleen voor listing)
            const safeAccounts = accounts.map(acc => ({
                ...acc,
                pass: acc.pass ? '••••••••' : ''
            }));

            return res.status(200).json({
                success: true,
                accounts: safeAccounts,
                source: kv ? 'kv' : 'local-file'
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // POST - Nieuw account toevoegen of bestaand updaten
    if (req.method === 'POST') {
        try {
            const {
                id, name, host, port, user, pass,
                fromName, fromEmail,
                hourlyLimit, dailyLimit,
                warmupEnabled, active = true
            } = req.body;

            let accounts = [];
            if (kv) {
                accounts = await kv.get(KV_KEY) || [];
            } else {
                accounts = getLocalData(KV_KEY, []);
            }

            // Check of we updaten of toevoegen
            const existingIndex = accounts.findIndex(a => a.id === id);
            const isUpdate = existingIndex >= 0;

            // Bij nieuw account: host, user, pass verplicht
            // Bij update: alleen geleverde velden worden gewijzigd
            if (!isUpdate && (!host || !user || !pass)) {
                return res.status(400).json({
                    success: false,
                    error: 'host, user en pass zijn verplicht voor nieuwe accounts'
                });
            }

            let accountData;

            if (isUpdate) {
                // Update: merge met bestaande data
                const existing = accounts[existingIndex];
                accountData = {
                    ...existing,
                    name: name !== undefined ? name : existing.name,
                    host: host || existing.host,
                    port: port || existing.port,
                    user: user || existing.user,
                    pass: pass || existing.pass, // Behoud bestaand wachtwoord als niet meegegeven
                    fromName: fromName !== undefined ? fromName : (existing.fromName || ''),
                    fromEmail: fromEmail !== undefined ? fromEmail : (existing.fromEmail || ''),
                    hourlyLimit: hourlyLimit !== undefined ? hourlyLimit : (existing.hourlyLimit || 10),
                    dailyLimit: dailyLimit !== undefined ? dailyLimit : (existing.dailyLimit || 50),
                    warmupEnabled: warmupEnabled !== undefined ? warmupEnabled : (existing.warmupEnabled || false),
                    active: active !== undefined ? active : existing.active,
                    updatedAt: new Date().toISOString()
                };
                accounts[existingIndex] = accountData;
            } else {
                // Nieuw account
                accountData = {
                    id: `smtp_${Date.now()}`,
                    name: name || host,
                    host,
                    port: port || '587',
                    user,
                    pass,
                    fromName: fromName || '',
                    fromEmail: fromEmail || '',
                    hourlyLimit: hourlyLimit || 10,
                    dailyLimit: dailyLimit || 50,
                    warmupEnabled: warmupEnabled || false,
                    active,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                accounts.push(accountData);
            }

            // Sla op
            if (kv) {
                await kv.set(KV_KEY, accounts);
            } else {
                setLocalData(KV_KEY, accounts);
            }

            return res.status(200).json({
                success: true,
                account: { ...accountData, pass: '••••••••' },
                message: isUpdate ? 'Account bijgewerkt' : 'Account toegevoegd'
            });
        } catch (error) {
            console.error('SMTP POST error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // DELETE - Account verwijderen
    if (req.method === 'DELETE') {
        try {
            const { id } = req.body;

            if (!id) {
                return res.status(400).json({ success: false, error: 'id is verplicht' });
            }

            let accounts = [];
            if (kv) {
                accounts = await kv.get(KV_KEY) || [];
            } else {
                accounts = getLocalData(KV_KEY, []);
            }

            const newAccounts = accounts.filter(a => a.id !== id);

            if (newAccounts.length === accounts.length) {
                return res.status(404).json({ success: false, error: 'Account niet gevonden' });
            }

            if (kv) {
                await kv.set(KV_KEY, newAccounts);
            } else {
                setLocalData(KV_KEY, newAccounts);
            }

            return res.status(200).json({ success: true, message: 'Account verwijderd' });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
