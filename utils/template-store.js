// Email Template Store Utility
// Stores and manages email templates

// In-memory store for development
let memoryTemplateStore = [];

// Default templates
const defaultTemplates = [
    {
        id: 'blank',
        name: 'Blanco',
        description: 'Start from scratch - alleen tekst',
        isDefault: true,
        isBlank: true,
        html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
  </style>
</head>
<body>
  {{content}}
</body>
</html>`
    },
    {
        id: 'modern',
        name: 'Modern',
        description: 'Minimalistisch design met accent kleuren',
        isDefault: true,
        accentColor: '#3b82f6',
        html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: {{accentColor}}; padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 32px 24px; }
    .footer { background: #f8f9fa; padding: 20px 24px; text-align: center; font-size: 12px; color: #666; }
    a { color: {{accentColor}}; }
    .btn { display: inline-block; background: {{accentColor}}; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{companyName}}</h1>
    </div>
    <div class="content">
      {{content}}
    </div>
    <div class="footer">
      {{footer}}
    </div>
  </div>
</body>
</html>`
    },
    {
        id: 'professional',
        name: 'Professioneel',
        description: 'Zakelijk design voor B2B communicatie',
        isDefault: true,
        accentColor: '#1e293b',
        html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Georgia, serif; line-height: 1.8; color: #1e293b; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .logo { font-size: 18px; font-weight: bold; margin-bottom: 32px; color: #1e293b; }
    .content { margin-bottom: 32px; }
    .signature { border-top: 1px solid #e2e8f0; padding-top: 24px; font-size: 14px; color: #64748b; }
    a { color: #3b82f6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">{{companyName}}</div>
    <div class="content">
      {{content}}
    </div>
    <div class="signature">
      {{signature}}
    </div>
  </div>
</body>
</html>`
    },
    {
        id: 'bold',
        name: 'Bold',
        description: 'Opvallend design met grote headers',
        isDefault: true,
        accentColor: '#f97316',
        html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background: #0f172a; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: {{accentColor}}; padding: 40px 24px; }
    .header h1 { color: white; margin: 0; font-size: 32px; font-weight: 800; }
    .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0 0; }
    .content { background: white; padding: 32px 24px; }
    .footer { background: #1e293b; padding: 24px; text-align: center; color: #94a3b8; font-size: 12px; }
    .btn { display: inline-block; background: {{accentColor}}; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{headline}}</h1>
      <p>{{subheadline}}</p>
    </div>
    <div class="content">
      {{content}}
    </div>
    <div class="footer">
      {{footer}}
    </div>
  </div>
</body>
</html>`
    }
];

async function getKV() {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        return null;
    }
    try {
        const { kv } = await import('@vercel/kv');
        await kv.ping();
        return kv;
    } catch (e) {
        return null;
    }
}

const KV_KEY = 'email_templates';

/**
 * Get all templates (including defaults)
 */
export async function getTemplates() {
    const kv = await getKV();
    let customTemplates = [];

    if (kv) {
        customTemplates = await kv.get(KV_KEY) || [];
    } else {
        customTemplates = [...memoryTemplateStore];
    }

    // Combine defaults with custom templates
    return [...defaultTemplates, ...customTemplates];
}

/**
 * Get a single template by ID
 */
export async function getTemplate(templateId) {
    const templates = await getTemplates();
    return templates.find(t => t.id === templateId) || null;
}

/**
 * Create a new custom template
 */
export async function createTemplate(templateData) {
    const kv = await getKV();

    const template = {
        id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDefault: false,
        ...templateData
    };

    let templates = [];
    if (kv) {
        templates = await kv.get(KV_KEY) || [];
        templates.push(template);
        await kv.set(KV_KEY, templates);
    } else {
        memoryTemplateStore.push(template);
    }

    return template;
}

/**
 * Update a custom template (cannot update defaults)
 */
export async function updateTemplate(templateId, updates) {
    // Check if it's a default template
    if (defaultTemplates.find(t => t.id === templateId)) {
        throw new Error('Standaard templates kunnen niet worden bewerkt');
    }

    const kv = await getKV();

    let templates = [];
    if (kv) {
        templates = await kv.get(KV_KEY) || [];
    } else {
        templates = memoryTemplateStore;
    }

    const index = templates.findIndex(t => t.id === templateId);
    if (index === -1) return null;

    templates[index] = {
        ...templates[index],
        ...updates,
        updatedAt: new Date().toISOString()
    };

    if (kv) {
        await kv.set(KV_KEY, templates);
    }

    return templates[index];
}

/**
 * Delete a custom template
 */
export async function deleteTemplate(templateId) {
    // Check if it's a default template
    if (defaultTemplates.find(t => t.id === templateId)) {
        throw new Error('Standaard templates kunnen niet worden verwijderd');
    }

    const kv = await getKV();

    if (kv) {
        let templates = await kv.get(KV_KEY) || [];
        templates = templates.filter(t => t.id !== templateId);
        await kv.set(KV_KEY, templates);
    } else {
        memoryTemplateStore = memoryTemplateStore.filter(t => t.id !== templateId);
    }

    return { success: true };
}

/**
 * Duplicate a template (creates a new custom template based on existing)
 */
export async function duplicateTemplate(templateId) {
    const original = await getTemplate(templateId);
    if (!original) return null;

    return createTemplate({
        name: original.name + ' (kopie)',
        description: original.description,
        html: original.html,
        accentColor: original.accentColor
    });
}

/**
 * Render a template with data
 */
export function renderTemplate(html, data = {}) {
    let rendered = html;

    // Replace all {{variable}} placeholders
    Object.entries(data).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        rendered = rendered.replace(regex, value || '');
    });

    // Remove any unreplaced placeholders
    rendered = rendered.replace(/{{[^}]+}}/g, '');

    return rendered;
}
