// Niche Database Loader
// Loads SKYE's comprehensive niche database with pain points, solutions, and email hooks

import fs from 'fs';
import path from 'path';

// Cache the databases to avoid reading from disk every time
let _cachedNicheDB = null;
let _cachedMailerAddon = null;

/**
 * Load the niche database from JSON file
 */
export function loadNicheDatabase() {
    if (_cachedNicheDB) {
        return _cachedNicheDB;
    }

    try {
        const dbPath = path.join(process.cwd(), 'skye-niche-database.json');
        if (fs.existsSync(dbPath)) {
            const content = fs.readFileSync(dbPath, 'utf-8');
            _cachedNicheDB = JSON.parse(content);
            console.log(`📚 Niche database geladen: ${_cachedNicheDB.niches?.length || 0} niches`);
            return _cachedNicheDB;
        }
    } catch (error) {
        console.error('Error loading niche database:', error.message);
    }
    return null;
}

/**
 * Load the mailer addon (observations, CTAs, subjects, follow-ups)
 */
export function loadMailerAddon() {
    if (_cachedMailerAddon) {
        return _cachedMailerAddon;
    }

    try {
        const addonPath = path.join(process.cwd(), 'skye-mailer-addon.json');
        if (fs.existsSync(addonPath)) {
            const content = fs.readFileSync(addonPath, 'utf-8');
            _cachedMailerAddon = JSON.parse(content);
            console.log(`🎯 Mailer addon geladen: ${_cachedMailerAddon.skyeMailerAddon?.observationPlaybook?.observaties?.length || 0} observaties`);
            return _cachedMailerAddon;
        }
    } catch (error) {
        console.error('Error loading mailer addon:', error.message);
    }
    return null;
}

/**
 * Get a random observation from the playbook
 * @param {Array} siteSignals - Optional signals from scraper (e.g., "geen CTA", "traag")
 * @returns {Object|null} - Observation object with zin, checkVraag, impact
 */
export function getRandomObservation(siteSignals = []) {
    const addon = loadMailerAddon();
    if (!addon?.skyeMailerAddon?.observationPlaybook?.observaties) return null;

    const observations = addon.skyeMailerAddon.observationPlaybook.observaties;

    // If we have site signals, try to match
    if (siteSignals && siteSignals.length > 0) {
        const signalStr = siteSignals.join(' ').toLowerCase();
        const matched = observations.find(obs =>
            obs.trigger.some(t => signalStr.includes(t.toLowerCase()))
        );
        if (matched) return matched;
    }

    // Return random observation
    const idx = Math.floor(Math.random() * observations.length);
    return observations[idx];
}

/**
 * Get a random CTA from the library
 * @param {string} type - Optional type filter ("reply", "call")
 * @returns {Object|null}
 */
export function getRandomCTA(type = 'reply') {
    const addon = loadMailerAddon();
    if (!addon?.skyeMailerAddon?.ctaLibrary) return null;

    const ctas = addon.skyeMailerAddon.ctaLibrary.filter(c => !type || c.type === type);
    if (ctas.length === 0) return addon.skyeMailerAddon.ctaLibrary[0];

    const idx = Math.floor(Math.random() * ctas.length);
    return ctas[idx];
}

/**
 * Get a random subject line
 * @param {string} nicheId - Optional niche for variation
 * @param {string} bedrijfsnaam - Business name for placeholder
 * @returns {string}
 */
export function getRandomSubject(nicheId = null, bedrijfsnaam = '') {
    const addon = loadMailerAddon();
    if (!addon?.skyeMailerAddon?.subjectLibrary) return `Vraagje — ${bedrijfsnaam}`;

    const library = addon.skyeMailerAddon.subjectLibrary;
    let subjects = [...(library.neutral || [])];

    // Add niche-specific variations
    if (nicheId && library.nicheVariations?.[nicheId]) {
        subjects = [...subjects, ...library.nicheVariations[nicheId]];
    }

    const idx = Math.floor(Math.random() * subjects.length);
    let subject = subjects[idx];

    // Replace placeholders
    subject = subject.replace(/{bedrijfsnaam}/g, bedrijfsnaam);

    return subject;
}

