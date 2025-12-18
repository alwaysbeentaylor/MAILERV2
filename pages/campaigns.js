import { useState, useEffect, useRef, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Navigation from "../components/Navigation";
import { canSendEmail, incrementDailySent, getWarmupSummary } from "../utils/warmupStore";
import { SES_TURBO_CONFIG, getSpeedProfile } from "../utils/godmode";

export default function Campaigns() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [smtpAccounts, setSmtpAccounts] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentEmailIndex, setCurrentEmailIndex] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('idle'); // idle, connecting, connected, error
  const [logs, setLogs] = useState([]);
  const abortRef = useRef(false);
  const logsEndRef = useRef(null);
  const [viewingEmail, setViewingEmail] = useState(null); // Email data voor modal
  const [showErrorDetails, setShowErrorDetails] = useState({}); // Track which errors are expanded
  const [currentEmailPage, setCurrentEmailPage] = useState(1); // Paginatie voor emails
  const emailsPerPage = 10; // Aantal emails per pagina
  const [speedProfile, setSpeedProfile] = useState('normal'); // SES speed profile: normal, turbo, max, godmode
  const [emailFilter, setEmailFilter] = useState('all'); // Email filter: all, sent, failed, pending

  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState([]);

  // Process emails for display (filter, sort, paginate)
  const processedEmails = useMemo(() => {
    if (!selectedCampaign || !selectedCampaign.emails) return null;

    // Group
    const sent = selectedCampaign.emails.filter(e => e.status === 'sent');
    const failed = selectedCampaign.emails.filter(e => e.status === 'failed');
    const pending = selectedCampaign.emails.filter(e => e.status === 'pending' || e.status === 'sending');

    // Filter
    let filtered = selectedCampaign.emails;
    if (emailFilter === 'sent') filtered = sent;
    else if (emailFilter === 'failed') filtered = failed;
    else if (emailFilter === 'pending') filtered = pending;

    // Sort: sent emails by sentAt (recent first), others keep order
    const sorted = [...filtered].sort((a, b) => {
      if (a.sentAt && b.sentAt) {
        return new Date(b.sentAt) - new Date(a.sentAt);
      }
      if (a.sentAt) return -1;
      if (b.sentAt) return 1;
      return 0;
    });

    // Pagination
    const total = sorted.length;
    const shouldPaginate = total >= 10;
    const totalPages = shouldPaginate ? Math.ceil(total / emailsPerPage) : 1;
    const startIndex = shouldPaginate ? (currentEmailPage - 1) * emailsPerPage : 0;
    const endIndex = shouldPaginate ? startIndex + emailsPerPage : total;
    const displayed = sorted.slice(startIndex, endIndex);

    return {
      sent, failed, pending,
      displayed,
      total,
      totalPages,
      startIndex,
      endIndex,
      shouldPaginate
    };
  }, [selectedCampaign, emailFilter, currentEmailPage, emailsPerPage]);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-select campaign from URL query
  useEffect(() => {
    if (router.query.id && campaigns.length > 0) {
      const campaign = campaigns.find(c => c.id === router.query.id);
      if (campaign && (!selectedCampaign || selectedCampaign.id !== campaign.id)) {
        selectCampaign(campaign);
      }
    }
  }, [router.query.id, campaigns, selectedCampaign?.id]);

  useEffect(() => {
    // Scroll logs to bottom
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 🔄 POLLING: Update status van actieve campagne elke 3 seconden
  useEffect(() => {
    let intervalId;

    const pollStatus = async () => {
      if (!selectedCampaign) return;

      // Alleen pollen als status actief is (running, pending, processing)
      // Of als we net de pagina openen om de laatste status te zien
      if (selectedCampaign.status === 'running' || selectedCampaign.status === 'processing' || selectedCampaign.status === 'pending') {
        try {
          const res = await fetch(`/api/campaigns/status?campaignId=${selectedCampaign.id}`);
          const data = await res.json();

          if (data.success && data.campaign) {
            // Update logs from server if available
            if (data.campaign.logs && data.campaign.logs.length > 0) {
              const serverLogs = data.campaign.logs.map(l => ({
                id: `server-${l.timestamp}-${l.message.substring(0, 10)}`,
                timestamp: new Date(l.timestamp).toLocaleTimeString('nl-NL'),
                message: l.message,
                type: l.type
              }));

              // We kunnen de logs simpelweg vervangen of mergen. 
              // Mergen is lastiger door duplicaten, dus we vervangen ze door de server logs 
              // plus eventuele zeer recente lokale logs als die er zijn.
              setLogs(serverLogs);
            }

            // Update campaign state
            setSelectedCampaign(prev => ({ ...prev, ...data.campaign }));

            // Als campagne klaar is, stop polling en reload list
            if (data.campaign.status === 'completed' || data.campaign.status === 'stopped' || data.campaign.status === 'paused') {
              loadData();
            }
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }
    };

    if (selectedCampaign) {
      // Start polling interval
      intervalId = setInterval(pollStatus, 3000);
      // Directe initiële poll
      pollStatus();
    }

    return () => clearInterval(intervalId);
  }, [selectedCampaign?.id, selectedCampaign?.status]); // Re-run als ID of status verandert

  const loadData = async () => {
    // 1. Load Campaigns from Server API
    try {
      const res = await fetch('/api/campaigns/status?all=true');
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.campaigns);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
      addLog('Fout bij laden campagnes', 'error');
    }

    // 2. Fetch SMTP accounts from API (keep existing logic)
    try {
      const res = await fetch('/api/smtp-accounts?full=true');
      const data = await res.json();
      if (data.success && data.accounts) {
        setSmtpAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Error loading SMTP accounts from API:', error);
    }
  };

  const addLog = (message, type = 'info', errorData = null) => {
    const timestamp = new Date().toLocaleTimeString('nl-NL');
    const logId = Date.now() + Math.random();
    setLogs(prev => [...prev, { id: logId, timestamp, message, type, errorData }]);
  };

  const selectCampaign = async (campaign) => {
    // 1. Optimistisch de basis info zetten (van de lijst)
    setSelectedCampaign(campaign);
    setLogs([]);
    setCurrentEmailPage(1);

    // 2. Volledige data ophalen (met emails array)
    try {
      const res = await fetch(`/api/campaigns/status?campaignId=${campaign.id}`);
      const data = await res.json();
      if (data.success && data.campaign) {
        setSelectedCampaign(data.campaign);

        // Laad logs van server
        if (data.campaign.logs) {
          setLogs(data.campaign.logs.map(l => ({
            id: `server-${l.timestamp}-${l.message.substring(0, 10)}`,
            timestamp: new Date(l.timestamp).toLocaleTimeString('nl-NL'),
            message: l.message,
            type: l.type
          })));
        } else {
          setLogs([]);
        }

        // Zet de huidige email index op de eerste pending email
        if (data.campaign.emails && data.campaign.emails.length > 0) {
          const firstPendingIdx = data.campaign.emails.findIndex(e => e.status === 'pending');
          setCurrentEmailIndex(firstPendingIdx >= 0 ? firstPendingIdx : 0);
        }
      }
    } catch (error) {
      console.error('Error loading full campaign data:', error);
      addLog('Fout bij laden campagne details', 'error');
    }
  };

  // Sync running state from campaign status
  useEffect(() => {
    const status = selectedCampaign?.status;
    const active = status === 'running' || status === 'processing';
    setIsRunning(active);

    // Update connection status
    if (active) setConnectionStatus('connected');
    else if (status === 'paused') setConnectionStatus('idle');
    else if (status === 'stopped' || status === 'completed') setConnectionStatus('idle');
    else setConnectionStatus('idle');
  }, [selectedCampaign?.status]);

  const handleStartCampaign = async () => {
    if (!selectedCampaign) return;

    try {
      setConnectionStatus('connecting');
      addLog('🚀 Verzoek tot starten/hervatten...', 'info');

      const res = await fetch('/api/campaigns/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: selectedCampaign.id })
      });

      const data = await res.json();

      if (data.success) {
        addLog('✅ Campagne gestart op achtergrond', 'success');
        // Force refresh om status update te zien
        const statusRes = await fetch(`/api/campaigns/status?campaignId=${selectedCampaign.id}`);
        const statusData = await statusRes.json();
        if (statusData.success) setSelectedCampaign(statusData.campaign);
      } else {
        addLog(`❌ Kon niet starten: ${data.error}`, 'error');
        setConnectionStatus('error');
      }
    } catch (error) {
      console.error('Start error:', error);
      addLog(`❌ Netwerkfout: ${error.message}`, 'error');
      setConnectionStatus('error');
    }
  };

  const pauseCampaign = async () => {
    if (!selectedCampaign) return;
    addLog('⏸️ Pauzeren...', 'warning');

    try {
      await fetch('/api/campaigns/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: selectedCampaign.id })
      });
      // UI update via polling
    } catch (error) {
      addLog(`❌ Fout bij pauzeren: ${error.message}`, 'error');
    }
  };

  const stopCampaign = async () => {
    if (!selectedCampaign) return;
    if (!confirm('Weet je zeker dat je deze campagne definitief wilt stoppen?')) return;

    addLog('⏹️ Stoppen...', 'warning');
    try {
      await fetch('/api/campaigns/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: selectedCampaign.id })
      });
    } catch (error) {
      addLog(`❌ Fout bij stoppen: ${error.message}`, 'error');
    }
  };

  const retryFailed = async () => {
    if (!selectedCampaign) return;

    addLog('🔄 Mislukte emails resetten...', 'info');
    try {
      const res = await fetch('/api/campaigns/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: selectedCampaign.id })
      });

      const data = await res.json();
      if (data.success) {
        addLog(`✅ ${data.count} emails gereset, klaar om te hervatten`, 'success');
        // Refresh campaign
        const statusRes = await fetch(`/api/campaigns/status?campaignId=${selectedCampaign.id}`);
        const statusData = await statusRes.json();
        if (statusData.success) setSelectedCampaign(statusData.campaign);
      } else {
        addLog(`⚠️ ${data.message || 'Geen emails gereset'}`, 'warning');
      }
    } catch (error) {
      addLog(`❌ Fout bij resetten: ${error.message}`, 'error');
    }
  };

  const handleDeleteCampaign = async (id) => {
    if (confirm('Weet je zeker dat je deze campagne wilt verwijderen?')) {
      try {
        await fetch(`/api/campaigns/delete?campaignId=${id}`, { method: 'DELETE' });

        if (selectedCampaign?.id === id) {
          setSelectedCampaign(null);
        }
        loadData();
      } catch (error) {
        console.error('Delete error', error);
      }
    }
  };

  // Bulk selection handlers
  const toggleCampaignSelection = (id) => {
    setSelectedForDeletion(prev => {
      if (prev.includes(id)) {
        return prev.filter(cid => cid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedForDeletion.length === 0) return;

    if (confirm(`Weet je zeker dat je ${selectedForDeletion.length} campagnes wilt verwijderen?`)) {

      // Parallel delete
      await Promise.all(selectedForDeletion.map(id =>
        fetch(`/api/campaigns/delete?campaignId=${id}`, { method: 'DELETE' })
      ));

      // Clear selection and selected campaign if deleted
      if (selectedCampaign && selectedForDeletion.includes(selectedCampaign.id)) {
        setSelectedCampaign(null);
      }

      setSelectedForDeletion([]);
      setIsSelectionMode(false);
      loadData();
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return '#22c55e';
      case 'paused': return '#f59e0b';
      case 'completed': return '#06b6d4';
      case 'stopped': return '#ef4444';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return '⏳ Klaar om te starten';
      case 'running': return '🔄 Actief';
      case 'paused': return '⏸️ Gepauzeerd';
      case 'completed': return '✅ Voltooid';
      case 'stopped': return '⏹️ Gestopt';
      case 'error': return '❌ Fout';
      default: return status;
    }
  };

  const progress = selectedCampaign
    ? Math.round((selectedCampaign.sent / selectedCampaign.total) * 100) || 0
    : 0;

  return (
    <>
      <Head>
        <title>Campagnes | SKYE Mail Agent</title>
      </Head>

      <div className="container">
        {/* Navigation */}
        {/* Navigation */}
        <Navigation dark={true} />

        <div className="layout">
          {/* Sidebar - Campaign List */}
          <aside className="sidebar">
            <div className="sidebar-header">
              <h2>📋 Campagnes</h2>
              {campaigns.length > 0 && (
                <button
                  className="btn-select-mode"
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    setSelectedForDeletion([]);
                  }}
                >
                  {isSelectionMode ? 'Annuleer' : 'Selecteer'}
                </button>
              )}
            </div>

            {isSelectionMode && selectedForDeletion.length > 0 && (
              <button
                className="btn-bulk-delete"
                onClick={handleBulkDelete}
              >
                🗑️ Verwijder ({selectedForDeletion.length})
              </button>
            )}

            {campaigns.length === 0 ? (
              <div className="empty-sidebar">
                <p>Geen campagnes</p>
                <Link href="/batch" className="btn-link">
                  Ga naar Batch →
                </Link>
              </div>
            ) : (
              <div className="campaign-list">
                {campaigns.map(camp => (
                  <div
                    key={camp.id}
                    className={`campaign-item ${selectedCampaign?.id === camp.id ? 'selected' : ''} ${isSelectionMode ? 'selection-mode' : ''}`}
                    onClick={() => {
                      if (isSelectionMode) {
                        toggleCampaignSelection(camp.id);
                      } else {
                        selectCampaign(camp);
                      }
                    }}
                  >
                    {isSelectionMode && (
                      <div className="campaign-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedForDeletion.includes(camp.id)}
                          onChange={() => { }} // Handled by div click
                          style={{ pointerEvents: 'none' }}
                        />
                      </div>
                    )}
                    <div className="campaign-item-content">
                      <div className="campaign-item-header">
                        <span className="campaign-name">{camp.name}</span>
                        {!isSelectionMode && (
                          <button
                            className="delete-btn"
                            onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(camp.id); }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                      <div className="campaign-meta">
                        <span style={{ color: getStatusColor(camp.status) }}>
                          {getStatusLabel(camp.status)}
                        </span>
                        <span>{camp.sent}/{camp.total}</span>
                      </div>
                      <div className="mini-progress">
                        <div
                          className="mini-progress-bar"
                          style={{ width: `${(camp.sent / camp.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          {/* Main Content */}
          <main className="main-content">
            {!selectedCampaign ? (
              <div className="select-prompt">
                <h2>👈 Selecteer een campagne</h2>
                <p>Of maak een nieuwe campagne via de Batch pagina</p>
              </div>
            ) : (
              <>
                {/* Campaign Header */}
                <div className="campaign-header">
                  <div>
                    <h1>{selectedCampaign.name}</h1>
                    <p className="campaign-date">
                      Aangemaakt: {new Date(selectedCampaign.createdAt).toLocaleString('nl-NL')}
                    </p>
                  </div>
                  <div className="status-badge" style={{ background: getStatusColor(selectedCampaign.status) }}>
                    {getStatusLabel(selectedCampaign.status)}
                  </div>
                </div>

                {/* Progress Panel */}
                <div className="progress-panel">
                  <div className="progress-header">
                    <span className="progress-text">{progress}%</span>
                    <span className="progress-count">{selectedCampaign.sent}/{selectedCampaign.total} emails</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="stats-row">
                    <div className="stat">
                      <span className="stat-value sent">{selectedCampaign.sent}</span>
                      <span className="stat-label">Verzonden</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value failed">{selectedCampaign.failed}</span>
                      <span className="stat-label">Mislukt</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value pending">{selectedCampaign.pending}</span>
                      <span className="stat-label">Wachtend</span>
                    </div>
                  </div>

                  {/* Connection Status */}
                  <div className={`connection-status ${connectionStatus}`}>
                    {connectionStatus === 'idle' && '🔌 Niet verbonden'}
                    {connectionStatus === 'connecting' && '🔄 Verbinden...'}
                    {connectionStatus === 'connected' && '📡 Verbonden'}
                    {connectionStatus === 'error' && '❌ Verbindingsfout'}
                  </div>

                  {/* ⚡ Speed Profile Selector */}
                  <div className="speed-selector">
                    <label>⚡ Verzendsnelheid:</label>
                    <div className="speed-buttons">
                      {Object.entries(SES_TURBO_CONFIG.profiles).map(([key, profile]) => (
                        <button
                          key={key}
                          className={`speed-btn ${speedProfile === key ? 'active' : ''} ${key === 'turbo' || key === 'max' ? 'ses-mode' : ''} ${key === 'godmode' ? 'godmode' : ''}`}
                          onClick={() => setSpeedProfile(key)}
                          disabled={isRunning}
                          title={profile.description}
                        >
                          {profile.name}
                        </button>
                      ))}
                    </div>
                    <span className="speed-description">
                      {getSpeedProfile(speedProfile).description}
                    </span>
                  </div>

                  {/* Controls */}
                  <div className="controls">
                    {!isRunning ? (
                      <button className="btn-start" onClick={handleStartCampaign}>
                        ▶️ {selectedCampaign.status === 'paused' ? 'Hervatten' : 'Starten'}
                      </button>
                    ) : (
                      <button className="btn-pause" onClick={pauseCampaign}>
                        ⏸️ Pauzeren
                      </button>
                    )}
                    <button
                      className="btn-stop"
                      onClick={stopCampaign}
                      disabled={!isRunning}
                    >
                      ⏹️ Stop
                    </button>
                    <button
                      className="btn-retry"
                      onClick={retryFailed}
                      disabled={isRunning || selectedCampaign.failed === 0}
                    >
                      🔄 Retry Mislukte ({selectedCampaign.failed})
                    </button>
                  </div>
                </div>

                {/* Logs */}
                <div className="logs-panel">
                  <div className="logs-header">
                    <h3>📜 Logs</h3>
                    <span className="logs-stats">
                      {logs.length} events |
                      ✅ {logs.filter(l => l.type === 'success').length} |
                      ⚠️ {logs.filter(l => l.type === 'warning').length} |
                      ❌ {logs.filter(l => l.type === 'error').length}
                    </span>
                    {logs.length > 0 && !isRunning && (
                      <button className="logs-clear" onClick={() => setLogs([])}>
                        Wissen
                      </button>
                    )}
                  </div>
                  <div className="logs-container">
                    {logs.length === 0 ? (
                      <p className="logs-empty">Nog geen activiteit...</p>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id} className={`log-entry ${log.type} ${log.errorData ? 'has-error-data' : ''}`}>
                          <span className="log-time">{log.timestamp}</span>
                          <span className="log-message">{log.message}</span>

                          {/* Error expand button */}
                          {log.errorData && (
                            <button
                              className="log-expand-btn"
                              onClick={() => setShowErrorDetails(prev => ({
                                ...prev,
                                [log.id]: !prev[log.id]
                              }))}
                            >
                              {showErrorDetails[log.id] ? '▼ Verberg' : '▶ Details'}
                            </button>
                          )}

                          {/* Expanded error details */}
                          {log.errorData && showErrorDetails[log.id] && (
                            <div className="log-error-details">
                              <div className="error-detail-row">
                                <span className="error-label">Code:</span>
                                <span className="error-value error-code">{log.errorData.code}</span>
                              </div>
                              <div className="error-detail-row">
                                <span className="error-label">Message:</span>
                                <span className="error-value">{log.errorData.message}</span>
                              </div>
                              {log.errorData.suggestion && (
                                <div className="error-detail-row">
                                  <span className="error-label">💡 Suggestie:</span>
                                  <span className="error-value error-suggestion">{log.errorData.suggestion}</span>
                                </div>
                              )}
                              {log.errorData.details && (
                                <div className="error-detail-row">
                                  <span className="error-label">Details:</span>
                                  <span className="error-value">{JSON.stringify(log.errorData.details, null, 2)}</span>
                                </div>
                              )}
                              <div className="error-detail-row">
                                <span className="error-label">Full Error:</span>
                                <pre className="error-json">{JSON.stringify(log.errorData.fullError, null, 2)}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>

                {/* Email List - Grouped by Status */}
                <div className="emails-panel">
                  <h3>📧 Emails ({selectedCampaign.total})</h3>

                  {/* Status Filter Tabs */}
                  {processedEmails && (
                    <>
                      {/* Status Tabs */}
                      <div className="email-status-tabs">
                        <button
                          className={`status-tab ${emailFilter === 'all' ? 'active' : ''}`}
                          onClick={() => { setEmailFilter('all'); setCurrentEmailPage(1); }}
                        >
                          📋 Alle ({selectedCampaign.emails.length})
                        </button>
                        <button
                          className={`status-tab sent ${emailFilter === 'sent' ? 'active' : ''}`}
                          onClick={() => { setEmailFilter('sent'); setCurrentEmailPage(1); }}
                        >
                          ✅ Verzonden ({processedEmails.sent.length})
                        </button>
                        <button
                          className={`status-tab failed ${emailFilter === 'failed' ? 'active' : ''}`}
                          onClick={() => { setEmailFilter('failed'); setCurrentEmailPage(1); }}
                        >
                          ❌ Mislukt ({processedEmails.failed.length})
                        </button>
                        <button
                          className={`status-tab pending ${emailFilter === 'pending' ? 'active' : ''}`}
                          onClick={() => { setEmailFilter('pending'); setCurrentEmailPage(1); }}
                        >
                          ⏳ Wachtend ({processedEmails.pending.length})
                        </button>
                      </div>

                      {processedEmails.shouldPaginate && (
                        <div className="email-pagination-info">
                          <span>
                            Pagina {currentEmailPage} van {processedEmails.totalPages}
                            (Toont {processedEmails.startIndex + 1}-{Math.min(processedEmails.endIndex, processedEmails.total)} van {processedEmails.total})
                          </span>
                        </div>
                      )}

                      <div className="emails-table-container">
                        <table className="emails-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Email</th>
                              <th>Bedrijf</th>
                              <th>Status</th>
                              <th>Via</th>
                              <th>Tijd</th>
                              <th>Acties</th>
                            </tr>
                          </thead>
                          <tbody>
                            {processedEmails.displayed.map((email, displayIdx) => {
                              const originalIdx = selectedCampaign.emails ? selectedCampaign.emails.findIndex(e => e.email === email.email) : -1;
                              return (
                                <tr
                                  key={email.email}
                                  className={`${email.status} ${originalIdx === currentEmailIndex && isRunning ? 'current' : ''}`}
                                >
                                  <td>{originalIdx >= 0 ? originalIdx + 1 : '?'}</td>
                                  <td>{email.email}</td>
                                  <td>{email.businessName || '-'}</td>
                                  <td>
                                    <span className={`email-status ${email.status}`}>
                                      {email.status === 'sent' && '✅'}
                                      {email.status === 'failed' && '❌'}
                                      {email.status === 'sending' && '📤'}
                                      {email.status === 'pending' && '⏳'}
                                      {' '}{email.status}
                                      {email.error && <span className="error-tooltip" title={email.error}>ℹ️</span>}
                                    </span>
                                  </td>
                                  <td>{email.smtpUsed || 'API'}</td>
                                  <td>{email.sentAt ? new Date(email.sentAt).toLocaleTimeString('nl-NL') : '-'}</td>
                                  <td>
                                    {email.status === 'sent' && email.emailContent && (
                                      <button
                                        className="btn-view-email"
                                        onClick={() => setViewingEmail(email)}
                                        title="Bekijk verzonden email"
                                      >
                                        👁️ Bekijk
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {processedEmails.shouldPaginate && processedEmails.totalPages > 1 && (
                        <div className="email-pagination-controls">
                          <button
                            onClick={() => setCurrentEmailPage(prev => Math.max(1, prev - 1))}
                            disabled={currentEmailPage === 1}
                            className="btn-pagination"
                          >
                            ← Vorige
                          </button>
                          <span className="pagination-info">
                            Pagina {currentEmailPage} van {processedEmails.totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentEmailPage(prev => Math.min(processedEmails.totalPages, prev + 1))}
                            disabled={currentEmailPage === processedEmails.totalPages}
                            className="btn-pagination"
                          >
                            Volgende →
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </main>
        </div >
      </div >

      {/* Email View Modal */}
      {
        viewingEmail && viewingEmail.emailContent && (
          <div className="email-modal-overlay" onClick={() => setViewingEmail(null)}>
            <div className="email-modal" onClick={(e) => e.stopPropagation()}>
              <div className="email-modal-header">
                <h2>📧 Verzonden Email</h2>
                <button className="email-modal-close" onClick={() => setViewingEmail(null)}>✕</button>
              </div>

              <div className="email-modal-content">
                <div className="email-meta">
                  <div className="email-meta-row">
                    <strong>Naar:</strong> {viewingEmail.email}
                  </div>
                  <div className="email-meta-row">
                    <strong>Bedrijf:</strong> {viewingEmail.businessName || '-'}
                  </div>
                  <div className="email-meta-row">
                    <strong>Verzonden:</strong> {viewingEmail.sentAt ? new Date(viewingEmail.sentAt).toLocaleString('nl-NL') : '-'}
                  </div>
                  <div className="email-meta-row">
                    <strong>SMTP:</strong> {viewingEmail.smtpUsed || '-'}
                  </div>
                </div>

                <div className="email-subject-box">
                  <strong>Onderwerp:</strong>
                  <div className="email-subject">{viewingEmail.emailContent.subject || '-'}</div>
                </div>

                {viewingEmail.emailContent.sections ? (
                  <div className="email-sections">
                    {viewingEmail.emailContent.sections.intro && (
                      <div className="email-section">
                        <h4>💬 Intro</h4>
                        <div className="email-section-content">{viewingEmail.emailContent.sections.intro}</div>
                      </div>
                    )}

                    {viewingEmail.emailContent.sections.audit && (
                      <div className="email-section">
                        <h4>💡 Audit</h4>
                        <div className="email-section-content">{viewingEmail.emailContent.sections.audit}</div>
                      </div>
                    )}

                    {viewingEmail.emailContent.sections.boosters && (
                      <div className="email-section">
                        <h4>✅ Oplossing</h4>
                        <div className="email-section-content">{viewingEmail.emailContent.sections.boosters}</div>
                      </div>
                    )}

                    {viewingEmail.emailContent.sections.resultaat && (
                      <div className="email-section">
                        <h4>🚀 Resultaat</h4>
                        <div className="email-section-content">{viewingEmail.emailContent.sections.resultaat}</div>
                      </div>
                    )}

                    {viewingEmail.emailContent.sections.cta && (
                      <div className="email-section">
                        <h4>📞 Call to Action</h4>
                        <div className="email-section-content">{viewingEmail.emailContent.sections.cta}</div>
                      </div>
                    )}
                  </div>
                ) : viewingEmail.emailContent.body ? (
                  <div className="email-body">
                    <h4>Email Inhoud</h4>
                    <div className="email-body-content">{viewingEmail.emailContent.body}</div>
                  </div>
                ) : (
                  <div className="email-empty">Geen email content beschikbaar</div>
                )}
              </div>
            </div>
          </div>
        )
      }

      <style jsx>{`
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }



        .layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 24px;
          min-height: calc(100vh - 120px);
        }

        .sidebar {
          background: #1a1a2e;
          border-radius: 12px;
          padding: 20px;
          height: fit-content;
          position: sticky;
          top: 20px;
        }

        .sidebar h2 {
          margin: 0 0 16px 0;
          color: #fff;
          font-size: 18px;
        }

        .empty-sidebar {
          text-align: center;
          color: #888;
          padding: 20px 0;
        }

        .btn-link {
          display: inline-block;
          margin-top: 12px;
          color: #00A4E8;
          text-decoration: none;
        }

        .campaign-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .campaign-item {
          background: #0d0d1a;
          border: 1px solid #2a2a4e;
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .campaign-item:hover { border-color: #00A4E8; }
        .campaign-item.selected { border-color: #00A4E8; background: #1a1a3e; }

        .campaign-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .campaign-name {
          font-weight: 600;
          color: #fff;
          font-size: 14px;
        }

        /* Selection Mode Styles */
        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .sidebar-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .btn-select-mode {
          background: transparent;
          border: 1px solid #3b82f6;
          color: #3b82f6;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-select-mode:hover {
          background: rgba(59, 130, 246, 0.1);
        }

        .btn-bulk-delete {
          width: 100%;
          background: #ef4444;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 12px;
          cursor: pointer;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .campaign-item.selection-mode {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }

        .campaign-checkbox input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .campaign-item-content {
          flex: 1;
        }

        .delete-btn {
          background: none;
          border: none;
          cursor: pointer;
          opacity: 0.5;
          transition: opacity 0.2s;
        }

        .delete-btn:hover { opacity: 1; }

        .campaign-meta {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #888;
          margin-top: 6px;
        }

        .mini-progress {
          height: 3px;
          background: #2a2a4e;
          border-radius: 2px;
          margin-top: 8px;
          overflow: hidden;
        }

        .mini-progress-bar {
          height: 100%;
          background: #00A4E8;
          transition: width 0.3s;
        }

        .main-content {
          min-width: 0;
        }

        .select-prompt {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
          text-align: center;
          color: #888;
        }

        .select-prompt h2 { color: #fff; margin-bottom: 8px; }

        .campaign-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .campaign-header h1 {
          margin: 0;
          color: #fff;
        }

        .campaign-date {
          color: #888;
          font-size: 14px;
          margin-top: 4px;
        }

        .status-badge {
          padding: 8px 16px;
          border-radius: 20px;
          color: #fff;
          font-weight: 600;
          font-size: 14px;
        }

        .progress-panel {
          background: #1a1a2e;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .progress-text {
          font-size: 32px;
          font-weight: 700;
          color: #00A4E8;
        }

        .progress-count {
          color: #888;
          font-size: 16px;
          align-self: flex-end;
        }

        .progress-bar-container {
          height: 12px;
          background: #2a2a4e;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 20px;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #00A4E8, #06b6d4);
          transition: width 0.5s ease;
        }

        .stats-row {
          display: flex;
          gap: 24px;
          margin-bottom: 16px;
        }

        .stat {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 700;
        }

        .stat-value.sent { color: #22c55e; }
        .stat-value.failed { color: #ef4444; }
        .stat-value.pending { color: #f59e0b; }

        .stat-label {
          font-size: 12px;
          color: #888;
        }

        .connection-status {
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
          display: inline-block;
        }

        .connection-status.idle { background: #374151; color: #9ca3af; }
        .connection-status.connecting { background: #1e3a5f; color: #60a5fa; }
        .connection-status.connected { background: #14532d; color: #22c55e; }
        .connection-status.error { background: #450a0a; color: #ef4444; }

        /* ⚡ Speed Selector Styles */
        .speed-selector {
          margin-bottom: 16px;
          padding: 16px;
          background: rgba(0, 164, 232, 0.05);
          border: 1px solid rgba(0, 164, 232, 0.2);
          border-radius: 10px;
        }

        .speed-selector label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 10px;
        }

        .speed-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .speed-btn {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid #374151;
          background: #1f2937;
          color: #9ca3af;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .speed-btn:hover:not(:disabled) {
          border-color: #00A4E8;
          color: #fff;
        }

        .speed-btn.active {
          background: #00A4E8;
          border-color: #00A4E8;
          color: #000;
          font-weight: 600;
        }

        .speed-btn.ses-mode {
          border-color: #06b6d4;
        }

        .speed-btn.ses-mode.active {
          background: linear-gradient(135deg, #00A4E8, #06b6d4);
          border-color: #06b6d4;
        }

        .speed-btn.godmode {
          border-color: #f59e0b;
          color: #f59e0b;
        }

        .speed-btn.godmode.active {
          background: linear-gradient(135deg, #f59e0b, #ef4444);
          border-color: #f59e0b;
          color: #000;
          animation: pulse-godmode 1s infinite;
        }

        @keyframes pulse-godmode {
          0%, 100% { box-shadow: 0 0 5px rgba(245, 158, 11, 0.3); }
          50% { box-shadow: 0 0 15px rgba(245, 158, 11, 0.6); }
        }

        .speed-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .speed-description {
          font-size: 12px;
          color: #9ca3af;
        }

        .controls {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .controls button {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .controls button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-start { background: #22c55e; color: #fff; }
        .btn-start:hover:not(:disabled) { background: #16a34a; }
        
        .btn-pause { background: #f59e0b; color: #fff; }
        .btn-pause:hover { background: #d97706; }
        
        .btn-stop { background: #ef4444; color: #fff; }
        .btn-stop:hover:not(:disabled) { background: #dc2626; }
        
        .btn-retry { background: #3b82f6; color: #fff; }
        .btn-retry:hover:not(:disabled) { background: #2563eb; }

        .logs-panel {
          background: #1a1a2e;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .logs-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .logs-panel h3 {
          margin: 0;
          color: #fff;
        }

        .logs-stats {
          font-size: 12px;
          color: #888;
          margin-left: auto;
        }

        .logs-clear {
          padding: 4px 12px;
          background: rgba(255,255,255,0.1);
          border: 1px solid #2a2a4e;
          border-radius: 6px;
          color: #888;
          font-size: 12px;
          cursor: pointer;
        }

        .logs-clear:hover {
          background: rgba(255,255,255,0.15);
          color: #fff;
        }

        .logs-container {
          background: #0d0d1a;
          border-radius: 8px;
          padding: 12px;
          max-height: 300px;
          overflow-y: auto;
          font-family: monospace;
          font-size: 13px;
        }

        .logs-empty {
          color: #666;
          margin: 0;
        }

        .log-entry {
          display: flex;
          gap: 12px;
          padding: 6px 0;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .log-time {
          color: #666;
          flex-shrink: 0;
          min-width: 65px;
        }

        .log-message {
          flex: 1;
        }

        .log-entry.success .log-message { color: #22c55e; }
        .log-entry.error .log-message { color: #ef4444; }
        .log-entry.warning .log-message { color: #f59e0b; }
        .log-entry.info .log-message { color: #ccc; }

        .log-entry.warning {
          background: rgba(245, 158, 11, 0.1);
          border-left: 3px solid #f59e0b;
          padding-left: 12px;
          margin-left: -12px;
          margin-right: -12px;
          padding-right: 12px;
        }

        .log-entry.has-error-data {
          cursor: pointer;
        }

        .log-expand-btn {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid #ef4444;
          border-radius: 4px;
          color: #ef4444;
          font-size: 10px;
          padding: 2px 8px;
          cursor: pointer;
          font-family: inherit;
          flex-shrink: 0;
        }

        .log-entry.warning .log-expand-btn {
          background: rgba(245, 158, 11, 0.2);
          border-color: #f59e0b;
          color: #f59e0b;
        }

        .log-expand-btn:hover {
          background: rgba(239, 68, 68, 0.3);
        }

        .log-error-details {
          width: 100%;
          margin-top: 8px;
          padding: 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 6px;
          font-size: 11px;
        }

        .log-entry.warning .log-error-details {
          background: rgba(245, 158, 11, 0.1);
          border-color: rgba(245, 158, 11, 0.3);
        }

        .error-detail-row {
          display: flex;
          gap: 8px;
          margin-bottom: 6px;
          align-items: flex-start;
        }

        .error-detail-row:last-child {
          margin-bottom: 0;
        }

        .error-label {
          color: #888;
          min-width: 80px;
          flex-shrink: 0;
        }

        .error-value {
          color: #ccc;
          word-break: break-word;
        }

        .error-code {
          background: #ef4444;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }

        .log-entry.warning .error-code {
          background: #f59e0b;
        }

        .error-suggestion {
          color: #22c55e;
          font-style: italic;
        }

        .error-json {
          background: #050510;
          padding: 8px;
          border-radius: 4px;
          overflow-x: auto;
          margin: 0;
          color: #888;
          font-size: 10px;
          max-height: 150px;
          overflow-y: auto;
        }

        .emails-panel {
          background: #1a1a2e;
          border-radius: 12px;
          padding: 20px;
        }

        .emails-panel h3 {
          margin: 0 0 12px 0;
          color: #fff;
        }

        .emails-table-container {
          overflow-x: auto;
        }

        .emails-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .emails-table th,
        .emails-table td {
          text-align: left;
          padding: 10px;
          border-bottom: 1px solid #2a2a4e;
        }

        .emails-table th {
          color: #888;
          font-weight: 500;
          font-size: 12px;
          text-transform: uppercase;
        }

        .emails-table td {
          color: #ccc;
        }

        .emails-table tr.current {
          background: rgba(0, 164, 232, 0.1);
        }

        .emails-table tr.sent td { color: #22c55e; }
        .emails-table tr.failed td { color: #ef4444; }

        .email-status {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .error-tooltip {
          cursor: help;
        }

        .btn-view-email {
          background: #3b82f6;
          color: #fff;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .btn-view-email:hover {
          background: #2563eb;
        }

        .email-pagination-info {
          margin-bottom: 12px;
          padding: 8px 12px;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 6px;
          color: #93c5fd;
          font-size: 13px;
        }

        .email-pagination-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #2a2a4e;
        }

        .btn-pagination {
          background: #3b82f6;
          color: #fff;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .btn-pagination:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-pagination:disabled {
          background: #374151;
          color: #6b7280;
          cursor: not-allowed;
        }

        .pagination-info {
          color: #ccc;
          font-size: 13px;
        }

        /* Email Status Tabs */
        .email-status-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .status-tab {
          padding: 8px 16px;
          border: 1px solid #334155;
          border-radius: 20px;
          background: transparent;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .status-tab:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: #475569;
        }

        .status-tab.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: #fff;
        }

        .status-tab.sent.active {
          background: #22c55e;
          border-color: #22c55e;
        }

        .status-tab.failed.active {
          background: #ef4444;
          border-color: #ef4444;
        }

        .status-tab.pending.active {
          background: #f59e0b;
          border-color: #f59e0b;
        }

        /* Email Modal */
        .email-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .email-modal {
          background: #1a1a2e;
          border-radius: 12px;
          max-width: 800px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .email-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #2a2a4e;
        }

        .email-modal-header h2 {
          margin: 0;
          color: #fff;
          font-size: 20px;
        }

        .email-modal-close {
          background: none;
          border: none;
          color: #888;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .email-modal-close:hover {
          background: #2a2a4e;
          color: #fff;
        }

        .email-modal-content {
          padding: 24px;
        }

        .email-meta {
          background: #0d0d1a;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .email-meta-row {
          color: #ccc;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .email-meta-row:last-child {
          margin-bottom: 0;
        }

        .email-meta-row strong {
          color: #888;
          margin-right: 8px;
        }

        .email-subject-box {
          background: #0d0d1a;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .email-subject-box strong {
          color: #888;
          font-size: 12px;
          text-transform: uppercase;
          display: block;
          margin-bottom: 8px;
        }

        .email-subject {
          color: #fff;
          font-size: 18px;
          font-weight: 600;
        }

        .email-sections {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .email-section {
          background: #0d0d1a;
          border-radius: 8px;
          padding: 16px;
        }

        .email-section h4 {
          margin: 0 0 12px 0;
          color: #00A4E8;
          font-size: 14px;
          font-weight: 600;
        }

        .email-section-content {
          color: #ccc;
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .email-body {
          background: #0d0d1a;
          border-radius: 8px;
          padding: 16px;
        }

        .email-body h4 {
          margin: 0 0 12px 0;
          color: #00A4E8;
          font-size: 14px;
          font-weight: 600;
        }

        .email-body-content {
          color: #ccc;
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .email-empty {
          color: #888;
          text-align: center;
          padding: 40px;
          font-style: italic;
        }

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }
          
          .sidebar {
            position: static;
          }
        }
      `}</style>
    </>
  );
}
