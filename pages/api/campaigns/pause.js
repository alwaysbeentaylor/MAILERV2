// Campaign Pause API
// Pauses a running campaign

import { getCampaign, pauseCampaign } from '../../../utils/campaign-server-store';

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

        if (campaign.status !== 'running') {
            return res.status(400).json({
                error: `Campagne kan niet worden gepauzeerd (status: ${campaign.status})`
            });
        }

        const updated = await pauseCampaign(campaignId);

        console.log(`⏸️ Campaign ${campaignId} paused at ${updated.pausedAt}`);

        return res.status(200).json({
            success: true,
            campaign: {
                id: updated.id,
                status: updated.status,
                sent: updated.sent,
                pending: updated.pending,
                pausedAt: updated.pausedAt
            },
            message: 'Campagne gepauzeerd'
        });

    } catch (error) {
        console.error('Campaign pause error:', error);
        return res.status(500).json({
            error: 'Fout bij pauzeren campagne',
            details: error.message
        });
    }
}
