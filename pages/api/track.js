// pages/api/track.js
// Click tracking endpoint - redirects naar doelURL na logging

import { recordClick, getEmail } from '../../utils/database';

export default async function handler(req, res) {
    const { id, type, url } = req.query;

    // Validate required params
    if (!id || !url) {
        return res.status(400).json({ error: 'Missing id or url parameter' });
    }

    try {
        // Decode URL
        const targetUrl = decodeURIComponent(url);

        // Check if email exists (async now)
        const email = await getEmail(id);

        if (email) {
            // Record the click (async now)
            const ipAddress = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null;
            const userAgent = req.headers['user-agent'] || null;

            await recordClick(id, type || 'unknown', ipAddress, userAgent);

            console.log(`📊 Click tracked: ${id} | Type: ${type} | URL: ${targetUrl.slice(0, 50)}...`);
        } else {
            // Email not found - still redirect but log warning
            console.warn(`⚠️ Click for unknown email ID: ${id}`);
        }

        // Redirect to target URL
        res.redirect(302, targetUrl);

    } catch (error) {
        console.error('❌ Click tracking error:', error);

        // Still try to redirect even on error
        try {
            const targetUrl = decodeURIComponent(url);
            res.redirect(302, targetUrl);
        } catch {
            res.status(500).json({ error: 'Tracking failed' });
        }
    }
}
