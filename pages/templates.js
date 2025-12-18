import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Navigation from '../components/Navigation';

export default function TemplatesPage() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '', html: '', accentColor: '#3b82f6' });
    const [previewHtml, setPreviewHtml] = useState('');

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            const res = await fetch('/api/templates');
            const data = await res.json();
            if (data.success) {
                setTemplates(data.templates || []);
            }
        } catch (e) {
            console.error('Failed to load templates:', e);
        }
        setLoading(false);
    };

    const selectTemplate = (template) => {
        setSelectedTemplate(template);
        setEditMode(false);
        setEditData({
            name: template.name,
            description: template.description || '',
            html: template.html,
            accentColor: template.accentColor || '#3b82f6'
        });
        updatePreview(template.html, template.accentColor);
    };

    const updatePreview = (html, accentColor) => {
        let preview = html || '';
        preview = preview.replace(/{{accentColor}}/g, accentColor || '#3b82f6');
        preview = preview.replace(/{{companyName}}/g, 'SKYE');
        preview = preview.replace(/{{headline}}/g, 'Uw Bedrijf Verdient Beter');
        preview = preview.replace(/{{subheadline}}/g, 'Laat ons u laten zien hoe');
        preview = preview.replace(/{{content}}/g, '<p>Dit is een voorbeeld van hoe uw email eruit zal zien. De inhoud wordt automatisch gegenereerd door de AI op basis van de website van uw lead.</p><p>U kunt de template aanpassen aan uw huisstijl.</p>');
        preview = preview.replace(/{{footer}}/g, '© 2024 SKYE • info@skye.be');
        preview = preview.replace(/{{signature}}/g, 'Met vriendelijke groet,<br>Het SKYE Team<br>info@skye.be');
        setPreviewHtml(preview);
    };

    const handleEdit = () => {
        if (selectedTemplate?.isDefault) {
            // Duplicate first
            duplicateTemplate(selectedTemplate.id);
        } else {
            setEditMode(true);
        }
    };

    const saveTemplate = async () => {
        try {
            const res = await fetch('/api/templates', {
                method: selectedTemplate.isDefault ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selectedTemplate.isDefault ? editData : { id: selectedTemplate.id, ...editData })
            });
            const data = await res.json();
            if (data.success) {
                await loadTemplates();
                if (data.template) {
                    setSelectedTemplate(data.template);
                }
                setEditMode(false);
            } else {
                alert('Fout: ' + data.error);
            }
        } catch (e) {
            alert('Opslaan mislukt: ' + e.message);
        }
    };

    const duplicateTemplate = async (templateId) => {
        try {
            const res = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ duplicate: templateId })
            });
            const data = await res.json();
            if (data.success) {
                await loadTemplates();
                setSelectedTemplate(data.template);
                setEditMode(true);
                setEditData({
                    name: data.template.name,
                    description: data.template.description || '',
                    html: data.template.html,
                    accentColor: data.template.accentColor || '#3b82f6'
                });
            }
        } catch (e) {
            alert('Dupliceren mislukt: ' + e.message);
        }
    };

    const deleteTemplate = async (templateId) => {
        if (!confirm('Weet je zeker dat je deze template wilt verwijderen?')) return;

        try {
            const res = await fetch('/api/templates', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: templateId })
            });
            const data = await res.json();
            if (data.success) {
                await loadTemplates();
                setSelectedTemplate(null);
            } else {
                alert('Fout: ' + data.error);
            }
        } catch (e) {
            alert('Verwijderen mislukt: ' + e.message);
        }
    };

    const createNewTemplate = () => {
        setSelectedTemplate({ id: 'new', isDefault: false });
        setEditMode(true);
        setEditData({
            name: 'Nieuwe Template',
            description: '',
            html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #333; }
  </style>
</head>
<body>
  {{content}}
</body>
</html>`,
            accentColor: '#3b82f6'
        });
        updatePreview(editData.html, editData.accentColor);
    };

    return (
        <>
            <Head>
                <title>Email Templates | SKYE Mail Agent</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
            </Head>

            <div className="app">
                <Navigation />
                <div className="page-header">
                    <h1>🎨 Email Templates</h1>
                    <button onClick={createNewTemplate} className="btn btn-primary">
                        ➕ Nieuwe Template
                    </button>
                </div>

                <main className="main">
                    <div className="container">
                        <div className="templates-layout">
                            {/* Templates Grid */}
                            <div className="templates-grid">
                                {loading ? (
                                    <div className="loading">Laden...</div>
                                ) : (
                                    templates.map(template => (
                                        <div
                                            key={template.id}
                                            className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                                            onClick={() => selectTemplate(template)}
                                        >
                                            <div
                                                className="template-preview-thumb"
                                                style={{ borderTopColor: template.accentColor || '#e2e8f0' }}
                                            >
                                                {template.isBlank ? '📄' : '📧'}
                                            </div>
                                            <div className="template-info">
                                                <div className="template-name">
                                                    {template.name}
                                                    {template.isDefault && <span className="default-badge">Standaard</span>}
                                                </div>
                                                <div className="template-desc">{template.description}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Template Editor/Preview */}
                            <div className="template-editor">
                                {selectedTemplate ? (
                                    <>
                                        <div className="editor-header">
                                            <div className="editor-title">
                                                {editMode ? '✏️ Bewerken' : selectedTemplate.name}
                                            </div>
                                            <div className="editor-actions">
                                                {!editMode ? (
                                                    <>
                                                        <button onClick={handleEdit} className="btn btn-secondary">
                                                            {selectedTemplate.isDefault ? '📋 Bewerken (maakt kopie)' : '✏️ Bewerken'}
                                                        </button>
                                                        {!selectedTemplate.isDefault && (
                                                            <button
                                                                onClick={() => deleteTemplate(selectedTemplate.id)}
                                                                className="btn btn-danger-text"
                                                            >
                                                                🗑️
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => setEditMode(false)} className="btn btn-secondary">
                                                            Annuleren
                                                        </button>
                                                        <button onClick={saveTemplate} className="btn btn-primary">
                                                            💾 Opslaan
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {editMode ? (
                                            <div className="edit-form">
                                                <div className="form-row">
                                                    <div className="form-group">
                                                        <label>Naam</label>
                                                        <input
                                                            type="text"
                                                            value={editData.name}
                                                            onChange={e => setEditData({ ...editData, name: e.target.value })}
                                                            className="input"
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Accent Kleur</label>
                                                        <div className="color-input">
                                                            <input
                                                                type="color"
                                                                value={editData.accentColor}
                                                                onChange={e => {
                                                                    setEditData({ ...editData, accentColor: e.target.value });
                                                                    updatePreview(editData.html, e.target.value);
                                                                }}
                                                            />
                                                            <input
                                                                type="text"
                                                                value={editData.accentColor}
                                                                onChange={e => setEditData({ ...editData, accentColor: e.target.value })}
                                                                className="input"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label>Beschrijving</label>
                                                    <input
                                                        type="text"
                                                        value={editData.description}
                                                        onChange={e => setEditData({ ...editData, description: e.target.value })}
                                                        className="input"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>HTML Code</label>
                                                    <textarea
                                                        value={editData.html}
                                                        onChange={e => {
                                                            setEditData({ ...editData, html: e.target.value });
                                                            updatePreview(e.target.value, editData.accentColor);
                                                        }}
                                                        className="code-editor"
                                                        rows={15}
                                                    />
                                                </div>
                                                <div className="variables-help">
                                                    <strong>Beschikbare variabelen:</strong>{' '}
                                                    {'{{content}}'} {'{{companyName}}'} {'{{accentColor}}'} {'{{footer}}'} {'{{signature}}'} {'{{headline}}'} {'{{subheadline}}'}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="preview-container">
                                                <div className="preview-label">Preview</div>
                                                <iframe
                                                    srcDoc={previewHtml}
                                                    className="preview-frame"
                                                    title="Template Preview"
                                                    sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
                                                />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="no-selection">
                                        <span className="empty-icon">👈</span>
                                        <p>Selecteer een template om te bekijken</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>

                <style jsx>{`
          .app {
            min-height: 100vh;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            font-family: 'Inter', sans-serif;
          }

          .page-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 24px;
            background: white;
            border-bottom: 1px solid #e2e8f0;
          }

          .page-header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
          }

          .main { padding: 24px; }
          .container { max-width: 1600px; margin: 0 auto; }

          .templates-layout {
            display: grid;
            grid-template-columns: 300px 1fr;
            gap: 24px;
            min-height: calc(100vh - 150px);
          }

          .templates-grid {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .template-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .template-card:hover { border-color: #cbd5e1; }
          .template-card.selected {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }

          .template-preview-thumb {
            height: 60px;
            background: #f8fafc;
            border-radius: 8px;
            border-top: 4px solid;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            margin-bottom: 12px;
          }

          .template-info {}
          .template-name {
            font-weight: 600;
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .default-badge {
            font-size: 10px;
            background: #e0f2fe;
            color: #0284c7;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
          }

          .template-desc {
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
          }

          .template-editor {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
          }

          .editor-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid #e2e8f0;
          }

          .editor-title { font-weight: 700; font-size: 16px; color: #1e293b; }
          .editor-actions { display: flex; gap: 8px; }

          .edit-form { padding: 20px; }

          .form-row {
            display: grid;
            grid-template-columns: 1fr 200px;
            gap: 16px;
          }

          .form-group {
            margin-bottom: 16px;
          }

          .form-group label {
            display: block;
            font-size: 12px;
            font-weight: 500;
            color: #64748b;
            margin-bottom: 6px;
            text-transform: uppercase;
          }

          .input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            font-size: 14px;
          }

          .input:focus { outline: none; border-color: #3b82f6; }

          .color-input {
            display: flex;
            gap: 8px;
            align-items: center;
          }

          .color-input input[type="color"] {
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          }

          .code-editor {
            width: 100%;
            padding: 12px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            line-height: 1.5;
            resize: vertical;
          }

          .variables-help {
            font-size: 12px;
            color: #64748b;
            background: #f8fafc;
            padding: 12px;
            border-radius: 8px;
            font-family: 'JetBrains Mono', monospace;
          }

          .preview-container { height: 100%; }

          .preview-label {
            padding: 12px 20px;
            font-size: 12px;
            font-weight: 500;
            color: #64748b;
            text-transform: uppercase;
            border-bottom: 1px solid #e2e8f0;
          }

          .preview-frame {
            width: 100%;
            height: calc(100vh - 250px);
            border: none;
            background: white;
          }

          .no-selection {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 400px;
            color: #64748b;
          }

          .empty-icon { font-size: 48px; margin-bottom: 12px; }
          .loading { padding: 40px; text-align: center; color: #64748b; }

          .btn {
            padding: 10px 16px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            font-size: 13px;
            transition: all 0.2s;
          }

          .btn-secondary { background: #f1f5f9; color: #1e293b; }
          .btn-primary { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; }
          .btn-danger-text { background: none; color: #ef4444; }

          @media (max-width: 900px) {
            .templates-layout { grid-template-columns: 1fr; }
          }
        `}</style>
            </div>
        </>
    );
}
