// API Settings Endpoint
// GET: Load current API settings
// POST: Update API settings

import { loadApiSettings, saveApiSettings } from '../../utils/api-settings';

export default async function handler(req, res) {
    // GET - Load settings
    if (req.method === 'GET') {
        try {
            const settings = loadApiSettings();
            return res.status(200).json({
                success: true,
                settings
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // POST - Update settings
    if (req.method === 'POST') {
        try {
            const { settings } = req.body;

            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid settings object'
                });
            }

            // Load current and merge with new
            const current = loadApiSettings();
            const updated = { ...current, ...settings };

            const saved = saveApiSettings(updated);

            if (saved) {
                console.log('✅ API Settings updated:', updated);
                return res.status(200).json({
                    success: true,
                    settings: updated
                });
            } else {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save settings'
                });
            }
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Method not allowed
    return res.status(405).json({
        success: false,
        error: 'Method not allowed'
    });
}
