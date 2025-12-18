// Process Campaign Email - QStash Webhook Handler
// This is called by QStash to process each email in a campaign
// It runs in the background, even when the user closes their browser

import {
    getCampaign,
    updateCampaign,
    updateCampaignEmail,
    completeCampaign,
    errorCampaign,
    getNextPendingEmail,
    addCampaignLog
} from '../../utils/campaign-server-store';
import { verifySignature, getQStashClient } from '../../utils/qstash';
import { getBaseUrl } from '../../utils/base-url';


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify QStash signature in production
    if (process.env.NODE_ENV === 'production') {
        const isValid = await verifySignature(req);
        if (!isValid) {
            console.error('❌ Invalid QStash signature');
            if (campaignId) {
                await addCampaignLog(campaignId, '❌ QStash signature verificatie mislukt. Controleer signing keys.', 'error');
            }
            return res.status(401).json({ error: 'Invalid signature' });
        }
    }

    const { campaignId } = req.body;

    if (campaignId) {
        await addCampaignLog(campaignId, '🔄 Worker aangeroepen door QStash - verwerking start...', 'info');
    }

    if (!campaignId) {
        return res.status(400).json({ error: 'Campaign ID is vereist' });
    }

    console.log(`\n🔄 Processing campaign email: ${campaignId}`);

    try {
        // Get campaign from server store
        const campaign = await getCampaign(campaignId);

        if (!campaign) {
            console.error(`Campaign ${campaignId} not found`);
            return res.status(404).json({ error: 'Campagne niet gevonden' });
        }

        // Check campaign status
        if (campaign.status === 'paused') {
            console.log(`⏸️ Campaign ${campaignId} is gepauzeerd - skip processing`);
            return res.status(200).json({
                success: true,
                skipped: true,
                reason: 'Campaign is paused'
            });
        }

        if (campaign.status === 'stopped' || campaign.status === 'completed') {
            console.log(`⏹️ Campaign ${campaignId} is ${campaign.status} - skip processing`);
            return res.status(200).json({
                success: true,
                skipped: true,
                reason: `Campaign is ${campaign.status}`
            });
        }

        if (campaign.status === 'error') {
            console.log(`❌ Campaign ${campaignId} has error - skip processing`);
            return res.status(200).json({
                success: true,
                skipped: true,
                reason: 'Campaign has error'
            });
        }

        // Get next pending email
        const nextEmail = await getNextPendingEmail(campaignId);

        if (!nextEmail) {
            // No more pending emails - mark campaign as completed
            console.log(`✅ Campaign ${campaignId} completed - no more pending emails`);
            await addCampaignLog(campaignId, '✅ Campagne voltooid: alle emails verwerkt', 'success');
            await completeCampaign(campaignId);
            return res.status(200).json({
                success: true,
                completed: true,
                message: 'Campagne voltooid'
            });
        }

        const { emailData, emailIndex } = nextEmail;
        console.log(`📧 Processing email ${emailIndex + 1}/${campaign.total}: ${emailData.email}`);

        // Mark email as processing
        await updateCampaignEmail(campaignId, emailIndex, {
            status: 'processing',
            processedAt: new Date().toISOString()
        });

        // Send the email via send-email API
        const baseUrl = getBaseUrl();


        try {
            const sendResult = await fetch(`${baseUrl}/api/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toEmail: emailData.email,
                    businessName: emailData.businessName || emailData.email.split('@')[0],
                    websiteUrl: emailData.websiteUrl || `https://${emailData.email.split('@')[1]}`,
                    contactPerson: emailData.contactPerson || '',
                    emailTone: campaign.emailTone || 'professional',
                    customSubject: campaign.customSubject || '',
                    customPreheader: campaign.customPreheader || '',
                    sessionPrompt: campaign.sessionPrompt || '',
                    // Use stored SMTP config
                    smtpConfig: campaign.smtpConfig || null,
                    smtpAccountId: campaign.smtpAccountIds?.[campaign.currentSmtpIndex % (campaign.smtpAccountIds?.length || 1)] || null,
                    // Speed optimizations
                    skipQualityCheck: true,
                    skipHumanize: true,
                    dryRun: false
                })
            });

            const sendData = await sendResult.json();

            if (sendData.success) {
                // Email sent successfully
                console.log(`✅ Email sent to ${emailData.email}`);

                await updateCampaignEmail(campaignId, emailIndex, {
                    status: 'sent',
                    processedAt: new Date().toISOString(),
                    trackingId: sendData.emailId || null,
                    smtpUsed: sendData.smtpUsed || null
                });
                await addCampaignLog(campaignId, `✅ E-mail verzonden naar ${emailData.email}`, 'success');

                // Rotate SMTP if in rotate mode
                if (campaign.smtpMode === 'rotate' && campaign.smtpAccountIds?.length > 1) {
                    await updateCampaign(campaignId, {
                        currentSmtpIndex: (campaign.currentSmtpIndex || 0) + 1
                    });
                }
            } else {
                // Email failed
                console.error(`❌ Email failed for ${emailData.email}: ${sendData.error?.message || sendData.error}`);

                await updateCampaignEmail(campaignId, emailIndex, {
                    status: 'failed',
                    processedAt: new Date().toISOString(),
                    error: sendData.error?.message || sendData.error || 'Unknown error'
                });
                await addCampaignLog(campaignId, `❌ Fout bij ${emailData.email}: ${sendData.error?.message || sendData.error}`, 'error');
            }
        } catch (sendError) {
            console.error(`❌ Send error for ${emailData.email}:`, sendError);

            await updateCampaignEmail(campaignId, emailIndex, {
                status: 'failed',
                processedAt: new Date().toISOString(),
                error: sendError.message || 'Network error'
            });
        }

        // Check if there are more pending emails
        const updatedCampaign = await getCampaign(campaignId);
        const hasMorePending = updatedCampaign.emails.some(e => e.status === 'pending');

        if (hasMorePending && updatedCampaign.status === 'running') {
            // Schedule next email via QStash
            const qstashClient = getQStashClient();
            const delay = campaign.delayBetweenEmails || 30; // seconds

            if (qstashClient) {
                try {
                    const response = await qstashClient.publishJSON({
                        url: `${baseUrl}/api/process-campaign-email`,
                        body: { campaignId },
                        delay: delay
                    });
                    console.log(`📅 Next email scheduled in ${delay}s, QStash: ${response.messageId}`);
                } catch (qstashError) {
                    console.error('QStash scheduling error:', qstashError);
                    // Don't fail the whole operation, campaign can be resumed manually
                }
            } else {
                console.warn('⚠️ QStash niet beschikbaar - volgende email niet automatisch gepland');
            }
        } else if (!hasMorePending) {
            // All emails processed
            console.log(`✅ Campaign ${campaignId} completed - all emails processed`);
            await completeCampaign(campaignId);
        }

        return res.status(200).json({
            success: true,
            processed: {
                email: emailData.email,
                index: emailIndex,
                status: 'sent' // or 'failed' but we continue anyway
            },
            campaign: {
                id: updatedCampaign.id,
                sent: updatedCampaign.sent,
                failed: updatedCampaign.failed,
                pending: updatedCampaign.pending,
                status: updatedCampaign.status
            }
        });

    } catch (error) {
        console.error(`❌ Campaign processing error:`, error);

        // Mark campaign as error
        await errorCampaign(campaignId, error.message);

        return res.status(500).json({
            error: 'Campaign processing error',
            details: error.message
        });
    }
}

// Increase timeout for this endpoint
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
        },
    },
    maxDuration: 60 // 60 seconds max
};
