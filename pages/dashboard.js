import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Navigation from '../components/Navigation';

export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selectedJob, setSelectedJob] = useState(null);

    // Load data
    useEffect(() => {
        loadData();
        // Auto refresh every 10 seconds
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, [filter]);

    const loadData = async () => {
        try {
            // Load stats
            const statsRes = await fetch('/api/jobs?stats=true');
            const statsData = await statsRes.json();
            if (statsData.success) {
                setStats(statsData.stats);
            }

            // Load jobs
            const jobsRes = await fetch(`/api/jobs${filter !== 'all' ? `?status=${filter}` : ''}`);
            const jobsData = await jobsRes.json();
            if (jobsData.success) {
                setJobs(jobsData.jobs || []);
            }
        } catch (e) {
            console.error('Failed to load dashboard data:', e);
        }
        setLoading(false);
    };

    const deleteJob = async (jobId) => {
        if (!confirm('Weet je zeker dat je deze job wilt verwijderen?')) return;

        try {
            await fetch('/api/jobs', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: jobId })
            });
            loadData();
            if (selectedJob?.id === jobId) {
                setSelectedJob(null);
            }
        } catch (e) {
            alert('Verwijderen mislukt: ' + e.message);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('nl-NL', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'pending': return '⏳';
            case 'processing': return '⚙️';
            case 'completed': return '✅';
            case 'failed': return '❌';
            default: return '❓';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return '#f59e0b';
            case 'processing': return '#3b82f6';
            case 'completed': return '#22c55e';
            case 'failed': return '#ef4444';
            default: return '#6b7280';
        }
    };

    return (
        <>
            <Head>
                <title>Dashboard | SKYE Mail Agent</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            </Head>

            <div className="app">
                <Navigation />
                <div className="page-header">
                    <h1>📊 Dashboard</h1>
                    <button onClick={loadData} className="btn btn-secondary">
                        🔄 Ververs
                    </button>
                </div>

                <main className="main">
                    <div className="container">
                        {/* Stats Cards */}
                        {stats && (
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-value">{stats.emailsSent}</div>
                                    <div className="stat-label">Emails Verstuurd</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{stats.today}</div>
                                    <div className="stat-label">Jobs Vandaag</div>
                                </div>
                                <div className="stat-card processing">
                                    <div className="stat-value">{stats.processing}</div>
                                    <div className="stat-label">Actief</div>
                                </div>
                                <div className="stat-card pending">
                                    <div className="stat-value">{stats.pending}</div>
                                    <div className="stat-label">Wachtend</div>
                                </div>
                                <div className="stat-card success">
                                    <div className="stat-value">{stats.completed}</div>
                                    <div className="stat-label">Voltooid</div>
                                </div>
                                <div className="stat-card error">
                                    <div className="stat-value">{stats.failed}</div>
                                    <div className="stat-label">Mislukt</div>
                                </div>
                            </div>
                        )}

                        {/* Filter Tabs */}
                        <div className="filter-tabs">
                            {['all', 'processing', 'pending', 'completed', 'failed'].map(f => (
                                <button
                                    key={f}
                                    className={`filter-tab ${filter === f ? 'active' : ''}`}
                                    onClick={() => setFilter(f)}
                                >
                                    {f === 'all' ? '📋 Alle' :
                                        f === 'processing' ? '⚙️ Actief' :
                                            f === 'pending' ? '⏳ Wachtend' :
                                                f === 'completed' ? '✅ Voltooid' : '❌ Mislukt'}
                                </button>
                            ))}
                        </div>

                        {/* Jobs List & Detail Split View */}
                        <div className="dashboard-split">
                            {/* Jobs List */}
                            <div className="jobs-list">
                                {loading ? (
                                    <div className="loading">Laden...</div>
                                ) : jobs.length === 0 ? (
                                    <div className="empty-state">
                                        <span className="empty-icon">📭</span>
                                        <p>Geen jobs gevonden</p>
                                        <Link href="/batch" className="btn btn-primary">
                                            Start een nieuwe batch
                                        </Link>
                                    </div>
                                ) : (
                                    jobs.map(job => (
                                        <div
                                            key={job.id}
                                            className={`job-card ${selectedJob?.id === job.id ? 'selected' : ''}`}
                                            onClick={() => setSelectedJob(job)}
                                        >
                                            <div className="job-status" style={{ color: getStatusColor(job.status) }}>
                                                {getStatusIcon(job.status)}
                                            </div>
                                            <div className="job-info">
                                                <div className="job-name">{job.name || 'Job ' + job.id.substr(-6)}</div>
                                                <div className="job-meta">
                                                    {formatDate(job.createdAt)} • {job.emailCount || 0} emails
                                                </div>
                                            </div>
                                            {job.results && (
                                                <div className="job-results">
                                                    <span className="result-sent">✅ {job.results.sent}</span>
                                                    {job.results.failed > 0 && (
                                                        <span className="result-failed">❌ {job.results.failed}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Job Detail */}
                            <div className="job-detail">
                                {selectedJob ? (
                                    <>
                                        <div className="detail-header">
                                            <div className="detail-title">
                                                {getStatusIcon(selectedJob.status)} {selectedJob.name || 'Job Details'}
                                            </div>
                                            <button
                                                className="btn btn-danger-text"
                                                onClick={() => deleteJob(selectedJob.id)}
                                            >
                                                🗑️ Verwijderen
                                            </button>
                                        </div>

                                        <div className="detail-grid">
                                            <div className="detail-item">
                                                <span className="detail-label">Status</span>
                                                <span className="detail-value" style={{ color: getStatusColor(selectedJob.status) }}>
                                                    {selectedJob.status}
                                                </span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="detail-label">Aangemaakt</span>
                                                <span className="detail-value">{formatDate(selectedJob.createdAt)}</span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="detail-label">Laatste update</span>
                                                <span className="detail-value">{formatDate(selectedJob.updatedAt)}</span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="detail-label">Emails</span>
                                                <span className="detail-value">{selectedJob.emailCount || 0}</span>
                                            </div>
                                        </div>

                                        {selectedJob.results && (
                                            <div className="results-section">
                                                <h4>Resultaten</h4>
                                                <div className="results-stats">
                                                    <div className="result-stat success">
                                                        <span className="stat-num">{selectedJob.results.sent}</span>
                                                        <span className="stat-label">Verstuurd</span>
                                                    </div>
                                                    <div className="result-stat error">
                                                        <span className="stat-num">{selectedJob.results.failed}</span>
                                                        <span className="stat-label">Mislukt</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {selectedJob.logs && selectedJob.logs.length > 0 && (
                                            <div className="logs-section">
                                                <h4>Logs</h4>
                                                <div className="log-list">
                                                    {selectedJob.logs.slice(-20).map((log, i) => (
                                                        <div key={i} className={`log-entry log-${log.type || 'info'}`}>
                                                            <span className="log-time">
                                                                {new Date(log.timestamp).toLocaleTimeString('nl-NL')}
                                                            </span>
                                                            <span className="log-message">{log.message}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="detail-empty">
                                        <span className="empty-icon">👈</span>
                                        <p>Selecteer een job om details te zien</p>
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

          .logo {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .logo-icon { font-size: 24px; }
          .logo-text { font-weight: 700; font-size: 18px; color: #1e293b; }

          .refresh-btn { margin-left: auto; }

          .main { padding: 24px; }
          .container { max-width: 1400px; margin: 0 auto; }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
          }

          .stat-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            border: 1px solid #e2e8f0;
          }

          .stat-value {
            font-size: 32px;
            font-weight: 700;
            color: #1e293b;
          }

          .stat-label {
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
            text-transform: uppercase;
          }

          .stat-card.processing .stat-value { color: #3b82f6; }
          .stat-card.pending .stat-value { color: #f59e0b; }
          .stat-card.success .stat-value { color: #22c55e; }
          .stat-card.error .stat-value { color: #ef4444; }

          .filter-tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            flex-wrap: wrap;
          }

          .filter-tab {
            padding: 10px 16px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            color: #64748b;
            transition: all 0.2s;
          }

          .filter-tab:hover { background: #f8fafc; }
          .filter-tab.active {
            background: #1e293b;
            color: white;
            border-color: #1e293b;
          }

          .dashboard-split {
            display: grid;
            grid-template-columns: 400px 1fr;
            gap: 24px;
            min-height: 500px;
          }

          .jobs-list {
            background: white;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
          }

          .job-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            border-bottom: 1px solid #f1f5f9;
            cursor: pointer;
            transition: background 0.2s;
          }

          .job-card:hover { background: #f8fafc; }
          .job-card.selected { background: #eff6ff; border-left: 3px solid #3b82f6; }

          .job-status { font-size: 20px; }

          .job-info { flex: 1; }
          .job-name { font-weight: 600; color: #1e293b; }
          .job-meta { font-size: 12px; color: #64748b; margin-top: 2px; }

          .job-results {
            display: flex;
            gap: 8px;
            font-size: 12px;
            font-weight: 500;
          }

          .result-sent { color: #22c55e; }
          .result-failed { color: #ef4444; }

          .job-detail {
            background: white;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            padding: 24px;
            overflow: hidden;
          }

          .detail-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }

          .detail-title {
            font-size: 18px;
            font-weight: 700;
            color: #1e293b;
          }

          .detail-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin-bottom: 24px;
          }

          .detail-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .detail-label {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
          }

          .detail-value {
            font-weight: 600;
            color: #1e293b;
          }

          .results-section, .logs-section {
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
          }

          .results-section h4, .logs-section h4 {
            margin: 0 0 16px 0;
            font-size: 14px;
            color: #64748b;
            text-transform: uppercase;
          }

          .results-stats {
            display: flex;
            gap: 24px;
          }

          .result-stat {
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .result-stat .stat-num {
            font-size: 28px;
            font-weight: 700;
          }

          .result-stat.success .stat-num { color: #22c55e; }
          .result-stat.error .stat-num { color: #ef4444; }

          .log-list {
            background: #0d1117;
            border-radius: 8px;
            padding: 12px;
            max-height: 200px;
            overflow-y: auto;
            font-family: 'JetBrains Mono', monospace;
          }

          .log-entry {
            display: flex;
            gap: 12px;
            padding: 4px 0;
            font-size: 11px;
          }

          .log-time { color: #6e7681; min-width: 60px; }
          .log-message { color: #c9d1d9; }
          .log-success .log-message { color: #3fb950; }
          .log-error .log-message { color: #f85149; }

          .empty-state, .detail-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
            color: #64748b;
          }

          .empty-icon { font-size: 48px; margin-bottom: 12px; }

          .loading {
            padding: 40px;
            text-align: center;
            color: #64748b;
          }

          .btn {
            padding: 10px 16px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            font-size: 13px;
            transition: all 0.2s;
          }

          .btn-secondary {
            background: #f1f5f9;
            color: #1e293b;
          }

          .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
          }

          .btn-danger-text {
            background: none;
            color: #ef4444;
            padding: 8px 12px;
          }

          .btn-danger-text:hover { background: rgba(239, 68, 68, 0.1); }

          @media (max-width: 900px) {
            .dashboard-split {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
            </div>
        </>
    );
}
