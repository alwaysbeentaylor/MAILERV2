// Campaign Delete API
// Permanently removes a campaign

import { deleteCampaign } from '../../../utils/campaign-server-store';

export default async function handler(req, res) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { campaignId } = req.query;

        if (!campaignId) {
            return res.status(400).json({ error: 'Campaign ID is vereist' });
        }

        await deleteCampaign(campaignId);

        return res.status(200).json({
            success: true,
            message: 'Campagne verwijderd'
        });

    } catch (error) {
        console.error('Campaign delete error:', error);
        return res.status(500).json({
            error: 'Fout bij verwijderen campagne',
            details: error.message
        });
    }
}
