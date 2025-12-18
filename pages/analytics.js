import { useState, useEffect } from 'react';
import Head from 'next/head';
import Navigation from '../components/Navigation';

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [emails, setEmails] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ niches: [], tones: [] });
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [scanning, setScanning] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    niche: '',
    emailTone: '',
    status: '',
    hasReply: '',
    fromDate: '',
    toDate: ''
  });

  // Sorting
  const [sortBy, setSortBy] = useState('sent_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Initial load
  useEffect(() => {
    loadStats();
    loadEmails();
    loadFollowUps();
  }, []);

  // Reload emails when filters or sorting change
  useEffect(() => {
    loadEmails();
  }, [filters, sortBy, sortOrder]);

  async function loadStats() {
    try {
      const res = await fetch('/api/analytics-data?action=stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setSettings(data.settings);
        setFilterOptions(data.filterOptions);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
    setLoading(false);
  }

  async function loadEmails() {
    try {
      const params = new URLSearchParams({ action: 'emails' });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      // Add sorting parameters
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const res = await fetch(`/api/analytics-data?${params}`);
      const data = await res.json();
      if (data.success) {
        setEmails(data.emails);
      }
    } catch (error) {
      console.error('Failed to load emails:', error);
    }
  }

  async function loadFollowUps() {
    try {
      const res = await fetch('/api/analytics-data?action=follow-ups');
      const data = await res.json();
      if (data.success) {
        setFollowUps(data.emails);
      }
    } catch (error) {
      console.error('Failed to load follow-ups:', error);
    }
  }

  async function scanReplies() {
    setScanning(true);
    try {
      const res = await fetch('/api/scan-replies');
      const data = await res.json();

      if (data.success) {
        alert(`Scan compleet! ${data.newReplies} nieuwe replies gevonden.`);
        loadStats();
        loadEmails();
        loadFollowUps();
      } else if (data.needsReauth) {
        alert('Gmail authenticatie nodig. Voer node get-gmail-refresh-token.js uit.');
      } else {
        alert('Scan mislukt: ' + (data.details || data.error));
      }
    } catch (error) {
      alert('Scan mislukt: ' + error.message);
    }
    setScanning(false);
  }

  async function updateSetting(key, value) {
    try {
      await fetch('/api/analytics-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-setting', key, value })
      });
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      console.error('Failed to update setting:', error);
    }
  }

  async function markFollowUpDone(emailId) {
    try {
      await fetch('/api/analytics-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-follow-up-done', emailId })
      });
      loadFollowUps();
      loadStats();
    } catch (error) {
      console.error('Failed to mark follow-up done:', error);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function daysSince(dateStr) {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    const now = new Date();
    return Math.floor((now - date) / (1000 * 60 * 60 * 24));
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Analytics laden...</p>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
            color: #fff;
          }
          .spinner {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(255,255,255,0.1);
            border-top-color: #00A4E8;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Email Analytics | SKYE</title>
        <meta name="description" content="Email marketing analytics dashboard" />
      </Head>

      <div className="dashboard">
        {/* Header */}
        <Navigation dark={true} />

        {/* Page Header */}
        <div className="page-header">
          <div className="logo">
            <span className="logo-text">SKYE</span>
            <span className="logo-dot"></span>
            <span className="logo-sub">Analytics</span>
          </div>
          <div className="header-actions">
            <button
              className={`scan-btn ${scanning ? 'scanning' : ''}`}
              onClick={scanReplies}
              disabled={scanning}
            >
              {scanning ? '🔄 Scannen...' : '📬 Scan Replies'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="tabs">
          <button
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overzicht
          </button>
          <button
            className={activeTab === 'emails' ? 'active' : ''}
            onClick={() => setActiveTab('emails')}
          >
            📧 Alle Emails
          </button>
          <button
            className={activeTab === 'follow-ups' ? 'active' : ''}
            onClick={() => setActiveTab('follow-ups')}
          >
            ⏰ Follow-ups ({followUps.length})
          </button>
          <button
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Instellingen
          </button>
        </nav>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="content">
            {/* Summary Cards */}
            <div className="stats-grid">
              <div className="stat-card primary">
                <div className="stat-icon">📧</div>
                <div className="stat-value">{stats.summary.totalEmails}</div>
                <div className="stat-label">Emails Verstuurd</div>
              </div>
              <div className="stat-card success">
                <div className="stat-icon">👆</div>
                <div className="stat-value">{stats.summary.totalClicks}</div>
                <div className="stat-label">Clicks ({stats.summary.clickRate}%)</div>
              </div>
              <div className="stat-card info">
                <div className="stat-icon">💬</div>
                <div className="stat-value">{stats.summary.totalReplies}</div>
                <div className="stat-label">Replies ({stats.summary.replyRate}%)</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-icon">⏰</div>
                <div className="stat-value">{stats.summary.pendingFollowUps}</div>
                <div className="stat-label">Follow-ups Nodig</div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="charts-row">
              {/* Per Niche */}
              <div className="chart-card">
                <h3>📌 Per Niche</h3>
                <div className="simple-chart">
                  {stats.nicheStats.map((item, i) => (
                    <div key={i} className="chart-row">
                      <span className="chart-label">{item.niche || 'Onbekend'}</span>
                      <div className="chart-bar-container">
                        <div
                          className="chart-bar"
                          style={{ width: `${Math.min((item.total / Math.max(...stats.nicheStats.map(n => n.total))) * 100, 100)}%` }}
                        >
                          <span className="bar-value">{item.total}</span>
                        </div>
                      </div>
                      <span className="chart-meta">
                        {item.clicks || 0} 👆 | {item.replies || 0} 💬
                      </span>
                    </div>
                  ))}
                  {stats.nicheStats.length === 0 && (
                    <p className="no-data">Nog geen data</p>
                  )}
                </div>
              </div>

              {/* Per Tone */}
              <div className="chart-card">
                <h3>🎨 Per Email Stijl</h3>
                <div className="simple-chart">
                  {stats.toneStats.map((item, i) => (
                    <div key={i} className="chart-row">
                      <span className="chart-label">{item.email_tone || 'Onbekend'}</span>
                      <div className="chart-bar-container">
                        <div
                          className="chart-bar tone"
                          style={{ width: `${Math.min((item.total / Math.max(...stats.toneStats.map(t => t.total))) * 100, 100)}%` }}
                        >
                          <span className="bar-value">{item.total}</span>
                        </div>
                      </div>
                      <span className="chart-meta">
                        {item.clicks || 0} 👆 | {item.replies || 0} 💬
                      </span>
                    </div>
                  ))}
                  {stats.toneStats.length === 0 && (
                    <p className="no-data">Nog geen data</p>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="chart-card full-width">
              <h3>📈 Activiteit Afgelopen 7 Dagen</h3>
              <div className="activity-timeline">
                {stats.recentActivity.map((day, i) => (
                  <div key={i} className="activity-day">
                    <div className="day-label">{new Date(day.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' })}</div>
                    <div className="day-stats">
                      <span className="sent">{day.sent} 📧</span>
                      <span className="clicks">{day.clicks || 0} 👆</span>
                      <span className="replies">{day.replies || 0} 💬</span>
                    </div>
                  </div>
                ))}
                {stats.recentActivity.length === 0 && (
                  <p className="no-data">Nog geen activiteit</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Emails Tab */}
        {activeTab === 'emails' && (
          <div className="content">
            {/* Filters */}
            <div className="filters-bar">
              <select
                value={filters.niche}
                onChange={e => setFilters(f => ({ ...f, niche: e.target.value }))}
              >
                <option value="">Alle niches</option>
                {filterOptions.niches.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>

              <select
                value={filters.emailTone}
                onChange={e => setFilters(f => ({ ...f, emailTone: e.target.value }))}
              >
                <option value="">Alle stijlen</option>
                {filterOptions.tones.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <select
                value={filters.hasReply}
                onChange={e => setFilters(f => ({ ...f, hasReply: e.target.value }))}
              >
                <option value="">Alle statussen</option>
                <option value="true">Met reply</option>
                <option value="false">Zonder reply</option>
              </select>

              <input
                type="date"
                value={filters.fromDate}
                onChange={e => setFilters(f => ({ ...f, fromDate: e.target.value }))}
                placeholder="Van datum"
              />

              <input
                type="date"
                value={filters.toDate}
                onChange={e => setFilters(f => ({ ...f, toDate: e.target.value }))}
                placeholder="Tot datum"
              />

              <button
                className="clear-btn"
                onClick={() => {
                  setFilters({ niche: '', emailTone: '', status: '', hasReply: '', fromDate: '', toDate: '' });
                  setSortBy('sent_at');
                  setSortOrder('desc');
                }}
              >
                ✕ Reset
              </button>

              {/* Sorting controls */}
              <div className="sort-controls">
                <span className="sort-label">Sorteren:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="sort-select"
                >
                  <option value="sent_at">Verzonden</option>
                  <option value="business_name">Bedrijfsnaam</option>
                  <option value="click_count">Clicks</option>
                  <option value="has_reply">Reply</option>
                  <option value="niche">Niche</option>
                </select>
                <button
                  className={`sort-order-btn ${sortOrder}`}
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  title={sortOrder === 'asc' ? 'Oplopend' : 'Aflopend'}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            {/* Email Table */}
            <div className="table-container">
              <table className="emails-table">
                <thead>
                  <tr>
                    <th className={`sortable ${sortBy === 'sent_at' ? 'active' : ''}`} onClick={() => { setSortBy('sent_at'); setSortOrder(sortBy === 'sent_at' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>
                      Verzonden {sortBy === 'sent_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className={`sortable ${sortBy === 'business_name' ? 'active' : ''}`} onClick={() => { setSortBy('business_name'); setSortOrder(sortBy === 'business_name' && sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                      Bedrijf {sortBy === 'business_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Email</th>
                    <th className={`sortable ${sortBy === 'niche' ? 'active' : ''}`} onClick={() => { setSortBy('niche'); setSortOrder(sortBy === 'niche' && sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                      Niche {sortBy === 'niche' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Stijl</th>
                    <th className={`sortable ${sortBy === 'click_count' ? 'active' : ''}`} onClick={() => { setSortBy('click_count'); setSortOrder(sortBy === 'click_count' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>
                      Clicks {sortBy === 'click_count' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className={`sortable ${sortBy === 'has_reply' ? 'active' : ''}`} onClick={() => { setSortBy('has_reply'); setSortOrder(sortBy === 'has_reply' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>
                      Reply {sortBy === 'has_reply' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map(email => (
                    <tr key={email.id} className={email.has_reply ? 'replied' : ''}>
                      <td>{formatDate(email.sent_at)}</td>
                      <td className="business-name">{email.business_name}</td>
                      <td className="email-addr">{email.to_email}</td>
                      <td><span className="badge niche">{email.niche || '-'}</span></td>
                      <td><span className="badge tone">{email.email_tone || '-'}</span></td>
                      <td className="clicks-cell">
                        {email.click_count > 0 ? (
                          <span className="click-count">👆 {email.click_count}</span>
                        ) : '-'}
                      </td>
                      <td>
                        {email.has_reply ? (
                          <span className="reply-yes">✅ Ja</span>
                        ) : (
                          <span className="reply-no">-</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${email.status}`}>
                          {email.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {emails.length === 0 && (
                    <tr>
                      <td colSpan="8" className="no-data">Geen emails gevonden</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Follow-ups Tab */}
        {activeTab === 'follow-ups' && (
          <div className="content">
            <div className="followup-header">
              <h2>⏰ Follow-up Nodig</h2>
              <p>Emails zonder reactie na {settings.follow_up_days || 3} dagen</p>
            </div>

            {followUps.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🎉</span>
                <h3>Alles is bijgewerkt!</h3>
                <p>Er zijn geen follow-ups nodig op dit moment.</p>
              </div>
            ) : (
              <div className="followup-list">
                {followUps.map(email => (
                  <div key={email.id} className="followup-card">
                    <div className="followup-main">
                      <div className="followup-business">{email.business_name}</div>
                      <div className="followup-email">{email.to_email}</div>
                      <div className="followup-meta">
                        <span className="badge">{email.niche || 'Onbekend'}</span>
                        <span className="days-ago">{daysSince(email.sent_at)} dagen geleden</span>
                      </div>
                    </div>
                    <div className="followup-actions">
                      <a
                        href={`mailto:${email.to_email}?subject=Re: ${email.subject || 'Opvolging'}`}
                        className="action-btn email"
                      >
                        📧 Email
                      </a>
                      <button
                        className="action-btn done"
                        onClick={() => markFollowUpDone(email.id)}
                      >
                        ✓ Klaar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="content">
            <div className="settings-card">
              <h2>⚙️ Instellingen</h2>

              <div className="setting-row">
                <div className="setting-info">
                  <label>Follow-up dagen</label>
                  <p>Na hoeveel dagen zonder reactie verschijnt een email in de follow-up lijst?</p>
                </div>
                <div className="setting-control">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.follow_up_days || 3}
                    onChange={e => updateSetting('follow_up_days', e.target.value)}
                  />
                  <span>dagen</span>
                </div>
              </div>

              <div className="setting-row info">
                <div className="setting-info">
                  <label>Gmail Reply Scanner</label>
                  <p>
                    Klik op "Scan Replies" in de header om je Gmail inbox te scannen voor antwoorden.
                    <br />
                    <small>⚠️ Je moet een token met gmail.readonly scope hebben.
                      Run <code>node get-gmail-refresh-token.js</code> als scanning niet werkt.</small>
                  </p>
                </div>
              </div>

              <div className="setting-row info">
                <div className="setting-info">
                  <label>Click Tracking</label>
                  <p>
                    Clicks op CTA knoppen en links worden automatisch getrackt.
                    <br />
                    <small>Zorg dat <code>NEXT_PUBLIC_BASE_URL</code> in .env.local correct is ingesteld voor productie.</small>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          .dashboard {
            min-height: 100vh;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
            color: #fff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }

          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 24px 32px 8px;
            /* background: rgba(0,0,0,0.3); */
            /* border-bottom: 1px solid rgba(255,255,255,0.1); */
          }

          .logo {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .logo-text {
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 0.06em;
          }

          .logo-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #00A4E8;
          }

          .logo-sub {
            font-size: 14px;
            color: #888;
            margin-left: 8px;
          }

          .header-actions {
            display: flex;
            gap: 16px;
            align-items: center;
          }

          .scan-btn {
            background: linear-gradient(135deg, #00A4E8, #0077b6);
            border: none;
            color: #fff;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .scan-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 20px rgba(0,164,232,0.4);
          }

          .scan-btn.scanning {
            opacity: 0.7;
            cursor: wait;
          }

          .back-link {
            color: #888;
            text-decoration: none;
            font-size: 14px;
          }

          .back-link:hover {
            color: #fff;
          }

          .tabs {
            display: flex;
            gap: 4px;
            padding: 16px 32px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }

          .tabs button {
            background: transparent;
            border: none;
            color: #888;
            padding: 12px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
          }

          .tabs button:hover {
            background: rgba(255,255,255,0.05);
            color: #fff;
          }

          .tabs button.active {
            background: rgba(0,164,232,0.2);
            color: #00A4E8;
          }

          .content {
            padding: 32px;
          }

          /* Stats Grid */
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
          }

          .stat-card {
            background: rgba(255,255,255,0.05);
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.1);
          }

          .stat-card.primary { border-color: #00A4E8; }
          .stat-card.success { border-color: #22c55e; }
          .stat-card.info { border-color: #3b82f6; }
          .stat-card.warning { border-color: #f59e0b; }

          .stat-icon {
            font-size: 32px;
            margin-bottom: 12px;
          }

          .stat-value {
            font-size: 36px;
            font-weight: 700;
          }

          .stat-label {
            color: #888;
            margin-top: 8px;
            font-size: 14px;
          }

          /* Charts */
          .charts-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
          }

          .chart-card {
            background: rgba(255,255,255,0.05);
            border-radius: 16px;
            padding: 24px;
            border: 1px solid rgba(255,255,255,0.1);
          }

          .chart-card.full-width {
            grid-column: 1 / -1;
          }

          .chart-card h3 {
            margin: 0 0 20px 0;
            font-size: 16px;
            color: #fff;
          }

          .chart-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          }

          .chart-label {
            width: 100px;
            font-size: 13px;
            color: #aaa;
            text-transform: capitalize;
          }

          .chart-bar-container {
            flex: 1;
            height: 24px;
            background: rgba(255,255,255,0.1);
            border-radius: 4px;
            overflow: hidden;
          }

          .chart-bar {
            height: 100%;
            background: linear-gradient(90deg, #00A4E8, #0077b6);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 8px;
            min-width: 30px;
          }

          .chart-bar.tone {
            background: linear-gradient(90deg, #9333ea, #7c3aed);
          }

          .bar-value {
            font-size: 11px;
            font-weight: 600;
            color: #fff;
          }

          .chart-meta {
            width: 100px;
            font-size: 12px;
            color: #666;
            text-align: right;
          }

          .activity-timeline {
            display: flex;
            gap: 16px;
            overflow-x: auto;
            padding: 8px 0;
          }

          .activity-day {
            flex-shrink: 0;
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 16px 20px;
            text-align: center;
            min-width: 100px;
          }

          .day-label {
            font-size: 12px;
            color: #888;
            margin-bottom: 12px;
          }

          .day-stats {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 13px;
          }

          .day-stats .sent { color: #00A4E8; }
          .day-stats .clicks { color: #22c55e; }
          .day-stats .replies { color: #3b82f6; }

          /* Filters */
          .filters-bar {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
            flex-wrap: wrap;
          }

          .filters-bar select,
          .filters-bar input {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 14px;
          }

          .filters-bar input[type="date"] {
            color-scheme: dark;
          }

          .clear-btn {
            background: transparent;
            border: 1px solid rgba(255,255,255,0.2);
            color: #888;
            padding: 10px 14px;
            border-radius: 8px;
            cursor: pointer;
          }

          .clear-btn:hover {
            border-color: #f87171;
            color: #f87171;
          }

          /* Sort Controls */
          .sort-controls {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: auto;
            background: rgba(0,164,232,0.1);
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid rgba(0,164,232,0.2);
          }

          .sort-label {
            color: #888;
            font-size: 13px;
          }

          .sort-select {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
          }

          .sort-order-btn {
            background: rgba(0,164,232,0.3);
            border: none;
            color: #00A4E8;
            width: 32px;
            height: 32px;
            border-radius: 6px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
          }

          .sort-order-btn:hover {
            background: rgba(0,164,232,0.5);
            transform: scale(1.1);
          }

          /* Table */
          .table-container {
            overflow-x: auto;
          }

          .emails-table {
            width: 100%;
            border-collapse: collapse;
          }

          .emails-table th,
          .emails-table td {
            padding: 14px 16px;
            text-align: left;
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }

          .emails-table th {
            color: #888;
            font-weight: 500;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .emails-table th.sortable {
            cursor: pointer;
            user-select: none;
            transition: all 0.2s;
          }

          .emails-table th.sortable:hover {
            color: #00A4E8;
            background: rgba(0,164,232,0.1);
          }

          .emails-table th.sortable.active {
            color: #00A4E8;
            background: rgba(0,164,232,0.15);
          }

          .emails-table tr.replied {
            background: rgba(34,197,94,0.1);
          }

          .business-name {
            font-weight: 600;
          }

          .email-addr {
            color: #888;
            font-size: 13px;
          }

          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
          }

          .badge.niche {
            background: rgba(0,164,232,0.2);
            color: #00A4E8;
          }

          .badge.tone {
            background: rgba(147,51,234,0.2);
            color: #a855f7;
          }

          .click-count {
            color: #22c55e;
            font-weight: 600;
          }

          .reply-yes {
            color: #22c55e;
          }

          .reply-no {
            color: #666;
          }

          .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            text-transform: capitalize;
          }

          .status-badge.sent {
            background: rgba(59,130,246,0.2);
            color: #3b82f6;
          }

          .status-badge.replied {
            background: rgba(34,197,94,0.2);
            color: #22c55e;
          }

          .no-data {
            text-align: center;
            color: #666;
            padding: 40px !important;
          }

          /* Follow-ups */
          .followup-header {
            margin-bottom: 24px;
          }

          .followup-header h2 {
            margin: 0 0 8px 0;
          }

          .followup-header p {
            color: #888;
            margin: 0;
          }

          .empty-state {
            text-align: center;
            padding: 60px 20px;
          }

          .empty-icon {
            font-size: 64px;
          }

          .empty-state h3 {
            margin: 20px 0 8px 0;
          }

          .empty-state p {
            color: #888;
          }

          .followup-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .followup-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 20px 24px;
            border: 1px solid rgba(255,255,255,0.1);
          }

          .followup-business {
            font-weight: 600;
            font-size: 16px;
          }

          .followup-email {
            color: #888;
            font-size: 14px;
            margin: 4px 0;
          }

          .followup-meta {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-top: 8px;
          }

          .days-ago {
            color: #f59e0b;
            font-size: 13px;
          }

          .followup-actions {
            display: flex;
            gap: 8px;
          }

          .action-btn {
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-block;
          }

          .action-btn.email {
            background: rgba(0,164,232,0.2);
            color: #00A4E8;
          }

          .action-btn.done {
            background: rgba(34,197,94,0.2);
            color: #22c55e;
          }

          .action-btn:hover {
            transform: translateY(-2px);
          }

          /* Settings */
          .settings-card {
            background: rgba(255,255,255,0.05);
            border-radius: 16px;
            padding: 32px;
            border: 1px solid rgba(255,255,255,0.1);
            max-width: 600px;
          }

          .settings-card h2 {
            margin: 0 0 24px 0;
          }

          .setting-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }

          .setting-row.info {
            display: block;
          }

          .setting-info label {
            display: block;
            font-weight: 600;
            margin-bottom: 4px;
          }

          .setting-info p {
            color: #888;
            font-size: 13px;
            margin: 0;
          }

          .setting-info small {
            color: #666;
          }

          .setting-info code {
            background: rgba(0,0,0,0.3);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
          }

          .setting-control {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .setting-control input[type="number"] {
            width: 60px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 14px;
            text-align: center;
          }

          .setting-control span {
            color: #888;
            font-size: 14px;
          }
        `}</style>
      </div>
    </>
  );
}