/**
 * Get follow-up email templates
 * @param {Object} context - { naam, niche, statistiek }
 * @returns {Array} - Array of follow-up objects
 */
export function getFollowUpTemplates(context = {}) {
    const addon = loadMailerAddon();
    if (!addon?.skyeMailerAddon?.followupFramework) return [];

    const fw = addon.skyeMailerAddon.followupFramework;
    const followups = [];

    if (fw.followup1) {
        let template = fw.followup1.template;
        template = template.replace(/{naam}/g, context.naam || 'daar');
        template = template.replace(/{niche}/g, context.niche || 'jouw branche');
        template = template.replace(/{statistiek}/g, context.statistiek || '40% van website bezoekers vertrekt binnen 3 seconden');

        followups.push({
            delayDays: fw.followup1.delayDays || 2,
            subject: fw.followup1.subjectPrefix || 'Re: ',
            body: template
        });
    }

    if (fw.followup2) {
        let template = fw.followup2.template;
        template = template.replace(/{naam}/g, context.naam || 'daar');

        followups.push({
            delayDays: fw.followup2.delayDays || 5,
            subject: fw.followup2.subjectPrefix || 'Laatste: ',
            body: template
        });
    }

    return followups;
}

/**
 * Get the brand tone guidelines
 * @returns {Object}
 */
export function getBrandTone() {
    const addon = loadMailerAddon();
    return addon?.skyeMailerAddon?.brand?.tone || {
        stijl: ['direct', 'menselijk'],
        vermijd: ['hype', 'emoji-blokken']
    };
}

/**
 * Get quality gate rules
 * @returns {Object}
 */
export function getQualityGates() {
    const addon = loadMailerAddon();
    return addon?.skyeMailerAddon?.qualityGates || {
        hardFails: [],
        mustHave: []
    };
}

/**
 * Find the best matching niche based on detected niche from scraper
 * @param {string} detectedNiche - Niche detected by scraper (e.g., "tandarts", "restaurant")
 * @returns {Object|null} - Niche data or null
 */
export function findNicheData(detectedNiche) {
    const db = loadNicheDatabase();
    if (!db || !db.niches || !detectedNiche) return null;

    const searchTerm = detectedNiche.toLowerCase().trim();

    // Try exact ID match first
    let match = db.niches.find(n => n.id === searchTerm);
    if (match) return match;

    // Try matching by keywords
    match = db.niches.find(n => {
        if (!n.zoekwoorden) return false;
        return n.zoekwoorden.some(kw =>
            searchTerm.includes(kw.toLowerCase()) ||
            kw.toLowerCase().includes(searchTerm)
        );
    });
    if (match) return match;

    // Try partial match on name
    match = db.niches.find(n =>
        n.naam && (
            n.naam.toLowerCase().includes(searchTerm) ||
            searchTerm.includes(n.naam.toLowerCase().split(' ')[0])
        )
    );

    return match || null;
}

/**
 * Detect niche from scraper analysis content (headings, services)
 * @param {Object} siteAnalysis - Scraped content
 * @returns {string} - Detected niche ID
 */
