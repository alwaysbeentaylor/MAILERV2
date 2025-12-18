// Campaign Create API
// Creates a new campaign but does NOT start it immediately
// Starten gebeurt via /api/campaigns/resume of /start (als je direct wilt starten)

import { createCampaign } from '../../../utils/campaign-server-store';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            name,
            emails,
            smtpMode,
            smtpAccountIds,
            smtpConfig,
            emailTone,
            customSubject,
            customPreheader,
            sessionPrompt,
            delayBetweenEmails = 30,
            verifyDomains = true
        } = req.body;

        if (!emails || emails.length === 0) {
            return res.status(400).json({ error: 'Geen emails opgegeven' });
        }

        // Create campaign in server store
        const campaign = await createCampaign({
            name,
            emails,
            smtpMode,
            smtpAccountIds,
            smtpConfig,
            emailTone,
            customSubject,
            customPreheader,
            sessionPrompt,
            delayBetweenEmails,
            verifyDomains
        });

        console.log(`✅ Campaign ${campaign.id} created (pending start)`);

        return res.status(200).json({
            success: true,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                total: campaign.total
            },
            message: `Campagne aangemaakt met ${campaign.total} emails`
        });

    } catch (error) {
        console.error('Campaign create error:', error);
        return res.status(500).json({
            error: 'Fout bij aanmaken campagne',
            details: error.message
        });
    }
}
