// utils/database.js
// Database voor email analytics - Vercel KV in productie, SQLite lokaal

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// === VERCEL KV IMPLEMENTATION ===
let kv = null;

async function getKV() {
  if (!kv) {
    const { kv: vercelKV } = await import('@vercel/kv');
    kv = vercelKV;
  }
  return kv;
}

// Key prefixes voor KV
const KEYS = {
  email: (id) => `email:${id}`,
  emailList: 'emails:list',
  clicks: (emailId) => `clicks:${emailId}`,
  clicksList: 'clicks:list',
  replies: (emailId) => `replies:${emailId}`,
  settings: 'settings',
  stats: 'stats:cache'
};

// === SQLITE FALLBACK (lokale development) ===
let db = null;
let Database = null;

function getSQLite() {
  if (!db) {
    try {
      Database = require('better-sqlite3');
      const path = require('path');
      const fs = require('fs');

      const DB_PATH = path.join(process.cwd(), 'data', 'analytics.db');
      const dataDir = path.dirname(DB_PATH);

      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      db = new Database(DB_PATH);
      db.pragma('journal_mode = WAL');
      initializeSQLiteSchema();
    } catch (e) {
      console.warn('SQLite not available, using in-memory fallback');
      return null;
    }
  }
  return db;
}

function initializeSQLiteSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      to_email TEXT NOT NULL,
      business_name TEXT,
      website_url TEXT,
      niche TEXT,
      email_tone TEXT,
      subject TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'sent',
      click_count INTEGER DEFAULT 0,
      has_reply INTEGER DEFAULT 0,
      reply_at DATETIME,
      follow_up_needed INTEGER DEFAULT 1,
      notes TEXT,
      contact_person TEXT
    );
    
    CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id TEXT NOT NULL,
      clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      link_type TEXT,
      ip_address TEXT,
      user_agent TEXT
    );
    
    CREATE TABLE IF NOT EXISTS replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id TEXT NOT NULL,
      gmail_thread_id TEXT,
      received_at DATETIME,
      snippet TEXT
    );
    
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('follow_up_days', '3');
}

// === UNIFIED API ===

