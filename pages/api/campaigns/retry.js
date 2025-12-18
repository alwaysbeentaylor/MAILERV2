// Campaign Retry API
// Resets failed emails to pending so they can be retried

import { getCampaign, updateCampaignEmail } from '../../../utils/campaign-server-store';

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

        // Find failed emails
        let resetCount = 0;

        // We need to iterate and update. This might be slow for many errors but okay for now.
        // In a real DB we would do a batch update: UPDATE emails SET status='pending' WHERE status='failed'
        // With KV/JSON blob, we modify the array and save the whole campaign usually, 
        // but our store helper updates individual emails or the whole campaign.
        // Let's manually iterate the emails array and save the campaign once to be efficient.

        // Wait, campaign-server-store offers updateCampaignEmail (one by one) or updateCampaign (fields).
        // It doesn't offer "reset failed emails".
        // I will implement the logic here to modify the emails array and call updateCampaign.

        const updatedEmails = campaign.emails.map(email => {
            if (email.status === 'failed') {
                resetCount++;
                return {
                    ...email,
                    status: 'pending',
                    error: null // Clear error
                };
            }
            return email;
        });

        if (resetCount === 0) {
            return res.status(200).json({
                success: true,
                message: 'Geen mislukte emails om te resetten',
                count: 0
            });
        }

        // Save updated emails to campaign
        // Note: updateCampaign merges fields, so we pass the new emails array
        // We import updateCampaign from store (which I need to import)
        const { updateCampaign } = require('../../../utils/campaign-server-store');
        await updateCampaign(campaignId, {
            emails: updatedEmails,
            failed: campaign.failed - resetCount,
            pending: campaign.pending + resetCount
        });

        return res.status(200).json({
            success: true,
            message: `${resetCount} mislukte emails gereset`,
            count: resetCount
        });

    } catch (error) {
        console.error('Campaign retry error:', error);
        return res.status(500).json({
            error: 'Fout bij resetten mislukte emails',
            details: error.message
        });
    }
}
