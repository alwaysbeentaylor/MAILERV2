// Bulk Settings Modal Component
// Apply settings to multiple SMTP accounts at once

import { useState } from 'react';

export default function BulkSettingsModal({ isOpen, onClose, selectedCount, onApply }) {
    const [settings, setSettings] = useState({
        hourlyLimit: '',
        dailyLimit: '',
        warmupEnabled: null,
        active: null
    });

    const handleApply = () => {
        // Only send non-empty values
        const updates = {};
        if (settings.hourlyLimit !== '') updates.hourlyLimit = parseInt(settings.hourlyLimit);
        if (settings.dailyLimit !== '') updates.dailyLimit = parseInt(settings.dailyLimit);
        if (settings.warmupEnabled !== null) updates.warmupEnabled = settings.warmupEnabled;
        if (settings.active !== null) updates.active = settings.active;

        if (Object.keys(updates).length > 0) {
            onApply(updates);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>⚙️ Bulk Instellingen</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="selected-info">
                        Instellingen toepassen op <strong>{selectedCount}</strong> accounts
                    </div>

                    {/* Hourly Limit */}
                    <div className="form-group">
                        <label>Hourly Limit</label>
                        <div className="input-with-suffix">
                            <input
                                type="number"
                                min="1"
                                max="500"
                                placeholder="Niet wijzigen"
                                value={settings.hourlyLimit}
                                onChange={e => setSettings(s => ({ ...s, hourlyLimit: e.target.value }))}
                            />
                            <span>emails/uur</span>
                        </div>
                    </div>

                    {/* Daily Limit */}
                    <div className="form-group">
                        <label>Daily Limit</label>
                        <div className="input-with-suffix">
                            <input
                                type="number"
                                min="1"
                                max="10000"
                                placeholder="Niet wijzigen"
                                value={settings.dailyLimit}
                                onChange={e => setSettings(s => ({ ...s, dailyLimit: e.target.value }))}
                            />
                            <span>emails/dag</span>
                        </div>
                    </div>

                    {/* Warmup Toggle */}
                    <div className="form-group">
                        <label>Warmup</label>
                        <div className="toggle-group">
                            <button
                                className={`toggle-btn ${settings.warmupEnabled === null ? 'active' : ''}`}
                                onClick={() => setSettings(s => ({ ...s, warmupEnabled: null }))}
                            >
                                — Niet wijzigen
                            </button>
                            <button
                                className={`toggle-btn ${settings.warmupEnabled === true ? 'active success' : ''}`}
                                onClick={() => setSettings(s => ({ ...s, warmupEnabled: true }))}
                            >
                                🔥 Aan
                            </button>
                            <button
                                className={`toggle-btn ${settings.warmupEnabled === false ? 'active danger' : ''}`}
                                onClick={() => setSettings(s => ({ ...s, warmupEnabled: false }))}
                            >
                                ❄️ Uit
                            </button>
                        </div>
                    </div>

                    {/* Active Toggle */}
                    <div className="form-group">
                        <label>Account Status</label>
                        <div className="toggle-group">
                            <button
                                className={`toggle-btn ${settings.active === null ? 'active' : ''}`}
                                onClick={() => setSettings(s => ({ ...s, active: null }))}
                            >
                                — Niet wijzigen
                            </button>
                            <button
                                className={`toggle-btn ${settings.active === true ? 'active success' : ''}`}
                                onClick={() => setSettings(s => ({ ...s, active: true }))}
                            >
                                ✅ Actief
                            </button>
                            <button
                                className={`toggle-btn ${settings.active === false ? 'active danger' : ''}`}
                                onClick={() => setSettings(s => ({ ...s, active: false }))}
                            >
                                ⏸️ Inactief
                            </button>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Annuleren
                    </button>
                    <button className="btn btn-primary" onClick={handleApply}>
                        ✅ Toepassen op {selectedCount} accounts
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
          max-width: 480px;
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
        .modal-body {
          padding: 24px;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--glass-border, rgba(255,255,255,0.1));
        }
        .selected-info {
          background: rgba(0, 164, 232, 0.1);
          border: 1px solid rgba(0, 164, 232, 0.3);
          border-radius: 8px;
          padding: 12px 16px;
          text-align: center;
          margin-bottom: 20px;
          color: var(--neon-blue, #00f3ff);
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          color: var(--text-secondary, #888);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .input-with-suffix {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .input-with-suffix input {
          flex: 1;
          background: rgba(0,0,0,0.3);
          border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
          border-radius: 8px;
          padding: 12px;
          color: #fff;
          font-size: 14px;
        }
        .input-with-suffix input:focus {
          outline: none;
          border-color: var(--neon-blue, #00f3ff);
        }
        .input-with-suffix span {
          color: var(--text-secondary, #888);
          font-size: 13px;
          white-space: nowrap;
        }
        .toggle-group {
          display: flex;
          gap: 8px;
        }
        .toggle-btn {
          flex: 1;
          padding: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
          border-radius: 8px;
          color: var(--text-secondary, #888);
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .toggle-btn.active {
          background: rgba(0, 164, 232, 0.2);
          border-color: var(--neon-blue, #00f3ff);
          color: var(--neon-blue, #00f3ff);
        }
        .toggle-btn.active.success {
          background: rgba(34, 197, 94, 0.2);
          border-color: #22c55e;
          color: #22c55e;
        }
        .toggle-btn.active.danger {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
          color: #ef4444;
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
        .btn-primary {
          background: var(--neon-blue, #00f3ff);
          color: #000;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
        }
      `}</style>
        </div>
    );
}
