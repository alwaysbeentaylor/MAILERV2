import { getCampaign, updateCampaign, addCampaignLog } from '../../../utils/campaign-server-store';
import { getSpeedProfile } from '../../../utils/godmode';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { campaignId, speedProfile } = req.body;

        if (!campaignId || !speedProfile) {
            return res.status(400).json({ error: 'Campaign ID en speedProfile zijn vereist' });
        }

        const campaign = await getCampaign(campaignId);
        if (!campaign) {
            return res.status(404).json({ error: 'Campagne niet gevonden' });
        }

        // Update target speed profile
        const profile = getSpeedProfile(speedProfile);
        await updateCampaign(campaignId, { speedProfile });

        await addCampaignLog(campaignId, `⚡ Snelheid aangepast naar: ${profile.name} (${profile.description})`, 'info');

        return res.status(200).json({
            success: true,
            message: `Snelheid bijgewerkt naar ${profile.name}`
        });

    } catch (error) {
        console.error('Update speed error:', error);
        return res.status(500).json({ error: 'Fout bij bijwerken snelheid', details: error.message });
    }
}
