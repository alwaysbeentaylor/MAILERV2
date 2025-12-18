// Campaign Stop API
// Permanently stops a campaign

import { getCampaign, stopCampaign } from '../../../utils/campaign-server-store';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { campaignId } = req.body;

        if (!campaignId) {
            return res.status(400).json({ error: 'Campaign ID is vereist' });
        }

        const campaign = await getCampaign(campaignId);
        if (!campaign) {
            return res.status(404).json({ error: 'Campagne niet gevonden' });
        }

        if (campaign.status === 'completed' || campaign.status === 'stopped') {
            return res.status(400).json({
                error: `Campagne is al ${campaign.status}`
            });
        }

        const updated = await stopCampaign(campaignId);

        console.log(`⏹️ Campaign ${campaignId} stopped`);

        return res.status(200).json({
            success: true,
            campaign: {
                id: updated.id,
                status: updated.status,
                sent: updated.sent,
                failed: updated.failed,
                completedAt: updated.completedAt
            },
            message: 'Campagne gestopt'
        });

    } catch (error) {
        console.error('Campaign stop error:', error);
        return res.status(500).json({
            error: 'Fout bij stoppen campagne',
            details: error.message
        });
    }
}