export function detectNicheFromAnalysis(siteAnalysis) {
    if (!siteAnalysis) return 'generiek';

    const textToScan = [
        siteAnalysis.title,
        siteAnalysis.h1,
        ...(siteAnalysis.headings || []),
        ...(siteAnalysis.services || [])
    ].join(' ').toLowerCase();

    // Debug logging
    console.log(`🔍 Scannen van tekst (${textToScan.length} chars) voor niche detectie...`);
    if (textToScan.length < 50) {
        console.log(`⚠️ Zeer weinig tekst om te scannen: "${textToScan}"`);
    }

    const nicheKeywords = {
        'aannemer_bouw': ['aannemer', 'bouw', 'verbouw', 'renovatie', 'constructie', 'bouwwerken', 'stukadoor'],
        'schilder': ['schilder', 'lakwerk', 'behangen', 'schilderwerk', 'buitenschilder', 'schildersbedrijf'],
        'tuinier_hovenier': ['tuin', 'hovenier', 'tuinier', 'beplanting', 'bestrating', 'tuinontwerp', 'tuinaanleg'],
        'kapper_barbershop': ['kapper', 'kapsalon', 'barber', 'knippen', 'styling', 'hairstudio', 'barbershop', 'coiffeur'],
        'tandarts': ['tandarts', 'gebit', 'mondhygiënist', 'ortho', 'cliënt', 'tandartspraktijk'],
        'loodgieter': ['loodgieter', 'lekkage', 'verstopping', 'sanitair', 'riool', 'cv-ketel'],
        'advocaat_notaris': ['advocaat', 'notaris', 'juridisch', 'recht', 'kantoor', 'rechtsbijstand'],
        'psycholoog_therapeut': ['psycholoog', 'therapeut', 'therapie', 'coaching', 'behandeling', 'mentale'],
        'horeca_restaurant': ['restaurant', 'eten', 'menu', 'kaart', 'reserveren', 'brasserie', 'café', 'skylounge', 'lounge', 'keuken', 'kitchen', 'dining', 'gastvrijheid', 'gerechten', 'proeven', 'smaak']
    };

    for (const [id, keywords] of Object.entries(nicheKeywords)) {
        if (keywords.some(kw => textToScan.includes(kw))) {
            console.log(`✅ Niche gedeteteerd: ${id}`);
            return id;
        }
    }

    console.log(`❌ Geen niche keywords gevonden, fallback naar generiek.`);
    return 'generiek';
}

/**
 * Get random pain points for a niche (for variety in emails)
 * @param {Object} nicheData - Niche data object
 * @param {number} count - Number of pain points to return
 * @returns {Array} - Array of pain point objects
 */
