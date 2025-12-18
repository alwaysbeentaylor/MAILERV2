// Campaign Status API
// Returns current campaign status and progress

import { getCampaign, getCampaigns } from '../../../utils/campaign-server-store';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { campaignId, all } = req.query;

        // Return all campaigns
        if (all === 'true' || all === '1') {
            const campaigns = await getCampaigns();

            // Return summary only (not full email lists for performance)
            const summaries = campaigns.map(c => ({
                id: c.id,
                name: c.name,
                status: c.status,
                total: c.total,
                sent: c.sent,
                failed: c.failed,
                pending: c.pending,
                createdAt: c.createdAt,
                startedAt: c.startedAt,
                completedAt: c.completedAt,
                pausedAt: c.pausedAt
            }));

            return res.status(200).json({
                success: true,
                campaigns: summaries
            });
        }

        // Return single campaign
        if (!campaignId) {
            return res.status(400).json({ error: 'Campaign ID is vereist' });
        }

        const campaign = await getCampaign(campaignId);
        if (!campaign) {
            return res.status(404).json({ error: 'Campagne niet gevonden' });
        }

        // Calculate additional stats
        const processingEmail = campaign.emails.find(e => e.status === 'processing');
        const lastSent = campaign.emails
            .filter(e => e.status === 'sent')
            .sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt))[0];

        return res.status(200).json({
            success: true,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                total: campaign.total,
                sent: campaign.sent,
                failed: campaign.failed,
                pending: campaign.pending,
                currentIndex: campaign.currentIndex,
                createdAt: campaign.createdAt,
                startedAt: campaign.startedAt,
                completedAt: campaign.completedAt,
                pausedAt: campaign.pausedAt,
                emailTone: campaign.emailTone,
                delayBetweenEmails: campaign.delayBetweenEmails,
                // Current processing info
                processingEmail: processingEmail ? {
                    index: processingEmail.index,
                    email: processingEmail.email,
                    businessName: processingEmail.businessName
                } : null,
                lastSentEmail: lastSent ? {
                    email: lastSent.email,
                    businessName: lastSent.businessName,
                    processedAt: lastSent.processedAt
                } : null,
                // Full email list (for detailed view)
                emails: campaign.emails.map(e => ({
                    id: e.id,
                    index: e.index,
                    email: e.email,
                    businessName: e.businessName,
                    status: e.status,
                    processedAt: e.processedAt,
                    error: e.error
                })),
                // Persistent logs
                logs: campaign.logs || []
            }
        });

    } catch (error) {
        console.error('Campaign status error:', error);
        return res.status(500).json({
            error: 'Fout bij ophalen campagne status',
            details: error.message
        });
    }
}
