// Campaign & SMTP Storage Utility
// Uses localStorage for persistence

const CAMPAIGNS_KEY = 'skyeCampaigns';
const SMTP_KEY = 'skyeSmtpAccounts';

// === SMTP ACCOUNTS ===

export function getSmtpAccounts() {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(SMTP_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error loading SMTP accounts:', e);
        return [];
    }
}

export function saveSmtpAccounts(accounts) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SMTP_KEY, JSON.stringify(accounts));
}

export function addSmtpAccount(account) {
    const accounts = getSmtpAccounts();
    const newAccount = {
        ...account,
        id: `smtp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        active: true
    };
    accounts.push(newAccount);
    saveSmtpAccounts(accounts);
    return newAccount;
}

export function updateSmtpAccount(id, updates) {
    const accounts = getSmtpAccounts();
    const index = accounts.findIndex(a => a.id === id);
    if (index !== -1) {
        accounts[index] = { ...accounts[index], ...updates };
        saveSmtpAccounts(accounts);
        return accounts[index];
    }
    return null;
}

export function deleteSmtpAccount(id) {
    const accounts = getSmtpAccounts().filter(a => a.id !== id);
    saveSmtpAccounts(accounts);
}

export function getActiveSmtpAccounts() {
    return getSmtpAccounts().filter(a => a.active);
}

// === CAMPAIGNS ===

export function getCampaigns() {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(CAMPAIGNS_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error loading campaigns:', e);
        return [];
    }
}

export function saveCampaigns(campaigns) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(campaigns));
}

export function getCampaign(id) {
    return getCampaigns().find(c => c.id === id) || null;
}

export function createCampaign(data) {
    const campaigns = getCampaigns();
    const campaign = {
        id: `camp-${Date.now()}`,
        name: data.name || `Campagne ${new Date().toLocaleDateString('nl-NL')}`,
        status: 'pending', // pending, running, paused, completed, stopped, error
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,

        // SMTP settings
        smtpMode: data.smtpMode || 'single', // single, rotate
        smtpAccountIds: data.smtpAccountIds || [],
        currentSmtpIndex: 0,

        // Email settings
        emailTone: data.emailTone || 'professional',
        customSubject: data.customSubject || '',
        customPreheader: data.customPreheader || '',
        sessionPrompt: data.sessionPrompt || '',
        delayBetweenEmails: data.delayBetweenEmails || 3000,
        verifyDomains: data.verifyDomains !== false, // Default true

        // Progress
        total: data.emails?.length || 0,
        sent: 0,
        failed: 0,
        pending: data.emails?.length || 0,

        // Email list with status
        emails: (data.emails || []).map((email, index) => ({
            id: index + 1,
            email: email.email || email.toEmail,
            businessName: email.businessName || '',
            websiteUrl: email.websiteUrl || '',
            contactPerson: email.contactPerson || '',
            knowledgeFile: email.knowledgeFile || '',
            needsEnrichment: email.needsEnrichment || (!email.businessName || !email.websiteUrl), // Flag for enrichment
            status: 'pending', // pending, sending, sent, failed
            sentAt: null,
            error: null,
            smtpUsed: null,
            emailId: null // tracking ID
        }))
    };

    campaigns.unshift(campaign); // Add to beginning
    saveCampaigns(campaigns);
    return campaign;
}

export function updateCampaign(id, updates) {
    const campaigns = getCampaigns();
    const index = campaigns.findIndex(c => c.id === id);
    if (index !== -1) {
        campaigns[index] = { ...campaigns[index], ...updates };
        saveCampaigns(campaigns);
        return campaigns[index];
    }
    return null;
}

export function updateCampaignEmail(campaignId, emailIndex, updates) {
    const campaigns = getCampaigns();
    const campIndex = campaigns.findIndex(c => c.id === campaignId);
    if (campIndex !== -1 && campaigns[campIndex].emails[emailIndex]) {
        campaigns[campIndex].emails[emailIndex] = {
            ...campaigns[campIndex].emails[emailIndex],
            ...updates
        };

        // Recalculate stats
        const emails = campaigns[campIndex].emails;
        campaigns[campIndex].sent = emails.filter(e => e.status === 'sent').length;
        campaigns[campIndex].failed = emails.filter(e => e.status === 'failed').length;
        campaigns[campIndex].pending = emails.filter(e => e.status === 'pending').length;

        saveCampaigns(campaigns);
        return campaigns[campIndex];
    }
    return null;
}

export function deleteCampaign(id) {
    const campaigns = getCampaigns().filter(c => c.id !== id);
    saveCampaigns(campaigns);
}

export function getNextSmtpAccount(campaign) {
    const accounts = getSmtpAccounts();
    
    let activeAccounts;
    
    // If campaign has specific SMTP account IDs, use those
    if (campaign.smtpAccountIds && campaign.smtpAccountIds.length > 0) {
        activeAccounts = campaign.smtpAccountIds
            .map(id => accounts.find(a => a.id === id))
            .filter(a => a && a.active);
    } else {
        // Otherwise, use ALL active SMTP accounts
        activeAccounts = accounts.filter(a => a.active !== false);
    }

    if (activeAccounts.length === 0) return null;

    if (campaign.smtpMode === 'single') {
        return activeAccounts[0];
    }

    // Rotate mode
    const index = campaign.currentSmtpIndex % activeAccounts.length;
    return activeAccounts[index];
}

export function advanceSmtpIndex(campaignId) {
    const campaign = getCampaign(campaignId);
    if (campaign && campaign.smtpMode === 'rotate') {
        updateCampaign(campaignId, {
            currentSmtpIndex: campaign.currentSmtpIndex + 1
        });
    }
}
