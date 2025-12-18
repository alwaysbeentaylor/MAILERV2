import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Navigation from '../components/Navigation';
import WarmupStatus from '../components/WarmupStatus';
import WarmupWizard from '../components/WarmupWizard';
import { getSmtpAccounts } from '../utils/campaignStore';
import {
  getWarmupSummary,
  initializeWarmup,
  pauseWarmup,
  resumeWarmup,
  disableWarmup,
  updateWarmupSettings
} from '../utils/warmupStore';

export default function WarmupPage() {
  const [accounts, setAccounts] = useState([]);
  const [warmupData, setWarmupData] = useState({});
  const [showWizard, setShowWizard] = useState(null); // accountId or null
  const [editingLimit, setEditingLimit] = useState(null); // accountId or null
  const [customLimitValue, setCustomLimitValue] = useState('');

  useEffect(() => {
    loadData();
    // Refresh every minute to update counters
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    const smtpAccounts = getSmtpAccounts();
    setAccounts(smtpAccounts);

    const data = {};
    smtpAccounts.forEach(account => {
      data[account.id] = getWarmupSummary(account.id);
    });
    setWarmupData(data);
  };

  const handleSetupComplete = (accountId, settings) => {
    initializeWarmup(accountId, settings);
    setShowWizard(null);
    loadData();
  };

  const handlePause = (accountId) => {
    pauseWarmup(accountId);
    loadData();
  };

  const handleResume = (accountId) => {
    resumeWarmup(accountId);
    loadData();
  };

  const handleDisable = (accountId) => {
    if (confirm('Weet je zeker dat je warm-up wilt uitschakelen voor dit account?')) {
      disableWarmup(accountId);
      loadData();
    }
  };

  const handleOverrideLimit = (accountId) => {
    const limit = parseInt(customLimitValue);
    if (limit > 0) {
      updateWarmupSettings(accountId, { customDailyLimit: limit });
      setEditingLimit(null);
      setCustomLimitValue('');
      loadData();
    }
  };

  const handleClearOverride = (accountId) => {
    updateWarmupSettings(accountId, { customDailyLimit: null });
    loadData();
  };

  return (
    <>
      <Head>
        <title>🔥 Warm-up | SKYE Mail Agent</title>
      </Head>

      <div className="container">
        <Navigation dark={true} />

        <header className="page-header">
          <h1>🔥 Email Warm-up</h1>
          <p>Beheer de opwarm-status van je SMTP accounts</p>
        </header>

        {accounts.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <h2>Geen SMTP accounts</h2>
            <p>Voeg eerst SMTP accounts toe om warm-up te configureren</p>
            <Link href="/settings" className="btn btn-primary">
              ⚙️ Ga naar Settings
            </Link>
          </div>
        ) : (
          <div className="accounts-grid">
            {accounts.map(account => {
              const summary = warmupData[account.id] || {};
              const isEditing = editingLimit === account.id;

              return (
                <div key={account.id} className="account-card">
                  <div className="account-header">
                    <div className="account-info">
                      <h3>{account.name || account.user}</h3>
                      <span className="account-email">{account.user}</span>
                    </div>
                    <span className={`account-badge ${account.active ? 'active' : 'inactive'}`}>
                      {account.active ? '● Actief' : '○ Inactief'}
                    </span>
                  </div>

                  {showWizard === account.id ? (
                    <WarmupWizard
                      onComplete={(settings) => handleSetupComplete(account.id, settings)}
                      onCancel={() => setShowWizard(null)}
                    />
                  ) : (
                    <>
                      <WarmupStatus summary={summary} />

                      {/* Custom Limit Override */}
                      {summary.enabled && !summary.isComplete && (
                        <div className="override-section">
                          {isEditing ? (
                            <div className="override-input">
                              <input
                                type="number"
                                min="1"
                                max="500"
                                value={customLimitValue}
                                onChange={(e) => setCustomLimitValue(e.target.value)}
                                placeholder="Nieuw limiet"
                              />
                              <button onClick={() => handleOverrideLimit(account.id)} className="btn-sm btn-primary">
                                ✓
                              </button>
                              <button onClick={() => setEditingLimit(null)} className="btn-sm btn-secondary">
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingLimit(account.id);
                                setCustomLimitValue(summary.dailyLimit?.toString() || '');
                              }}
                              className="btn-text"
                            >
                              ✏️ Override dagelijks limiet
                            </button>
                          )}
                        </div>
                      )}

                      {/* Controls */}
                      <div className="account-controls">
                        {!summary.enabled ? (
                          <button
                            onClick={() => setShowWizard(account.id)}
                            className="btn btn-primary"
                          >
                            🔥 Warm-up Starten
                          </button>
                        ) : summary.paused ? (
                          <button onClick={() => handleResume(account.id)} className="btn btn-success">
                            ▶️ Hervatten
                          </button>
                        ) : !summary.isComplete ? (
                          <button onClick={() => handlePause(account.id)} className="btn btn-warning">
                            ⏸️ Pauzeren
                          </button>
                        ) : null}

                        {summary.enabled && (
                          <button onClick={() => handleDisable(account.id)} className="btn btn-danger-text">
                            Warm-up Uitschakelen
                          </button>
                        )}
                      </div>

                      {/* Stats */}
                      {summary.enabled && (
                        <div className="account-stats">
                          <div className="stat">
                            <span className="stat-value">{summary.totalSent || 0}</span>
                            <span className="stat-label">Totaal verzonden</span>
                          </div>
                          <div className="stat">
                            <span className="stat-value">{summary.daysRemaining || 0}</span>
                            <span className="stat-label">Dagen resterend</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Info Section */}
        <div className="info-section">
          <h3>💡 Over Email Warm-up</h3>
          <p>
            Email warm-up is het proces van geleidelijk het volume van verzonden emails verhogen
            vanaf een nieuwe email account. Dit helpt om een goede reputatie op te bouwen bij
            email providers zoals Gmail en Outlook, zodat je emails niet in spam belanden.
          </p>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-icon">🐢</span>
              <strong>Voorzichtig</strong>
              <span>8 weken, start met 3/dag</span>
            </div>
            <div className="info-item">
              <span className="info-icon">🚶</span>
              <strong>Standaard</strong>
              <span>4 weken, start met 10/dag</span>
            </div>
            <div className="info-item">
              <span className="info-icon">🏃</span>
              <strong>Agressief</strong>
              <span>2 weken, start met 20/dag</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .page-header {
          margin-bottom: 32px;
          padding: 24px 32px;
          background: rgba(26, 26, 46, 0.6);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
        }

        .page-header h1 {
          margin: 0;
          color: #fff;
          font-size: 28px;
        }

        .page-header p {
          margin: 8px 0 0;
          color: #94a3b8;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: #1a1a2e;
          border-radius: 16px;
        }

        .empty-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 16px;
        }

        .empty-state h2 {
          color: #fff;
          margin: 0 0 8px;
        }

        .empty-state p {
          color: #888;
          margin: 0 0 20px;
        }

        .accounts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }

        .account-card {
          background: #0d0d1a;
          border: 1px solid #2a2a4e;
          border-radius: 16px;
          padding: 20px;
        }

        .account-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .account-info h3 {
          margin: 0;
          color: #fff;
          font-size: 16px;
        }

        .account-email {
          color: #888;
          font-size: 13px;
        }

        .account-badge {
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 12px;
        }

        .account-badge.active {
          background: #14532d;
          color: #22c55e;
        }

        .account-badge.inactive {
          background: #374151;
          color: #9ca3af;
        }

        .override-section {
          margin-top: 12px;
        }

        .override-input {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .override-input input {
          width: 100px;
          padding: 8px 12px;
          border: 1px solid #3a3a5e;
          border-radius: 6px;
          background: #1a1a2e;
          color: #fff;
        }

        .btn-sm {
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }

        .btn-sm.btn-primary {
          background: #00A4E8;
          color: #fff;
        }

        .btn-sm.btn-secondary {
          background: #3a3a5e;
          color: #fff;
        }

        .btn-text {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 13px;
        }

        .btn-text:hover {
          color: #00A4E8;
        }

        .account-controls {
          display: flex;
          gap: 10px;
          margin-top: 16px;
          flex-wrap: wrap;
        }

        .btn {
          padding: 10px 18px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #00A4E8;
          color: #fff;
        }

        .btn-primary:hover {
          background: #0090cc;
        }

        .btn-success {
          background: #22c55e;
          color: #fff;
        }

        .btn-warning {
          background: #f59e0b;
          color: #fff;
        }

        .btn-danger-text {
          background: none;
          color: #888;
        }

        .btn-danger-text:hover {
          color: #ef4444;
        }

        .account-stats {
          display: flex;
          gap: 24px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #2a2a4e;
        }

        .stat {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          color: #00A4E8;
        }

        .stat-label {
          font-size: 12px;
          color: #888;
        }

        .info-section {
          background: #1a1a2e;
          border-radius: 16px;
          padding: 24px;
        }

        .info-section h3 {
          margin: 0 0 12px;
          color: #fff;
        }

        .info-section p {
          color: #aaa;
          line-height: 1.6;
          margin: 0 0 20px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .info-item {
          background: #0d0d1a;
          padding: 16px;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .info-icon {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .info-item strong {
          color: #fff;
          margin-bottom: 4px;
        }

        .info-item span:last-child {
          color: #888;
          font-size: 13px;
        }

        @media (max-width: 768px) {
          .accounts-grid {
            grid-template-columns: 1fr;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background: #0a0a14;
          color: #fff;
          font-family: 'Inter', -apple-system, sans-serif;
        }
      `}</style>
    </>
  );
}