// Save email
async function saveEmail(emailData) {
  if (isVercel) {
    const kvClient = await getKV();
    const email = {
      id: emailData.id,
      to_email: emailData.toEmail,
      business_name: emailData.businessName,
      website_url: emailData.websiteUrl,
      niche: emailData.niche,
      email_tone: emailData.emailTone,
      subject: emailData.subject,
      contact_person: emailData.contactPerson || null,
      sent_at: new Date().toISOString(),
      status: 'sent',
      click_count: 0,
      has_reply: 0,
      follow_up_needed: 1
    };

    await kvClient.set(KEYS.email(emailData.id), email);
    await kvClient.lpush(KEYS.emailList, emailData.id);

    return emailData.id;
  } else {
    const database = getSQLite();
    if (!database) return emailData.id;

    const stmt = database.prepare(`
      INSERT INTO emails (id, to_email, business_name, website_url, niche, email_tone, subject, contact_person)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      emailData.id,
      emailData.toEmail,
      emailData.businessName,
      emailData.websiteUrl,
      emailData.niche,
      emailData.emailTone,
      emailData.subject,
      emailData.contactPerson || null
    );

    return emailData.id;
  }
}

// Get single email
async function getEmail(id) {
  if (isVercel) {
    const kvClient = await getKV();
    return await kvClient.get(KEYS.email(id));
  } else {
    const database = getSQLite();
    if (!database) return null;
    return database.prepare('SELECT * FROM emails WHERE id = ?').get(id);
  }
}

// Get all emails with filters
async function getAllEmails(filters = {}) {
  const { sortBy = 'sent_at', sortOrder = 'desc' } = filters;

  if (isVercel) {
    const kvClient = await getKV();
    const emailIds = await kvClient.lrange(KEYS.emailList, 0, filters.limit || 100);

    if (!emailIds || emailIds.length === 0) return [];

    const emails = await Promise.all(
      emailIds.map(id => kvClient.get(KEYS.email(id)))
    );

    let filtered = emails.filter(e => e !== null);

    // Apply filters
    if (filters.niche) filtered = filtered.filter(e => e.niche === filters.niche);
    if (filters.emailTone) filtered = filtered.filter(e => e.email_tone === filters.emailTone);
    if (filters.hasReply !== undefined) filtered = filtered.filter(e => e.has_reply === (filters.hasReply ? 1 : 0));
    if (filters.followUpNeeded) filtered = filtered.filter(e => e.follow_up_needed === 1 && e.has_reply === 0);

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // Handle special cases
      if (sortBy === 'sent_at') {
        aVal = new Date(aVal || 0);
        bVal = new Date(bVal || 0);
      } else if (sortBy === 'click_count' || sortBy === 'has_reply') {
        aVal = aVal || 0;
        bVal = bVal || 0;
      } else {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return filtered;
  } else {
    const database = getSQLite();
    if (!database) return [];

    let query = 'SELECT * FROM emails WHERE 1=1';
    const params = [];

    if (filters.niche) { query += ' AND niche = ?'; params.push(filters.niche); }
    if (filters.status) { query += ' AND status = ?'; params.push(filters.status); }
    if (filters.emailTone) { query += ' AND email_tone = ?'; params.push(filters.emailTone); }
    if (filters.hasReply !== undefined) { query += ' AND has_reply = ?'; params.push(filters.hasReply ? 1 : 0); }
    if (filters.fromDate) { query += ' AND sent_at >= ?'; params.push(filters.fromDate); }
    if (filters.toDate) { query += ' AND sent_at <= ?'; params.push(filters.toDate); }
    if (filters.followUpNeeded) { query += ' AND follow_up_needed = 1 AND has_reply = 0'; }

    // Dynamic sorting with whitelist for security
    const allowedSortColumns = ['sent_at', 'business_name', 'to_email', 'niche', 'email_tone', 'click_count', 'has_reply', 'status'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'sent_at';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortColumn} ${sortDirection}`;

    if (filters.limit) { query += ' LIMIT ?'; params.push(filters.limit); }

    return database.prepare(query).all(...params);
  }
}

// Record click
async function recordClick(emailId, linkType, ipAddress = null, userAgent = null) {
  if (isVercel) {
    const kvClient = await getKV();

    // Get current email and increment click count
    const email = await kvClient.get(KEYS.email(emailId));
    if (email) {
      email.click_count = (email.click_count || 0) + 1;
      await kvClient.set(KEYS.email(emailId), email);
    }

    // Store click event
    const click = {
      email_id: emailId,
      link_type: linkType,
      clicked_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent
    };
    await kvClient.lpush(KEYS.clicks(emailId), JSON.stringify(click));

    return true;
  } else {
    const database = getSQLite();
    if (!database) return true;

    database.prepare(`
      INSERT INTO clicks (email_id, link_type, ip_address, user_agent)
      VALUES (?, ?, ?, ?)
    `).run(emailId, linkType, ipAddress, userAgent);

    database.prepare('UPDATE emails SET click_count = click_count + 1 WHERE id = ?').run(emailId);

    return true;
  }
}

// Mark email as replied
async function markEmailAsReplied(id, replyAt = new Date().toISOString()) {
  if (isVercel) {
    const kvClient = await getKV();
    const email = await kvClient.get(KEYS.email(id));
    if (email) {
      email.has_reply = 1;
      email.reply_at = replyAt;
      email.status = 'replied';
      email.follow_up_needed = 0;
      await kvClient.set(KEYS.email(id), email);
    }
  } else {
    const database = getSQLite();
    if (!database) return;

    database.prepare(`
      UPDATE emails 
      SET has_reply = 1, reply_at = ?, status = 'replied', follow_up_needed = 0 
      WHERE id = ?
    `).run(replyAt, id);
  }
}

// Save reply
async function saveReply(emailId, gmailThreadId, receivedAt, snippet) {
  if (isVercel) {
    const kvClient = await getKV();
    const reply = { email_id: emailId, gmail_thread_id: gmailThreadId, received_at: receivedAt, snippet };
    await kvClient.lpush(KEYS.replies(emailId), JSON.stringify(reply));
    await markEmailAsReplied(emailId, receivedAt);
  } else {
    const database = getSQLite();
    if (!database) return;

    database.prepare(`
      INSERT INTO replies (email_id, gmail_thread_id, received_at, snippet)
      VALUES (?, ?, ?, ?)
    `).run(emailId, gmailThreadId, receivedAt, snippet);

    markEmailAsReplied(emailId, receivedAt);
  }
}

// Mark follow-up done
async function markFollowUpDone(id) {
  if (isVercel) {
    const kvClient = await getKV();
    const email = await kvClient.get(KEYS.email(id));
    if (email) {
      email.follow_up_needed = 0;
      await kvClient.set(KEYS.email(id), email);
    }
  } else {
    const database = getSQLite();
    if (!database) return;
    database.prepare('UPDATE emails SET follow_up_needed = 0 WHERE id = ?').run(id);
  }
}

// Update email status
async function updateEmailStatus(id, status) {
  if (isVercel) {
    const kvClient = await getKV();
    const email = await kvClient.get(KEYS.email(id));
    if (email) {
      email.status = status;
      await kvClient.set(KEYS.email(id), email);
    }
  } else {
    const database = getSQLite();
    if (!database) return;
    database.prepare('UPDATE emails SET status = ? WHERE id = ?').run(status, id);
  }
}

// Get follow-up emails
async function getFollowUpEmails(daysThreshold = null) {
  if (daysThreshold === null) {
    daysThreshold = parseInt(await getSetting('follow_up_days') || '3');
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

  const emails = await getAllEmails({ followUpNeeded: true });
  return emails.filter(e => new Date(e.sent_at) <= cutoffDate);
}

// Get stats
async function getStats() {
  const emails = await getAllEmails({});

  const totalEmails = emails.length;
  const totalClicks = emails.reduce((sum, e) => sum + (e.click_count || 0), 0);
  const totalReplies = emails.filter(e => e.has_reply).length;
  const pendingFollowUps = emails.filter(e => e.follow_up_needed && !e.has_reply).length;

  // Per niche stats
  const nicheMap = {};
  emails.forEach(e => {
    const niche = e.niche || 'onbekend';
    if (!nicheMap[niche]) nicheMap[niche] = { niche, total: 0, clicks: 0, replies: 0 };
    nicheMap[niche].total++;
    nicheMap[niche].clicks += e.click_count || 0;
    nicheMap[niche].replies += e.has_reply || 0;
  });

  // Per tone stats
  const toneMap = {};
  emails.forEach(e => {
    const tone = e.email_tone || 'onbekend';
    if (!toneMap[tone]) toneMap[tone] = { email_tone: tone, total: 0, clicks: 0, replies: 0 };
    toneMap[tone].total++;
    toneMap[tone].clicks += e.click_count || 0;
    toneMap[tone].replies += e.has_reply || 0;
  });

  // Recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentEmails = emails.filter(e => new Date(e.sent_at) >= sevenDaysAgo);
  const activityMap = {};
  recentEmails.forEach(e => {
    const date = e.sent_at.split('T')[0];
    if (!activityMap[date]) activityMap[date] = { date, sent: 0, clicks: 0, replies: 0 };
    activityMap[date].sent++;
    activityMap[date].clicks += e.click_count || 0;
    activityMap[date].replies += e.has_reply || 0;
  });

  return {
    summary: {
      totalEmails,
      totalClicks,
      totalReplies,
      pendingFollowUps,
      clickRate: totalEmails > 0 ? (totalClicks / totalEmails * 100).toFixed(1) : 0,
      replyRate: totalEmails > 0 ? (totalReplies / totalEmails * 100).toFixed(1) : 0
    },
    nicheStats: Object.values(nicheMap),
    toneStats: Object.values(toneMap),
    recentActivity: Object.values(activityMap).sort((a, b) => b.date.localeCompare(a.date))
  };
}

// Settings
async function getSetting(key) {
  if (isVercel) {
    const kvClient = await getKV();
    const settings = await kvClient.get(KEYS.settings) || {};
    return settings[key] || null;
  } else {
    const database = getSQLite();
    if (!database) return null;
    const row = database.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }
}

async function setSetting(key, value) {
  if (isVercel) {
    const kvClient = await getKV();
    const settings = await kvClient.get(KEYS.settings) || {};
    settings[key] = value;
    await kvClient.set(KEYS.settings, settings);
  } else {
    const database = getSQLite();
    if (!database) return;
    database.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }
}

async function getAllSettings() {
  if (isVercel) {
    const kvClient = await getKV();
    return await kvClient.get(KEYS.settings) || { follow_up_days: '3' };
  } else {
    const database = getSQLite();
    if (!database) return { follow_up_days: '3' };
    const rows = database.prepare('SELECT key, value FROM settings').all();
    return rows.reduce((acc, row) => { acc[row.key] = row.value; return acc; }, {});
  }
}

// Find email by recipient
async function findEmailByRecipient(toEmail) {
  const emails = await getAllEmails({});
  return emails.find(e => e.to_email === toEmail) || null;
}

// Get unique values for filters
async function getUniqueNiches() {
  const emails = await getAllEmails({});
  return [...new Set(emails.map(e => e.niche).filter(Boolean))];
}

async function getUniqueTones() {
  const emails = await getAllEmails({});
  return [...new Set(emails.map(e => e.email_tone).filter(Boolean))];
}

// Compatibility exports (some are now async)
module.exports = {
  // Email CRUD
  saveEmail,
  getEmail,
  getAllEmails,
  updateEmailStatus,
  markEmailAsReplied,
  markFollowUpDone,
  // Click tracking
  recordClick,
  getClicksForEmail: async (emailId) => [], // Simplified for now
  // Reply tracking
  saveReply,
  getRepliesForEmail: async (emailId) => [], // Simplified for now
  // Follow-ups
  getFollowUpEmails,
  // Statistics
  getStats,
  // Settings
  getSetting,
  setSetting,
  getAllSettings,
  // Utilities
  findEmailByRecipient,
  getUniqueNiches,
  getUniqueTones,
  // Helper
  isVercel
};
