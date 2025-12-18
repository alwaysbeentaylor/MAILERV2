// API Endpoint: Email Templates Management

import {
    getTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate
} from '../../utils/template-store';

export default async function handler(req, res) {
    // GET - List templates or get single template
    if (req.method === 'GET') {
        try {
            const { id } = req.query;

            if (id) {
                const template = await getTemplate(id);
                if (!template) {
                    return res.status(404).json({ success: false, error: 'Template niet gevonden' });
                }
                return res.status(200).json({ success: true, template });
            }

            const templates = await getTemplates();
            return res.status(200).json({ success: true, templates });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // POST - Create new template or duplicate
    if (req.method === 'POST') {
        try {
            const { duplicate, ...templateData } = req.body;

            // Duplicate existing template
            if (duplicate) {
                const template = await duplicateTemplate(duplicate);
                if (!template) {
                    return res.status(404).json({ success: false, error: 'Template niet gevonden' });
                }
                return res.status(201).json({ success: true, template });
            }

            // Create new template
            const template = await createTemplate(templateData);
            return res.status(201).json({ success: true, template });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // PUT - Update template
    if (req.method === 'PUT') {
        try {
            const { id, ...updates } = req.body;

            if (!id) {
                return res.status(400).json({ success: false, error: 'Template ID is verplicht' });
            }

            const template = await updateTemplate(id, updates);

            if (!template) {
                return res.status(404).json({ success: false, error: 'Template niet gevonden' });
            }

            return res.status(200).json({ success: true, template });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    // DELETE - Delete template
    if (req.method === 'DELETE') {
        try {
            const { id } = req.body;

            if (!id) {
                return res.status(400).json({ success: false, error: 'Template ID is verplicht' });
            }

            await deleteTemplate(id);
            return res.status(200).json({ success: true, message: 'Template verwijderd' });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