export function getRandomPainPoints(nicheData, count = 3) {
    if (!nicheData?.pijnpunten || nicheData.pijnpunten.length === 0) {
        return [];
    }

    const shuffled = [...nicheData.pijnpunten].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

/**
 * Get random solutions for a niche
 * @param {Object} nicheData - Niche data object
 * @param {number} countPerCategory - Solutions per category
 * @returns {Object} - { webdesign: [...], automatisering: [...] }
 */
export function getRandomSolutions(nicheData, countPerCategory = 2) {
    if (!nicheData?.oplossingen) {
        return { webdesign: [], automatisering: [] };
    }

    const result = {};

    for (const category of ['webdesign', 'automatisering', 'content']) {
        const solutions = nicheData.oplossingen[category] || [];
        const shuffled = [...solutions].sort(() => 0.5 - Math.random());
        result[category] = shuffled.slice(0, countPerCategory);
    }

    return result;
}

/**
 * Get a random email hook for the niche
 * @param {Object} nicheData - Niche data object
 * @returns {string|null}
 */
export function getRandomEmailHook(nicheData) {
    if (!nicheData?.emailHooks || nicheData.emailHooks.length === 0) {
        return null;
    }
    const idx = Math.floor(Math.random() * nicheData.emailHooks.length);
    return nicheData.emailHooks[idx];
}

/**
 * Get a random preheader for the niche
 * @param {Object} nicheData - Niche data object
 * @returns {string|null}
 */
export function getRandomPreheader(nicheData) {
    if (!nicheData?.preheaders || nicheData.preheaders.length === 0) {
        return null;
    }
    const idx = Math.floor(Math.random() * nicheData.preheaders.length);
    return nicheData.preheaders[idx];
}

/**
 * Format pain points for the AI prompt
 * @param {Array} painPoints - Array of pain point objects
 * @returns {string}
 */
export function formatPainPointsForPrompt(painPoints) {
    if (!painPoints || painPoints.length === 0) return '';

    return painPoints.map((pp, i) => {
        const lines = [`PIJNPUNT ${i + 1}: ${pp.probleem}`];
        if (pp.impact) lines.push(`   Impact: ${pp.impact}`);
        if (pp.kostenIndicatie) lines.push(`   Kosten: ${pp.kostenIndicatie}`);
        return lines.join('\n');
    }).join('\n\n');
}

/**
 * Format solutions for the AI prompt
 * @param {Object} solutions - Solutions object with webdesign and automatisering
 * @returns {string}
 */
export function formatSolutionsForPrompt(solutions) {
    if (!solutions) return '';

    const lines = [];

    if (solutions.webdesign?.length > 0) {
        lines.push('DESIGN OPLOSSINGEN:');
        solutions.webdesign.forEach(s => {
            lines.push(`   - ${s.oplossing}`);
            if (s.beschrijving) lines.push(`      → ${s.beschrijving}`);
            if (s.resultaat) lines.push(`      Resultaat: ${s.resultaat}`);
        });
    }

    if (solutions.automatisering?.length > 0) {
        lines.push('\nAUTOMATISERING OPLOSSINGEN:');
        solutions.automatisering.forEach(s => {
            lines.push(`   - ${s.oplossing}`);
            if (s.beschrijving) lines.push(`      → ${s.beschrijving}`);
            if (s.resultaat) lines.push(`      Resultaat: ${s.resultaat}`);
        });
    }

    return lines.join('\n');
}

/**
 * Get a complete niche context for the AI prompt (includes addon data)
 * @param {string} detectedNiche - Detected niche from scraper
 * @param {Array} siteSignals - Optional signals from scraper for observation matching
 * @param {string} businessName - Business name for subject personalization
 * @returns {Object|null}
 */
export function getNicheContext(detectedNiche, siteSignals = [], businessName = '') {
    const nicheData = findNicheData(detectedNiche);

    // Get addon data even if niche not found
    const observation = getRandomObservation(siteSignals);
    const cta = getRandomCTA('reply');
    const subject = getRandomSubject(nicheData?.id || null, businessName);
    const brandTone = getBrandTone();
    const qualityGates = getQualityGates();

    if (!nicheData) {
        // Return addon data only if no niche match
        return {
            niche: null,
            nicheNaam: 'Algemeen bedrijf',
            nicheId: 'general',
            painPoints: [],
            solutions: { webdesign: [], automatisering: [] },
            painPointsFormatted: '',
            solutionsFormatted: '',
            emailHook: null,
            preheader: null,
            statistieken: [],
            bezwaarWeerlegging: {},
            // Addon data
            observation,
            cta,
            suggestedSubject: subject,
            brandTone,
            qualityGates,
            followups: getFollowUpTemplates({ niche: 'jouw branche' })
        };
    }

    const painPoints = getRandomPainPoints(nicheData, 3);
    const solutions = getRandomSolutions(nicheData, 2);

    return {
        // Niche database data
        niche: nicheData,
        nicheNaam: nicheData.naam,
        nicheId: nicheData.id,
        painPoints,
        solutions,
        painPointsFormatted: formatPainPointsForPrompt(painPoints),
        solutionsFormatted: formatSolutionsForPrompt(solutions),
        emailHook: getRandomEmailHook(nicheData),
        preheader: getRandomPreheader(nicheData),
        statistieken: nicheData.statistieken || [],
        bezwaarWeerlegging: nicheData.bezwaarWeerlegging || {},
        // Addon data
        observation,
        cta,
        suggestedSubject: subject,
        brandTone,
        qualityGates,
        followups: getFollowUpTemplates({
            niche: nicheData.naam,
            statistiek: nicheData.statistieken?.[0] || null
        })
    };
}

// Cache for V2 observations
let _cachedNicheObservationsV2 = null;

/**
 * Load the V2 niche observations from JSON file
 */
export function loadNicheObservationsV2() {
    if (_cachedNicheObservationsV2) {
        return _cachedNicheObservationsV2;
    }

    try {
        const dbPath = path.join(process.cwd(), 'niche-observaties-v2.json');
        if (fs.existsSync(dbPath)) {
            const content = fs.readFileSync(dbPath, 'utf-8');
            _cachedNicheObservationsV2 = JSON.parse(content);
            return _cachedNicheObservationsV2;
        }
    } catch (error) {
        console.error('Error loading niche observations V2:', error.message);
    }
    return null;
}

/**
 * Maps scraper analysis to JSON signals
 * @param {Object} siteAnalysis - Analysis from scraper
 * @returns {Array} - List of signals
 */
export function mapAnalysisToSignals(siteAnalysis = {}) {
    const signals = [];
    if (!siteAnalysis) return signals;

    // Direct issues
    if (siteAnalysis.issues) {
        if (siteAnalysis.issues.some(i => i.toLowerCase().includes('afspraak') || i.toLowerCase().includes('boeking'))) signals.push('NO_BOOKING');
        if (siteAnalysis.issues.some(i => i.toLowerCase().includes('review') || i.toLowerCase().includes('ervaring'))) signals.push('NO_REVIEWS');
        if (siteAnalysis.issues.some(i => i.toLowerCase().includes('portfolio') || i.toLowerCase().includes('project'))) signals.push('NO_PORTFOLIO');
        if (siteAnalysis.issues.some(i => i.toLowerCase().includes('contact') || i.toLowerCase().includes('tel'))) signals.push('NO_PHONE');
        if (siteAnalysis.isOffline) signals.push('OFFLINE');
    }

    // Feature flags
    if (siteAnalysis.hasOpeningHours === false) signals.push('NO_HOURS');
    if (!siteAnalysis.city) signals.push('NO_LOCATION');
    if (!siteAnalysis.stats || siteAnalysis.stats.length === 0) signals.push('NO_STATS');
    if (!siteAnalysis.headings || siteAnalysis.headings.length === 0 || siteAnalysis.headings[0]?.length < 15) signals.push('VAGUE_INTRO');

    return [...new Set(signals)];
}

/**
 * Get the master prompt context with semantic variants
 * @param {string} detectedNiche - Detected niche ID
 * @param {Object} siteAnalysis - Analysis from scraper
 * @returns {Object|null}
 */
export function getMasterPromptContext(detectedNiche, siteAnalysis = {}) {
    const db = loadNicheObservationsV2();
    if (!db || !db.niches) return null;

    const signals = mapAnalysisToSignals(siteAnalysis);

    // If niche is generic/bedrijf, try to detect it from content
    let nicheId = detectedNiche?.toLowerCase().trim().replace(/ /g, '_');
    if (!nicheId || nicheId === 'bedrijf' || nicheId === 'generiek') {
        nicheId = detectNicheFromAnalysis(siteAnalysis);
        console.log(`🔍 Niche gedetecteerd uit content: ${nicheId}`);
    }

    // Find niche or fallback to general
    let niche = db.niches[nicheId];
    if (!niche) {
        // Try fuzzy matches on the keys
        const keys = Object.keys(db.niches);
        const match = keys.find(k =>
            nicheId?.includes(k) ||
            k.includes(nicheId) ||
            (nicheId?.split('_')[0] && k.includes(nicheId.split('_')[0]))
        );
        niche = db.niches[match || 'generiek'];
    }

    if (!niche || !niche.observaties) return null;

    // Filter observations by signals if any match
    let validObs = niche.observaties;
    if (signals.length > 0) {
        const matchingObs = niche.observaties.filter(obs =>
            obs.signals && obs.signals.some(s => signals.includes(s))
        );
        if (matchingObs.length > 0) {
            validObs = matchingObs;
        }
    }

    // Pick a random observation
    const selectedObs = validObs[Math.floor(Math.random() * validObs.length)];

    // Pick variants
    const zin = selectedObs.zin_varianten[Math.floor(Math.random() * selectedObs.zin_varianten.length)];
    const gedrag = selectedObs.gedrag_varianten[Math.floor(Math.random() * selectedObs.gedrag_varianten.length)];
    const patroon = selectedObs.patroon_varianten[Math.floor(Math.random() * selectedObs.patroon_varianten.length)];

    // Pick CTA (niche-specific or general)
    const ctaPool = niche.ctas || db.cta_varianten || [];
    const cta = ctaPool[Math.floor(Math.random() * ctaPool.length)];

    return {
        zin,
        gedrag,
        patroon,
        cta,
        nicheId: nicheId,
        signals
    };
}

export default {
    loadNicheDatabase,
    loadMailerAddon,
    loadNicheObservationsV2,
    findNicheData,
    getRandomPainPoints,
    getRandomSolutions,
    getRandomEmailHook,
    getRandomPreheader,
    getRandomObservation,
    getRandomCTA,
    getRandomSubject,
    getFollowUpTemplates,
    getBrandTone,
    getQualityGates,
    formatPainPointsForPrompt,
    formatSolutionsForPrompt,
    getNicheContext,
    getMasterPromptContext
};
