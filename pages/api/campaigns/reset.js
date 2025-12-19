// Campaign Reset API
// Resets emails to pending so they can be re-sent

import { getCampaign, updateCampaign, addCampaignLog } from '../../../utils/campaign-server-store';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { campaignId, mode, emailIndices } = req.body;

        if (!campaignId) {
            return res.status(400).json({ error: 'Campaign ID is vereist' });
        }

        const campaign = await getCampaign(campaignId);
        if (!campaign) {
            return res.status(404).json({ error: 'Campagne niet gevonden' });
        }

        let resetCount = 0;
        const updatedEmails = campaign.emails.map((email, index) => {
            let shouldReset = false;

            if (mode === 'all') {
                shouldReset = true;
            } else if (mode === 'failed') {
                shouldReset = email.status === 'failed';
            } else if (mode === 'selected' && Array.isArray(emailIndices)) {
                shouldReset = emailIndices.includes(index);
            }

            if (shouldReset) {
                resetCount++;
                return {
                    ...email,
                    status: 'pending',
                    error: null,
                    processedAt: null,
                    sendingAt: null,
                    sentAt: null
                };
            }
            return email;
        });

        if (resetCount === 0) {
            return res.status(200).json({
                success: true,
                message: 'Geen emails om te resetten',
                count: 0
            });
        }

        // Calculate new stats
        const sent = updatedEmails.filter(e => e.status === 'sent').length;
        const failed = updatedEmails.filter(e => e.status === 'failed').length;
        const pending = updatedEmails.filter(e => e.status === 'pending').length;

        // Reset campaign status if it was completed or stopped and we reset everything
        let newStatus = campaign.status;
        if (mode === 'all') {
            newStatus = 'pending';
        }

        await updateCampaign(campaignId, {
            emails: updatedEmails,
            sent,
            failed,
            pending,
            status: newStatus,
            currentIndex: mode === 'all' ? 0 : campaign.currentIndex
        });

        const modeText = mode === 'all' ? 'alle' : (mode === 'failed' ? 'mislukte' : 'geselecteerde');
        await addCampaignLog(campaignId, `🔄 ${resetCount} ${modeText} emails gereset naar 'pending'`, 'info');

        return res.status(200).json({
            success: true,
            message: `${resetCount} emails gereset`,
            count: resetCount
        });

    } catch (error) {
        console.error('Campaign reset error:', error);
        return res.status(500).json({
            error: 'Fout bij resetten emails',
            details: error.message
        });
    }
}
