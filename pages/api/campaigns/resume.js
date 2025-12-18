// Campaign Resume API
// Resumes a paused campaign and schedules next email

import { getCampaign, resumeCampaign } from '../../../utils/campaign-server-store';
import { getQStashClient } from '../../../utils/qstash';

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

        if (campaign.status !== 'paused') {
            return res.status(400).json({
                error: `Campagne kan niet worden hervat (status: ${campaign.status})`
            });
        }

        // Check if there are pending emails
        const hasPending = campaign.emails.some(e => e.status === 'pending');
        if (!hasPending) {
            return res.status(400).json({
                error: 'Geen openstaande emails meer in deze campagne'
            });
        }

        // Resume the campaign
        const updated = await resumeCampaign(campaignId);

        // Schedule next email via QStash
        const qstashClient = getQStashClient();
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

        if (qstashClient) {
            try {
                const response = await qstashClient.publishJSON({
                    url: `${baseUrl}/api/process-campaign-email`,
                    body: { campaignId: campaignId },
                    delay: 2 // Start after 2 seconds
                });
                console.log(`▶️ Campaign ${campaignId} resumed, QStash message: ${response.messageId}`);
            } catch (qstashError) {
                console.error('QStash scheduling error:', qstashError);
            }
        }

        return res.status(200).json({
            success: true,
            campaign: {
                id: updated.id,
                status: updated.status,
                sent: updated.sent,
                pending: updated.pending
            },
            message: 'Campagne hervat'
        });

    } catch (error) {
        console.error('Campaign resume error:', error);
        return res.status(500).json({
            error: 'Fout bij hervatten campagne',
            details: error.message
        });
    }
}
