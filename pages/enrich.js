import { useState, useRef, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import Navigation from "../components/Navigation";

const ENRICHER_RESULTS_KEY = 'skyeEnricherResults';

export default function EnrichPage() {
    const [emails, setEmails] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [paused, setPaused] = useState(false);
    const pausedRef = useRef(false); // Ref voor async loop check
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState([]);
    const fileInputRef = useRef(null);
    const [showTextInput, setShowTextInput] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [inputMode, setInputMode] = useState('email'); // 'email' of 'domain'
    
    // New state for medium priority features
    const [concurrency, setConcurrency] = useState(5); // Concurrency slider (1-10)
    const [startTime, setStartTime] = useState(null);
    const [avgTimePerItem, setAvgTimePerItem] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, success, failed, pending, no_email

    // Load saved results on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(ENRICHER_RESULTS_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                setResults(parsed.results || []);
                setEmails(parsed.emails || []);
            }
        } catch (e) {
            console.error('Error loading enricher results:', e);
        }
    }, []);

    // Save results when they change
    useEffect(() => {
        if (results.length > 0 || emails.length > 0) {
            try {
                localStorage.setItem(ENRICHER_RESULTS_KEY, JSON.stringify({
                    results,
                    emails,
                    savedAt: new Date().toISOString()
                }));
            } catch (e) {
                console.error('Error saving enricher results:', e);
            }
        }
    }, [results, emails]);

    // Clear saved results
    const clearResults = () => {
        if (confirm('Weet je zeker dat je alle resultaten wilt wissen?')) {
            setEmails([]);
            setResults([]);
            localStorage.removeItem(ENRICHER_RESULTS_KEY);
        }
    };

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    // Filter emails based on search query and status
    const filteredEmails = emails.filter(item => {
        // Status filter
        if (statusFilter !== 'all' && item.status !== statusFilter) return false;
        
        // Search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchEmail = item.email?.toLowerCase().includes(query);
            const matchDomain = item.domain?.toLowerCase().includes(query);
            const matchCompany = item.data?.companyName?.toLowerCase().includes(query);
            return matchEmail || matchDomain || matchCompany;
        }
        return true;
    });

    // Group filtered emails by status
    const groupedByStatus = filteredEmails.reduce((acc, item) => {
        const status = item.status || 'pending';
        if (!acc[status]) {
            acc[status] = [];
        }
        acc[status].push(item);
        return acc;
    }, {});

    // Status order and labels
    const statusOrder = ['success', 'processing', 'pending', 'no_email', 'failed'];
    const statusLabels = {
        success: '✅ Geslaagd',
        processing: '🔄 Bezig',
        pending: '⏳ Wachtend',
        no_email: '⚠️ Geen email',
        failed: '❌ Mislukt'
    };

    // Reset page when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter]);
    
    // Format ETA helper
    const formatETA = (ms) => {
        if (!ms || ms < 0) return 'Berekenen...';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `${hours}u ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    };
    
    // Calculate estimated time remaining
    const estimatedTimeRemaining = avgTimePerItem > 0 && progress.total > 0
        ? (progress.total - progress.current) * avgTimePerItem
        : 0;

    // Detect duplicates helper
    const detectDuplicates = (items) => {
        const seen = new Set();
        const duplicates = [];
        const unique = [];
        
        items.forEach(item => {
            const key = item.email || item.domain;
            if (seen.has(key)) {
                duplicates.push(key);
            } else {
                seen.add(key);
                unique.push(item);
            }
        });
        
        return { unique, duplicates };
    };

    // Extract emails from text (shared logic)
    const extractEmailsFromText = (text) => {
        // Normalize line endings (Windows \r\n, Mac \r, Linux \n)
        const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedText.split('\n').map(l => l.trim()).filter(l => l);

        const extractedEmails = [];

        lines.forEach((line, index) => {
            // Skip header als het 'email' bevat
            if (index === 0 && line.toLowerCase().includes('email') && !line.includes('@')) return;

            // Split op komma, puntkomma, of tab
            const parts = line.split(/[;,\t]/);
            const emailPart = parts.find(p => p.includes('@') && p.includes('.'));

            if (emailPart) {
                extractedEmails.push(emailPart.trim().replace(/^"|"$/g, ''));
            }
        });

        // Filter duplicaten
        return [...new Set(extractedEmails)];
    };

    // 🆕 Extract domains from text
    const extractDomainsFromText = (text) => {
        const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedText.split('\n').map(l => l.trim()).filter(l => l);

        const extractedDomains = [];

        lines.forEach((line, index) => {
            // Skip headers
            if (index === 0 && (line.toLowerCase().includes('domain') || line.toLowerCase().includes('website') || line.toLowerCase().includes('url'))) return;

            // Split op komma, puntkomma, of tab
            const parts = line.split(/[;,\t]/);

            for (const part of parts) {
                let cleaned = part.trim()
                    .replace(/^"|"$/g, '')
                    .replace(/^https?:\/\//, '')
                    .replace(/^www\./, '')
                    .replace(/\/.*$/, '')
                    .toLowerCase();

                // Check of het een geldige domeinnaam is (bevat . en geen @)
                if (cleaned && cleaned.includes('.') && !cleaned.includes('@') && cleaned.length > 3) {
                    // Filter generieke extensies
                    const extensions = ['.com', '.nl', '.be', '.eu', '.net', '.org', '.io', '.co', '.info', '.biz', '.de', '.fr'];
                    const hasValidExtension = extensions.some(ext => cleaned.endsWith(ext));

                    if (hasValidExtension) {
                        extractedDomains.push(cleaned);
                        break; // Neem eerste geldige domein per regel
                    }
                }
            }
        });

        return [...new Set(extractedDomains)];
    };

    // Import CSV - nu met mode awareness + duplicate detection
    const handleCSVImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;

            let items = [];
            if (inputMode === 'domain') {
                const uniqueDomains = extractDomainsFromText(text);
                items = uniqueDomains.map(d => ({ domain: d, status: 'pending' }));
            } else {
                const uniqueEmails = extractEmailsFromText(text);
                items = uniqueEmails.map(e => ({ email: e, status: 'pending' }));
            }

            // Check for duplicates
            const { unique, duplicates } = detectDuplicates(items);
            if (duplicates.length > 0) {
                const proceed = confirm(
                    `${duplicates.length} duplicaten gevonden.\n\n` +
                    `Eerste 5: ${duplicates.slice(0, 5).join(', ')}\n\n` +
                    `Doorgaan met ${unique.length} unieke items?`
                );
                if (!proceed) {
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    return;
                }
            }

            setEmails(unique);
            setResults([]);
            setSearchQuery(''); // Reset filter
            setStatusFilter('all'); // Reset filter
            setShowTextInput(false);
            setPasteText('');

            if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsText(file);
    };

    // Handle text paste submit - nu met mode awareness + duplicate detection
    const handleTextPaste = () => {
        if (!pasteText.trim()) return;

        let items = [];
        if (inputMode === 'domain') {
            const uniqueDomains = extractDomainsFromText(pasteText);

            if (uniqueDomains.length === 0) {
                alert('Geen geldige domeinen gevonden in de tekst.\n\nVoorbeeld input:\nexamplebedrijf.be\nanderbedrijf.nl');
                return;
            }

            items = uniqueDomains.map(d => ({ domain: d, status: 'pending' }));
        } else {
            const uniqueEmails = extractEmailsFromText(pasteText);

            if (uniqueEmails.length === 0) {
                alert('Geen geldige email adressen gevonden in de tekst');
                return;
            }

            items = uniqueEmails.map(e => ({ email: e, status: 'pending' }));
        }

        // Check for duplicates
        const { unique, duplicates } = detectDuplicates(items);
        if (duplicates.length > 0) {
            const proceed = confirm(
                `${duplicates.length} duplicaten gevonden.\n\n` +
                `Eerste 5: ${duplicates.slice(0, 5).join(', ')}\n\n` +
                `Doorgaan met ${unique.length} unieke items?`
            );
            if (!proceed) return;
        }

        setEmails(unique);
        setResults([]);
        setSearchQuery(''); // Reset filter
        setStatusFilter('all'); // Reset filter
        setPasteText('');
        setShowTextInput(false);
    };

    // Process Single Lead - supports both email and domain
    const processLead = async (item) => {
        try {
            const body = item.email
                ? { email: item.email }
                : { domain: item.domain };

            const res = await fetch('/api/enrich-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return await res.json();
        } catch (error) {
            return { success: false, status: 'error', email: item.email, domain: item.domain, message: error.message };
        }
    };

    // Process batch of leads in parallel
    const processBatch = async (items, startIdx) => {
        // Update all items in batch to processing status
        setEmails(prev => prev.map((e, idx) => 
            idx >= startIdx && idx < startIdx + items.length 
                ? { ...e, status: 'processing' } 
                : e
        ));

        // Process all items in batch concurrently
        const batchResults = await Promise.all(
            items.map((item, batchIdx) => processLead(item))
        );

        // Update UI with results
        batchResults.forEach((result, batchIdx) => {
            const actualIdx = startIdx + batchIdx;
            setEmails(prev => prev.map((e, idx) => idx === actualIdx ? {
                ...e,
                status: result.success ? 'success' : (result.status === 'no_email_found' ? 'no_email' : 'failed'),
                email: result.email || e.email,
                data: result.data || null,
                websiteUrl: result.websiteUrl,
                message: result.message
            } : e));
        });

        return batchResults;
    };

    // Start Bulk Processing - Parallel met pause/resume support + timing
    const handleProcessAll = async () => {
        setProcessing(true);
        setPaused(false);
        pausedRef.current = false;
        const total = emails.length;
        setProgress({ current: 0, total });
        setStartTime(Date.now());
        setAvgTimePerItem(0);

        const newResults = [];
        const timingData = [];

        // Process in batches with concurrency limit
        for (let i = 0; i < total; i += concurrency) {
            // Check if paused - wait until resumed
            while (pausedRef.current) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            const batchStartTime = Date.now();
            const batch = emails.slice(i, Math.min(i + concurrency, total));
            const batchResults = await processBatch(batch, i);
            newResults.push(...batchResults);
            
            // Track timing for ETA calculation
            const batchDuration = Date.now() - batchStartTime;
            const avgBatchTime = batchDuration / batch.length;
            timingData.push(avgBatchTime);
            
            // Update average time per item (rolling average)
            const currentAvg = timingData.reduce((a, b) => a + b, 0) / timingData.length;
            setAvgTimePerItem(currentAvg);

            setProgress({ current: Math.min(i + concurrency, total), total });
        }

        setResults(newResults);
        setProcessing(false);
        setPaused(false);
        pausedRef.current = false;
        setStartTime(null);
    };

    // Retry Failed Items - met timing support
    const handleRetryFailed = async () => {
        const failedIndices = emails
            .map((e, idx) => ({ item: e, idx }))
            .filter(({ item }) => item.status === 'failed' || item.status === 'no_email')
            .map(({ idx }) => idx);

        if (failedIndices.length === 0) {
            alert('Geen mislukte items om opnieuw te proberen');
            return;
        }

        setProcessing(true);
        setPaused(false);
        pausedRef.current = false;
        setProgress({ current: 0, total: failedIndices.length });
        setStartTime(Date.now());
        setAvgTimePerItem(0);

        const newResults = [...results];
        const timingData = [];

        // Process failed items in batches
        for (let i = 0; i < failedIndices.length; i += concurrency) {
            // Check if paused
            while (pausedRef.current) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            const batchStartTime = Date.now();
            const batchIndices = failedIndices.slice(i, Math.min(i + concurrency, failedIndices.length));
            const batch = batchIndices.map(idx => emails[idx]);

            // Update to processing
            setEmails(prev => prev.map((e, idx) => 
                batchIndices.includes(idx) ? { ...e, status: 'processing' } : e
            ));

            // Process batch
            const batchResults = await Promise.all(batch.map(item => processLead(item)));
            
            // Track timing
            const batchDuration = Date.now() - batchStartTime;
            const avgBatchTime = batchDuration / batch.length;
            timingData.push(avgBatchTime);
            const currentAvg = timingData.reduce((a, b) => a + b, 0) / timingData.length;
            setAvgTimePerItem(currentAvg);

            // Update results and emails
            batchResults.forEach((result, batchIdx) => {
                const actualIdx = batchIndices[batchIdx];
                const existingResultIdx = newResults.findIndex(r => 
                    (r.email && r.email === emails[actualIdx].email) ||
                    (r.domain && r.domain === emails[actualIdx].domain)
                );

                if (existingResultIdx >= 0) {
                    newResults[existingResultIdx] = result;
                } else {
                    newResults.push(result);
                }

                setEmails(prev => prev.map((e, idx) => idx === actualIdx ? {
                    ...e,
                    status: result.success ? 'success' : (result.status === 'no_email_found' ? 'no_email' : 'failed'),
                    email: result.email || e.email,
                    data: result.data || null,
                    websiteUrl: result.websiteUrl,
                    message: result.message
                } : e));
            });

            setProgress({ current: Math.min(i + concurrency, failedIndices.length), total: failedIndices.length });
        }

        setResults(newResults);
        setProcessing(false);
        setPaused(false);
        pausedRef.current = false;
        setStartTime(null);
    };

    // CSV Export Helper
    const downloadCSV = (data, filename) => {
        // Definieer kolommen - output voor batch import
        const headers = [
            'Email',
            'Bedrijfsnaam',
            'Website',
            'Contactpersoon',
            'Tone'
        ];

        const csvContent = [
            headers.join(','),
            ...data.map(item => {
                const d = item.data || {};
                return [
                    `"${item.email || ''}"`,
                    `"${d.companyName || ''}"`,
                    `"${item.websiteUrl || ''}"`,
                    `"${d.contactPerson || ''}"`,
                    `""` // Tone leeg laten zodat gebruiker zelf kan kiezen
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // Export handlers
    const exportAll = () => downloadCSV(results, 'alle_leads_verrijkt.csv');
    const exportSuccess = () => downloadCSV(results.filter(r => r.success), 'leads_met_email.csv');
    const exportFailed = () => downloadCSV(results.filter(r => !r.success && r.status !== 'no_email_found'), 'leads_zonder_website.csv');
    const exportNoEmail = () => downloadCSV(results.filter(r => r.status === 'no_email_found'), 'leads_geen_email.csv');

    // Group results by knowledge file
    const getResultsByKnowledgeFile = () => {
        const grouped = {};
        results.filter(r => r.success).forEach(item => {
            const kf = item.data?.knowledgeFile || 'overig.md';
            if (!grouped[kf]) grouped[kf] = [];
            grouped[kf].push(item);
        });
        return grouped;
    };

    // Export specific knowledge file
    const exportByKnowledgeFile = (knowledgeFile) => {
        const filtered = results.filter(r => r.success && (r.data?.knowledgeFile || 'overig.md') === knowledgeFile);
        const safeName = knowledgeFile.replace('.md', '').replace(/[^a-z0-9]/gi, '_');
        downloadCSV(filtered, `leads_${safeName}.csv`);
    };

    // Copy to clipboard for specific knowledge file (for batch paste)
    const copyByKnowledgeFile = async (knowledgeFile) => {
        const filtered = results.filter(r => r.success && (r.data?.knowledgeFile || 'overig.md') === knowledgeFile);

        // Format: email,bedrijfsnaam,website,contactpersoon,tone
        const textContent = filtered.map(item => {
            const d = item.data || {};
            return [
                item.email || '',
                d.companyName || '',
                item.websiteUrl || '',
                d.contactPerson || '',
                '' // Tone leeg
            ].join(',');
        }).join('\n');

        try {
            await navigator.clipboard.writeText(textContent);
            alert(`✅ ${filtered.length} leads gekopieerd naar klembord!\n\nPlak direct in Batch Modus.`);
        } catch (err) {
            console.error('Clipboard error:', err);
            alert('❌ Kopiëren mislukt. Probeer opnieuw.');
        }
    };

    const groupedResults = getResultsByKnowledgeFile();
    const knowledgeFiles = Object.keys(groupedResults).sort();

    const stats = {
        total: emails.length,
        processed: results.length,
        success: results.filter(r => r.success).length,
        noWebsite: results.filter(r => r.status === 'website_unreachable' || r.status === 'no_website_generic').length,
        deadDomains: results.filter(r => r.status === 'domain_dead').length,
        noEmailFound: results.filter(r => r.status === 'no_email_found').length // 🆕 Domeinen zonder gevonden email
    };

    return (
        <>
            <Head>
                <title>Lead Verrijker | SKYE Mail Agent</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            </Head>

            <div className="app">
                <div className="bg-gradient"></div>

                <Navigation />
                <div className="page-header">
                    <div className="logo">
                        <span className="logo-icon">🕵️</span>
                        <span className="logo-text">Lead Verrijker</span>
                    </div>
                </div>

                <main className="main">
                    <div className="container">

                        {/* Control Panel */}
                        <div className="card control-panel">
                            <div className="upload-section">
                                <h3>1. Input Type</h3>

                                {/* 🆕 INPUT MODE TOGGLE */}
                                <div className="mode-toggle">
                                    <button
                                        className={`mode-btn ${inputMode === 'email' ? 'active' : ''}`}
                                        onClick={() => { setInputMode('email'); setEmails([]); setResults([]); }}
                                    >
                                        📧 Emails
                                    </button>
                                    <button
                                        className={`mode-btn ${inputMode === 'domain' ? 'active' : ''}`}
                                        onClick={() => { setInputMode('domain'); setEmails([]); setResults([]); }}
                                    >
                                        🌐 Domeinen
                                    </button>
                                </div>

                                <p className="mode-hint">
                                    {inputMode === 'domain'
                                        ? '💡 Bij domeinen zoeken we automatisch emails op de website'
                                        : 'Upload emails om bedrijfsinfo te verrijken'}
                                </p>

                                <div className="input-toggle">
                                    <button
                                        className={`toggle-btn ${!showTextInput ? 'active' : ''}`}
                                        onClick={() => setShowTextInput(false)}
                                    >
                                        📂 Bestand
                                    </button>
                                    <button
                                        className={`toggle-btn ${showTextInput ? 'active' : ''}`}
                                        onClick={() => setShowTextInput(true)}
                                    >
                                        📋 Tekst Plakken
                                    </button>
                                </div>

                                {!showTextInput ? (
                                    <label className="btn btn-secondary file-btn full-width">
                                        📂 Selecteer {inputMode === 'domain' ? 'domein' : 'email'} bestand
                                        <input type="file" accept=".csv,.txt" onChange={handleCSVImport} ref={fileInputRef} hidden />
                                    </label>
                                ) : (
                                    <div className="text-paste-area">
                                        <textarea
                                            value={pasteText}
                                            onChange={(e) => setPasteText(e.target.value)}
                                            placeholder={inputMode === 'domain'
                                                ? "Plak hier je domeinen...\n\nVoorbeeld:\nbedrijf1.be\nbedrijf2.nl\nhttps://www.bedrijf3.com"
                                                : "Plak hier je emails...\n\nVoorbeeld:\ninfo@bedrijf1.be\ncontact@bedrijf2.be\n\nOf CSV formaat:\nemail;naam;website"}
                                            className="paste-textarea"
                                            rows={6}
                                        />
                                        <button
                                            onClick={handleTextPaste}
                                            className="btn btn-primary full-width"
                                            disabled={!pasteText.trim()}
                                        >
                                            ✅ {inputMode === 'domain' ? 'Domeinen' : 'Emails'} Verwerken
                                        </button>
                                    </div>
                                )}

                                {emails.length > 0 && (
                                    <div className="stats-preview">
                                        ✅ {emails.length} {inputMode === 'domain' ? 'domeinen' : 'emails'} gevonden
                                    </div>
                                )}
                            </div>

                            <div className="action-section">
                                <h3>2. Start Verrijking</h3>
                                {!processing && (
                                    <div className="concurrency-control">
                                        <label className="concurrency-label">
                                            Parallel: <span className="concurrency-value">{concurrency}</span>
                                        </label>
                                        <input 
                                            type="range" 
                                            min="1" 
                                            max="10" 
                                            value={concurrency}
                                            onChange={(e) => setConcurrency(Number(e.target.value))}
                                            disabled={processing}
                                            className="concurrency-slider"
                                        />
                                    </div>
                                )}
                                {processing ? (
                                    <div className="processing-controls">
                                        <button
                                            onClick={() => {
                                                const newPaused = !paused;
                                                setPaused(newPaused);
                                                pausedRef.current = newPaused;
                                            }}
                                            className="btn btn-secondary full-width"
                                        >
                                            {paused ? '▶️ Hervat' : '⏸️ Pauzeer'}
                                        </button>
                                        <div className="progress-bar-container">
                                            <div 
                                                className="progress-bar" 
                                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                            />
                                        </div>
                                        <div className="progress-stats">
                                            <span>{progress.current}/{progress.total}</span>
                                            <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                                            {estimatedTimeRemaining > 0 && (
                                                <span>ETA: {formatETA(estimatedTimeRemaining)}</span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleProcessAll}
                                        disabled={emails.length === 0}
                                        className="btn btn-primary full-width"
                                    >
                                        🚀 Start Scrapen
                                    </button>
                                )}
                            </div>

                            <div className="export-section">
                                <h3>3. Download Resultaat</h3>
                                <div className="btn-group">
                                    {(stats.noWebsite > 0 || (results.filter(r => r.status === 'failed' || r.status === 'no_email').length > 0)) && !processing && (
                                        <button onClick={handleRetryFailed} className="btn btn-retry">
                                            🔄 Retry Mislukte Items
                                        </button>
                                    )}
                                    <button onClick={exportSuccess} disabled={stats.success === 0} className="btn btn-success">
                                        ✅ {inputMode === 'domain' ? 'Met Email' : 'Met Website'} ({stats.success})
                                    </button>
                                    {inputMode === 'domain' && stats.noEmailFound > 0 && (
                                        <button onClick={exportNoEmail} className="btn btn-warning">
                                            ⚠️ Geen Email Gevonden ({stats.noEmailFound})
                                        </button>
                                    )}
                                    <button onClick={exportFailed} disabled={stats.noWebsite === 0} className="btn btn-error">
                                        ❌ Website Onbereikbaar ({stats.noWebsite})
                                    </button>
                                    <button onClick={exportAll} disabled={results.length === 0} className="btn btn-outline">
                                        📥 Download Alles
                                    </button>
                                    <button onClick={clearResults} disabled={emails.length === 0 || processing} className="btn btn-danger">
                                        🗑️ Wissen
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Per Knowledge File Export */}
                        {knowledgeFiles.length > 0 && (
                            <div className="card niche-exports">
                                <h3>📁 Per Niche Exporteren</h3>
                                <p className="niche-hint">Kopieer of download leads gegroepeerd per branche</p>
                                <div className="niche-grid">
                                    {knowledgeFiles.map(kf => (
                                        <div key={kf} className="niche-card">
                                            <div className="niche-header">
                                                <span className="niche-name">{kf.replace('.md', '')}</span>
                                                <span className="niche-count">{groupedResults[kf].length} leads</span>
                                            </div>
                                            <div className="niche-actions">
                                                <button
                                                    onClick={() => copyByKnowledgeFile(kf)}
                                                    className="btn btn-copy"
                                                    title="Kopieer voor Batch Modus"
                                                >
                                                    📋 Kopieer
                                                </button>
                                                <button
                                                    onClick={() => exportByKnowledgeFile(kf)}
                                                    className="btn btn-download"
                                                    title="Download als CSV"
                                                >
                                                    💾 CSV
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Filter Bar */}
                        {emails.length > 0 && (
                            <div className="filter-bar">
                                <input 
                                    type="text"
                                    placeholder="Zoek op email, domein, bedrijf..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="filter-search-input"
                                />
                                <select 
                                    value={statusFilter} 
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="filter-status-select"
                                >
                                    <option value="all">Alle statussen</option>
                                    <option value="success">✅ Geslaagd</option>
                                    <option value="failed">❌ Mislukt</option>
                                    <option value="pending">⏳ Wachtend</option>
                                    <option value="no_email">⚠️ Geen email</option>
                                    <option value="processing">🔄 Bezig</option>
                                </select>
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setStatusFilter('all');
                                    }}
                                    className={`btn ${(searchQuery || statusFilter !== 'all') ? 'btn-outline' : 'btn-secondary'} filter-clear`}
                                    disabled={!searchQuery && statusFilter === 'all'}
                                >
                                    ✕ Wissen
                                </button>
                            </div>
                        )}

                        {/* Results Summary */}
                        {filteredEmails.length > 0 && (
                            <div className="results-summary">
                                <span>{filteredEmails.length} {inputMode === 'domain' ? 'domeinen' : 'emails'} gevonden</span>
                                {filteredEmails.length < emails.length && (
                                    <span className="filter-indicator"> ({emails.length} totaal)</span>
                                )}
                            </div>
                        )}

                        {/* Grouped Results */}
                        {Object.keys(groupedByStatus).length > 0 ? (
                            <div className="results-container-grouped">
                                {statusOrder.map(status => {
                                    const groupItems = groupedByStatus[status] || [];
                                    if (groupItems.length === 0) return null;

                                    return (
                                        <div key={status} className="status-group">
                                            <div className="status-group-header">
                                                <h4 className="status-group-title">
                                                    {statusLabels[status] || status}
                                                    <span className="status-group-count">({groupItems.length})</span>
                                                </h4>
                                            </div>
                                            <div className="status-group-items">
                                                {groupItems.map((item, index) => {
                                                    const globalIndex = emails.findIndex(e => 
                                                        (e.email && e.email === item.email) || 
                                                        (e.domain && e.domain === item.domain)
                                                    );
                                                    return (
                                                        <div key={`${status}-${index}`} className={`lead-item ${item.status}`}>
                                                            <div className="lead-index">{globalIndex + 1}</div>
                                                            <div className="lead-status-icon">
                                                                {item.status === 'pending' && '⏳'}
                                                                {item.status === 'processing' && '🔄'}
                                                                {item.status === 'success' && '✅'}
                                                                {item.status === 'no_email' && '⚠️'}
                                                                {item.status === 'failed' && '❌'}
                                                            </div>
                                                            <div className="lead-info">
                                                                {/* Toon domein of email afhankelijk van mode */}
                                                                <div className="lead-email">
                                                                    {item.domain && !item.email && <span className="domain-tag">🌐 </span>}
                                                                    {item.email || item.domain}
                                                                </div>

                                                                {/* Als we in domain mode een email gevonden hebben, toon die */}
                                                                {item.domain && item.email && (
                                                                    <div className="found-email">📧 {item.email}</div>
                                                                )}

                                                                {item.data && (
                                                                    <div className="lead-meta">
                                                                        <a href={item.websiteUrl} target="_blank" rel="noopener noreferrer" className="lead-link">{item.data.companyName}</a>
                                                                        {item.data.contactPerson && <span className="lead-city">👤 {item.data.contactPerson}</span>}
                                                                        {item.data.allEmails && item.data.allEmails.length > 1 && (
                                                                            <span className="lead-emails-count">+{item.data.allEmails.length - 1} meer emails</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {item.message && <div className="lead-error">{item.message}</div>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : emails.length > 0 ? (
                            <div className="no-results">
                                <p>Geen resultaten gevonden met de huidige filters.</p>
                            </div>
                        ) : null}

                    </div>
                </main>
            </div>

            <style jsx>{`
        .app {
          min-height: 100vh;
          background: var(--bg-primary);
          font-family: var(--font-sans);
          color: var(--text-primary);
        }

        .bg-gradient {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
          z-index: -1;
        }

        .page-header {
          padding: 20px 24px;
          background: var(--glass-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--glass-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .logo { 
          font-size: 1.25rem; 
          font-weight: 700; 
          display: flex; 
          gap: 8px;
          color: var(--text-primary);
        }
        
        .logo-icon {
          filter: drop-shadow(0 0 8px var(--neon-blue));
        }

        .container {
          max-width: 800px;
          margin: 40px auto;
          padding: 0 20px;
        }

        .card {
          background: var(--glass-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
          margin-bottom: 30px;
        }

        .control-panel {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 24px;
        }

        h3 { 
          font-size: 0.9rem; 
          text-transform: uppercase; 
          color: var(--text-secondary); 
          margin-bottom: 12px;
          letter-spacing: 0.5px;
        }
        p { 
          font-size: 0.9rem; 
          color: var(--text-muted); 
          margin-bottom: 16px; 
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          gap: 8px;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .full-width { width: 100%; }

        .btn-primary { 
          background: var(--neon-blue); 
          color: var(--bg-primary);
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.3);
        }
        .btn-primary:hover:not(:disabled) {
          box-shadow: 0 0 20px rgba(0, 243, 255, 0.5);
        }
        .btn-secondary { 
          background: var(--glass-bg); 
          border: 1px solid var(--glass-border); 
          color: var(--text-primary);
        }
        .btn-secondary:hover:not(:disabled) {
          border-color: var(--neon-blue);
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);
        }
        .btn-success { 
          background: var(--success); 
          color: var(--bg-primary);
          box-shadow: 0 0 10px rgba(0, 255, 157, 0.3);
        }
        .btn-success:hover:not(:disabled) {
          box-shadow: 0 0 20px rgba(0, 255, 157, 0.5);
        }
        .btn-error { 
          background: transparent; 
          border: 1px solid var(--error); 
          color: var(--error);
        }
        .btn-error:hover:not(:disabled) {
          background: var(--error);
          color: var(--bg-primary);
          box-shadow: 0 0 10px rgba(255, 0, 85, 0.3);
        }
        .btn-outline { 
          background: transparent; 
          border: 1px solid var(--glass-border); 
          color: var(--text-primary);
        }
        .btn-outline:hover:not(:disabled) {
          border-color: var(--neon-blue);
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);
        }
        .btn-danger { 
          background: var(--error); 
          color: var(--bg-primary);
          box-shadow: 0 0 10px rgba(255, 0, 85, 0.3);
        }
        .btn-danger:hover:not(:disabled) {
          box-shadow: 0 0 20px rgba(255, 0, 85, 0.5);
        }
        .btn-retry {
          background: var(--neon-purple);
          color: var(--bg-primary);
          box-shadow: 0 0 10px rgba(112, 0, 255, 0.3);
        }
        .btn-retry:hover:not(:disabled) {
          box-shadow: 0 0 20px rgba(112, 0, 255, 0.5);
        }

        .btn-group { display: flex; flex-direction: column; gap: 8px; }

        /* Pagination Styles */
        .pagination-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          padding: 16px 20px;
          background: var(--glass-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          margin-bottom: 16px;
        }

        .pagination-info {
          font-size: 13px;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .pagination-per-page {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pagination-per-page label {
          font-size: 13px;
          color: #64748b;
          white-space: nowrap;
        }

        .input-select {
          padding: 6px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 13px;
          background: white;
          cursor: pointer;
        }

        .input-select:focus {
          outline: none;
          border-color: var(--accent);
        }

        .pagination-nav {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-page {
          padding: 6px 12px;
          font-size: 13px;
          min-width: 36px;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          color: var(--text-primary);
        }

        .btn-page:hover:not(:disabled) {
          background: var(--glass-highlight);
          border-color: var(--neon-blue);
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);
        }

        .btn-page:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .page-indicator {
          font-size: 13px;
          color: #1e293b;
          font-weight: 500;
          padding: 0 12px;
          white-space: nowrap;
        }

        .lead-index {
          font-size: 12px;
          color: #94a3b8;
          min-width: 28px;
          text-align: center;
          font-weight: 500;
        }

        .results-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .lead-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          background: var(--glass-bg);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: 8px;
          border: 1px solid var(--glass-border);
          transition: all 0.2s;
        }

        .lead-item:hover {
          border-color: var(--neon-blue);
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.1);
        }

        .lead-item.success { 
          border-left: 4px solid var(--success);
          box-shadow: 0 0 10px rgba(0, 255, 157, 0.1);
        }
        .lead-item.failed { 
          border-left: 4px solid var(--error);
          box-shadow: 0 0 10px rgba(255, 0, 85, 0.1);
        }
        .lead-item.processing { 
          border-left: 4px solid var(--neon-blue);
          opacity: 0.9;
          animation: pulse 2s ease-in-out infinite;
        }
        .lead-item.no_email { 
          border-left: 4px solid var(--warning);
          background: rgba(255, 214, 0, 0.1);
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 0.7; }
        }

        .lead-status-icon { font-size: 1.2rem; }
        
        .lead-info { flex: 1; }
        .lead-email { 
          font-weight: 500;
          color: var(--text-primary);
        }
        
        .lead-meta { 
          margin-top: 4px; 
          display: flex; 
          gap: 12px; 
          font-size: 0.85rem; 
          align-items: center; 
          flex-wrap: wrap; 
        }
        .lead-link { 
          color: var(--neon-blue); 
          text-decoration: none; 
          font-weight: 600;
          text-shadow: 0 0 5px rgba(0, 243, 255, 0.3);
        }
        .lead-link:hover {
          text-shadow: 0 0 10px rgba(0, 243, 255, 0.5);
        }
        .lead-badge { 
          background: var(--glass-highlight); 
          padding: 2px 8px; 
          border-radius: 4px; 
          color: var(--text-secondary);
        }
        .lead-city { 
          color: var(--text-secondary);
        }
        
        .lead-error { 
          font-size: 0.8em; 
          color: var(--error); 
          margin-top: 2px;
        }
        
        /* 🆕 Domain mode styles */
        .found-email { 
          font-size: 0.85rem; 
          color: var(--success); 
          font-weight: 500; 
          margin-top: 2px;
          text-shadow: 0 0 5px rgba(0, 255, 157, 0.3);
        }
        .domain-tag { 
          opacity: 0.7; 
        }
        .lead-emails-count { 
          font-size: 0.75rem; 
          background: rgba(0, 243, 255, 0.15); 
          color: var(--neon-blue); 
          padding: 2px 6px; 
          border-radius: 4px;
          border: 1px solid rgba(0, 243, 255, 0.3);
        }
        
        .mode-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .mode-btn {
          flex: 1;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          background: white;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          color: #64748b;
        }
        
        .mode-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        
        .mode-btn.active {
          border-color: var(--neon-blue);
          background: rgba(0, 243, 255, 0.1);
          color: #000000;
          box-shadow: 0 0 15px rgba(0, 243, 255, 0.3);
        }
        
        .mode-hint {
          font-size: 0.8rem !important;
          color: var(--text-muted) !important;
          padding: 8px;
          background: var(--glass-highlight);
          border-radius: 6px;
          margin-bottom: 12px !important;
          border: 1px solid var(--glass-border);
        }
        
        .btn-warning {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          color: #b45309;
        }
        
        .btn-warning:hover {
          background: #fde68a;
        }

        .input-toggle {
          display: flex;
          gap: 4px;
          margin-bottom: 12px;
          background: var(--glass-highlight);
          padding: 4px;
          border-radius: 8px;
          border: 1px solid var(--glass-border);
        }

        .toggle-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.2s;
        }

        .toggle-btn.active {
          background: var(--glass-bg);
          color: var(--neon-blue);
          box-shadow: 0 1px 3px rgba(0, 243, 255, 0.2);
        }

        .text-paste-area {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .paste-textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          font-family: var(--font-sans);
          font-size: 0.9rem;
          resize: vertical;
          min-height: 120px;
          background: var(--glass-bg);
          color: var(--text-primary);
        }

        .paste-textarea:focus {
          outline: none;
          border-color: var(--neon-blue);
          box-shadow: 0 0 0 3px rgba(0, 243, 255, 0.15);
        }

        .stats-preview {
          margin-top: 12px;
          padding: 8px 12px;
          background: rgba(0, 255, 157, 0.1);
          border-radius: 6px;
          color: var(--success);
          font-weight: 500;
          font-size: 0.9rem;
          border: 1px solid rgba(0, 255, 157, 0.2);
        }
        
        .processing-controls {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .progress-bar-container {
          width: 100%;
          height: 8px;
          background: var(--glass-highlight);
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid var(--glass-border);
        }
        
        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, var(--neon-blue), var(--neon-purple));
          transition: width 0.3s ease;
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.5);
        }
        
        .progress-stats {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 500;
        }
        
        .concurrency-control {
          margin-bottom: 12px;
        }
        
        .concurrency-label {
          display: block;
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 8px;
          font-weight: 500;
        }
        
        .concurrency-value {
          color: var(--neon-blue);
          font-weight: 600;
        }
        
        .concurrency-slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: var(--glass-highlight);
          outline: none;
          -webkit-appearance: none;
        }
        
        .concurrency-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--neon-blue);
          cursor: pointer;
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.5);
        }
        
        .concurrency-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--neon-blue);
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.5);
        }
        
        .filter-bar {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 16px 20px;
          background: var(--glass-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          margin-bottom: 16px;
        }
        
        .filter-search-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          font-size: 0.9rem;
          background: var(--glass-highlight);
          color: var(--text-primary);
          font-family: var(--font-sans);
        }
        
        .filter-search-input:focus {
          outline: none;
          border-color: var(--neon-blue);
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);
        }
        
        .filter-search-input::placeholder {
          color: var(--text-muted);
        }
        
        .filter-status-select {
          padding: 10px 14px;
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          font-size: 0.9rem;
          background: var(--glass-highlight);
          color: var(--text-primary);
          cursor: pointer;
          min-width: 160px;
        }
        
        .filter-status-select:focus {
          outline: none;
          border-color: var(--neon-blue);
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);
        }
        
        .filter-clear {
          padding: 10px 16px;
          white-space: nowrap;
          min-width: 80px;
        }
        
        .filter-indicator {
          color: var(--text-muted);
          font-size: 0.85rem;
          margin-left: 4px;
        }
        
        .results-summary {
          padding: 12px 20px;
          background: var(--glass-bg);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 0.9rem;
          color: var(--text-primary);
          font-weight: 500;
        }
        
        .results-container-grouped {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .status-group {
          background: var(--glass-bg);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          overflow: hidden;
        }
        
        .status-group-header {
          padding: 16px 20px;
          background: var(--glass-highlight);
          border-bottom: 1px solid var(--glass-border);
        }
        
        .status-group-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .status-group-count {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 500;
        }
        
        .status-group-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
        }
        
        .no-results {
          padding: 40px 20px;
          text-align: center;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: var(--text-secondary);
        }
        
        .no-results p {
          margin: 0;
          font-size: 0.95rem;
        }

        .niche-exports {
          margin-bottom: 24px;
        }

        .niche-exports h3 {
          font-size: 1rem;
          margin-bottom: 4px;
        }

        .niche-hint {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-bottom: 16px;
        }

        .niche-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }

        .niche-card {
          background: var(--glass-bg);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          padding: 14px;
          transition: all 0.2s;
        }

        .niche-card:hover {
          border-color: var(--neon-blue);
          background: rgba(0, 243, 255, 0.05);
          box-shadow: 0 0 15px rgba(0, 243, 255, 0.2);
        }

        .niche-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .niche-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-primary);
        }

        .niche-count {
          font-size: 0.75rem;
          background: var(--neon-blue);
          color: var(--bg-primary);
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: 600;
          box-shadow: 0 0 8px rgba(0, 243, 255, 0.3);
        }

        .niche-actions {
          display: flex;
          gap: 8px;
        }

        .btn-copy, .btn-download {
          flex: 1;
          padding: 8px 10px;
          font-size: 0.8rem;
          border-radius: 6px;
          border: 1px solid var(--glass-border);
          background: var(--glass-bg);
          color: var(--text-primary);
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-copy:hover {
          background: rgba(0, 243, 255, 0.1);
          border-color: var(--neon-blue);
          color: var(--neon-blue);
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);
        }

        .btn-download:hover {
          background: rgba(0, 255, 157, 0.1);
          border-color: var(--success);
          color: var(--success);
          box-shadow: 0 0 10px rgba(0, 255, 157, 0.2);
        }

        @media (max-width: 768px) {
          .control-panel { grid-template-columns: 1fr; }
          .niche-grid { grid-template-columns: 1fr; }
        }
      `}</style>
        </>
    );
}
