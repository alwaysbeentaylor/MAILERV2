// Bulk Import Modal Component
// Allows importing multiple SMTP accounts via text or CSV

import { useState } from 'react';

export default function BulkImportModal({ isOpen, onClose, onImport }) {
    const [importText, setImportText] = useState('');
    const [format, setFormat] = useState('text'); // 'text' or 'csv'
    const [preview, setPreview] = useState([]);
    const [error, setError] = useState('');

    const parseTextFormat = (text) => {
        // Format: host:port:user:password:fromName (one per line)
        const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        const accounts = [];

        for (const line of lines) {
            const parts = line.trim().split(':');
            if (parts.length >= 4) {
                accounts.push({
                    host: parts[0].trim(),
                    port: parts[1].trim() || '587',
                    user: parts[2].trim(),
                    pass: parts[3].trim(),
                    fromName: parts[4]?.trim() || ''
                });
            }
        }
        return accounts;
    };

    const parseCsvFormat = (text) => {
        // Format: CSV with headers: host,port,user,pass,fromName,fromEmail
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        const accounts = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const account = {};

            headers.forEach((header, idx) => {
                account[header] = values[idx] || '';
            });

            if (account.host && account.user && account.pass) {
                accounts.push({
                    host: account.host,
                    port: account.port || '587',
                    user: account.user,
                    pass: account.pass,
                    fromName: account.fromname || account.fromName || '',
                    fromEmail: account.fromemail || account.fromEmail || ''
                });
            }
        }
        return accounts;
    };

    const handlePreview = () => {
        setError('');
        try {
            const accounts = format === 'csv'
                ? parseCsvFormat(importText)
                : parseTextFormat(importText);

            if (accounts.length === 0) {
                setError('Geen geldige accounts gevonden. Check het formaat.');
                setPreview([]);
            } else {
                setPreview(accounts);
            }
        } catch (e) {
            setError('Fout bij parsen: ' + e.message);
            setPreview([]);
        }
    };

    const handleImport = async () => {
        if (preview.length === 0) return;
        await onImport(preview);
        setImportText('');
        setPreview([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content bulk-import-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📋 Bulk Import SMTP Accounts</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {/* Format Selection */}
                    <div className="format-toggle">
                        <button
                            className={`format-btn ${format === 'text' ? 'active' : ''}`}
                            onClick={() => setFormat('text')}
                        >
                            📝 Kladblok
                        </button>
                        <button
                            className={`format-btn ${format === 'csv' ? 'active' : ''}`}
                            onClick={() => setFormat('csv')}
                        >
                            📊 CSV
                        </button>
                    </div>

                    {/* Format Help */}
                    <div className="format-help">
                        {format === 'text' ? (
                            <p>
                                <strong>Formaat:</strong> host:port:user:password:fromName<br />
                                <code>smtp.gmail.com:587:email@gmail.com:apppassword:SKYE</code>
                            </p>
                        ) : (
                            <p>
                                <strong>CSV Headers:</strong> host,port,user,pass,fromName<br />
                                <code>smtp.gmail.com,587,email@gmail.com,pass,SKYE</code>
                            </p>
                        )}
                    </div>

                    {/* Text Input */}
                    <textarea
                        className="import-textarea"
                        placeholder={format === 'text'
                            ? "# Plak SMTP accounts (één per regel)\nsmtp.gmail.com:587:email@gmail.com:password:SKYE"
                            : "host,port,user,pass,fromName\nsmtp.gmail.com,587,email@gmail.com,password,SKYE"
                        }
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        rows={8}
                    />

                    {/* Error */}
                    {error && <div className="import-error">❌ {error}</div>}

                    {/* Preview Button */}
                    <button
                        className="btn btn-secondary preview-btn"
                        onClick={handlePreview}
                        disabled={!importText.trim()}
                    >
                        👁️ Preview
                    </button>

                    {/* Preview Results */}
                    {preview.length > 0 && (
                        <div className="preview-results">
                            <div className="preview-header">
                                ✅ {preview.length} accounts gevonden
                            </div>
                            <div className="preview-list">
                                {preview.slice(0, 5).map((acc, i) => (
                                    <div key={i} className="preview-item">
                                        <span className="preview-user">{acc.user}</span>
                                        <span className="preview-host">{acc.host}:{acc.port}</span>
                                    </div>
                                ))}
                                {preview.length > 5 && (
                                    <div className="preview-more">
                                        ... en {preview.length - 5} meer
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Annuleren
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleImport}
                        disabled={preview.length === 0}
                    >
                        📥 Importeer {preview.length} Accounts
                    </button>
                </div>
            </div>

            <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .modal-content {
          background: var(--glass-bg, #1a1a2e);
          border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
          border-radius: 16px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--glass-border, rgba(255,255,255,0.1));
        }
        .modal-header h2 {
          margin: 0;
          font-size: 18px;
        }
        .modal-close {
          background: none;
          border: none;
          color: var(--text-secondary, #888);
          font-size: 24px;
          cursor: pointer;
        }
        .modal-close:hover {
          color: #fff;
        }
        .modal-body {
          padding: 24px;
          overflow-y: auto;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--glass-border, rgba(255,255,255,0.1));
        }
        .format-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .format-btn {
          flex: 1;
          padding: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
          border-radius: 8px;
          color: var(--text-secondary, #888);
          cursor: pointer;
          transition: all 0.2s;
        }
        .format-btn.active {
          background: rgba(0, 164, 232, 0.2);
          border-color: var(--neon-blue, #00f3ff);
          color: var(--neon-blue, #00f3ff);
        }
        .format-help {
          background: rgba(255,255,255,0.03);
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13px;
          color: var(--text-secondary, #888);
        }
        .format-help code {
          display: block;
          margin-top: 8px;
          padding: 8px;
          background: rgba(0,0,0,0.3);
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
          color: var(--neon-blue, #00f3ff);
          word-break: break-all;
        }
        .import-textarea {
          width: 100%;
          background: rgba(0,0,0,0.3);
          border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
          border-radius: 8px;
          padding: 12px;
          color: #fff;
          font-family: monospace;
          font-size: 13px;
          resize: vertical;
        }
        .import-textarea:focus {
          outline: none;
          border-color: var(--neon-blue, #00f3ff);
        }
        .import-error {
          margin-top: 12px;
          padding: 10px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #f87171;
          font-size: 13px;
        }
        .preview-btn {
          margin-top: 12px;
          width: 100%;
        }
        .preview-results {
          margin-top: 16px;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 8px;
          overflow: hidden;
        }
        .preview-header {
          padding: 12px 16px;
          background: rgba(34, 197, 94, 0.2);
          font-weight: 600;
          color: #22c55e;
        }
        .preview-list {
          padding: 12px 16px;
        }
        .preview-item {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .preview-item:last-child {
          border-bottom: none;
        }
        .preview-user {
          color: #fff;
          font-size: 13px;
        }
        .preview-host {
          color: var(--text-secondary, #888);
          font-size: 12px;
        }
        .preview-more {
          padding-top: 8px;
          color: var(--text-secondary, #888);
          font-size: 12px;
          text-align: center;
        }
        .btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .btn-secondary {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }
        .btn-secondary:hover {
          background: rgba(255,255,255,0.15);
        }
        .btn-primary {
          background: var(--neon-blue, #00f3ff);
          color: #000;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 243, 255, 0.3);
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }
      `}</style>
        </div>
    );
}
