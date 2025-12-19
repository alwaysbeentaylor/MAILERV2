import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import Navigation from "../components/Navigation";
import BulkImportModal from "../components/BulkImportModal";
import BulkSettingsModal from "../components/BulkSettingsModal";
import SmtpSettingsModal from "../components/SmtpSettingsModal";

export default function Settings() {
  // Accounts data
  const [accounts, setAccounts] = useState([]);
  const [advices, setAdvices] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Filter & Sort
  const [filter, setFilter] = useState({ status: 'all', provider: 'all', search: '' });
  const [sortBy, setSortBy] = useState('recent');

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Modals
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showBulkSettings, setShowBulkSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  // Testing
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);

  // API Settings (toggles)
  const [apiSettings, setApiSettings] = useState({
    resendEnabled: true,
    mailgunEnabled: true,
    openaiEnabled: true,
    websiteAnalysisEnabled: true,
    dryRunMode: false,
    resendDefaultFrom: 'info@skye-unlimited.be'
  });
  const [apiSettingsLoading, setApiSettingsLoading] = useState(true);

  // Load accounts from API
  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/smtp-accounts');
      const data = await res.json();
      if (data.success) {
        setAccounts(data.accounts);
        loadAdvices(data.accounts);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
    setLoading(false);
  };

  // Load advices for all accounts
  const loadAdvices = async (accs) => {
    try {
      const res = await fetch('/api/smtp-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success && data.accounts) {
        const advMap = {};
        data.accounts.forEach(a => { advMap[a.accountId] = a; });
        setAdvices(advMap);
      }
    } catch (error) {
      console.error('Error loading advices:', error);
    }
  };

  // Load API settings
  const loadApiSettings = async () => {
    setApiSettingsLoading(true);
    try {
      const res = await fetch('/api/api-settings');
      const data = await res.json();
      if (data.success) {
        setApiSettings(data.settings);
      }
    } catch (error) {
      console.error('Error loading API settings:', error);
    }
    setApiSettingsLoading(false);
  };

  // Toggle API setting
  const toggleApiSetting = async (key) => {
    const newValue = !apiSettings[key];
    const newSettings = { ...apiSettings, [key]: newValue };
    setApiSettings(newSettings);

    try {
      await fetch('/api/api-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { [key]: newValue } })
      });
    } catch (error) {
      console.error('Error saving API setting:', error);
      // Revert on error
      setApiSettings(apiSettings);
    }
  };

  useEffect(() => {
    loadAccounts();
    loadApiSettings();
  }, []);

  // Filter accounts
  const filteredAccounts = accounts.filter(acc => {
    // Status filter
    if (filter.status !== 'all') {
      const advice = advices[acc.id];
      if (filter.status === 'cold' && advice?.status !== 'cold') return false;
      if (filter.status === 'warming' && !advice?.status?.startsWith('warming')) return false;
      if (filter.status === 'warm' && advice?.status !== 'warm') return false;
      if (filter.status === 'hot' && advice?.status !== 'hot') return false;
    }
    // Provider filter
    if (filter.provider !== 'all') {
      const advice = advices[acc.id];
      if (advice?.provider?.toLowerCase() !== filter.provider.toLowerCase()) return false;
    }
    // Search filter
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!acc.user?.toLowerCase().includes(search) &&
        !acc.name?.toLowerCase().includes(search) &&
        !acc.host?.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  // Sort accounts
  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.name || a.user).localeCompare(b.name || b.user);
      case 'status':
        const statusOrder = { cold: 0, warming_week1: 1, warming_week2: 2, warming_week3: 3, warm: 4, hot: 5 };
        return (statusOrder[advices[a.id]?.status] || 0) - (statusOrder[advices[b.id]?.status] || 0);
      case 'capacity':
        return (advices[b.id]?.usage?.today || 0) - (advices[a.id]?.usage?.today || 0);
      default: // recent
        return new Date(b.lastUsed || 0) - new Date(a.lastUsed || 0);
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedAccounts.length / perPage);
  const paginatedAccounts = sortedAccounts.slice((page - 1) * perPage, page * perPage);

  // Selection handlers
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedAccounts.map(a => a.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // CRUD handlers
  const handleSave = async (id, formData) => {
    setSaving(true);
    try {
      // If editing and password is empty, keep the old password
      let payload = { id, ...formData };

      // If editing existing account and no new password provided
      if (id && (!formData.pass || formData.pass === '')) {
        const existingAccount = accounts.find(a => a.id === id);
        if (existingAccount) {
          // Don't include pass in update - API should keep existing
          delete payload.pass;
        }
      }

      const res = await fetch('/api/smtp-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        await loadAccounts();
        setShowSettings(false);
        setEditingAccount(null);
      } else {
        alert('Fout: ' + (data.error || 'Onbekende fout'));
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Fout bij opslaan: ' + error.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (confirm('Weet je zeker dat je dit SMTP account wilt verwijderen?')) {
      try {
        const res = await fetch('/api/smtp-accounts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) {
          await loadAccounts();
        }
      } catch (error) {
        alert('Fout bij verwijderen: ' + error.message);
      }
    }
  };

  const handleTest = async (config) => {
    try {
      const res = await fetch('/api/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtpConfig: config, testEmail: config.user })
      });
      const data = await res.json();
      return { success: data.success, message: data.message || data.error };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // Bulk import handler
  const handleBulkImport = async (importedAccounts) => {
    setSaving(true);
    try {
      for (const acc of importedAccounts) {
        await fetch('/api/smtp-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(acc)
        });
      }
      await loadAccounts();
    } catch (error) {
      alert('Fout bij importeren: ' + error.message);
    }
    setSaving(false);
  };

  // Bulk settings handler
  const handleBulkSettings = async (updates) => {
    setSaving(true);
    try {
      for (const id of selectedIds) {
        const account = accounts.find(a => a.id === id);
        if (account) {
          await fetch('/api/smtp-accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...account, ...updates })
          });
        }
      }
      await loadAccounts();
      setSelectedIds([]);
      setSelectAll(false);
    } catch (error) {
      alert('Fout bij bulk update: ' + error.message);
    }
    setSaving(false);
  };

  // Open settings modal
  const openAccountSettings = (account = null) => {
    setEditingAccount(account);
    setShowSettings(true);
  };

  return (
    <>
      <Head>
        <title>SMTP Settings | SKYE Mail Agent</title>
      </Head>

      <div className="container">
        {/* Navigation */}
        <Navigation dark={true} />

        <div className="page-header">
          <h1>⚙️ SMTP Instellingen</h1>
          <p>Beheer je email accounts voor het verzenden van campagnes</p>
        </div>

        {/* Action Buttons */}
        <div className="actions-bar">
          <div className="actions-left">
            <button className="btn btn-primary" onClick={() => openAccountSettings()}>
              ➕ Nieuw Account
            </button>
            <button className="btn btn-secondary" onClick={() => setShowBulkImport(true)}>
              📋 Bulk Import
            </button>
            {selectedIds.length > 0 && (
              <button className="btn btn-secondary" onClick={() => setShowBulkSettings(true)}>
                ⚙️ Bulk Settings ({selectedIds.length})
              </button>
            )}
          </div>
          <div className="actions-right">
            <span className="account-count">
              {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* 🔧 API Toggle Panel */}
        <div className="api-toggle-panel">
          <div className="api-toggle-header">
            <span className="api-toggle-title">🔧 API Instellingen</span>
            <span className="api-toggle-subtitle">Toggle API's aan/uit</span>
          </div>

          <div className="api-toggles">
            {/* Resend Toggle - PRIMARY */}
            <div className="api-toggle-item primary">
              <div className="toggle-info">
                <span className="toggle-icon">🚀</span>
                <div>
                  <div className="toggle-name">Resend API <span className="badge-primary">Primary</span></div>
                  <div className="toggle-desc">Beste deliverability & developer UX</div>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={apiSettings.resendEnabled}
                  onChange={() => toggleApiSetting('resendEnabled')}
                  disabled={apiSettingsLoading}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Mailgun Toggle - FALLBACK */}
            <div className="api-toggle-item">
              <div className="toggle-info">
                <span className="toggle-icon">📧</span>
                <div>
                  <div className="toggle-name">Mailgun API <span className="badge-fallback">Fallback</span></div>
                  <div className="toggle-desc">Backup als Resend faalt</div>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={apiSettings.mailgunEnabled}
                  onChange={() => toggleApiSetting('mailgunEnabled')}
                  disabled={apiSettingsLoading}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* OpenAI Toggle */}
            <div className="api-toggle-item">
              <div className="toggle-info">
                <span className="toggle-icon">🤖</span>
                <div>
                  <div className="toggle-name">OpenAI API</div>
                  <div className="toggle-desc">AI-gegenereerde emails</div>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={apiSettings.openaiEnabled}
                  onChange={() => toggleApiSetting('openaiEnabled')}
                  disabled={apiSettingsLoading}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Website Analysis Toggle */}
            <div className="api-toggle-item">
              <div className="toggle-info">
                <span className="toggle-icon">🔍</span>
                <div>
                  <div className="toggle-name">Website Analyse</div>
                  <div className="toggle-desc">Scraping & personalisatie</div>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={apiSettings.websiteAnalysisEnabled}
                  onChange={() => toggleApiSetting('websiteAnalysisEnabled')}
                  disabled={apiSettingsLoading}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Dry Run Mode Toggle */}
            <div className="api-toggle-item dry-run">
              <div className="toggle-info">
                <span className="toggle-icon">🧪</span>
                <div>
                  <div className="toggle-name">Dry Run Modus</div>
                  <div className="toggle-desc">Test zonder echte emails te versturen</div>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={apiSettings.dryRunMode}
                  onChange={() => toggleApiSetting('dryRunMode')}
                  disabled={apiSettingsLoading}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="resend-config-box">
              <div className="config-header">
                <span className="config-label">📬 Standaard Resend Afzender (From/Reply-To)</span>
                <span className="config-hint">Instellen op een geverifieerd (sub)domein in Resend</span>
              </div>
              <div className="config-input-row">
                <input
                  type="email"
                  value={apiSettings.resendDefaultFrom || 'info@skye-unlimited.be'}
                  onChange={(e) => setApiSettings({ ...apiSettings, resendDefaultFrom: e.target.value })}
                  placeholder="bijv: info@mail.skye-unlimited.be"
                  className="config-input"
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    fetch('/api/api-settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ settings: { resendDefaultFrom: apiSettings.resendDefaultFrom } })
                    }).then(() => alert('Instelling opgeslagen!'));
                  }}
                >
                  Opslaan
                </button>
              </div>
            </div>
          </div>

          {/* Filter & Sort Bar */}
          <div className="filter-bar">
            <div className="filters">
              {/* Status Filter */}
              <select
                value={filter.status}
                onChange={e => { setFilter(f => ({ ...f, status: e.target.value })); setPage(1); }}
              >
                <option value="all">Alle Status</option>
                <option value="cold">❄️ Koud</option>
                <option value="warming">🌡️ Warming</option>
                <option value="warm">🔥 Warm</option>
                <option value="hot">💥 Hot</option>
              </select>

              {/* Provider Filter */}
              <select
                value={filter.provider}
                onChange={e => { setFilter(f => ({ ...f, provider: e.target.value })); setPage(1); }}
              >
                <option value="all">Alle Providers</option>
                <option value="gmail">Gmail</option>
                <option value="outlook/365">Outlook</option>
                <option value="sendgrid">SendGrid</option>
                <option value="custom">Custom</option>
              </select>

              {/* Search */}
              <input
                type="text"
                placeholder="🔍 Zoeken..."
                value={filter.search}
                onChange={e => { setFilter(f => ({ ...f, search: e.target.value })); setPage(1); }}
                className="search-input"
              />
            </div>

            <div className="sort-pagination">
              {/* Sort */}
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="recent">Recent</option>
                <option value="name">Naam A-Z</option>
                <option value="status">Status</option>
                <option value="capacity">Capaciteit</option>
              </select>

              {/* Per Page */}
              <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>

          {/* Accounts Table */}
          <div className="accounts-table">
            {/* Header */}
            <div className="table-header">
              <div className="col-check">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                />
              </div>
              <div className="col-account">Account</div>
              <div className="col-status">Status</div>
              <div className="col-usage">Gebruik</div>
              <div className="col-actions">Acties</div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="loading-state">
                ⏳ Accounts laden...
              </div>
            )}

            {/* Empty State */}
            {!loading && accounts.length === 0 && (
              <div className="empty-state">
                <p>🔌 Nog geen SMTP accounts geconfigureerd</p>
                <p>Klik op "Nieuw Account" of "Bulk Import" om te beginnen</p>
              </div>
            )}

            {/* No Results */}
            {!loading && accounts.length > 0 && paginatedAccounts.length === 0 && (
              <div className="empty-state">
                <p>🔍 Geen accounts gevonden met deze filters</p>
              </div>
            )}

            {/* Account Rows */}
            {paginatedAccounts.map(account => {
              const advice = advices[account.id] || {};
              return (
                <div
                  key={account.id}
                  className={`table-row ${account.active ? '' : 'inactive'} ${selectedIds.includes(account.id) ? 'selected' : ''}`}
                >
                  {/* Checkbox */}
                  <div className="col-check">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(account.id)}
                      onChange={() => handleSelect(account.id)}
                    />
                  </div>

                  {/* Account Info */}
                  <div className="col-account">
                    <div className="account-email">📧 {account.user}</div>
                    <div className="account-meta">
                      {account.name && <span className="account-name">{account.name}</span>}
                      <span className="account-provider">{advice.provider || 'Custom'}</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-status">
                    <span
                      className="status-badge"
                      style={{
                        background: `${advice.statusColor}20`,
                        borderColor: advice.statusColor,
                        color: advice.statusColor
                      }}
                    >
                      {advice.statusEmoji} {advice.statusLabel || 'Unknown'}
                    </span>
                  </div>

                  {/* Usage */}
                  <div className="col-usage">
                    <span className="usage-text">
                      {advice.usage?.today || 0}/{advice.usage?.dailyLimit || 50}
                    </span>
                    <div className="usage-bar">
                      <div
                        className="usage-fill"
                        style={{
                          width: `${Math.min(100, ((advice.usage?.today || 0) / (advice.usage?.dailyLimit || 50)) * 100)}%`,
                          background: advice.statusColor
                        }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-actions">
                    <button
                      className="btn-icon"
                      title="Instellingen"
                      onClick={() => openAccountSettings(account)}
                    >
                      ⚙️
                    </button>
                    <button
                      className="btn-icon"
                      title="Verwijderen"
                      onClick={() => handleDelete(account.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-sm"
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                ⏮️
              </button>
              <button
                className="btn btn-sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                ◀️
              </button>
              <span className="page-info">
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                ▶️
              </button>
              <button
                className="btn btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
              >
                ⏭️
              </button>
            </div>
          )}
        </div >

        {/* Modals */}
        < BulkImportModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)
          }
          onImport={handleBulkImport}
        />

        <BulkSettingsModal
          isOpen={showBulkSettings}
          onClose={() => setShowBulkSettings(false)}
          selectedCount={selectedIds.length}
          onApply={handleBulkSettings}
        />

        <SmtpSettingsModal
          isOpen={showSettings}
          onClose={() => { setShowSettings(false); setEditingAccount(null); }}
          account={editingAccount}
          advice={editingAccount ? advices[editingAccount.id] : null}
          onSave={handleSave}
          onTest={handleTest}
        />

        <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .page-header {
          margin-bottom: 24px;
          padding: 16px 24px;
          background: rgba(30, 30, 45, 0.5);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .page-header h1 {
          margin: 0 0 8px 0;
          color: #fff;
          font-size: 24px;
        }

        .page-header p {
          margin: 0;
          color: #94a3b8;
        }

        .actions-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .actions-left {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .account-count {
          color: #888;
          font-size: 14px;
        }

        .btn {
          padding: 10px 18px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }

        .btn-primary {
          background: linear-gradient(135deg, #00A4E8, #0078d4);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 164, 232, 0.4);
        }

        .btn-secondary {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }

        .btn-secondary:hover {
          background: rgba(255,255,255,0.15);
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        .filter-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sort-pagination {
          display: flex;
          gap: 8px;
        }

        .filter-bar select,
        .search-input {
          padding: 8px 12px;
          background: #1a1a2e;
          border: 1px solid #2a2a4e;
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
        }

        .search-input {
          width: 180px;
        }

        .accounts-table {
          background: #1a1a2e;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #2a2a4e;
        }

        .table-header {
          display: grid;
          grid-template-columns: 40px 1fr 120px 120px 80px;
          padding: 12px 16px;
          background: #0d0d1a;
          border-bottom: 1px solid #2a2a4e;
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .table-row {
          display: grid;
          grid-template-columns: 40px 1fr 120px 120px 80px;
          padding: 12px 16px;
          border-bottom: 1px solid #2a2a4e;
          align-items: center;
          transition: background 0.2s;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .table-row:hover {
          background: rgba(255,255,255,0.02);
        }

        .table-row.selected {
          background: rgba(0, 164, 232, 0.1);
        }

        .table-row.inactive {
          opacity: 0.5;
        }

        .col-check input {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .account-email {
          font-size: 14px;
          color: #fff;
          margin-bottom: 2px;
        }

        .account-meta {
          display: flex;
          gap: 8px;
          font-size: 12px;
          color: #888;
        }

        .account-name {
          color: #aaa;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          border: 1px solid;
        }

        .usage-text {
          font-size: 13px;
          color: #fff;
          margin-bottom: 4px;
          display: block;
        }

        .usage-bar {
          height: 4px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
          overflow: hidden;
        }

        .usage-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s;
        }

        .col-actions {
          display: flex;
          gap: 4px;
        }

        .btn-icon {
          padding: 6px 8px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .btn-icon:hover {
          opacity: 1;
        }

        .loading-state,
        .empty-state {
          padding: 60px 20px;
          text-align: center;
          color: #888;
        }

        .empty-state p:first-child {
          font-size: 18px;
          margin-bottom: 8px;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
        }

        .page-info {
          color: #888;
          font-size: 14px;
          padding: 0 12px;
        }

        /* API Toggle Panel */
        .api-toggle-panel {
          background: rgba(30, 30, 45, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
        }

        .api-toggle-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .api-toggle-title {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
        }

        .api-toggle-subtitle {
          font-size: 13px;
          color: #888;
        }

        .resend-config-box {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .config-header {
          margin-bottom: 12px;
        }

        .config-label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }

        .config-hint {
          display: block;
          font-size: 12px;
          color: #888;
        }

        .config-input-row {
          display: flex;
          gap: 12px;
        }

        .config-input {
          flex: 1;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
        }

        .config-input:focus {
          border-color: #6366f1;
          outline: none;
        }

        .api-toggles {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 12px;
        }

        .api-toggle-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          transition: all 0.2s;
        }

        .api-toggle-item:hover {
          border-color: rgba(255, 255, 255, 0.15);
          background: rgba(0, 0, 0, 0.3);
        }

        .api-toggle-item.dry-run {
          border-color: rgba(251, 191, 36, 0.3);
          background: rgba(251, 191, 36, 0.05);
        }

        .toggle-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .toggle-icon {
          font-size: 24px;
        }

        .toggle-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 2px;
        }

        .toggle-desc {
          font-size: 12px;
          color: #888;
        }

        /* Toggle Switch Styling */
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 26px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #3a3a5a;
          transition: 0.3s;
          border-radius: 26px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        .toggle-switch input:checked + .toggle-slider {
          background: linear-gradient(135deg, #10b981, #06b6d4);
        }

        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }

        .toggle-switch input:disabled + .toggle-slider {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .api-toggle-item.dry-run .toggle-switch input:checked + .toggle-slider {
          background: linear-gradient(135deg, #f59e0b, #fbbf24);
        }

        /* Primary toggle styling (Resend) */
        .api-toggle-item.primary {
          border-color: rgba(99, 102, 241, 0.4);
          background: rgba(99, 102, 241, 0.08);
        }

        .api-toggle-item.primary .toggle-switch input:checked + .toggle-slider {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
        }

        /* Badges */
        .badge-primary {
          display: inline-block;
          padding: 2px 8px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          font-size: 10px;
          font-weight: 700;
          border-radius: 12px;
          margin-left: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .badge-fallback {
          display: inline-block;
          padding: 2px 8px;
          background: rgba(148, 163, 184, 0.2);
          color: #94a3b8;
          font-size: 10px;
          font-weight: 600;
          border-radius: 12px;
          margin-left: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
      </div>
    </>
  );
}
