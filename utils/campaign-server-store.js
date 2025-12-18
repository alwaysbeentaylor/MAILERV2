// Campaign Server Store
// Server-side campaign storage using Vercel KV (or in-memory for local dev)
// This replaces localStorage-based campaignStore.js for background processing

const KV_KEY_CAMPAIGNS = 'server_campaigns';
const KV_KEY_CAMPAIGN = (id) => `campaign:${id}`;

// In-memory fallback for local development
let memoryStore = {
    campaigns: []
};

/**
 * Get Vercel KV client (or null for local dev)
 */
async function getKV() {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        return null;
    }
    try {
        const { kv } = await import('@vercel/kv');
        await kv.ping();
        return kv;
    } catch (e) {
        console.warn('⚠️ Vercel KV niet beschikbaar, gebruik in-memory store');
        return null;
    }
}

/**
 * Get all campaigns
 */
export async function getCampaigns() {
    const kv = await getKV();

    if (kv) {
        const campaigns = await kv.get(KV_KEY_CAMPAIGNS) || [];
        return campaigns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return [...memoryStore.campaigns].sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    );
}

/**
 * Get single campaign by ID
 */
export async function getCampaign(id) {
    const kv = await getKV();

    if (kv) {
        // Try individual key first (faster)
        let campaign = await kv.get(KV_KEY_CAMPAIGN(id));
        if (campaign) return campaign;

        // Fallback to list search
        const campaigns = await kv.get(KV_KEY_CAMPAIGNS) || [];
        return campaigns.find(c => c.id === id) || null;
    }

    return memoryStore.campaigns.find(c => c.id === id) || null;
}

/**
 * Create new campaign
 */
