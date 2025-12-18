// SMTP Settings Modal Component
// Individual SMTP account settings with advice display

import { useState, useEffect } from 'react';

// Pre-configured SMTP presets for popular providers
const SMTP_PRESETS = {
  mailgunApi: {
    name: '📧 Mailgun API ✅',
    host: 'API', // Special marker - uses API not SMTP
    port: 'API',
    user: 'postmaster@mail.skye-unlimited.be',
    pass: '', // Set via environment variable MAILGUN_API_KEY
    description: '⚡ Mailgun HTTP API - Configureer API key in settings',
    isApi: true
  },
  custom: {
    name: 'Handmatig',
    host: '',
    port: '587',
    user: '',
    pass: '',
    description: 'Vul zelf alle SMTP gegevens in'
  },
  gmail: {
    name: '📧 Gmail',
    host: 'smtp.gmail.com',
    port: '587',
    user: '',
    pass: '',
    description: 'Gmail - Vereist App Password'
  },
  outlook: {
    name: '📨 Outlook/Hotmail',
    host: 'smtp.office365.com',
    port: '587',
    user: '',
    pass: '',
    description: 'Microsoft Outlook/Hotmail'
  },
  sendgrid: {
    name: '📤 SendGrid',
    host: 'smtp.sendgrid.net',
    port: '587',
    user: 'apikey',
    pass: '',
    description: 'SendGrid - User = "apikey", Pass = API key'
  }
};

