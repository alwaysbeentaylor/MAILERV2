// pages/api/analytics-data.js
// API endpoint voor analytics dashboard data

import {
    getStats,
    getAllEmails,
    getFollowUpEmails,
    getUniqueNiches,
    getUniqueTones,
    getAllSettings,
    setSetting,
    markFollowUpDone,
    updateEmailStatus
} from '../../utils/database';

export default async function handler(req, res) {
    if (req.method === 'GET') {
        return handleGet(req, res);
    } else if (req.method === 'POST') {
        return handlePost(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
    try {
        const {
            action = 'stats',
            niche,
            emailTone,
            status,
            hasReply,
            fromDate,
            toDate,
            followUpNeeded,
            limit
        } = req.query;

        // Settings & filter options (async now)
        const settings = await getAllSettings();
        const niches = await getUniqueNiches();
        const tones = await getUniqueTones();

        if (action === 'stats') {
            // Volledige statistieken
            const stats = await getStats();

            return res.status(200).json({
                success: true,
                stats,
                settings,
                filterOptions: { niches, tones }
            });
        }

        if (action === 'emails') {
            // Gefilterde email lijst
            const filters = {};

            if (niche) filters.niche = niche;
            if (emailTone) filters.emailTone = emailTone;
            if (status) filters.status = status;
            if (hasReply !== undefined) filters.hasReply = hasReply === 'true';
            if (fromDate) filters.fromDate = fromDate;
            if (toDate) filters.toDate = toDate;
            if (followUpNeeded === 'true') filters.followUpNeeded = true;
            if (limit) filters.limit = parseInt(limit);

            // Sorting
            const { sortBy = 'sent_at', sortOrder = 'desc' } = req.query;
            filters.sortBy = sortBy;
            filters.sortOrder = sortOrder;

            const emails = await getAllEmails(filters);

            return res.status(200).json({
                success: true,
                emails,
                count: emails.length,
                filterOptions: { niches, tones }
            });
        }

        if (action === 'follow-ups') {
            // Follow-up lijst
            const followUpDays = parseInt(settings.follow_up_days || '3');
            const emails = await getFollowUpEmails(followUpDays);

            return res.status(200).json({
                success: true,
                emails,
                count: emails.length,
                followUpDays
            });
        }

        return res.status(400).json({ error: 'Onbekende action' });

    } catch (error) {
        console.error('❌ Analytics data error:', error);
        return res.status(500).json({
            error: 'Fout bij ophalen data',
            details: error.message
        });
    }
}

async function handlePost(req, res) {
    try {
        const { action, emailId, key, value } = req.body;

        if (action === 'update-setting') {
            // Update een instelling
            if (!key || value === undefined) {
                return res.status(400).json({ error: 'Key en value zijn verplicht' });
            }

            await setSetting(key, value.toString());

            return res.status(200).json({
                success: true,
                message: `Setting ${key} bijgewerkt naar ${value}`
            });
        }

        if (action === 'mark-follow-up-done') {
            // Markeer follow-up als afgehandeld
            if (!emailId) {
                return res.status(400).json({ error: 'emailId is verplicht' });
            }

            await markFollowUpDone(emailId);

            return res.status(200).json({
                success: true,
                message: 'Follow-up gemarkeerd als afgehandeld'
            });
        }

        if (action === 'update-status') {
            // Update email status
            if (!emailId || !value) {
                return res.status(400).json({ error: 'emailId en value (status) zijn verplicht' });
            }

            await updateEmailStatus(emailId, value);

            return res.status(200).json({
                success: true,
                message: `Email status bijgewerkt naar ${value}`
            });
        }

        return res.status(400).json({ error: 'Onbekende action' });

    } catch (error) {
        console.error('❌ Analytics update error:', error);
        return res.status(500).json({
            error: 'Fout bij bijwerken',
            details: error.message
        });
    }
}