export async function createCampaign(data) {
    const campaign = {
        id: `camp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: data.name || `Campagne ${new Date().toLocaleDateString('nl-NL')}`,
        status: 'pending', // pending, running, paused, completed, stopped, error
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        pausedAt: null,

        // SMTP settings
        smtpMode: data.smtpMode || 'single',
        smtpAccountIds: data.smtpAccountIds || [],
        currentSmtpIndex: 0,

        // Email settings
        emailTone: data.emailTone || 'professional',
        customSubject: data.customSubject || '',
        customPreheader: data.customPreheader || '',
        sessionPrompt: data.sessionPrompt || '',
        delayBetweenEmails: data.delayBetweenEmails || 30, // seconds
        verifyDomains: data.verifyDomains !== false,

        // Progress tracking
        total: data.emails?.length || 0,
        sent: 0,
        failed: 0,
        pending: data.emails?.length || 0,
        currentIndex: 0, // Index of next email to process

        // Email list with status
        emails: (data.emails || []).map((email, index) => ({
            id: `${index + 1}`,
            index: index,
            email: email.email || email.toEmail,
            businessName: email.businessName || '',
            websiteUrl: email.websiteUrl || '',
            contactPerson: email.contactPerson || '',
            knowledgeFile: email.knowledgeFile || '',
            status: 'pending', // pending, processing, sent, failed, skipped
            processedAt: null,
            error: null,
            trackingId: null,
            smtpUsed: null
        })),

        // QStash message ID (to potentially cancel)
        qstashMessageId: null
    };

    const kv = await getKV();

    if (kv) {
        // Store in list and individual key
        const campaigns = await kv.get(KV_KEY_CAMPAIGNS) || [];
        campaigns.unshift(campaign);

        // Keep only last 50 campaigns in list
        const trimmedCampaigns = campaigns.slice(0, 50);

        await kv.set(KV_KEY_CAMPAIGNS, trimmedCampaigns);
        await kv.set(KV_KEY_CAMPAIGN(campaign.id), campaign);
    } else {
        memoryStore.campaigns.unshift(campaign);
    }

    console.log(`📧 Campaign created: ${campaign.id} with ${campaign.total} emails`);
    return campaign;
}

/**
 * Update campaign
 */
export async function updateCampaign(id, updates) {
    const kv = await getKV();

    if (kv) {
        let campaign = await kv.get(KV_KEY_CAMPAIGN(id));
        if (!campaign) {
            console.error(`Campaign ${id} not found`);
            return null;
        }

        campaign = {
            ...campaign,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        // Update individual key
        await kv.set(KV_KEY_CAMPAIGN(id), campaign);

        // Update in list too
        const campaigns = await kv.get(KV_KEY_CAMPAIGNS) || [];
        const index = campaigns.findIndex(c => c.id === id);
        if (index !== -1) {
            campaigns[index] = campaign;
            await kv.set(KV_KEY_CAMPAIGNS, campaigns);
        }

        return campaign;
    }

    // In-memory update
    const index = memoryStore.campaigns.findIndex(c => c.id === id);
    if (index === -1) return null;

    memoryStore.campaigns[index] = {
        ...memoryStore.campaigns[index],
        ...updates,
        updatedAt: new Date().toISOString()
    };

    return memoryStore.campaigns[index];
}

/**
 * Update single email in campaign
 */
export async function updateCampaignEmail(campaignId, emailIndex, updates) {
    const campaign = await getCampaign(campaignId);
    if (!campaign || !campaign.emails[emailIndex]) {
        return null;
    }

    campaign.emails[emailIndex] = {
        ...campaign.emails[emailIndex],
        ...updates
    };

    // Recalculate stats
    campaign.sent = campaign.emails.filter(e => e.status === 'sent').length;
    campaign.failed = campaign.emails.filter(e => e.status === 'failed').length;
    campaign.pending = campaign.emails.filter(e => e.status === 'pending').length;

    return updateCampaign(campaignId, {
        emails: campaign.emails,
        sent: campaign.sent,
        failed: campaign.failed,
        pending: campaign.pending
    });
}

/**
 * Start campaign - set status to running
 */
export async function startCampaign(id) {
    return updateCampaign(id, {
        status: 'running',
        startedAt: new Date().toISOString()
    });
}

/**
 * Pause campaign
 */
export async function pauseCampaign(id) {
    console.log(`⏸️ Campaign ${id} paused`);
    return updateCampaign(id, {
        status: 'paused',
        pausedAt: new Date().toISOString()
    });
}

/**
 * Resume campaign
 */
export async function resumeCampaign(id) {
    console.log(`▶️ Campaign ${id} resumed`);
    return updateCampaign(id, {
        status: 'running',
        pausedAt: null
    });
}

/**
 * Stop campaign permanently
 */
export async function stopCampaign(id) {
    console.log(`⏹️ Campaign ${id} stopped`);
    return updateCampaign(id, {
        status: 'stopped',
        completedAt: new Date().toISOString()
    });
}

/**
 * Mark campaign as completed
 */
export async function completeCampaign(id) {
    console.log(`✅ Campaign ${id} completed`);
    return updateCampaign(id, {
        status: 'completed',
        completedAt: new Date().toISOString()
    });
}

/**
 * Mark campaign as error
 */
export async function errorCampaign(id, errorMessage) {
    console.log(`❌ Campaign ${id} error: ${errorMessage}`);
    return updateCampaign(id, {
        status: 'error',
        completedAt: new Date().toISOString(),
        lastError: errorMessage
    });
}

/**
 * Get next pending email from campaign
 */
export async function getNextPendingEmail(campaignId) {
    const campaign = await getCampaign(campaignId);
    if (!campaign) return null;

    // Find first pending email
    const pendingEmail = campaign.emails.find(e => e.status === 'pending');
    if (!pendingEmail) return null;

    return {
        campaign,
        emailData: pendingEmail,
        emailIndex: pendingEmail.index
    };
}

/**
 * Delete campaign
 */
export async function deleteCampaign(id) {
    const kv = await getKV();

    if (kv) {
        await kv.del(KV_KEY_CAMPAIGN(id));
        const campaigns = await kv.get(KV_KEY_CAMPAIGNS) || [];
        const filtered = campaigns.filter(c => c.id !== id);
        await kv.set(KV_KEY_CAMPAIGNS, filtered);
    } else {
        memoryStore.campaigns = memoryStore.campaigns.filter(c => c.id !== id);
    }

    return { success: true };
}

/**
 * Delete multiple campaigns
 */
export async function deleteCampaigns(ids) {
    const results = await Promise.all(ids.map(id => deleteCampaign(id)));
    return { success: true, deleted: results.length };
}
