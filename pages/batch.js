import { useState, useRef, useCallback, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Navigation from '../components/Navigation';

import godmode from '../utils/godmode';
import { createCampaign, getActiveSmtpAccounts, getSmtpAccounts } from "../utils/campaignStore";
import { getWarmupSummary } from "../utils/warmupStore";

export default function BatchPage() {
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const fileInputRef = useRef(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [leadStatuses, setLeadStatuses] = useState({}); // Track status per lead: { [id]: 'waiting' | 'processing' | 'sent' | 'failed' }
  const [currentProcessingId, setCurrentProcessingId] = useState(null);
  const [sessionPrompt, setSessionPrompt] = useState(''); // Tijdelijke extra instructies voor de AI
  const [showSessionPrompt, setShowSessionPrompt] = useState(false);
  const [enrichingLeads, setEnrichingLeads] = useState(new Set()); // Track which leads are being enriched
  const enrichTimersRef = useRef({}); // Store debounce timers per lead

  // Campaign mode
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [smtpAccounts, setSmtpAccounts] = useState([]);
  const [selectedSmtpIds, setSelectedSmtpIds] = useState([]);
  const [smtpMode, setSmtpMode] = useState('single'); // single or rotate
  const [defaultTone, setDefaultTone] = useState('professional');
  const [verifyDomains, setVerifyDomains] = useState(true); // Verify domains before sending

  // 🔥 GODMODE
  const [sendMode, setSendMode] = useState('normal'); // normal, turbo, godmode
  const [godmodeStats, setGodmodeStats] = useState(null);
  const [godmodeConfirm, setGodmodeConfirm] = useState(false);
  const [godmodeLogs, setGodmodeLogs] = useState([]); // Live activity logs
  const [showErrorDetails, setShowErrorDetails] = useState({}); // Track which errors are expanded

  // Load SMTP accounts on mount
  useEffect(() => {
    async function loadSmtp() {
      try {
        const res = await fetch('/api/smtp-accounts');
        const data = await res.json();
        if (data.success) {
          setSmtpAccounts(data.accounts || []);
        }
      } catch (e) {
        console.error('Failed to load SMTP accounts:', e);
        setSmtpAccounts(getSmtpAccounts());
      }
    }
    loadSmtp();
  }, []);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Calculate pagination
  const totalPages = Math.ceil(leads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeads = leads.slice(startIndex, endIndex);

  // Add single lead
  const addLead = () => {
    setLeads([...leads, {
      id: Date.now(),
      toEmail: "",
      businessName: "",
      websiteUrl: "",
      contactPerson: "",
      emailTone: "professional"
    }]);
  };

  // Update lead
  const updateLead = (id, field, value) => {
    const updatedLeads = leads.map(lead =>
      lead.id === id ? { ...lead, [field]: value } : lead
    );
    setLeads(updatedLeads);

    // Auto-enrich when email is entered (with debounce)
    // Only if not too many leads are already being enriched (max 10 concurrent)
    if (field === 'toEmail' && value && value.includes('@') && value.includes('.')) {
      const lead = updatedLeads.find(l => l.id === id);

      // Only enrich if businessName or websiteUrl is missing
      // And if we're not already enriching too many leads
      if (lead && (!lead.businessName || !lead.websiteUrl) && enrichingLeads.size < 10) {
        // Clear existing timer for this lead
        if (enrichTimersRef.current[id]) {
          clearTimeout(enrichTimersRef.current[id]);
        }

        // Set enriching status
        setEnrichingLeads(prev => new Set(prev).add(id));

        // Debounce: wait 1.5 seconds after user stops typing (longer for bulk)
        enrichTimersRef.current[id] = setTimeout(async () => {
          try {
            const enriched = await enrichLead(lead);
            setLeads(prevLeads =>
              prevLeads.map(l => l.id === id ? enriched : l)
            );
          } catch (error) {
            console.error('Auto-enrichment error:', error);
          } finally {
            setEnrichingLeads(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            delete enrichTimersRef.current[id];
          }
        }, 1500); // Wait 1.5 seconds after user stops typing
      }
    }
  };

  // Remove lead
  const removeLead = (id) => {
    setLeads(leads.filter(lead => lead.id !== id));
    if (selectedLeads.has(id)) {
      const newSelected = new Set(selectedLeads);
      newSelected.delete(id);
      setSelectedLeads(newSelected);
    }
  };

  // Auto-enrich lead from email
  const enrichLead = async (lead) => {
    // Skip if already has all required fields
    if (lead.businessName && lead.websiteUrl) {
      return lead;
    }

    // Skip if no email
    if (!lead.toEmail || !lead.toEmail.includes('@')) {
      return lead;
    }

    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const res = await fetch('/api/enrich-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lead.toEmail }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (data.success && data.data) {
        return {
          ...lead,
          businessName: lead.businessName || data.data.companyName || '',
          websiteUrl: lead.websiteUrl || data.websiteUrl || '',
          contactPerson: lead.contactPerson || data.data.contactPerson || '',
          knowledgeFile: lead.knowledgeFile || data.data.knowledgeFile || ''
        };
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('Enrichment timeout for', lead.toEmail);
      } else {
        console.error('Enrichment error for', lead.toEmail, error);
      }
    }

    return lead;
  };

  // Auto-enrich all leads that need it (with rate limiting)
  const enrichLeads = async (currentLeads, onLog = null) => {
    const leadsToEnrich = currentLeads.filter(l => l.toEmail && (!l.businessName || !l.websiteUrl));

    if (leadsToEnrich.length === 0) {
      if (onLog) onLog(`✅ Alle leads zijn al verrijkt`, 'success');
      return { leads: currentLeads, logs: [] };
    }

    if (onLog) onLog(`🔍 Start verrijking van ${leadsToEnrich.length} leads...`, 'info');

    // Process in batches to avoid overwhelming the server
    const BATCH_SIZE = 5; // Max 5 concurrent requests
    const BATCH_DELAY = 500; // 500ms delay between batches
    const enriched = [];
    const enrichmentLogs = [];

    for (let i = 0; i < leadsToEnrich.length; i += BATCH_SIZE) {
      const batch = leadsToEnrich.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(leadsToEnrich.length / BATCH_SIZE);

      if (onLog) onLog(`📦 Batch ${batchNum}/${totalBatches}: ${batch.length} leads verrijken...`, 'info');

      // Process batch
      const batchResults = await Promise.allSettled(
        batch.map(lead => enrichLead(lead))
      );

      batchResults.forEach((result, idx) => {
        const lead = batch[idx];
        if (result.status === 'fulfilled') {
          const enrichedLead = result.value;
          enriched.push(enrichedLead);

          if (enrichedLead.businessName && enrichedLead.websiteUrl) {
            if (onLog) onLog(`✅ ${lead.toEmail} - ${enrichedLead.businessName}`, 'success');
            enrichmentLogs.push({
              timestamp: new Date().toLocaleTimeString('nl-NL'),
              email: lead.toEmail,
              status: 'success',
              message: `✅ ${lead.toEmail} - Verrijkt: ${enrichedLead.businessName} | ${enrichedLead.websiteUrl}`
            });
          } else {
            if (onLog) onLog(`⚠️ ${lead.toEmail} - Geen bedrijfswebsite gevonden`, 'warning');
            enrichmentLogs.push({
              timestamp: new Date().toLocaleTimeString('nl-NL'),
              email: lead.toEmail,
              status: 'warning',
              message: `⚠️ ${lead.toEmail} - Geen bedrijfswebsite gevonden (mogelijk generieke email provider)`
            });
          }
        } else {
          if (onLog) onLog(`❌ ${lead.toEmail} - ${result.reason?.message || 'Verrijking mislukt'}`, 'error');
          enrichmentLogs.push({
            timestamp: new Date().toLocaleTimeString('nl-NL'),
            email: lead.toEmail,
            status: 'error',
            message: `❌ ${lead.toEmail} - ${result.reason?.message || 'Verrijking mislukt'}`
          });
        }
      });

      // Update state incrementally for better UX
      const updated = currentLeads.map(prevLead => {
        const enrichedLead = enriched.find(e => e.id === prevLead.id);
        return enrichedLead || prevLead;
      });
      setLeads(updated);

      // Wait before next batch (except for last batch)
      if (i + BATCH_SIZE < leadsToEnrich.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    // Final update
    const finalUpdated = currentLeads.map(prevLead => {
      const enrichedLead = enriched.find(e => e.id === prevLead.id);
      return enrichedLead || prevLead;
    });

    const successCount = enriched.filter(e => e.businessName && e.websiteUrl).length;
    const warningCount = enrichmentLogs.filter(l => l.status === 'warning').length;
    const errorCount = enrichmentLogs.filter(l => l.status === 'error').length;

    if (onLog) onLog(`✅ Verrijking voltooid: ${successCount}/${leadsToEnrich.length} succesvol`, 'success');

    // Add summary log
    enrichmentLogs.push({
      timestamp: new Date().toLocaleTimeString('nl-NL'),
      email: '',
      status: 'success',
      message: `📊 Verrijking voltooid: ${successCount} succesvol, ${warningCount} waarschuwingen, ${errorCount} fouten`
    });

    setLeads(finalUpdated);
    return { leads: finalUpdated, logs: enrichmentLogs };
  };

  // Bulk Selection Handlers
  const toggleLead = (id) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLeads(newSelected);
  };

  const toggleAll = () => {
    if (selectedLeads.size === leads.length && leads.length > 0) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)));
    }
  };

  const bulkUpdateTone = (tone) => {
    setLeads(leads.map(lead =>
      selectedLeads.has(lead.id) ? { ...lead, emailTone: tone } : lead
    ));
  };

  const bulkRemove = () => {
    if (!confirm(`Weet je zeker dat je ${selectedLeads.size} leads wilt verwijderen?`)) return;
    setLeads(leads.filter(lead => !selectedLeads.has(lead.id)));
    setSelectedLeads(new Set());
  };

  // Shared function to parse leads from text/CSV
  // Supports both manual input AND the enricher CSV format
  const parseLeadsFromText = (text) => {
    // Normalize line endings
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n').filter(line => line.trim());

    if (lines.length === 0) return [];

    // Detect headers - check first line for known column names
    const firstLine = lines[0].toLowerCase();
    const hasHeaders = (firstLine.includes('email') || firstLine.includes('bedrijf') || firstLine.includes('website')) && !firstLine.includes('@');

    // Parse headers to detect column mapping
    let columnMap = { email: 0, business: 1, website: 2, contact: 3, knowledge: 4, tone: 5 };

    if (hasHeaders) {
      const headerParts = lines[0].split(/[,;\t]/).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      headerParts.forEach((header, index) => {
        if (header.includes('email')) columnMap.email = index;
        else if (header.includes('bedrijf') || header.includes('company') || header.includes('naam')) columnMap.business = index;
        else if (header.includes('website') || header.includes('url')) columnMap.website = index;
        else if (header.includes('contact') || header.includes('person')) columnMap.contact = index;
        else if (header.includes('knowledge') || header.includes('file') || header.includes('niche')) columnMap.knowledge = index;
        else if (header.includes('tone') || header.includes('stijl')) columnMap.tone = index;
      });
    }

    const startIndex = hasHeaders ? 1 : 0;
    const importedLeads = [];

    for (let i = startIndex; i < lines.length; i++) {
      // Split on comma, semicolon, or tab
      const parts = lines[i].split(/[,;\t]/).map(p => p.trim().replace(/^"|"$/g, ''));

      // Check if at least we have an email
      const emailValue = parts[columnMap.email];
      if (emailValue && emailValue.includes('@') && emailValue.includes('.')) {
        // Extract knowledge file to potentially set a default tone later
        const knowledgeFile = parts[columnMap.knowledge] || '';

        importedLeads.push({
          id: Date.now() + i,
          toEmail: emailValue,
          businessName: parts[columnMap.business] || "",
          websiteUrl: parts[columnMap.website] || "",
          contactPerson: parts[columnMap.contact] || "",
          knowledgeFile: knowledgeFile, // Store for reference
          emailTone: parts[columnMap.tone] || "professional"
        });
      }
    }
    return importedLeads;
  };

  // Import from CSV
  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const importedLeads = parseLeadsFromText(text);
      const newLeads = [...leads, ...importedLeads];
      setLeads(newLeads);
      setShowTextInput(false);
      setPasteText('');
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Auto-enrich imported leads that need it (only if not too many)
      const leadsToEnrich = importedLeads.filter(l => l.toEmail && (!l.businessName || !l.websiteUrl));
      if (leadsToEnrich.length > 0 && leadsToEnrich.length <= 50) {
        // Only auto-enrich if less than 50 leads (to avoid blocking)
        // Mark as enriching
        leadsToEnrich.forEach(lead => {
          setEnrichingLeads(prev => new Set(prev).add(lead.id));
        });

        // Enrich in background with rate limiting
        enrichLeads(newLeads).then((result) => {
          leadsToEnrich.forEach(lead => {
            setEnrichingLeads(prev => {
              const next = new Set(prev);
              next.delete(lead.id);
              return next;
            });
          });
        }).catch(err => {
          console.error('Bulk enrichment error:', err);
          // Clear enriching status on error
          leadsToEnrich.forEach(lead => {
            setEnrichingLeads(prev => {
              const next = new Set(prev);
              next.delete(lead.id);
              return next;
            });
          });
        });
      } else if (leadsToEnrich.length > 50) {
        // Too many leads - show message that enrichment happens on send
        setError(`✅ ${importedLeads.length} leads toegevoegd. Verrijking gebeurt automatisch bij versturen (max 50 tegelijk voor performance).`);
        setTimeout(() => setError(null), 5000); // Clear message after 5 seconds
      }
    };
    reader.readAsText(file);
  };

  // Handle text paste submit
  const handleTextPaste = async () => {
    if (!pasteText.trim()) return;

    const importedLeads = parseLeadsFromText(pasteText);

    if (importedLeads.length === 0) {
      alert('Geen geldige leads gevonden in de tekst. Zorg dat elke regel minimaal een email bevat.');
      return;
    }

    const newLeads = [...leads, ...importedLeads];
    setLeads(newLeads);
    setPasteText('');
    setShowTextInput(false);

    // Auto-enrich imported leads that need it (only if not too many)
    const leadsToEnrich = importedLeads.filter(l => l.toEmail && (!l.businessName || !l.websiteUrl));
    if (leadsToEnrich.length > 0 && leadsToEnrich.length <= 50) {
      // Only auto-enrich if less than 50 leads (to avoid blocking)
      // Mark as enriching
      leadsToEnrich.forEach(lead => {
        setEnrichingLeads(prev => new Set(prev).add(lead.id));
      });

      // Enrich in background with rate limiting
      enrichLeads(newLeads).then((result) => {
        leadsToEnrich.forEach(lead => {
          setEnrichingLeads(prev => {
            const next = new Set(prev);
            next.delete(lead.id);
            return next;
          });
        });
      }).catch(err => {
        console.error('Bulk enrichment error:', err);
        // Clear enriching status on error
        leadsToEnrich.forEach(lead => {
          setEnrichingLeads(prev => {
            const next = new Set(prev);
            next.delete(lead.id);
            return next;
          });
        });
      });
    } else if (leadsToEnrich.length > 50) {
      // Too many leads - show message that enrichment happens on send
      setError(`✅ ${importedLeads.length} leads toegevoegd. Verrijking gebeurt automatisch bij versturen (max 50 tegelijk voor performance).`);
      setTimeout(() => setError(null), 5000); // Clear message after 5 seconds
    }
  };

  // Send all emails with real-time streaming progress
  const handleSendAll = async () => {
    // First, enrich leads that only have email
    setError(null);
    setSending(true); // Show loading state during enrichment

    const enrichmentResult = await enrichLeads(leads);
    const enrichedLeadsList = enrichmentResult.leads;

    setSending(false);

    // Now filter for valid leads (after enrichment)
    const validLeads = enrichedLeadsList.filter(l => l.toEmail && l.businessName && l.websiteUrl);

    if (validLeads.length === 0) {
      setError("Geen geldige leads om te versturen. Controleer of de emails geldige bedrijfswebsites hebben.");
      return;
    }

    setSending(true);
    setError(null);
    setResults(null);
    setProgress({ current: 0, total: validLeads.length });
    setGodmodeLogs([]); // Clear previous logs

    // Initialize all lead statuses to waiting
    const initialStatuses = {};
    validLeads.forEach(lead => {
      initialStatuses[lead.id] = 'waiting';
    });
    setLeadStatuses(initialStatuses);

    // Add start log
    const timestamp = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setGodmodeLogs([{
      id: Date.now(),
      timestamp,
      type: 'system',
      message: '📧 Batch verzending gestart',
      details: `${validLeads.length} emails te versturen`
    }]);

    try {
      const response = await fetch("/api/send-batch-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: validLeads,
          delayBetweenEmails: 5000, // 5 seconds between emails
          sessionPrompt: sessionPrompt.trim() // Extra AI instructies voor deze batch
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Batch verzenden mislukt");
      }

      // Handle Server-Sent Events
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResults = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEvent = null;
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.substring(6));

              switch (currentEvent) {
                case 'processing':
                  // Update status for this lead
                  setLeadStatuses(prev => ({
                    ...prev,
                    [validLeads[data.index].id]: 'processing'
                  }));
                  setCurrentProcessingId(validLeads[data.index].id);
                  setProgress({ current: data.current, total: data.total });
                  break;

                case 'sent':
                  setLeadStatuses(prev => ({
                    ...prev,
                    [validLeads[data.index].id]: 'sent'
                  }));
                  setCurrentProcessingId(null);
                  // Log AI status for normal batch mode too
                  if (data.usedAI) {
                    setGodmodeLogs(prev => [...prev, {
                      id: Date.now() + Math.random(),
                      timestamp: new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                      type: 'success',
                      message: `✅ Verstuurd: ${data.email}`,
                      details: `${data.business} | 🤖 AI`
                    }]);
                  } else {
                    // Include actual AI error details
                    const aiError = data.aiStatus?.error;
                    const errorCode = aiError?.code || 'NO_AI';
                    const errorMsg = aiError?.message || data.aiStatus?.reason || 'Geen AI gebruikt';

                    let suggestion = 'Voeg OPENAI_API_KEY toe aan .env.local';
                    if (data.aiStatus?.hasApiKey) {
                      if (errorMsg.includes('API key') || errorMsg.includes('API_KEY')) {
                        suggestion = 'API key is ongeldig of verlopen - maak een nieuwe aan op https://platform.openai.com/api-keys';
                      } else if (errorMsg.includes('quota') || errorMsg.includes('rate') || errorMsg.includes('rate_limit')) {
                        suggestion = 'API quota bereikt - wacht even of upgrade je OpenAI plan';
                      } else if (errorMsg.includes('not found') || errorMsg.includes('NOT_FOUND') || errorMsg.includes('404')) {
                        suggestion = 'Model niet gevonden - herstart de server om nieuwe modellen te laden';
                      } else if (errorMsg.includes('model')) {
                        suggestion = 'Model niet beschikbaar - mogelijk tijdelijke OpenAI outage';
                      } else {
                        suggestion = 'Check de server console voor meer details';
                      }
                    }

                    setGodmodeLogs(prev => [...prev, {
                      id: Date.now() + Math.random(),
                      timestamp: new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                      type: 'warning',
                      message: `⚠️ Verstuurd (geen AI): ${data.email}`,
                      details: `${data.business} | [${errorCode}] ${errorMsg.slice(0, 40)}...`,
                      errorData: {
                        code: errorCode,
                        message: errorMsg,
                        suggestion: suggestion,
                        fullError: { aiStatus: data.aiStatus, tone: data.emailTone }
                      }
                    }]);
                  }
                  break;

                case 'failed':
                  setLeadStatuses(prev => ({
                    ...prev,
                    [validLeads[data.index].id]: 'failed'
                  }));
                  setCurrentProcessingId(null);
                  // Enhanced error logging for normal batch mode
                  setGodmodeLogs(prev => [...prev, {
                    id: Date.now() + Math.random(),
                    timestamp: new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    type: 'error',
                    message: `❌ Mislukt: ${data.email}`,
                    details: `[${data.errorCode || 'UNKNOWN'}] ${data.error}`,
                    errorData: {
                      code: data.errorCode || 'UNKNOWN',
                      message: data.error,
                      details: data.errorDetails,
                      suggestion: data.errorSuggestion,
                      fullError: data.fullError || data
                    }
                  }]);
                  break;

                case 'complete':
                  finalResults = data;
                  break;
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
            currentEvent = null;
          }
        }
      }

      if (finalResults) {
        setResults(finalResults);

        // Clear successfully sent leads
        const sentEmails = finalResults.details
          .filter(d => d.status === 'sent')
          .map(d => d.email);
        setLeads(prevLeads => prevLeads.filter(l => !sentEmails.includes(l.toEmail)));
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
      setCurrentProcessingId(null);
      setLeadStatuses({});
    }
  };

  // Start campaign mode - creates persistent campaign via Server API and redirects to dashboard
  const handleStartCampaign = async () => {
    // Get all leads with email (enrichment happens on campaign page/server)
    const leadsWithEmail = leads.filter(l => l.toEmail);

    if (leadsWithEmail.length === 0) {
      setError("Geen leads met email om te versturen");
      return;
    }

    try {
      setSending(true);

      const response = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: campaignName || `Campagne ${new Date().toLocaleDateString('nl-NL')} ${new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`,
          emails: leadsWithEmail.map(lead => ({
            email: lead.toEmail,
            businessName: lead.businessName || '',
            websiteUrl: lead.websiteUrl || '',
            contactPerson: lead.contactPerson || '',
            knowledgeFile: lead.knowledgeFile || '',
            needsEnrichment: !lead.businessName || !lead.websiteUrl
          })),
          smtpMode,
          smtpAccountIds: selectedSmtpIds,
          emailTone: defaultTone,
          sessionPrompt: sessionPrompt.trim(),
          delayBetweenEmails: 30, // Default 30s for server-side
          verifyDomains
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Fout bij aanmaken campagne');
      }

      // Clear batch page and redirect to campaign dashboard
      setLeads([]);
      setShowCampaignModal(false);
      setSending(false);
      router.push(`/campaigns?id=${data.campaign.id}`);

    } catch (err) {
      console.error('Create campaign error:', err);
      setError(err.message);
      setSending(false);
    }
  };

  // 🔥 GODMODE - Maximum speed sending
  const handleGodmode = async () => {
    const activeSmtps = smtpAccounts.filter(a => a.active !== false);
    if (activeSmtps.length === 0) {
      setError("Geen actieve SMTP accounts. Ga naar Settings.");
      return;
    }

    if (!godmodeConfirm) {
      // First check: enrich leads and show confirmation
      setError(null);
      setSending(true); // Show loading state during enrichment

      const enrichmentResult = await enrichLeads(leads);
      const enrichedLeadsList = enrichmentResult.leads;

      setSending(false);

      const validLeads = enrichedLeadsList.filter(l => l.toEmail && l.businessName && l.websiteUrl);

      if (validLeads.length === 0) {
        setError("Geen geldige leads om te versturen. Controleer of de emails geldige bedrijfswebsites hebben.");
        return;
      }

      // Show confirmation
      setGodmodeStats({
        emails: validLeads.length,
        smtps: activeSmtps.length,
        estimatedTime: Math.ceil(validLeads.length / (activeSmtps.length * 10) * 0.5) + ' seconden'
      });
      setGodmodeConfirm(true);
      return;
    }

    // Execute GODMODE - leads are already enriched
    const validLeads = leads.filter(l => l.toEmail && l.businessName && l.websiteUrl);

    if (validLeads.length === 0) {
      setError("Geen geldige leads om te versturen");
      return;
    }

    setSending(true);
    setError(null);
    setResults(null);
    setGodmodeConfirm(false);
    setProgress({ current: 0, total: validLeads.length });
    setGodmodeLogs([]); // Clear previous logs

    // Log helper - enhanced with error details
    const addLog = (type, message, details = null, errorData = null) => {
      const timestamp = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const logId = Date.now() + Math.random();
      setGodmodeLogs(prev => [...prev, { id: logId, timestamp, type, message, details, errorData }]);
    };

    addLog('system', '🔥🔥🔥 GODMODE GEACTIVEERD');
    addLog('info', `📧 ${validLeads.length} emails te versturen`);
    addLog('info', `📡 ${activeSmtps.length} SMTP accounts actief`);

    // Initialize all lead statuses
    const initialStatuses = {};
    validLeads.forEach(lead => {
      initialStatuses[lead.id] = 'waiting';
    });
    setLeadStatuses(initialStatuses);

    try {
      // Distribute emails across SMTPs
      const batches = activeSmtps.map(smtp => ({
        smtp,
        emails: []
      }));

      validLeads.forEach((lead, index) => {
        const batchIndex = index % batches.length;
        batches[batchIndex].emails.push(lead);
      });

      // Shared counter object (mutable reference for parallel access)
      const counter = { sent: 0, failed: 0, processed: 0 };
      const details = [];

      // Update progress function
      const updateProgress = () => {
        setProgress({ current: counter.processed, total: validLeads.length });
      };

      // Process all batches in parallel
      const batchPromises = batches.filter(b => b.emails.length > 0).map(async (batch, batchIdx) => {
        const chunkSize = 5; // 5 emails at once per SMTP for better progress updates

        addLog('smtp', `🔌 Verbinden met ${batch.smtp.user}...`, batch.smtp.host);

        for (let i = 0; i < batch.emails.length; i += chunkSize) {
          const chunk = batch.emails.slice(i, i + chunkSize);

          const chunkResults = await Promise.allSettled(
            chunk.map(async (lead) => {
              // Mark as processing
              setLeadStatuses(prev => ({ ...prev, [lead.id]: 'processing' }));
              addLog('send', `📤 Versturen naar ${lead.toEmail}...`, batch.smtp.user);

              try {
                const res = await fetch('/api/send-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    toEmail: lead.toEmail,
                    businessName: lead.businessName,
                    websiteUrl: lead.websiteUrl,
                    contactPerson: lead.contactPerson,
                    emailTone: lead.emailTone,
                    smtpAccountId: batch.smtp.id,
                    sessionPrompt: sessionPrompt
                  })
                });

                const data = await res.json();

                if (data.success) {
                  setLeadStatuses(prev => ({ ...prev, [lead.id]: 'sent' }));
                  // Log AI usage info with details
                  const aiInfo = data.usedAI ? '🤖 AI' : '📝 Template';
                  const aiReason = data.aiStatus?.reason || '';

                  if (data.usedAI) {
                    addLog('success', `✅ Verstuurd: ${lead.toEmail}`, `${lead.businessName} | ${aiInfo}`);
                  } else {
                    // Warning: sent but without AI - include actual error details
                    const aiError = data.aiStatus?.error;
                    const errorCode = aiError?.code || 'NO_AI';
                    const errorMsg = aiError?.message || aiReason;

                    let suggestion = 'Voeg OPENAI_API_KEY toe aan .env.local';
                    if (data.aiStatus?.hasApiKey) {
                      if (errorMsg.includes('API key') || errorMsg.includes('API_KEY')) {
                        suggestion = 'API key is ongeldig of verlopen - maak een nieuwe aan op https://platform.openai.com/api-keys';
                      } else if (errorMsg.includes('quota') || errorMsg.includes('rate') || errorMsg.includes('rate_limit')) {
                        suggestion = 'API quota bereikt - wacht even of upgrade je OpenAI plan';
                      } else if (errorMsg.includes('not found') || errorMsg.includes('NOT_FOUND') || errorMsg.includes('404')) {
                        suggestion = 'Model niet gevonden - herstart de server om nieuwe modellen te laden';
                      } else if (errorMsg.includes('model')) {
                        suggestion = 'Model niet beschikbaar - mogelijk tijdelijke OpenAI outage';
                      } else {
                        suggestion = 'Check de server console voor meer details';
                      }
                    }

                    addLog('warning', `⚠️ Verstuurd (geen AI): ${lead.toEmail}`, `${lead.businessName} | [${errorCode}] ${errorMsg.slice(0, 50)}...`, {
                      code: errorCode,
                      message: errorMsg,
                      suggestion: suggestion,
                      fullError: { aiStatus: data.aiStatus, tone: data.emailTone }
                    });
                  }
                  return { success: true, lead, data };
                } else {
                  setLeadStatuses(prev => ({ ...prev, [lead.id]: 'failed' }));
                  // Enhanced error logging with full error object
                  const errorMsg = data.error?.message || data.error || 'Onbekende fout';
                  const errorCode = data.error?.code || 'UNKNOWN';
                  addLog('error', `❌ Mislukt: ${lead.toEmail}`, `[${errorCode}] ${errorMsg}`, {
                    code: errorCode,
                    message: errorMsg,
                    details: data.error?.details || null,
                    suggestion: data.error?.suggestion || null,
                    fullError: data.error || data
                  });
                  return { success: false, lead, error: errorMsg };
                }
              } catch (err) {
                setLeadStatuses(prev => ({ ...prev, [lead.id]: 'failed' }));
                addLog('error', `❌ Network Error: ${lead.toEmail}`, err.message, {
                  code: 'NETWORK_ERROR',
                  message: err.message,
                  stack: err.stack
                });
                return { success: false, lead, error: err.message };
              }
            })
          );

          // Update progress after each chunk
          chunkResults.forEach((result) => {
            counter.processed++;
            if (result.status === 'fulfilled') {
              if (result.value.success) {
                counter.sent++;
                details.push({
                  email: result.value.lead.toEmail,
                  business: result.value.lead.businessName,
                  status: 'sent'
                });
              } else {
                counter.failed++;
                details.push({
                  email: result.value.lead.toEmail,
                  business: result.value.lead.businessName,
                  status: 'failed'
                });
              }
            } else {
              counter.failed++;
            }
          });

          // Update progress bar after each chunk completes
          updateProgress();
        }
      });

      await Promise.all(batchPromises);

      addLog('system', `🏁 GODMODE VOLTOOID`);
      addLog('success', `✅ Verstuurd: ${counter.sent}`);
      if (counter.failed > 0) {
        addLog('error', `❌ Mislukt: ${counter.failed}`);
      }

      setResults({
        sent: counter.sent,
        failed: counter.failed,
        details
      });

      // Clear successfully sent leads
      const sentEmails = details.filter(d => d.status === 'sent').map(d => d.email);
      setLeads(prevLeads => prevLeads.filter(l => !sentEmails.includes(l.toEmail)));

    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
      setCurrentProcessingId(null);
      setLeadStatuses({});
      setGodmodeStats(null);
    }
  };

  return (
    <>
      <Head>
        <title>Batch Modus | SKYE Mail Agent</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="app">
        <div className="bg-gradient"></div>
        <div className="bg-grid"></div>

        <Navigation />
        {/* Page Header */}
        <div className="page-header">
          <div className="logo">
            <span className="logo-icon">📦</span>
            <span className="logo-text">Batch Modus</span>
          </div>
          <div className="lead-count">
            {leads.length} leads
          </div>
        </div>

        <main className="main">
          <div className="container">
            {/* Actions Bar */}
            <div className="actions-bar">
              <button onClick={addLead} className="btn btn-secondary">
                ➕ Lead Toevoegen
              </button>

              <div className="input-toggle-inline">
                <button
                  className={`toggle-btn ${!showTextInput ? 'active' : ''}`}
                  onClick={() => setShowTextInput(false)}
                >
                  📄 CSV
                </button>
                <button
                  className={`toggle-btn ${showTextInput ? 'active' : ''}`}
                  onClick={() => setShowTextInput(true)}
                >
                  📋 Plakken
                </button>
              </div>

              {!showTextInput && (
                <label className="btn btn-secondary file-btn">
                  📂 Bestand Kiezen
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleCSVImport}
                    ref={fileInputRef}
                    hidden
                  />
                </label>
              )}

              <button
                onClick={() => setShowSessionPrompt(!showSessionPrompt)}
                className={`btn btn-secondary ${sessionPrompt.trim() ? 'has-content' : ''}`}
                disabled={sending}
              >
                🧠 {sessionPrompt.trim() ? 'AI Instructie ✓' : 'AI Instructie'}
              </button>

              <button
                onClick={handleSendAll}
                disabled={sending || leads.length === 0}
                className="btn btn-secondary"
              >
                {sending && sendMode === 'normal' ? `Versturen... (${progress.current}/${progress.total})` : '📧 Normaal'}
              </button>

              <button
                onClick={() => setShowCampaignModal(true)}
                disabled={sending || leads.length === 0}
                className="btn btn-primary"
              >
                🚀 Campagne
              </button>

              <button
                onClick={handleGodmode}
                disabled={sending || leads.length === 0 || smtpAccounts.filter(a => a.active !== false).length === 0}
                className="btn btn-godmode"
              >
                {sending && sendMode === 'godmode' ? `🔥 ${progress.current}/${progress.total}` : '🔥 GODMODE'}
              </button>
            </div>

            {/* GODMODE Confirmation Dialog */}
            {godmodeConfirm && godmodeStats && (
              <div className="godmode-confirm">
                <div className="godmode-warning">
                  <span className="godmode-icon">🔥🔥🔥</span>
                  <div className="godmode-title">GODMODE ACTIVEREN?</div>
                  <div className="godmode-subtitle">
                    Dit gaat <strong>{godmodeStats.emails}</strong> emails versturen via <strong>{godmodeStats.smtps}</strong> SMTP accounts
                    in ~<strong>{godmodeStats.estimatedTime}</strong>
                  </div>
                  <div className="godmode-details">
                    <div className="detail-item">⚡ 10+ parallel per SMTP</div>
                    <div className="detail-item">🚫 Geen rate limiting</div>
                    <div className="detail-item">💨 0 vertraging</div>
                  </div>
                  <div className="godmode-danger">
                    ⚠️ WAARSCHUWING: Dit kan je SMTP reputatie beschadigen bij overmatig gebruik!
                  </div>
                  <div className="godmode-actions">
                    <button onClick={() => setGodmodeConfirm(false)} className="btn btn-secondary">
                      Annuleren
                    </button>
                    <button onClick={handleGodmode} className="btn btn-godmode-confirm">
                      🔥 VUUR LOS!
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Session Prompt - Extra AI instructies voor deze batch */}
            {showSessionPrompt && (
              <div className="session-prompt-section">
                <div className="session-prompt-header">
                  <span className="session-prompt-icon">🧠</span>
                  <span className="session-prompt-title">Tijdelijke AI Instructie</span>
                  <span className="session-prompt-hint">(alleen voor deze batch)</span>
                </div>
                <textarea
                  value={sessionPrompt}
                  onChange={(e) => setSessionPrompt(e.target.value)}
                  placeholder="Geef extra context aan de AI voor deze batch...

Voorbeelden:
• Focus op onze nieuwe december korting (20% op alle diensten)
• Vermeld dat we binnenkort in Antwerpen openen
• Richt je op restaurants die nog geen online reserveersysteem hebben
• Leg nadruk op de snelle doorlooptijd (binnen 2 weken live)"
                  className="session-prompt-textarea"
                  rows={4}
                  disabled={sending}
                />
                {sessionPrompt.trim() && (
                  <div className="session-prompt-status">
                    ✅ Deze instructie wordt bij elke email meegestuurd
                  </div>
                )}
              </div>
            )}

            {/* Text Paste Area */}
            {showTextInput && (
              <div className="paste-section">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Plak hier je leads...&#10;&#10;Alleen email is nodig - de rest wordt automatisch ingevuld!&#10;&#10;Voorbeeld:&#10;info@bedrijf.be&#10;contact@ander.be&#10;&#10;Of met extra velden (optioneel):&#10;info@bedrijf.be, Bedrijf Naam, https://website.be"
                  className="paste-textarea"
                  rows={5}
                />
                <button
                  onClick={handleTextPaste}
                  className="btn btn-primary"
                  disabled={!pasteText.trim()}
                >
                  ✅ Leads Toevoegen
                </button>
              </div>
            )}

            {/* CSV Format Help */}
            <div className="csv-help">
              <strong>Formaat:</strong> email (verplicht), bedrijfsnaam (auto), website (auto), contactpersoon (optioneel), tone (optioneel) — <em>Alleen email is nodig, de rest wordt automatisch ingevuld bij versturen. Ondersteunt komma, puntkomma en tab als scheidingsteken</em>
            </div>

            {/* Bulk Actions Toolbar */}
            {leads.length > 0 && (
              <div className={`bulk-toolbar ${selectedLeads.size > 0 ? 'active' : ''}`}>
                <div className="bulk-selection">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && selectedLeads.size === leads.length}
                      onChange={toggleAll}
                      className="checkbox"
                      disabled={sending}
                    />
                    <span className="checkbox-text">
                      {selectedLeads.size > 0 ? `${selectedLeads.size} geselecteerd` : 'Alles selecteren'}
                    </span>
                  </label>
                </div>

                {selectedLeads.size > 0 && !sending && (
                  <div className="bulk-actions-group">
                    <div className="bulk-action">
                      <span className="action-label">Zet stijl:</span>
                      <select
                        onChange={(e) => bulkUpdateTone(e.target.value)}
                        className="input select small"
                        value=""
                      >
                        <option value="" disabled>Kies...</option>
                        <option value="professional">💰 ROI Focus</option>
                        <option value="casual">🎯 Value Drop</option>
                        <option value="urgent">🔥 FOMO</option>
                        <option value="friendly">🤝 Warm Direct</option>
                        <option value="random">🎲 Willekeurig</option>
                      </select>
                    </div>
                    <button onClick={bulkRemove} className="btn-danger-text">
                      🗑️ Verwijderen
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Progress Bar - shown when sending */}
            {sending && progress.total > 0 && (
              <div className="progress-container">
                <div className="progress-header">
                  <span className="progress-title">📧 Emails versturen...</span>
                  <span className="progress-count">{progress.current} van {progress.total}</span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <div className="progress-percentage">
                  {Math.round((progress.current / progress.total) * 100)}% voltooid
                </div>
              </div>
            )}

            {/* Live Log Panel - All Batch Modes */}
            {godmodeLogs.length > 0 && (
              <div className="log-panel">
                <div className="log-header">
                  <span className="log-title">📋 Live Log</span>
                  <span className="log-count">
                    {godmodeLogs.length} events |
                    ✅ {godmodeLogs.filter(l => l.type === 'success').length} |
                    ⚠️ {godmodeLogs.filter(l => l.type === 'warning').length} |
                    ❌ {godmodeLogs.filter(l => l.type === 'error').length}
                  </span>
                  {!sending && (
                    <button
                      className="log-clear"
                      onClick={() => setGodmodeLogs([])}
                    >
                      Wissen
                    </button>
                  )}
                </div>
                <div className="log-body">
                  {godmodeLogs.map((log) => (
                    <div key={log.id} className={`log-entry log-${log.type} ${log.errorData ? 'has-error-data' : ''}`}>
                      <span className="log-time">{log.timestamp}</span>
                      <span className="log-message">{log.message}</span>
                      {log.details && <span className="log-details">{log.details}</span>}

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
                  ))}
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {leads.length > 0 && (
              <div className="pagination-controls">
                <div className="pagination-info">
                  <span>Weergave: {startIndex + 1} - {Math.min(endIndex, leads.length)} van {leads.length} leads</span>
                </div>

                <div className="pagination-per-page">
                  <label>Toon per pagina:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1); // Reset to first page
                    }}
                    className="input select small"
                    disabled={sending}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                  </select>
                </div>

                {totalPages > 1 && (
                  <div className="pagination-nav">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1 || sending}
                      className="btn btn-page"
                    >
                      ««
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || sending}
                      className="btn btn-page"
                    >
                      «
                    </button>
                    <span className="page-indicator">
                      Pagina {currentPage} van {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || sending}
                      className="btn btn-page"
                    >
                      »
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages || sending}
                      className="btn btn-page"
                    >
                      »»
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Leads List */}
            <div className="leads-list">
              {leads.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📭</span>
                  <p>Nog geen leads toegevoegd</p>
                  <p className="empty-hint">Klik op "Lead Toevoegen" of importeer een CSV. Alleen email is nodig - de rest wordt automatisch ingevuld!</p>
                </div>
              ) : (
                paginatedLeads.map((lead, index) => {
                  const actualIndex = startIndex + index;
                  const status = leadStatuses[lead.id];
                  const isProcessing = status === 'processing';
                  const isSent = status === 'sent';
                  const isFailed = status === 'failed';
                  const isWaiting = status === 'waiting';

                  return (
                    <div
                      key={lead.id}
                      className={`lead-card ${selectedLeads.has(lead.id) ? 'selected' : ''} ${status ? `status-${status}` : ''}`}
                    >
                      {/* Status Indicator */}
                      {sending && status && (
                        <div className={`lead-status-badge ${status}`}>
                          {isWaiting && <span className="status-icon">⏳</span>}
                          {isProcessing && <span className="status-icon spinner">⚙️</span>}
                          {isSent && <span className="status-icon">✅</span>}
                          {isFailed && <span className="status-icon">❌</span>}
                        </div>
                      )}

                      {/* Enriching Indicator */}
                      {enrichingLeads.has(lead.id) && !sending && (
                        <div className="lead-status-badge enriching">
                          <span className="status-icon spinner">🔍</span>
                        </div>
                      )}

                      <div className="lead-check">
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => toggleLead(lead.id)}
                          className="checkbox"
                          disabled={sending}
                        />
                      </div>
                      <div className={`lead-number ${status || ''}`}>{actualIndex + 1}</div>
                      <div className="lead-fields">
                        <input
                          type="email"
                          placeholder="email@bedrijf.be *"
                          value={lead.toEmail}
                          onChange={(e) => updateLead(lead.id, 'toEmail', e.target.value)}
                          className="input"
                          disabled={sending}
                          required
                        />
                        <input
                          type="text"
                          placeholder="Bedrijfsnaam (auto)"
                          value={lead.businessName}
                          onChange={(e) => updateLead(lead.id, 'businessName', e.target.value)}
                          className="input"
                          disabled={sending}
                          title="Wordt automatisch ingevuld bij versturen"
                        />
                        <input
                          type="url"
                          placeholder="Website (auto)"
                          value={lead.websiteUrl}
                          onChange={(e) => updateLead(lead.id, 'websiteUrl', e.target.value)}
                          className="input"
                          disabled={sending}
                          title="Wordt automatisch ingevuld bij versturen"
                        />
                        <input
                          type="text"
                          placeholder="Contactpersoon (optioneel)"
                          value={lead.contactPerson}
                          onChange={(e) => updateLead(lead.id, 'contactPerson', e.target.value)}
                          className="input small"
                          disabled={sending}
                        />
                        <select
                          value={lead.emailTone}
                          onChange={(e) => updateLead(lead.id, 'emailTone', e.target.value)}
                          className="input select"
                          disabled={sending}
                        >
                          <option value="professional">💰 ROI Focus</option>
                          <option value="casual">🎯 Value Drop</option>
                          <option value="urgent">🔥 FOMO</option>
                          <option value="friendly">🤝 Warm Direct</option>
                          <option value="random">🎲 Willekeurig</option>
                        </select>
                        {lead.knowledgeFile && (
                          <span className="knowledge-badge" title="Knowledge file voor deze niche">
                            📁 {lead.knowledgeFile}
                          </span>
                        )}
                      </div>
                      {!sending && (
                        <button
                          onClick={() => removeLead(lead.id)}
                          className="remove-btn"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="alert alert-error">
                <span>❌</span> {error}
              </div>
            )}

            {/* Results */}
            {results && (
              <div className="results-card">
                <h3>📊 Resultaten</h3>
                <div className="results-summary">
                  <div className="result-stat success">
                    <span className="stat-num">{results.sent}</span>
                    <span className="stat-label">Verstuurd</span>
                  </div>
                  <div className="result-stat error">
                    <span className="stat-num">{results.failed}</span>
                    <span className="stat-label">Mislukt</span>
                  </div>
                </div>
                <div className="results-details">
                  {results.details.map((d, i) => (
                    <div key={i} className={`result-item ${d.status}`}>
                      <span className="result-icon">{d.status === 'sent' ? '✅' : '❌'}</span>
                      <span className="result-business">{d.business}</span>
                      <span className="result-email">{d.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Campaign Modal */}
        {showCampaignModal && (
          <div className="modal-overlay" onClick={() => setShowCampaignModal(false)}>
            <div className="modal campaign-modal" onClick={e => e.stopPropagation()}>
              <h2>🚀 Nieuwe Campagne</h2>

              <div className="form-group">
                <label>Campagne Naam</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder={`Campagne ${new Date().toLocaleDateString('nl-NL')}`}
                  className="input"
                />
              </div>

              <div className="form-group">
                <label>SMTP Account(s) *</label>
                {smtpAccounts.length === 0 ? (
                  <div className="mailgun-api-notice">
                    ✅ <strong>Mailgun API actief</strong> - Emails worden via Mailgun verstuurd (geen SMTP nodig)
                  </div>
                ) : (
                  <div className="smtp-list">
                    {smtpAccounts.filter(a => a.active).map(account => (
                      <label key={account.id} className="smtp-option">
                        <input
                          type="checkbox"
                          checked={selectedSmtpIds.includes(account.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSmtpIds([...selectedSmtpIds, account.id]);
                            } else {
                              setSelectedSmtpIds(selectedSmtpIds.filter(id => id !== account.id));
                            }
                          }}
                        />
                        <span className="smtp-name">{account.name || account.user}</span>
                        <span className="smtp-host">{account.host}</span>
                        {(() => {
                          const ws = getWarmupSummary(account.id);
                          if (!ws.enabled) return null;
                          return (
                            <span className={`smtp-warmup ${ws.remaining === 0 ? 'at-limit' : ''}`}>
                              🔥 {ws.remaining} over
                            </span>
                          );
                        })()}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {selectedSmtpIds.length > 1 && (
                <div className="form-group">
                  <label>SMTP Modus</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        value="rotate"
                        checked={smtpMode === 'rotate'}
                        onChange={() => setSmtpMode('rotate')}
                      />
                      🔄 Roteren (afwisselen tussen accounts)
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        value="single"
                        checked={smtpMode === 'single'}
                        onChange={() => setSmtpMode('single')}
                      />
                      1️⃣ Eerste account gebruiken
                    </label>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Standaard Stijl</label>
                <select
                  value={defaultTone}
                  onChange={e => setDefaultTone(e.target.value)}
                  className="input select"
                >
                  <option value="professional">💰 ROI Focus</option>
                  <option value="casual">🎯 Value Drop</option>
                  <option value="urgent">🔥 FOMO</option>
                  <option value="friendly">🤝 Warm Direct</option>
                  <option value="random">🎲 Willekeurig per email</option>
                </select>
              </div>

              <div className="form-group">
                <label className="toggle-option">
                  <input
                    type="checkbox"
                    checked={verifyDomains}
                    onChange={(e) => setVerifyDomains(e.target.checked)}
                  />
                  <span>🔍 Domein verificatie (check-host.net)</span>
                </label>
                <small className="toggle-hint">
                  Controleert of de website bereikbaar is voordat de email wordt opgesteld
                </small>
              </div>

              <div className="campaign-summary">
                <span>📧 {leads.filter(l => l.toEmail && l.businessName && l.websiteUrl).length} emails</span>
                <span>📡 {selectedSmtpIds.length} SMTP account(s)</span>
                {verifyDomains && <span>🔍 Verificatie aan</span>}
              </div>

              {error && (
                <div className="modal-error">❌ {error}</div>
              )}

              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCampaignModal(false)}
                >
                  Annuleren
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleStartCampaign}
                >
                  🚀 Start Campagne
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        :root {
          --bg-primary: #f8fafc;
          --bg-secondary: #ffffff;
          --bg-card: rgba(255, 255, 255, 0.95);
          --border-color: rgba(0, 0, 0, 0.1);
          --text-primary: #1a1a2e;
          --text-secondary: #4a5568;
          --text-muted: #718096;
          --accent-primary: #0066cc;
          --accent-secondary: #00a67e;
          --accent-gradient: linear-gradient(135deg, #0066cc, #00a67e);
          --font-sans: 'Inter', sans-serif;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .app {
          min-height: 100vh;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-family: var(--font-sans);
          position: relative;
        }

        .bg-gradient {
          position: fixed;
          inset: 0;
          background: 
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 102, 204, 0.08), transparent),
            radial-gradient(ellipse 60% 40% at 100% 100%, rgba(0, 166, 126, 0.06), transparent);
          pointer-events: none;
        }

        .bg-grid {
          position: fixed;
          inset: 0;
          background-image: 
            linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
        }

        .header {
          position: relative;
          z-index: 10;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
        }

        .back-link {
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
        }

        .back-link:hover { color: var(--accent-primary); }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-icon { font-size: 24px; }
        .logo-text { font-size: 18px; font-weight: 600; }

        .lead-count {
          font-size: 14px;
          color: var(--accent-primary);
          font-weight: 600;
        }

        .main {
          position: relative;
          z-index: 1;
          padding: 24px;
        }

        .container {
          max-width: 900px;
          margin: 0 auto;
        }

        .actions-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-primary {
          background: var(--accent-gradient);
          color: #ffffff;
        }

        .btn-secondary {
          background: #ffffff;
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .btn-secondary:hover {
          background: #f8fafc;
          border-color: rgba(0, 0, 0, 0.2);
        }

        .btn-godmode {
          background: linear-gradient(135deg, #f97316, #dc2626, #f97316);
          background-size: 200% 200%;
          animation: fire-gradient 2s ease infinite;
          color: white;
          font-weight: 700;
          border: none;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          box-shadow: 0 4px 15px rgba(220, 38, 38, 0.4);
        }

        .btn-godmode:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 6px 20px rgba(220, 38, 38, 0.5);
        }

        .btn-godmode-confirm {
          background: linear-gradient(135deg, #dc2626, #991b1b);
          color: white;
          font-weight: 700;
          font-size: 16px;
          padding: 14px 28px;
          animation: pulse-fire 1s ease-in-out infinite;
        }

        @keyframes fire-gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes pulse-fire {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 15px rgba(220, 38, 38, 0.4); }
          50% { transform: scale(1.02); box-shadow: 0 6px 25px rgba(220, 38, 38, 0.6); }
        }

        .godmode-confirm {
          background: rgba(220, 38, 38, 0.05);
          border: 2px solid #dc2626;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 20px;
          animation: shake 0.5s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }

        .godmode-warning {
          text-align: center;
        }

        .godmode-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 12px;
        }

        .godmode-title {
          font-size: 24px;
          font-weight: 800;
          color: #dc2626;
          margin-bottom: 8px;
        }

        .godmode-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        .godmode-details {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-bottom: 16px;
        }

        .detail-item {
          font-size: 13px;
          color: var(--text-primary);
          font-weight: 500;
        }

        .godmode-danger {
          background: rgba(220, 38, 38, 0.1);
          color: #dc2626;
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        .godmode-actions {
          display: flex;
          justify-content: center;
          gap: 12px;
        }

        /* Live Log Panel */
        .log-panel {
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 12px;
          margin-bottom: 20px;
          overflow: hidden;
          font-family: 'JetBrains Mono', monospace;
        }

        .log-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #161b22;
          border-bottom: 1px solid #30363d;
        }

        .log-title {
          font-weight: 600;
          color: #f97316;
        }

        .log-count {
          font-size: 12px;
          color: #8b949e;
          margin-left: auto;
        }

        .log-clear {
          padding: 4px 12px;
          background: rgba(255,255,255,0.1);
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          font-size: 12px;
          cursor: pointer;
        }

        .log-clear:hover {
          background: rgba(255,255,255,0.15);
          color: #fff;
        }

        .log-body {
          max-height: 300px;
          overflow-y: auto;
          padding: 8px 0;
        }

        .log-entry {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 4px 16px;
          font-size: 12px;
          line-height: 1.4;
        }

        .log-time {
          color: #6e7681;
          min-width: 65px;
        }

        .log-message {
          color: #c9d1d9;
          flex: 1;
        }

        .log-details {
          color: #8b949e;
          font-size: 11px;
        }

        .log-system .log-message { color: #f97316; font-weight: 600; }
        .log-smtp .log-message { color: #58a6ff; }
        .log-send .log-message { color: #a5d6ff; }
        .log-success .log-message { color: #3fb950; }
        .log-warning .log-message { color: #f59e0b; }
        .log-error .log-message { color: #f85149; }
        .log-info .log-message { color: #8b949e; }
        
        .log-warning {
          background: rgba(245, 158, 11, 0.1);
          border-left: 3px solid #f59e0b;
          padding-left: 12px;
        }

        /* Error details expansion */
        .log-entry.has-error-data {
          flex-wrap: wrap;
          cursor: pointer;
        }

        .log-expand-btn {
          background: rgba(248, 81, 73, 0.2);
          border: 1px solid #f85149;
          border-radius: 4px;
          color: #f85149;
          font-size: 10px;
          padding: 2px 8px;
          cursor: pointer;
          margin-left: auto;
          font-family: inherit;
        }

        .log-expand-btn:hover {
          background: rgba(248, 81, 73, 0.3);
        }

        .log-error-details {
          width: 100%;
          margin-top: 8px;
          padding: 12px;
          background: rgba(248, 81, 73, 0.1);
          border: 1px solid rgba(248, 81, 73, 0.3);
          border-radius: 6px;
          font-size: 11px;
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
          color: #8b949e;
          min-width: 80px;
          flex-shrink: 0;
        }

        .error-value {
          color: #c9d1d9;
          word-break: break-word;
        }

        .error-code {
          background: #f85149;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }

        .error-suggestion {
          color: #3fb950;
          font-style: italic;
        }

        .error-json {
          background: #0d1117;
          padding: 8px;
          border-radius: 4px;
          overflow-x: auto;
          margin: 0;
          color: #8b949e;
          font-size: 10px;
          max-height: 150px;
          overflow-y: auto;
        }

        .file-btn { position: relative; }

        .csv-help {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 24px;
          padding: 12px 16px;
          background: #ffffff;
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }

        .input-toggle-inline {
          display: flex;
          gap: 2px;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 8px;
        }

        .toggle-btn {
          padding: 8px 14px;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;
        }

        .toggle-btn.active {
          background: white;
          color: var(--accent-primary);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .paste-section {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          align-items: flex-start;
        }

        .paste-textarea {
          flex: 1;
          padding: 12px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-family: var(--font-sans);
          font-size: 13px;
          resize: vertical;
          min-height: 100px;
          background: #ffffff;
        }

        .paste-textarea:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.15);
        }

        /* Session Prompt Styles */
        .session-prompt-section {
          margin-bottom: 16px;
          background: linear-gradient(135deg, #f3e8ff 0%, #fae8ff 50%, #fdf4ff 100%);
          border: 1px solid #d8b4fe;
          border-radius: 12px;
          padding: 16px;
        }

        .session-prompt-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .session-prompt-icon {
          font-size: 20px;
        }

        .session-prompt-title {
          font-size: 14px;
          font-weight: 600;
          color: #7c3aed;
        }

        .session-prompt-hint {
          font-size: 12px;
          color: #a855f7;
          font-style: italic;
        }

        .session-prompt-textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #d8b4fe;
          border-radius: 8px;
          font-family: var(--font-sans);
          font-size: 13px;
          resize: vertical;
          min-height: 80px;
          background: rgba(255, 255, 255, 0.8);
          color: #581c87;
        }

        .session-prompt-textarea:focus {
          outline: none;
          border-color: #a855f7;
          box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.2);
          background: #ffffff;
        }

        .session-prompt-textarea::placeholder {
          color: #a78bfa;
        }

        .session-prompt-status {
          margin-top: 10px;
          font-size: 12px;
          color: #16a34a;
          font-weight: 500;
        }

        .btn.has-content {
          background: linear-gradient(135deg, #f3e8ff, #fae8ff);
          border-color: #d8b4fe;
          color: #7c3aed;
        }

        .btn.has-content:hover {
          background: linear-gradient(135deg, #ede9fe, #f5d0fe);
        }

        /* Pagination Styles */
        .pagination-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          padding: 16px 20px;
          background: #ffffff;
          border: 1px solid var(--border-color);
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
          color: var(--text-secondary);
          white-space: nowrap;
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
          background: #f8fafc;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-weight: 600;
        }

        .btn-page:hover:not(:disabled) {
          background: #e2e8f0;
          border-color: rgba(0, 0, 0, 0.15);
        }

        .btn-page:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .page-indicator {
          font-size: 13px;
          color: var(--text-primary);
          font-weight: 500;
          padding: 0 12px;
          white-space: nowrap;
        }

        .leads-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: var(--text-muted);
        }

        .empty-icon { font-size: 48px; display: block; margin-bottom: 16px; }
        .empty-hint { font-size: 13px; margin-top: 8px; }

        .lead-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #ffffff;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          transition: all 0.2s;
        }

        .lead-card.selected {
          border-color: var(--accent-primary);
          background: rgba(0, 102, 204, 0.02);
        }

        .lead-check {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .checkbox {
          width: 18px;
          height: 18px;
          accent-color: var(--accent-primary);
          cursor: pointer;
        }

        .bulk-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #ffffff;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          margin-bottom: 16px;
        }

        .bulk-toolbar.active {
          border-color: var(--accent-primary);
          background: rgba(0, 102, 204, 0.05);
        }

        .bulk-selection {
          display: flex;
          align-items: center;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .bulk-actions-group {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .bulk-action {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-label {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .btn-danger-text {
          background: none;
          border: none;
          color: #ef4444;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 6px;
        }

        .btn-danger-text:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .lead-number {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
        }

        .lead-fields {
          flex: 1;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .input {
          flex: 1;
          min-width: 150px;
          padding: 10px 12px;
          background: #ffffff;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 13px;
        }

        .input:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.15);
        }

        .input.small { min-width: 120px; max-width: 150px; }
        .input.select { min-width: 140px; max-width: 160px; }

        .knowledge-badge {
          display: flex;
          align-items: center;
          padding: 6px 10px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          color: #0284c7;
          white-space: nowrap;
        }

        .remove-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(239, 68, 68, 0.1);
          border: none;
          border-radius: 8px;
          color: #ef4444;
          cursor: pointer;
          transition: background 0.2s;
        }

        .remove-btn:hover { background: rgba(239, 68, 68, 0.2); }

        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          padding: 14px 18px;
          border-radius: 10px;
        }

        .alert-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #dc2626;
        }

        .results-card {
          margin-top: 24px;
          padding: 24px;
          background: #ffffff;
          border: 1px solid var(--border-color);
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .results-card h3 {
          margin-bottom: 20px;
          font-size: 16px;
        }

        .results-summary {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }

        .result-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 32px;
          border-radius: 12px;
        }

        .result-stat.success { background: rgba(34, 197, 94, 0.15); }
        .result-stat.error { background: rgba(239, 68, 68, 0.1); }

        .stat-num { font-size: 28px; font-weight: 700; }
        .result-stat.success .stat-num { color: #16a34a; }
        .result-stat.error .stat-num { color: #dc2626; }

        .stat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

        .results-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .result-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: #f8fafc;
          border-radius: 8px;
          font-size: 13px;
        }

        .result-business { font-weight: 500; flex: 1; }
        .result-email { color: var(--text-muted); }

        /* Progress Bar Styles */
        .progress-container {
          margin-bottom: 20px;
          padding: 20px;
          background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
          border: 1px solid #7dd3fc;
          border-radius: 12px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .progress-title {
          font-weight: 600;
          font-size: 14px;
          color: #0369a1;
        }

        .progress-count {
          font-size: 13px;
          color: #0284c7;
          font-weight: 500;
        }

        .progress-bar-track {
          height: 12px;
          background: rgba(255, 255, 255, 0.8);
          border-radius: 6px;
          overflow: hidden;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #0ea5e9, #06b6d4, #22c55e);
          border-radius: 6px;
          transition: width 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .progress-bar-fill::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .progress-percentage {
          text-align: center;
          margin-top: 8px;
          font-size: 12px;
          color: #0369a1;
          font-weight: 500;
        }

        /* Lead Status Styles */
        .lead-card.status-processing {
          border-color: #0ea5e9;
          background: rgba(14, 165, 233, 0.05);
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
        }

        .lead-card.status-sent {
          border-color: #22c55e;
          background: rgba(34, 197, 94, 0.05);
        }

        .lead-card.status-failed {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.05);
        }

        .lead-card.status-waiting {
          opacity: 0.7;
        }

        .lead-status-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 16px;
          z-index: 10;
          background: #ffffff;
          border: 2px solid;
        }

        .lead-status-badge.waiting {
          border-color: #94a3b8;
        }

        .lead-status-badge.processing {
          border-color: #0ea5e9;
          background: #f0f9ff;
        }

        .lead-status-badge.sent {
          border-color: #22c55e;
          background: #f0fdf4;
        }

        .lead-status-badge.failed {
          border-color: #ef4444;
          background: #fef2f2;
        }

        .lead-status-badge.enriching {
          border-color: #a855f7;
          background: #faf5ff;
          animation: pulse-enrich 2s ease-in-out infinite;
        }

        @keyframes pulse-enrich {
          0%, 100% { 
            box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4);
          }
          50% { 
            box-shadow: 0 0 0 8px rgba(168, 85, 247, 0);
          }
        }

        .lead-card {
          position: relative;
        }

        .status-icon.spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .lead-number.processing {
          background: #0ea5e9;
          color: white;
        }

        .lead-number.sent {
          background: #22c55e;
          color: white;
        }

        .lead-number.failed {
          background: #ef4444;
          color: white;
        }

        .input:disabled {
          background: #f8fafc;
          cursor: not-allowed;
          opacity: 0.7;
        }

        @media (max-width: 768px) {
          .actions-bar { flex-wrap: wrap; }
          .lead-fields { flex-direction: column; }
          .input { min-width: 100% !important; max-width: 100% !important; }
        }

        /* Campaign Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal {
          background: white;
          border-radius: 16px;
          padding: 28px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .modal h2 {
          margin: 0 0 20px 0;
          color: var(--text-primary);
        }

        .form-group {
          margin-bottom: 18px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: var(--text-secondary);
          font-size: 14px;
        }

        .no-smtp-warning {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 12px;
          color: #92400e;
          font-size: 14px;
        }

        .no-smtp-warning a {
          color: #0066cc;
          text-decoration: none;
          font-weight: 600;
        }

        .smtp-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .smtp-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: #f8fafc;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .smtp-option:hover {
          border-color: var(--accent-primary);
        }

        .smtp-option input[type="checkbox"] {
          width: 18px;
          height: 18px;
        }

        .smtp-name {
          font-weight: 500;
          color: var(--text-primary);
        }

        .smtp-host {
          font-size: 12px;
          color: var(--text-muted);
          margin-left: auto;
        }

        .smtp-warmup {
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 12px;
          background: #dcfce7;
          color: #16a34a;
          font-weight: 600;
        }

        .smtp-warmup.at-limit {
          background: #fee2e2;
          color: #dc2626;
        }

        .radio-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .radio-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: #f8fafc;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }

        .radio-option input[type="radio"] {
          width: 16px;
          height: 16px;
        }

        .campaign-summary {
          display: flex;
          gap: 16px;
          padding: 14px;
          background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
          border-radius: 10px;
          margin-bottom: 18px;
          font-weight: 500;
          color: #0369a1;
        }

        .modal-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .modal-actions .btn {
          flex: 1;
        }

        .toggle-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
        }

        .toggle-option input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--accent-primary);
        }

        .toggle-hint {
          display: block;
          margin-top: 6px;
          color: var(--text-muted);
          font-size: 12px;
        }
      `}</style>

      <style jsx global>{`
        html, body { margin: 0; padding: 0; background: #f8fafc; }
      `}</style>
    </>
  );
}
