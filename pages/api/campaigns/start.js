// Campaign Start API
// Creates a new campaign and schedules the first email via QStash

import { createCampaign, startCampaign, updateCampaign, addCampaignLog } from '../../../utils/campaign-server-store';
import { getQStashClient } from '../../../utils/qstash';
import { getBaseUrl } from '../../../utils/base-url';


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
            smtpConfig, // Fallback: direct SMTP config if no account IDs
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
            smtpConfig, // Store the config for processing
            emailTone,
            customSubject,
            customPreheader,
            sessionPrompt,
            delayBetweenEmails,
            verifyDomains
        });

        // Start the campaign
        await startCampaign(campaign.id);
        await addCampaignLog(campaign.id, '🚀 Campagne gestart op de achtergrond', 'info');

        // Schedule first email processing via QStash
        const qstashClient = getQStashClient();
        const baseUrl = getBaseUrl();


        if (qstashClient) {
            try {
                const response = await qstashClient.publishJSON({
                    url: `${baseUrl}/api/process-campaign-email`,
                    body: { campaignId: campaign.id },
                    delay: 2 // Start after 2 seconds
                });

                // Store QStash message ID
                await updateCampaign(campaign.id, {
                    qstashMessageId: response.messageId
                });

                console.log(`🚀 Campaign ${campaign.id} started, QStash message: ${response.messageId}`);
                await addCampaignLog(campaign.id, '✅ Achtergrond-taak gepland via QStash', 'info');
            } catch (qstashError) {
                console.error('QStash scheduling error:', qstashError);
                await addCampaignLog(campaign.id, `⚠️ Kon achtergrond-taak niet plannen: ${qstashError.message} (URL: ${baseUrl}/api/process-campaign-email)`, 'error');
                // Continue anyway - campaign exists, can be processed manually
            }
        } else {
            console.warn('⚠️ QStash niet geconfigureerd - campagne moet handmatig worden verwerkt');
        }

        return res.status(200).json({
            success: true,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                total: campaign.total
            },
            message: `Campagne gestart met ${campaign.total} emails`
        });

    } catch (error) {
        console.error('Campaign start error:', error);
        return res.status(500).json({
            error: 'Fout bij starten campagne',
            details: error.message
        });
    }
}