export default function SmtpSettingsModal({ isOpen, onClose, account, advice, onSave, onTest }) {
  const [selectedPreset, setSelectedPreset] = useState('custom');
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '587',
    user: '',
    pass: '',
    fromName: '',
    fromEmail: '',
    hourlyLimit: 10,
    dailyLimit: 50,
    warmupEnabled: false,
    active: true
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Apply preset when selected
  const applyPreset = (presetKey) => {
    setSelectedPreset(presetKey);
    const preset = SMTP_PRESETS[presetKey];
    if (preset && presetKey !== 'custom') {
      setFormData(f => ({
        ...f,
        name: preset.name.replace(/^[^\w]+ /, ''), // Remove emoji
        host: preset.host,
        port: preset.port,
        user: preset.user,
        pass: preset.pass,
        hourlyLimit: preset.hourlyLimit || f.hourlyLimit,
        dailyLimit: preset.dailyLimit || f.dailyLimit
      }));
    }
  };

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || '',
        host: account.host || '',
        port: account.port || '587',
        user: account.user || '',
        pass: '', // Don't show password
        fromName: account.fromName || '',
        fromEmail: account.fromEmail || '',
        hourlyLimit: account.hourlyLimit || advice?.recommended?.hourly || 10,
        dailyLimit: account.dailyLimit || advice?.recommended?.daily || 50,
        warmupEnabled: account.warmupEnabled || false,
        active: account.active !== false
      });
    }
  }, [account, advice]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(account?.id, formData);
    onClose();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(formData);
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: error.message });
    }
    setTesting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ {account ? 'SMTP Instellingen' : 'Nieuw SMTP Account'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Quick Preset Selector - Only show for new accounts */}
            {!account && (
              <div className="preset-selector">
                <label>🚀 Snelle Setup</label>
                <div className="preset-buttons">
                  {Object.entries(SMTP_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      className={`preset-btn ${selectedPreset === key ? 'active' : ''} ${key === 'amazonSES' ? 'highlight' : ''}`}
                      onClick={() => applyPreset(key)}
                    >
                      <span className="preset-name">{preset.name}</span>
                      <span className="preset-desc">{preset.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Advice Card (if available) */}
            {advice && (
              <div className="advice-card" style={{ borderColor: advice.statusColor }}>
                <div className="advice-header">
                  <span className="advice-status">
                    {advice.statusEmoji} {advice.statusLabel}
                  </span>
                  <span className="advice-score">
                    Score: {advice.healthScore}/100
                  </span>
                </div>
                <div className="advice-recommended">
                  📊 Aanbevolen: {advice.recommended.hourly}/uur, {advice.recommended.daily}/dag
                </div>
                {advice.warnings?.length > 0 && (
                  <div className="advice-warnings">
                    {advice.warnings.map((w, i) => (
                      <div key={i} className="warning-item">{w}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="form-grid">
              {/* Account Name */}
              <div className="form-group full-width">
                <label>Account Naam</label>
                <input
                  type="text"
                  placeholder="Bijv: Gmail #1"
                  value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Host & Port */}
              <div className="form-group">
                <label>SMTP Host *</label>
                <input
                  type="text"
                  required
                  placeholder="smtp.gmail.com"
                  value={formData.host}
                  onChange={e => setFormData(f => ({ ...f, host: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Port</label>
                <input
                  type="text"
                  placeholder="587"
                  value={formData.port}
                  onChange={e => setFormData(f => ({ ...f, port: e.target.value }))}
                />
              </div>

              {/* User & Pass */}
              <div className="form-group">
                <label>Username / Email *</label>
                <input
                  type="text"
                  required
                  placeholder="username of email@domain.com"
                  value={formData.user}
                  onChange={e => setFormData(f => ({ ...f, user: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  required={!account}
                  placeholder={account ? '••••••••' : 'App Password'}
                  value={formData.pass}
                  onChange={e => setFormData(f => ({ ...f, pass: e.target.value }))}
                />
              </div>

              {/* From Name & Email */}
              <div className="form-group">
                <label>Afzender Naam</label>
                <input
                  type="text"
                  placeholder="SKYE"
                  value={formData.fromName}
                  onChange={e => setFormData(f => ({ ...f, fromName: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Afzender Email</label>
                <input
                  type="email"
                  placeholder="(optioneel, default = user)"
                  value={formData.fromEmail}
                  onChange={e => setFormData(f => ({ ...f, fromEmail: e.target.value }))}
                />
              </div>

              {/* Limits */}
              <div className="form-group">
                <label>Hourly Limit</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={formData.hourlyLimit}
                  onChange={e => setFormData(f => ({ ...f, hourlyLimit: parseInt(e.target.value) || 10 }))}
                />
              </div>
              <div className="form-group">
                <label>Daily Limit</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={formData.dailyLimit}
                  onChange={e => setFormData(f => ({ ...f, dailyLimit: parseInt(e.target.value) || 50 }))}
                />
              </div>

              {/* Toggles */}
              <div className="form-group">
                <label>Warmup</label>
                <button
                  type="button"
                  className={`toggle ${formData.warmupEnabled ? 'on' : 'off'}`}
                  onClick={() => setFormData(f => ({ ...f, warmupEnabled: !f.warmupEnabled }))}
                >
                  {formData.warmupEnabled ? '🔥 Aan' : '❄️ Uit'}
                </button>
              </div>
              <div className="form-group">
                <label>Status</label>
                <button
                  type="button"
                  className={`toggle ${formData.active ? 'on' : 'off'}`}
                  onClick={() => setFormData(f => ({ ...f, active: !f.active }))}
                >
                  {formData.active ? '✅ Actief' : '⏸️ Inactief'}
                </button>
              </div>
            </div>

            {/* Test Button */}
            <button
              type="button"
              className="btn btn-secondary test-btn"
              onClick={handleTest}
              disabled={testing || !formData.host || !formData.user}
            >
              {testing ? '⏳ Testen...' : '🔌 Test Verbinding'}
            </button>

            {testResult && (
              <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                {testResult.success ? '✅' : '❌'} {testResult.message}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annuleren
            </button>
            <button type="submit" className="btn btn-primary">
              💾 Opslaan
            </button>
          </div>
        </form>
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
          overflow-y: auto;
          max-height: 70vh;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--glass-border, rgba(255,255,255,0.1));
        }
        .advice-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .advice-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .advice-status {
          font-weight: 600;
          font-size: 14px;
        }
        .advice-score {
          font-size: 12px;
          color: var(--text-secondary, #888);
        }
        .advice-recommended {
          font-size: 13px;
          color: var(--text-secondary, #888);
          margin-bottom: 8px;
        }
        .advice-warnings {
          font-size: 12px;
          color: #f59e0b;
        }
        .warning-item {
          margin-top: 4px;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
        }
        .form-group.full-width {
          grid-column: 1 / -1;
        }
        .form-group label {
          margin-bottom: 6px;
          font-size: 12px;
          color: var(--text-secondary, #888);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .form-group input {
          background: rgba(0,0,0,0.3);
          border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
          border-radius: 8px;
          padding: 10px 12px;
          color: #fff;
          font-size: 14px;
        }
        .form-group input:focus {
          outline: none;
          border-color: var(--neon-blue, #00f3ff);
        }
        .toggle {
          padding: 10px 16px;
          border-radius: 8px;
          border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .toggle.on {
          background: rgba(34, 197, 94, 0.2);
          border-color: #22c55e;
          color: #22c55e;
        }
        .toggle.off {
          background: rgba(255,255,255,0.05);
          color: var(--text-secondary, #888);
        }
        .test-btn {
          width: 100%;
          margin-top: 16px;
        }
        .test-result {
          margin-top: 12px;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
        }
        .test-result.success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }
        .test-result.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
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
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        /* Preset Selector Styles */
        .preset-selector {
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--glass-border, rgba(255,255,255,0.1));
        }
        .preset-selector > label {
          display: block;
          margin-bottom: 12px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }
        .preset-buttons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .preset-btn {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 12px 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }
        .preset-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.2);
        }
        .preset-btn.active {
          background: rgba(0, 243, 255, 0.1);
          border-color: var(--neon-blue, #00f3ff);
        }
        .preset-btn.highlight {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
          animation: pulse-glow 2s infinite;
        }
        .preset-btn.highlight.active {
          background: rgba(245, 158, 11, 0.2);
          border-color: #f59e0b;
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 5px rgba(245, 158, 11, 0.3); }
          50% { box-shadow: 0 0 15px rgba(245, 158, 11, 0.5); }
        }
        .preset-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }
        .preset-desc {
          font-size: 11px;
          color: var(--text-secondary, #888);
          line-height: 1.3;
        }
      `}</style>
    </div>
  );
}
