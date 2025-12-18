import { useState, useEffect } from 'react';
import Head from 'next/head';
import Navigation from '../components/Navigation';

export default function Inbox() {
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [showReplyModal, setShowReplyModal] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [replyFormat, setReplyFormat] = useState('text');
    const [aiLoading, setAiLoading] = useState(false);
    const [sendingReply, setSendingReply] = useState(false);
    const [sortBy, setSortBy] = useState('date'); // 'date', 'status'
    const [filterBy, setFilterBy] = useState('all'); // 'all', 'new', 'reply', 'replied'
    const [repliedEmails, setRepliedEmails] = useState([]);
    const [deletedEmails, setDeletedEmails] = useState([]);

    useEffect(() => {
        loadEmails();
        // Load replied/deleted emails from localStorage
        const savedReplied = localStorage.getItem('repliedEmails');
        if (savedReplied) setRepliedEmails(JSON.parse(savedReplied));
        const savedDeleted = localStorage.getItem('deletedEmails');
        if (savedDeleted) setDeletedEmails(JSON.parse(savedDeleted));
    }, []);

    async function loadEmails() {
        setLoading(true);
        try {
            const res = await fetch('/api/inbox');
            const data = await res.json();
            if (data.success) {
                setEmails(data.emails);
            } else {
                setError(data.error);
            }
        } catch (e) {
            setError(e.message);
        }
        setLoading(false);
    }

    async function selectEmail(email) {
        setSelectedEmail(email);
        setLoadingDetail(true);
        try {
            const res = await fetch(`/api/inbox/${email.id}`);
            const data = await res.json();
            if (data.success && data.email) {
                setSelectedEmail({
                    ...email,
                    body: data.email.html || data.email.text || data.email.body,
                    text: data.email.text,
                    html: data.email.html
                });
            }
        } catch (e) {
            console.error('Error loading email details:', e);
        }
        setLoadingDetail(false);
    }

    async function suggestAiReply() {
        if (!selectedEmail) return;
        setAiLoading(true);
        try {
            const res = await fetch('/api/ai/suggest-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inboundEmail: selectedEmail,
                    originalEmail: selectedEmail.originalEmail,
                    format: replyFormat
                })
            });
            const data = await res.json();
            if (data.success) {
                setReplyContent(data.reply);
            } else {
                alert('AI fout: ' + data.error);
            }
        } catch (e) {
            alert('Fout: ' + e.message);
        }
        setAiLoading(false);
    }

    async function sendReply() {
        if (!selectedEmail || !replyContent.trim()) return;
        setSendingReply(true);
        try {
            const res = await fetch('/api/inbox/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: selectedEmail.from,
                    subject: `Re: ${selectedEmail.subject}`,
                    content: replyContent,
                    format: replyFormat
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('✅ Reply verzonden!');
                // Mark email as replied
                const newReplied = [...repliedEmails, selectedEmail.id];
                setRepliedEmails(newReplied);
                localStorage.setItem('repliedEmails', JSON.stringify(newReplied));
                setShowReplyModal(false);
                setReplyContent('');
                setSelectedEmail(null);
            } else {
                alert('Fout: ' + (data.error || 'Onbekende fout'));
            }
        } catch (e) {
            alert('Fout: ' + e.message);
        }
        setSendingReply(false);
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('nl-NL', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getEmailStatus(email) {
        if (repliedEmails.includes(email.id)) return 'replied';
        if (email.isReply) return 'reply';
        return 'new';
    }

    async function deleteEmail(emailId) {
        if (!confirm('Weet je zeker dat je deze email wilt verwijderen?')) return;
        try {
            await fetch(`/api/inbox/delete?id=${emailId}`, { method: 'DELETE' });
            const newDeleted = [...deletedEmails, emailId];
            setDeletedEmails(newDeleted);
            localStorage.setItem('deletedEmails', JSON.stringify(newDeleted));
            setSelectedEmail(null);
        } catch (e) {
            alert('Fout bij verwijderen: ' + e.message);
        }
    }

    // Filter deleted and apply status filter, then sort
    const filteredEmails = emails
        .filter(e => !deletedEmails.includes(e.id))
        .filter(e => {
            if (filterBy === 'all') return true;
            const status = getEmailStatus(e);
            return status === filterBy;
        });
    const sortedEmails = [...filteredEmails].sort((a, b) => {
        if (sortBy === 'status') {
            const statusOrder = { new: 0, reply: 1, replied: 2 };
            const statusA = getEmailStatus(a);
            const statusB = getEmailStatus(b);
            return statusOrder[statusA] - statusOrder[statusB];
        }
        return new Date(b.created_at) - new Date(a.created_at);
    });

    return (
        <>
            <Head>
                <title>Inbox | SKYE Mail Agent</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            </Head>

            <div className="app">
                <div className="bg-orb orb-1"></div>
                <div className="bg-orb orb-2"></div>

                <header className="header glass-panel">
                    <div className="logo">
                        <span className="logo-icon">📬</span>
                        <span className="logo-text">INBOX</span>
                    </div>
                    <Navigation dark={true} />
                </header>

                <main className="main">
                    <div className="container">
                        <div className="inbox-header">
                            <h1 className="page-title">Ontvangen Emails ({emails.length})</h1>
                            <div className="header-actions">
                                <select
                                    className="filter-select"
                                    value={filterBy}
                                    onChange={(e) => setFilterBy(e.target.value)}
                                >
                                    <option value="all">Alle</option>
                                    <option value="new">📥 Nieuw</option>
                                    <option value="reply">↩️ Reply</option>
                                    <option value="replied">✅ Beantwoord</option>
                                </select>
                                <select
                                    className="sort-select"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                >
                                    <option value="date">Datum ↓</option>
                                    <option value="status">Status</option>
                                </select>
                                <button className="btn btn-secondary" onClick={loadEmails} disabled={loading}>
                                    🔄
                                </button>
                            </div>
                        </div>

                        {loading && (
                            <div className="loading-state">
                                <div className="spinner"></div>
                                <p>Emails laden...</p>
                            </div>
                        )}

                        {error && <div className="error-state"><p>❌ {error}</p></div>}

                        {!loading && !error && emails.length === 0 && (
                            <div className="empty-state"><p>📭 Geen emails gevonden</p></div>
                        )}

                        <div className="email-list">
                            {sortedEmails.map(email => {
                                const status = getEmailStatus(email);
                                return (
                                    <div
                                        key={email.id}
                                        className={`email-item ${selectedEmail?.id === email.id ? 'selected' : ''}`}
                                        onClick={() => selectEmail(email)}
                                    >
                                        <div className="email-badges">
                                            {status === 'replied' && <span className="badge badge-replied">✅ Beantwoord</span>}
                                            {status === 'reply' && <span className="badge badge-reply">↩️ Reply</span>}
                                            {status === 'new' && <span className="badge badge-new">📥 Nieuw</span>}
                                        </div>
                                        <div className="email-from">{email.from}</div>
                                        <div className="email-subject">{email.subject}</div>
                                        <div className="email-date">{formatDate(email.created_at)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </main>

                {/* Email Detail Modal (Popup) */}
                {selectedEmail && (
                    <div className="modal-overlay" onClick={() => setSelectedEmail(null)}>
                        <div className="email-modal glass-panel" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{selectedEmail.subject}</h2>
                                <button className="btn-close" onClick={() => setSelectedEmail(null)}>✕</button>
                            </div>

                            <div className="detail-meta">
                                <div><strong>Van:</strong> {selectedEmail.from}</div>
                                <div><strong>Aan:</strong> {Array.isArray(selectedEmail.to) ? selectedEmail.to.join(', ') : selectedEmail.to}</div>
                                <div><strong>Datum:</strong> {formatDate(selectedEmail.created_at)}</div>
                            </div>

                            {selectedEmail.isReply && selectedEmail.originalEmail && (
                                <div className="thread-section">
                                    <h3 className="thread-title">📤 Onze Originele Email</h3>
                                    <div className="original-email">
                                        <div className="original-subject">
                                            <strong>Onderwerp:</strong> {selectedEmail.originalEmail.subject}
                                        </div>
                                        <div className="original-body" dangerouslySetInnerHTML={{
                                            __html: selectedEmail.originalEmail.body || '<em>(niet beschikbaar)</em>'
                                        }} />
                                    </div>
                                </div>
                            )}

                            <div className="detail-body">
                                <h3>📥 Ontvangen Bericht</h3>
                                <div className="email-content">
                                    {loadingDetail ? (
                                        <div className="loading-body">⏳ Inhoud laden...</div>
                                    ) : selectedEmail.html ? (
                                        <div className="html-content" dangerouslySetInnerHTML={{ __html: selectedEmail.html }} />
                                    ) : (
                                        <div className="text-content">{selectedEmail.body || selectedEmail.text || '(Geen inhoud)'}</div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button className="btn btn-danger" onClick={() => deleteEmail(selectedEmail.id)}>
                                    🗑️ Verwijderen
                                </button>
                                <button className="btn btn-primary" onClick={() => setShowReplyModal(true)}>
                                    ✉️ Beantwoorden
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reply Modal */}
                {showReplyModal && selectedEmail && (
                    <div className="modal-overlay" onClick={() => setShowReplyModal(false)}>
                        <div className="reply-modal glass-panel" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>Beantwoorden</h2>
                                <button className="btn-close" onClick={() => setShowReplyModal(false)}>✕</button>
                            </div>

                            <div className="modal-meta">
                                <p><strong>Aan:</strong> {selectedEmail.from}</p>
                                <p><strong>Onderwerp:</strong> Re: {selectedEmail.subject}</p>
                            </div>

                            <div className="format-toggle">
                                <button
                                    className={`toggle-btn ${replyFormat === 'text' ? 'active' : ''}`}
                                    onClick={() => setReplyFormat('text')}
                                >📝 Tekst</button>
                                <button
                                    className={`toggle-btn ${replyFormat === 'html' ? 'active' : ''}`}
                                    onClick={() => setReplyFormat('html')}
                                >🎨 HTML</button>
                            </div>

                            <textarea
                                className="reply-textarea"
                                value={replyContent}
                                onChange={e => setReplyContent(e.target.value)}
                                placeholder="Typ je antwoord hier..."
                                rows={8}
                            />

                            <div className="modal-actions">
                                <button className="btn btn-ai" onClick={suggestAiReply} disabled={aiLoading}>
                                    {aiLoading ? '🔄 AI denkt...' : '🤖 AI Suggestie'}
                                </button>
                                <button className="btn btn-primary" onClick={sendReply} disabled={sendingReply || !replyContent.trim()}>
                                    {sendingReply ? '📤 Verzenden...' : '📤 Verstuur'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .app {
                    min-height: 100vh;
                    background: #0a0a0f;
                    color: #f0f0f0;
                    position: relative;
                }
                .bg-orb {
                    position: fixed;
                    border-radius: 50%;
                    filter: blur(120px);
                    z-index: 0;
                    opacity: 0.4;
                }
                .orb-1 {
                    top: -150px;
                    left: -150px;
                    width: 500px;
                    height: 500px;
                    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                }
                .orb-2 {
                    bottom: -150px;
                    right: -150px;
                    width: 600px;
                    height: 600px;
                    background: linear-gradient(135deg, #8b5cf6, #ec4899);
                }
                .glass-panel {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 24px;
                    margin: 16px;
                    position: relative;
                    z-index: 10;
                }
                .logo {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .logo-icon { font-size: 24px; }
                .logo-text {
                    font-weight: 700;
                    font-size: 18px;
                    background: linear-gradient(90deg, #60a5fa, #a78bfa);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .main {
                    padding: 0 16px 24px;
                    position: relative;
                    z-index: 1;
                }
                .container {
                    max-width: 900px;
                    margin: 0 auto;
                }
                .inbox-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }
                .page-title {
                    font-size: 22px;
                    font-weight: 700;
                    color: #fff;
                }
                .header-actions {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                .sort-select, .filter-select {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 8px;
                    padding: 8px 12px;
                    color: #fff;
                    font-size: 13px;
                    cursor: pointer;
                }
                .sort-select option {
                    background: #1a1a2e;
                    color: #fff;
                }
                .btn {
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                    font-size: 13px;
                }
                .btn-secondary {
                    background: rgba(255, 255, 255, 0.1);
                    color: #fff;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                .btn-primary {
                    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                    color: #fff;
                }
                .btn-ai {
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: #fff;
                }
                .btn-danger {
                    background: rgba(239, 68, 68, 0.2);
                    color: #f87171;
                    border: 1px solid rgba(239, 68, 68, 0.3);
                }
                .btn-danger:hover {
                    background: rgba(239, 68, 68, 0.3);
                }
                .loading-state, .error-state, .empty-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: #94a3b8;
                }
                .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid rgba(255,255,255,0.1);
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 12px;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                .email-list {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .email-item {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 10px;
                    padding: 12px 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .email-item:hover {
                    background: rgba(255, 255, 255, 0.06);
                    border-color: rgba(255, 255, 255, 0.15);
                }
                .email-item.selected {
                    background: rgba(59, 130, 246, 0.1);
                    border-color: rgba(59, 130, 246, 0.3);
                }
                .email-badges {
                    display: flex;
                    gap: 6px;
                    margin-bottom: 6px;
                }
                .badge {
                    padding: 3px 8px;
                    border-radius: 5px;
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .badge-reply {
                    background: rgba(59, 130, 246, 0.2);
                    color: #60a5fa;
                }
                .badge-new {
                    background: rgba(16, 185, 129, 0.2);
                    color: #34d399;
                }
                .badge-replied {
                    background: rgba(168, 85, 247, 0.2);
                    color: #c084fc;
                }
                .email-from {
                    font-weight: 600;
                    color: #f0f0f0;
                    font-size: 14px;
                    margin-bottom: 2px;
                }
                .email-subject {
                    color: #94a3b8;
                    font-size: 13px;
                    margin-bottom: 2px;
                }
                .email-date {
                    color: #64748b;
                    font-size: 11px;
                }
                /* Modal Overlay */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    padding: 20px;
                }
                /* Email Detail Modal */
                .email-modal {
                    width: 100%;
                    max-width: 700px;
                    max-height: 80vh;
                    overflow-y: auto;
                    padding: 20px;
                    background: rgba(20, 20, 35, 0.98);
                }
                .reply-modal {
                    width: 100%;
                    max-width: 550px;
                    padding: 20px;
                    background: rgba(20, 20, 35, 0.98);
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 12px;
                }
                .modal-header h2 {
                    font-size: 18px;
                    font-weight: 600;
                    color: #fff;
                }
                .btn-close {
                    background: rgba(255, 255, 255, 0.1);
                    border: none;
                    color: #fff;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .detail-meta {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 10px 12px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    font-size: 13px;
                    color: #94a3b8;
                }
                .detail-meta div {
                    margin-bottom: 3px;
                }
                .thread-section {
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 10px;
                    padding: 12px;
                    margin-bottom: 16px;
                }
                .thread-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: #60a5fa;
                    margin-bottom: 10px;
                }
                .original-email {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 10px;
                    border-radius: 6px;
                }
                .original-subject {
                    font-size: 12px;
                    color: #94a3b8;
                    margin-bottom: 6px;
                }
                .original-body {
                    font-size: 12px;
                    color: #cbd5e1;
                    line-height: 1.5;
                    max-height: 150px;
                    overflow-y: auto;
                }
                .detail-body h3 {
                    font-size: 13px;
                    font-weight: 600;
                    color: #34d399;
                    margin-bottom: 10px;
                }
                .email-content {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 14px;
                    border-radius: 8px;
                    font-size: 13px;
                    line-height: 1.6;
                    max-height: 300px;
                    overflow-y: auto;
                }
                .html-content {
                    color: #e2e8f0;
                }
                .html-content * {
                    color: #e2e8f0 !important;
                    background: transparent !important;
                }
                .text-content {
                    white-space: pre-wrap;
                    color: #e2e8f0;
                }
                .loading-body {
                    color: #94a3b8;
                    text-align: center;
                    padding: 20px;
                }
                .modal-actions {
                    margin-top: 16px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .modal-meta {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 10px;
                    border-radius: 8px;
                    margin-bottom: 12px;
                    font-size: 13px;
                    color: #94a3b8;
                }
                .modal-meta p {
                    margin: 2px 0;
                }
                .format-toggle {
                    display: flex;
                    gap: 6px;
                    margin-bottom: 12px;
                }
                .toggle-btn {
                    flex: 1;
                    padding: 8px;
                    border-radius: 6px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.05);
                    color: #94a3b8;
                    cursor: pointer;
                    font-size: 12px;
                }
                .toggle-btn.active {
                    background: rgba(59, 130, 246, 0.2);
                    border-color: rgba(59, 130, 246, 0.4);
                    color: #60a5fa;
                }
                .reply-textarea {
                    width: 100%;
                    background: rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 12px;
                    color: #f0f0f0;
                    font-size: 13px;
                    line-height: 1.5;
                    resize: vertical;
                    font-family: inherit;
                }
                .reply-textarea:focus {
                    outline: none;
                    border-color: rgba(59, 130, 246, 0.5);
                }
            `}</style>
        </>
    );
}
