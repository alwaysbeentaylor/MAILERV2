import nodemailer from "nodemailer";
import OpenAI from "openai";
import * as cheerio from "cheerio";
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { v4 as uuidv4 } from 'uuid';
import { loadNiches } from '../../utils/knowledge';
import { analyzeWebsite } from '../../utils/scraper';
import { saveEmail } from '../../utils/database';
import {
  AppError,
  ERROR_CODES,
  formatErrorResponse,
  logError,
  wrapError
} from '../../utils/error-handler';
// 📧 Mailgun API Client
import { isMailgunEnabled, sendEmailViaMailgun } from '../../utils/mailgun-client';
// 🚀 Resend API Client (PRIMARY)
import { isResendEnabled, sendEmailViaResend } from '../../utils/resend-client';
// 📬 MX Record Validator
import { validateMX } from '../../utils/mx-validator';
// 🔧 API Settings (user toggles)
import { isApiEnabled, loadApiSettings } from '../../utils/api-settings';
// 📚 Niche Database (pain points, solutions, hooks)
import { getNicheContext, getMasterPromptContext } from '../../utils/niche-database';
// ☁️ AWS SES Client (FALLBACK 2)
import { isSESEnabled, sendEmailViaSES } from '../../utils/ses-client';

// Initialize OpenAI only if API key is present
let openai = null;
if (process.env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (error) {
    console.error('❌ Fout bij initialiseren OpenAI:', error.message);
  }
}

// Cache voor geladen data (uitgeschakeld in development voor live reloading)
let _cachedNiches = null;
let _cachedPrompts = {};
const isDev = process.env.NODE_ENV !== 'production';

// === KNOWLEDGE BASE LOADERS ===

// analyzeWebsite and loadNiches imported from utils

// Laad prompt template uit /knowledge/prompts/tone-{tone}.md
function loadPromptTemplate(tone) {
  // In development: altijd vers laden voor live updates
  if (!isDev && _cachedPrompts[tone]) return _cachedPrompts[tone];

  const defaultTemplate = {
    style: "Zakelijk",
    subjectTemplates: ["{businessName} website check"],
    introExample: "Ik keek naar uw site...",
    resultExample: "Dit levert meer klanten op.",
    ctaExample: "Zullen we bellen?",
    auditPoints: "- Punt 1\n- Punt 2",
    solutionPoints: "- Oplossing 1\n- Oplossing 2",
    emojiLimit: 5
  };

  try {
    const filePath = path.join(process.cwd(), 'knowledge', 'prompts', `tone-${tone}.md`);
    if (!fs.existsSync(filePath)) {
      return defaultTemplate;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const { data, content: body } = matter(content);

    const parseSection = (header) => {
      const match = body.match(new RegExp(`# ${header}\\s+([\\s\\S]*?)(?=\\n#|$)`, 'i'));
      return match ? match[1].trim() : '';
    };

    const template = {
      style: parseSection('Style Instructions'),
      subjectTemplates: parseSection('Subject Templates').split('\n').filter(l => l.startsWith('-')).map(l => l.replace(/^-\s*/, '').trim()),
      introExample: parseSection('Intro Example').replace(/^"/, '').replace(/"$/, ''),
      resultExample: parseSection('Result Example').replace(/^"/, '').replace(/"$/, ''),
      ctaExample: parseSection('CTA Example').replace(/^"/, '').replace(/"$/, ''),
      auditPoints: parseSection('Audit Points'),
      solutionPoints: parseSection('Solution Points'),
      emojiLimit: data.emoji_limit || 5
    };

    _cachedPrompts[tone] = template;
    return template;

  } catch (error) {
    console.error(`Error loading prompt for ${tone}:`, error);
    return defaultTemplate;
  }
}

// Niche-specifieke stats voor dynamische content (Pre-header etc.)
// Helper om stats op te halen (vervangt oude SHARED_NICHE_STATS)
function getNicheStat(niche) {
  const niches = loadNiches();
  return niches[niche]?.stat || '5+ nieuwe klanten';
}


// Genereer Hormozi-style email op basis van site analyse
async function generateEmailWithAnalysis({ businessName, websiteUrl, contactPerson, emailTone, siteAnalysis, sessionPrompt = "", humanize = false }) {
  // Laad tone instellingen dynamisch uit MD files
  const toneSettings = loadPromptTemplate(emailTone);

  // 📚 Laad niche-specifieke context uit de database + addon
  const detectedNiche = siteAnalysis?.niche || siteAnalysis?.aiNiche || 'bedrijf';
  const siteSignals = siteAnalysis?.issues || []; // Use detected issues as signals
  const nicheContext = getNicheContext(detectedNiche, siteSignals, businessName);
  const masterPromptV2 = getMasterPromptContext(detectedNiche, siteAnalysis);

  if (masterPromptV2) {
    console.log(`🚀 Master Prompt V2 geladen voor: ${detectedNiche}`);
    console.log(`   → Signals: ${masterPromptV2.signals.join(', ') || 'geen'}`);
  }

  if (nicheContext) {
    console.log(`📚 Niche database match: ${nicheContext.nicheNaam}`);
    console.log(`   → ${nicheContext.painPoints?.length || 0} pijnpunten geladen`);
    console.log(`   → Observatie: "${nicheContext.observation?.id || 'random'}"`);
    console.log(`   → CTA: "${nicheContext.cta?.id || 'default'}"`);
  }

  const toneStyle = toneSettings.style;
  const subjectOptions = toneSettings.subjectTemplates;
  // Pick random subject fallback if list is empty
  const selectedSubjectTemplate = (subjectOptions && subjectOptions.length > 0)
    ? subjectOptions[Math.floor(Math.random() * subjectOptions.length)]
    : `${businessName} - website check`;

  const issuesList = siteAnalysis.issues?.length > 0
    ? siteAnalysis.issues.map(i => `- ${i}`).join('\n')
    : "- Site lijkt basis op orde, maar kan altijd beter converteren";

  // === PERSONALISATIE: PRIORITEIT = VERHAAL/ABOUT BOVEN HOMEPAGE ===
  // 
  // NIEUW: We prioriteren data die laat zien dat we het bedrijf BEGRIJPEN, niet alleen "zagen".
  // Over-ons/verhaal content is veel persoonlijker dan een random homepage-element.
  //

  // === PRIMARY HOOK: Verhaal/Missie/Origin (meest persoonlijk) ===
  let primaryHook = null;
  let primaryHookType = null; // 'story', 'owner', 'team', 'generic'

  // Prioriteit 1: Story hooks (missie, visie, passie, begin-verhaal)
  if (siteAnalysis.foundStoryHooks?.[0]) {
    const story = siteAnalysis.foundStoryHooks[0];
    primaryHook = `${story.type === 'missie' ? 'Jullie missie' : story.type === 'passie' ? 'Jullie passie' : 'Jullie verhaal'}: "${story.text.slice(0, 100)}${story.text.length > 100 ? '...' : ''}"`;
    primaryHookType = 'story';
  }
  // Prioriteit 2: About content (algemene over-ons tekst)
  else if (siteAnalysis.aboutContent && siteAnalysis.aboutContent.length > 50) {
    primaryHook = `Over jullie: "${siteAnalysis.aboutContent.slice(0, 120)}..."`;
    primaryHookType = 'story';
  }
  // Prioriteit 3: Owner/oprichter (persoonlijk)
  else if (siteAnalysis.ownerNames?.[0]) {
    primaryHook = `Opgericht door ${siteAnalysis.ownerNames[0]}`;
    primaryHookType = 'owner';
  }
  // Prioriteit 4: Team met rollen
  else if (siteAnalysis.teamMembersWithRoles?.[0]) {
    const tm = siteAnalysis.teamMembersWithRoles[0];
    primaryHook = `${tm.name} als ${tm.role}`;
    primaryHookType = 'team';
  }
  // Prioriteit 5: Team naam alleen
  else if (siteAnalysis.teamMembers?.[0]) {
    primaryHook = `Teamlid ${siteAnalysis.teamMembers[0]}`;
    primaryHookType = 'team';
  }

  // === SECONDARY HOOK: Wat ze DOEN (diensten, specialisaties, reviews) ===
  let secondaryHook = null;

  // Prioriteit 1: Specialisatie (laat begrip zien)
  if (siteAnalysis.specializations?.[0]) {
    secondaryHook = `Gespecialiseerd in: "${siteAnalysis.specializations[0]}"`;
  }
  // Prioriteit 2: Claims met bewijskracht
  else if (siteAnalysis.claims?.[0]) {
    secondaryHook = `Claim: "${siteAnalysis.claims[0]}"`;
  }
  // Prioriteit 3: Diensten
  else if (siteAnalysis.services?.[0]) {
    secondaryHook = `Dienst: "${siteAnalysis.services[0]}"`;
  }
  // Prioriteit 4: Review
  else if (siteAnalysis.testimonials?.[0]) {
    const t = siteAnalysis.testimonials[0];
    secondaryHook = `Review${t.author ? ` van ${t.author}` : ''}: "${t.text.slice(0, 60)}..."`;
  }

  // === TERTIARY HOOK: Extra context (stad, slogans) ===
  let tertiaryHook = null;
  if (siteAnalysis.city) {
    tertiaryHook = `Gevestigd in ${siteAnalysis.city}`;
  } else if (siteAnalysis.slogans?.[0]) {
    tertiaryHook = `Slogan: "${siteAnalysis.slogans[0]}"`;
  }

  // Legacy compatibility
  const hookA = primaryHook;
  const hookB = secondaryHook || tertiaryHook;

  // Determine personalization strength
  const hasDeepAboutData = primaryHookType === 'story' || primaryHookType === 'owner';
  const hasStrongPersonalization = primaryHook && secondaryHook;
  const hasSpecificIntroLink = !!primaryHook || !!secondaryHook || siteAnalysis.city || siteAnalysis.niche !== 'bedrijf';

  // Selecteer het belangrijkste probleem
  const mainIssue = siteAnalysis.issues?.[0] || 'de site kan beter converteren';

  // Kennisbank: wordt alleen gebruikt als Gemini zelf confidence medium/high aangeeft
  const allNicheData = loadNiches();
  const knownNiches = Object.keys(allNicheData || {}).sort();
  const genericResultClaim = 'meer aanvragen die al (bijna) overtuigd zijn, met minder handwerk';
  const resultClaim = genericResultClaim;
  const painPoints = '';
  const nicheCheatSheet = knownNiches.length > 0
    ? knownNiches.map((n) => {
      const d = allNicheData[n] || {};
      const rc = (d.resultClaim || '').replace(/\s+/g, ' ').trim();
      const pp = (d.painPoints || '').replace(/\s+/g, ' ').trim();
      const stat = (d.stat || '').replace(/\s+/g, ' ').trim();
      return `- ${n}: stat="${stat}" resultClaim="${rc}" painPoints="${pp}"`;
    }).join('\n')
    : '- (geen niches gevonden in knowledge base)';

  // Niche label: voorlopig generiek; Gemini kiest niche in output header
  const nicheLabel = siteAnalysis.city ? `ondernemer in ${siteAnalysis.city}` : 'ondernemer';

  // Tone-specific examples from settings - replace placeholders
  // Veelgebruikte placeholders: {businessName}, {websiteUrl}, {nicheLabel}, {resultClaim}
  const replacePlaceholders = (text) => {
    return text
      .replace(/{businessName}/g, businessName)
      .replace(/{websiteUrl}/g, websiteUrl)
      .replace(/{nicheLabel}/g, nicheLabel)
      .replace(/{resultClaim}/g, resultClaim)
      .replace(/{firstName}/g, contactPerson ? contactPerson.split(' ')[0] : '');
  };

  const introExample = replacePlaceholders(toneSettings.introExample);
  const resultExample = replacePlaceholders(toneSettings.resultExample);
  const ctaExample = replacePlaceholders(toneSettings.ctaExample);

  // Tone-specific audit and solution points
  const auditContent = toneSettings.auditPoints;
  const solutionContent = toneSettings.solutionPoints;

  // Build facts list - NEW: Priority-based structure
  // De AI krijgt duidelijke prioriteit: VERHAAL eerst, dan WAT ZE DOEN, dan EXTRA context
  const factLines = [];

  // === PRIORITY 1: VERHAAL/ABOUT (meest persoonlijk - gebruik dit voor de INTRO) ===
  if (primaryHook) {
    factLines.push(`🔥 VERHAAL (gebruik dit voor persoonlijke intro): ${primaryHook}`);
  }

  // Voeg extra about/story details toe als beschikbaar
  if (siteAnalysis.foundStoryHooks?.length > 1) {
    const extraStory = siteAnalysis.foundStoryHooks[1];
    factLines.push(`   └─ Extra: ${extraStory.type}: "${extraStory.text.slice(0, 80)}..."`);
  }
  if (siteAnalysis.ownerNames?.length && primaryHookType !== 'owner') {
    factLines.push(`   └─ Eigenaar: ${siteAnalysis.ownerNames[0]}`);
  }
  if (siteAnalysis.teamMembersWithRoles?.length && primaryHookType !== 'team') {
    const tm = siteAnalysis.teamMembersWithRoles[0];
    factLines.push(`   └─ Team: ${tm.name} (${tm.role})`);
  }

  // === PRIORITY 2: WAT ZE DOEN (laat begrip zien) ===
  if (secondaryHook) {
    factLines.push(`📌 EXPERTISE: ${secondaryHook}`);
  }
  if (siteAnalysis.services?.length) {
    factLines.push(`   └─ Diensten: ${siteAnalysis.services.slice(0, 4).join(', ')}`);
  }
  if (siteAnalysis.specializations?.length > 1) {
    factLines.push(`   └─ Ook specialist in: ${siteAnalysis.specializations.slice(1, 3).join(', ')}`);
  }

  // === PRIORITY 3: SOCIAL PROOF (reviews, claims) ===
  if (siteAnalysis.testimonials?.length) {
    const t = siteAnalysis.testimonials[0];
    factLines.push(`⭐ REVIEW: "${t.text.slice(0, 100)}..."${t.author ? ` - ${t.author}` : ''}`);
  }
  if (siteAnalysis.claims?.length) {
    factLines.push(`📊 CLAIMS: ${siteAnalysis.claims.slice(0, 2).join(' | ')}`);
  }

  // === PRIORITY 4: EXTRA CONTEXT ===
  if (siteAnalysis.city) {
    factLines.push(`📍 Stad: ${siteAnalysis.city}`);
  }
  if (siteAnalysis.hasPromos && siteAnalysis.promos?.length) {
    factLines.push(`🏷️ Actie: "${siteAnalysis.promos[0]}"`);
  }

  const hookLines = factLines.length > 0
    ? factLines.join('\n')
    : '- (geen specifieke info gevonden, focus op hun beroep)';

  const prompt = `
=== INPUT VAN SCRAPER ===
Bedrijfsnaam: ${businessName}
Website: ${websiteUrl}
Niche: ${detectedNiche}
${siteAnalysis.city ? `Locatie: ${siteAnalysis.city}` : ''}

=== SEMANTISCHE LEIDRAAD (Hanteer deze betekenis) ===
Gebruik de volgende 4 delen als de basis voor je mail. Je mag de formulering iets menselijker maken, maar de kernboodschap moet exact gelijk blijven.

DEEL 1: ${masterPromptV2?.zin || nicheContext?.observation?.zin || 'Ik keek even naar jullie site en zag iets opvallends.'}
DEEL 2: ${masterPromptV2?.gedrag || nicheContext?.observation?.gedrag || 'Op dat moment haken bezoekers vaak af nog vóór ze verder kijken.'}
DEEL 3: ${masterPromptV2?.patroon || nicheContext?.observation?.patroon || 'Dit zie ik vaker bij bedrijven die offline heel sterk zijn.'}
DEEL 4: ${masterPromptV2?.cta || nicheContext?.cta?.zin || 'Zal ik je laten zien waar dit gebeurt?'}

=== VARIATIE (anti-bulk) ===
Hou je aan de 4 delen hierboven, maar breng variatie aan in de EXACTE woordkeuze zodat niet elke mail hetzelfde is.

=== OUTPUT STRUCTUUR ===
SUBJECT: [max 5 woorden]

Hallo,

[DEEL 1: Observatie - 1 zin]

[DEEL 2: Bezoekersgedrag - 1 zin]

[DEEL 3: Patroon - 1 zin]

[DEEL 4: Open CTA - 1 zin]

Hope
`;

  // Log wat we naar de AI sturen voor debugging
  console.log(`\n🤖 AI Prompt bevat:`);
  console.log(`   → Tone: "${emailTone}"`);
  console.log(`   → Subject template: "${selectedSubjectTemplate}"`);
  console.log(`   → Result claim: "${resultClaim}"`);
  console.log(`   → Pain points: "${painPoints ? '✅ Ja' : '❌ Nee'}"`);
  console.log(`   → Session prompt: "${sessionPrompt ? '✅ Ja (' + sessionPrompt.slice(0, 40) + '...)' : '❌ Nee'}"`);

  // Fallback systeem: probeer verschillende modellen bij fouten
  // OpenAI models - gpt-4o-mini is cost-effective, gpt-4o for complex tasks
  const models = [
    "gpt-4o-mini",    // Snel en goedkoop, goed voor de meeste taken
    "gpt-4o",         // Krachtiger model als fallback
  ];

  // Check if OpenAI is initialized
  if (!openai) {
    throw new Error('OpenAI niet geïnitialiseerd - OPENAI_API_KEY ontbreekt of is ongeldig');
  }

  let text = '';
  let lastError = null;

  for (const modelName of models) {
    try {
      console.log(`   🔄 Probeer model: ${modelName}...`);

      // DEFINITIEVE MASTER PROMPT - Conversatie-engineering voor 5-10% replies
      const systemMessage = `Je bent Hope - een menselijke observator, geen marketeer.

=== 5 DEFINITIEVE HARD RULES (BOVENAAN) ===

RULE 1 — GEEN NICHE BENOEMEN
Verboden: restaurants, schilders, aannemers, bedrijven die lokaal populair zijn, sector, branche.
Nooit de sector of het type bedrijf noemen. De lezer moet zichzelf herkennen zonder dat zijn beroep wordt genoemd.

RULE 2 — GEEN CIJFERS OF STATISTIEKEN
Verboden: %, 53%, 60, getallen.
Geen autoriteit-claims of statistieken. Dit lokt discussie uit in plaats van nieuwsgierigheid.

RULE 3 — GEEN TIJDSVOORSTEL (MAIL 1)
Verboden: 10 minuten, even bellen, gesprek, afspraak, voorstel.
Dit is een verkooptrigger die direct weerstand oproept.

RULE 4 — GEEN EVALUATIEVE WOORDEN
Verboden: generiek, sterk, zwak, goed, slecht, professioneel, gedateerd, actueel, algemeen, krachtiger, beter.
Beschrijf alleen wat je ziet (objectief), niet wat je ervan vindt (subjectief).

RULE 5 — CTA MAG GEEN OPLOSSING SUGGEREREN
Verboden: verbeteren, oplossen, fixen, helpen.
De CTA moet alleen gaan over: laten zien waar/wat ik zag.

=== MINDSET ===
Je taak is ondernemers individueel aan te spreken alsof je persoonlijk hun website hebt bekeken.
Je schrijft géén marketing, géén verkoop, géén uitleg.
Je doel: een reply uitlokken zodat er een gesprek kan ontstaan.
Observeer → benoem gedrag → stop. Stilte wint inboxen.

=== VERBODEN WOORDEN (UITGEBREID) ===
wij, ons team, helpen, meer klanten, online aanwezigheid, online zichtbaarheid,
design, automation, professioneel, opvallen, groeien, schaalbaar,
slecht, jammer, gedateerd, beter, gratis, voorstel, gesprek, call, meeting,
generiek, sterk, zwak, goed, veilig, omdat, waardoor, hierdoor, video, schermopname

=== EXACT 4-DELIGE STRUCTUUR ===
Elke mail bestaat uit exact 4 zinnen. Geen bullets. Geen kopjes. Geen emoji's.

DEEL 1 — CONCRETE OBSERVATIE (1 zin)
Feitelijk. Geen oordeel. Geen compliment. Gebaseerd op wat écht zichtbaar is.
Voorbeelden:
- "Ik keek even naar jullie site en zag dat er geen directe manier is om een afspraak te maken."
- "Bij het bekijken van jullie homepage viel me op dat reviews niet meteen zichtbaar zijn."

DEEL 2 — GEDRAG VAN BEZOEKERS (1 zin)
Wat doen bezoekers op dát moment? Geen cijfers, geen claims.
Voorbeelden:
- "Op dat moment haken bezoekers vaak af, nog vóór ze contact opnemen."
- "Dan gaan mensen sneller vergelijken of zoeken ze verder."

DEEL 3 — PATROON (1 zin)
Haal de druk van hén af. Maak het algemeen.
Voorbeelden:
- "Dit zie ik vaker bij bedrijven waar offline alles goed loopt."
- "Dit komt verrassend vaak voor bij sterke ondernemers."

DEEL 4 — OPEN CTA (1 zin)
Nieuwsgierigheid wekken. Geen call, geen tijdsvoorstel, geen dienst.
CTA mag GEEN kennis claimen die niet zichtbaar is op de site.
Voorbeelden:
- "Zal ik je laten zien waar dit gebeurt?"
- "Wil je dat ik je laat zien wat ik bedoel?"

=== FORMAT ===
- Begroeting: Een korte, menselijke opening (bv. "Hallo," of "Goedemiddag,")
- Exact 4 alinea's (1 zin per alinea)
- 60-95 woorden (target 70-85)
- Sign-off: alleen "Hope" (geen Groet)
- GEEN bullets, GEEN emoji's, GEEN kopjes

=== QUALITY CHECK ===
Email is ONGELDIG als:
- Observatie niet feitelijk/controleerbaar
- Iets wordt uitgelegd of verkocht
- Er geen "waarom?" blijft hangen
- Reageren niet de logische volgende stap is

=== OUTPUT ===
SUBJECT: [max 5 woorden, menselijk]

BODY:
[de complete email]`;

      const result = await openai.chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt }
        ],
        temperature: 0.9,
        top_p: 0.95,
      });

      text = result.choices[0].message.content.trim();

      // === 🛡️ QUALITY GATE GUARDRAIL ===
      console.log(`   🛡️ Uitvoeren Quality Gate check...`);

      const bodyLower = text.toLowerCase();
      const subjectMatch = text.match(/SUBJECT:\s*(.*)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : '';
      const subjectLower = subject.toLowerCase();
      const wordCount = text.split(/\s+/).length;

      const forbiddenWords = ['gratis', 'voorstel', 'gesprek', 'call', 'meeting', 'helpen', 'wij', 'ons team', 'minuten', ' bellen', 'afspraak', 'proberen', 'verbeteren', 'oplossen', 'fixen', 'waarde', 'tijd', 'video'];
      const evaluativeWords = ['generiek', 'sterk', 'zwak', 'goed', 'slecht', 'professioneel', 'gedateerd', 'actueel', 'algemeen', 'krachtiger', 'beter'];
      const sectorWords = ['restaurant', 'schilder', 'aannemer', 'loodgieter', 'tandarts', 'kapsalon', 'horeca', 'bouw', 'sector', 'branche'];

      let failReason = null;
      if (wordCount < 35 || wordCount > 105) failReason = `Woordenaantal buiten bereik (${wordCount})`;

      const combinedText = (subjectLower + ' ' + bodyLower);
      const foundForbidden = [...forbiddenWords, ...evaluativeWords, ...sectorWords].filter(w => combinedText.includes(w));
      if (foundForbidden.length > 0) failReason = `Verboden woorden gedetecteerd: ${foundForbidden.join(', ')}`;

      // Check voor cijfers (Rule 2) - Negeer bedrijfsnaam
      const textForDigits = text.replace(new RegExp(businessName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
      if (/\d+/.test(textForDigits)) {
        // Check only the content part (after subject and greeting)
        const lines = text.split('\n');
        const contentLines = lines.filter(l =>
          l.trim().length > 0 &&
          !l.toUpperCase().startsWith('SUBJECT:') &&
          !/^(Hallo|Beste|Goedendag|Goedemorgen|Goedemiddag|Goedenavond|Hope)/i.test(l.trim())
        );
        if (/\d+/.test(contentLines.join(' '))) {
          failReason = "Cijfers gedetecteerd in email body (Rule 2)";
        }
      }

      if (failReason) {
        console.log(`   ❌ Quality Gate FAIL: ${failReason}`);
        if (modelName === models[0]) {
          console.log(`   🔄 Opnieuw proberen met hetzelfde model vanwege Quality Gate fail...`);
          continue;
        }
      }

      console.log(`   ✅ Succes en Quality Gate PASSED met ${modelName}!`);
      break; // Succes, stop met proberen
    } catch (error) {
      lastError = error;
      console.log(`   ⚠️ ${modelName} faalde: ${error.message}`);
      // Log meer details voor debugging
      if (error.code) console.log(`   📋 Error code: ${error.code}`);
      if (error.status) console.log(`   📋 Status: ${error.status}`);
      if (error.statusCode) console.log(`   📋 Status code: ${error.statusCode}`);

      // Check voor specifieke billing/quota errors
      const errorMsg = (error.message || '').toLowerCase();
      const errorCode = String(error.code || error.status || '').toLowerCase();
      if (errorMsg.includes('quota') || errorMsg.includes('billing') ||
        errorMsg.includes('payment') || errorCode === '429' ||
        errorCode === '402' || errorMsg.includes('rate_limit')) {
        console.error(`   💳 BILLING/QUOTA ERROR gedetecteerd!`);
        console.error(`   💡 Controleer je OpenAI API billing instellingen`);
        // Stop niet meteen, probeer volgende model
      }

      // Probeer volgende model
      continue;
    }
  }

  // Als alle modellen falen, gooi de laatste error
  if (!text && lastError) {
    throw lastError;
  }

  // Optional second-pass rewrite (extra call) to reduce "AI feel"
  if (humanize) {
    try {
      console.log('   ✨ Humanizer pass aan...');
      text = await humanizeStructuredEmail({ draftText: text, emailTone });
    } catch (e) {
      console.log(`   ⚠️ Humanizer pass faalde: ${e.message} (ga door met eerste draft)`);
    }
  }

  // Clean subject placeholders
  const cleanUrl = (url) => url.replace(/(^\w+:|^)\/\//, '').replace('www.', '').replace(/\/$/, '');
  const cleanName = cleanUrl(businessName); // Zorgt dat URLs in subject er strak uitzien

  // Use the tone-specific subject template as default - PROPERLY replace placeholder
  let subject = selectedSubjectTemplate.replace(/{businessName}/g, cleanName);
  let niche = 'bedrijf';
  let nicheConfidence = 'low';
  let sections = {
    intro: '',
    audit: '',
    boosters: '',
    resultaat: '',
    socialProof: '',
    cta: ''
  };

  // Parse NICHE headers (moet boven SUBJECT staan)
  // Try multiple patterns in case AI formats it differently
  const nichePatterns = [
    /^NICHE:\s*(.+?)(?:\r?\n|$)/mi,
    /NICHE:\s*(.+?)(?:\r?\nNICHE_CONFIDENCE|$)/mi,
    /niche[:\s]+(.+?)(?:\r?\n|$)/mi
  ];

  for (const pattern of nichePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim().toLowerCase();
      if (candidate === 'bedrijf' || knownNiches.includes(candidate)) {
        niche = candidate;
        console.log(`   🎯 Niche gekozen door AI: ${niche}`);
        break;
      }
    }
  }

  const confPatterns = [
    /^NICHE_CONFIDENCE:\s*(low|medium|high)(?:\r?\n|$)/mi,
    /niche_confidence[:\s]+(low|medium|high)(?:\r?\n|$)/mi,
    /confidence[:\s]+(low|medium|high)(?:\r?\n|$)/mi
  ];

  for (const pattern of confPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      nicheConfidence = match[1].trim().toLowerCase();
      console.log(`   📊 Niche confidence: ${nicheConfidence}`);
      break;
    }
  }

  // Fallback: als geen niche gevonden, log warning
  if (niche === 'bedrijf' && nicheConfidence === 'low') {
    console.log(`   ⚠️ Geen niche gevonden in AI output, gebruik generiek`);
  }

  // Parse subject from AI output (override if AI provides one)
  if (text.includes("SUBJECT:")) {
    const subjectMatch = text.match(/SUBJECT:\s*(.+?)(?:\n|$)/);
    if (subjectMatch && subjectMatch[1].trim().length > 5) {
      // Also replace placeholders in AI-generated subject
      subject = subjectMatch[1].trim().replace(/{businessName}/g, cleanName);
    }
  }

  // NEW FORMAT: Check for simple BODY: format first
  const bodyMatch = text.match(/BODY:\s*([\s\S]*?)(?:---|$)/i);
  if (bodyMatch && bodyMatch[1].trim().length > 50) {
    // New simple format - just SUBJECT + BODY
    const fullBody = bodyMatch[1].trim();
    console.log(`   📝 New format detected: simple SUBJECT + BODY`);
    console.log(`   ✅ Email gegenereerd met subject: "${subject.slice(0, 50)}..."`);
    console.log(`   📝 Body length: ${fullBody.length} characters`);

    return {
      subject,
      body: fullBody,
      sections: { intro: fullBody }, // Put full body in intro for template compatibility
      niche,
      nicheConfidence
    };
  }

  // OLD FORMAT: Parse each section - legacy structured format
  const introMatch = text.match(/INTRO:\s*([\s\S]*?)(?=AUDIT:|KANSEN:|$)/i);
  const auditMatch = text.match(/(?:AUDIT|KANSEN):\s*([\s\S]*?)(?=BOOSTERS:|OPLOSSING:|$)/i);
  const boostersMatch = text.match(/(?:BOOSTERS|OPLOSSING):\s*([\s\S]*?)(?=RESULTAAT:|BELOFTE:|SOCIAL_PROOF:|CTA:|$)/i);
  const resultaatMatch = text.match(/(?:RESULTAAT|BELOFTE):\s*([\s\S]*?)(?=SOCIAL_PROOF:|CTA:|$)/i);
  const socialProofMatch = text.match(/SOCIAL_PROOF:\s*([\s\S]*?)(?=CTA:|$)/i);
  const ctaMatch = text.match(/CTA:\s*([\s\S]*?)(?:---|$)/i);

  if (introMatch) sections.intro = introMatch[1].trim();
  if (auditMatch) sections.audit = auditMatch[1].trim();
  if (boostersMatch) sections.boosters = boostersMatch[1].trim();

  // RESULTAAT wordt ook als socialProof gebruikt in het nieuwe format
  if (resultaatMatch) {
    sections.resultaat = resultaatMatch[1].trim();
    // Als er geen aparte SOCIAL_PROOF is, gebruik RESULTAAT
    if (!socialProofMatch) {
      sections.socialProof = sections.resultaat;
    }
  }
  if (socialProofMatch) sections.socialProof = socialProofMatch[1].trim();
  if (ctaMatch) sections.cta = ctaMatch[1].trim();

  // Ultimate fallback: if nothing parsed, use whole text as sections.intro
  if (!sections.intro && !sections.audit) {
    // Strip out any formatting markers and use as-is
    const fallbackBody = text
      .replace(/^SUBJECT:.*$/mi, '')
      .replace(/^BODY:\s*/mi, '')
      .replace(/^NICHE:.*$/mi, '')
      .replace(/^NICHE_CONFIDENCE:.*$/mi, '')
      .replace(/^---.*$/gm, '')
      .trim();

    if (fallbackBody.length > 50) {
      sections.intro = fallbackBody;
      console.log(`   ⚠️ Fallback: Using full text as body (${fallbackBody.length} chars)`);
    }
  }

  console.log(`   ✅ Email gegenereerd met subject: "${subject.slice(0, 50)}..."`);
  console.log(`   📝 Secties: intro=${!!sections.intro}, audit=${!!sections.audit}, boosters=${!!sections.boosters}, resultaat=${!!sections.resultaat}, socialProof=${!!sections.socialProof}, cta=${!!sections.cta}`);
  console.log(`   🎯 Niche: ${niche} (confidence: ${nicheConfidence})`);

  return { subject, sections, niche, nicheConfidence };
}

// Optional second-pass rewrite: behoud labels + feiten, maak het menselijker
async function humanizeStructuredEmail({ draftText, emailTone }) {
  const prompt = `
Je herschrijft een cold email zodat het menselijker, warmer en natuurlijker klinkt - alsof een echte persoon het schreef, niet een AI.

BELANGRIJK:
- Bewaar EXACT dezelfde labels en volgorde: NICHE, NICHE_CONFIDENCE, SUBJECT, INTRO, AUDIT, OPLOSSING, RESULTAAT, SOCIAL_PROOF, CTA.
- Bewaar alle feiten/observaties (geen nieuwe verzinsels, geen feiten weglaten).
- Verwijder stijve/robot-zinnen zoals "ik identificeerde", "ik constateerde", "ik bekeek", "ik zag op jullie website".
- Varieer zinslengte: mix korte punchy zinnen (5-8 woorden) met 1-2 iets langere zinnen (12-18 woorden) voor natuurlijke flow.
- Vermijd marketing-clichés: geen "game-changer", "revolutionair", "next-level", "disruptive".
- Geen meta-tekst: nooit zeggen dat je iets "niet kon vinden" of "op de site zag".
- Maak het CONVERSATIONEEL: alsof je tegen een collega praat, niet een formele brief.
- Behoud de ${emailTone} stijl, maar maak het warmer.

EMAIL OM TE HERSCHRIJVEN:
${draftText}
`.trim();

  const models = [
    "gpt-4o-mini",
    "gpt-4o"
  ];

  let lastError = null;
  for (const modelName of models) {
    try {
      const result = await openai.chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: "Je bent een expert in het herschrijven van emails om ze menselijker te maken." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        top_p: 0.9,
      });
      return result.choices[0].message.content.trim();
    } catch (e) {
      lastError = e;
      continue;
    }
  }
  if (lastError) throw lastError;
  return draftText;
}

// === 🆕 AI QUALITY CHECK ===
// Controleert de gegenereerde email op logische fouten en onzinnige zinnen
async function validateEmailQuality(sections, businessName, emailTone) {
  const emailContent = `
INTRO: ${sections.intro || '(leeg)'}
AUDIT: ${sections.audit || '(leeg)'}
OPLOSSING: ${sections.boosters || '(leeg)'}
RESULTAAT: ${sections.resultaat || '(leeg)'}
SOCIAL_PROOF: ${sections.socialProof || '(leeg)'}
CTA: ${sections.cta || '(leeg)'}
  `.trim();

  const validationPrompt = `
Je bent een strenge kwaliteitscontrole voor cold emails. 
Beoordeel de volgende email voor ${businessName} op deze criteria:

1. LOGICA: Zijn alle zinnen logisch en begrijpelijk? Geen onafgemaakte zinnen?
2. RELEVANTIE: Past de inhoud bij een bedrijf (geen onzin)?
3. STRUCTUUR: Heeft elke sectie echte content (niet alleen placeholder tekst)?
4. TAAL: Is het correct Nederlands zonder rare woorden/karakters?
5. PERSONALISATIE: Wordt er iets specifieks over het bedrijf genoemd?

EMAIL:
${emailContent}

ANTWOORD IN DIT EXACTE FORMAAT:
SCORE: [1-10]
PROBLEMEN: [lijst van problemen, of "geen"]
VERDICT: [OK of HERGENEREREN]

Voorbeelden:
- Score 8-10 = OK (kleine issues zijn acceptabel)
- Score 5-7 = HERGENEREREN (matige kwaliteit)
- Score 1-4 = HERGENEREREN (slechte kwaliteit)
`;

  // Fallback modellen voor quality check
  const qualityModels = [
    "gpt-4o-mini",
    "gpt-4o"
  ];

  if (!openai) {
    throw new Error('OpenAI niet geïnitialiseerd');
  }

  let response = '';
  let lastQualityError = null;

  for (const modelName of qualityModels) {
    try {
      const result = await openai.chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: "Je bent een strenge kwaliteitscontrole voor cold emails." },
          { role: "user", content: validationPrompt }
        ],
        temperature: 0.1 // Lage temp voor consistente beoordeling
      });
      response = result.choices[0].message.content.trim();
      break; // Succes
    } catch (error) {
      lastQualityError = error;
      continue; // Probeer volgende model
    }
  }

  if (!response && lastQualityError) {
    throw lastQualityError;
  }

  try {
    // Parse het antwoord
    const scoreMatch = response.match(/SCORE:\s*(\d+)/i);
    const verdictMatch = response.match(/VERDICT:\s*(OK|HERGENEREREN)/i);
    const problemsMatch = response.match(/PROBLEMEN:\s*(.+?)(?=VERDICT:|$)/is);

    const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
    const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : 'OK';
    const problems = problemsMatch ? problemsMatch[1].trim() : 'geen';

    console.log(`   🔍 Quality check: Score ${score}/10 - ${verdict}`);
    if (problems !== 'geen' && problems.toLowerCase() !== 'geen') {
      console.log(`   ⚠️ Problemen: ${problems.slice(0, 100)}...`);
    }

    return {
      score,
      verdict,
      problems,
      shouldRegenerate: verdict === 'HERGENEREREN' || score < 6
    };
  } catch (error) {
    console.log(`   ⚠️ Quality check mislukt: ${error.message}`);
    // Bij fout, gewoon doorgaan
    return { score: 7, verdict: 'OK', problems: 'check failed', shouldRegenerate: false };
  }
}

// Fallback template - NOW WITH TONE SUPPORT
function generateFallbackEmail(data) {
  const analysis = data.siteAnalysis || {};
  const niche = analysis.niche || 'ondernemer';
  const websiteUrl = data.websiteUrl || 'jullie site';
  const emailTone = data.emailTone || 'professional';
  const contactPerson = data.contactPerson || '';

  // Niche label met stad als fallback (zelfde logica als AI prompt)
  let nicheLabel = 'ondernemer';
  if (niche && niche !== 'bedrijf') {
    nicheLabel = niche;
  } else if (analysis.city) {
    nicheLabel = `ondernemer in ${analysis.city}`;
  }

  // Clean business name for subject
  const cleanName = data.businessName.replace(/(^\w+:|^)\/\//, '').replace('www.', '').replace(/\//g, '');

  // Personal greeting based on contact person
  const hasContact = contactPerson && contactPerson.trim().length > 0;
  const firstName = hasContact ? contactPerson.split(' ')[0] : '';

  // TONE-SPECIFIC CONTENT with optional contact person - NU MET BEROEP IN RESULTAAT
  // Check for observation hooks (geen slogans tenzij verifieerbaar)
  const city = analysis.city;
  const claim = analysis.claims?.[0];
  const service = analysis.services?.[0];
  const review = analysis.testimonials?.[0]?.text;
  const verifiableSlogan = analysis.slogans?.[0];
  const hook = claim
    ? `Jullie claim "${claim}"`
    : review
      ? `Ik las een review: "${review.slice(0, 70)}..."`
      : service
        ? `Jullie bieden o.a. ${service} aan`
        : city
          ? `Jullie zitten in ${city}`
          : verifiableSlogan
            ? `Jullie noemen "${verifiableSlogan}"`
            : '';

  const toneContent = {
    professional: {
      subject: `${cleanName} - je verliest klanten`,
      intro: hasContact
        ? `Beste ${firstName}, ${hook ? hook + '.' : `Ik bekeek ${websiteUrl}.`} Ik zag 3 problemen. Ze kosten je elke week klanten. De fix is simpel.`
        : `${hook ? hook + '.' : `Ik bekeek ${websiteUrl}.`} Ik zag 3 problemen. Ze kosten je elke week klanten. De fix is simpel.`,
      audit: `- Site werkt slecht op telefoon - 60% van bezoekers weg\n- Geen duidelijke actieknop - mensen weten niet wat te doen\n- Trage laadtijd - elke seconde kost je 7% conversie`,
      boosters: `- Mobielvriendelijke site - bereik iedereen\n- Sterke actieknop - bezoekers worden klanten\n- Snelle site - mensen blijven en kopen`,
      resultaat: `Als ${nicheLabel} met een goede site krijg je klanten die al overtuigd zijn voordat ze bellen. Geen magie. Gewoon een site die verkoopt.`,
      cta: `10 minuten bellen. Ik laat zien wat je mist. Geen verplichtingen.`
    },
    casual: {
      subject: `Hey ${cleanName}! Je laat geld liggen 💸`,
      intro: hasContact
        ? `Yo ${firstName}! ${hook ? hook + '.' : `Ik checkte ${websiteUrl}.`} Eerlijk? Je laat geld liggen. Elke dag. Ik zag 3 dingen die je direct kan fixen. 🔥`
        : `Yo! ${hook ? hook + '.' : `Ik checkte ${websiteUrl}.`} Eerlijk? Je laat geld liggen. Elke dag. Ik zag 3 dingen die je direct kan fixen. 🔥`,
      audit: `- 😬 Site crasht op mobiel - daar gaat 60% van je traffic\n- 🤷 Geen actieknop - bezoekers scrollen en vertrekken\n- 🐌 Trage site - mensen hebben geen geduld meer`,
      boosters: `- 📱 Site die overal werkt = meer bereik\n- 🎯 Duidelijke knop = bezoekers worden kopers\n- ⚡ Snelle site = mensen blijven en betalen`,
      resultaat: `Als ${nicheLabel} met een sterke site? Klanten die al overtuigd zijn voordat ze bellen. Terwijl je concurrenten zich afvragen waar hun klanten blijven. 💪🚀`,
      cta: `10 min bellen. Ik laat het zien. Geen gezeur, gewoon resultaat. 🤙`
    },
    urgent: {
      subject: `${cleanName} - je bloedt klanten ⚠️`,
      intro: hasContact
        ? `${firstName}, even eerlijk: ${hook ? hook + '.' : `${websiteUrl} kost je elke dag klanten.`} Niet volgende week. Nu. Ik zag 3 lekken. Ze zijn te fixen. Maar niet als je wacht. ⚠️`
        : `Even eerlijk: ${hook ? hook + '.' : `${websiteUrl} kost je elke dag klanten.`} Niet volgende week. Nu. Ik zag 3 lekken. Ze zijn te fixen. Maar niet als je wacht. ⚠️`,
      audit: `- ⚠️ Site kapot op mobiel - 60% van je bezoekers ziet een puinhoop\n- 🚨 Geen actieknop - mensen willen kopen maar kunnen niet\n- 💸 Trage site - elke seconde vertraging = 7% minder verkoop`,
      boosters: `- ⚡ Werkende mobiele site = stroom aan klanten terug\n- 🎯 Sterke actieknop = bezoekers worden betalers\n- 🚀 Snelle site = meer verkoop, minder afhakers`,
      resultaat: `Andere ${nicheLabel}s die dit fixten? Volle agenda's en tevreden klanten. Terwijl jij nog twijfelt, pakken zij jouw klanten. Elke. Dag. 🔥`,
      cta: `10 minuten bellen. Vandaag. Elke dag wachten kost je geld. 💸`
    },
    friendly: {
      subject: `${cleanName} - even langskomen! 👋`,
      intro: hasContact
        ? `Hoi ${firstName}! ${hook ? hook + '.' : `Ik zag ${websiteUrl} en moest even wat zeggen.`} Jullie laten klanten liggen. Niet expres, maar het gebeurt. Ik leg uit waarom. 😊`
        : `Hoi! ${hook ? hook + '.' : `Ik zag ${websiteUrl} en moest even wat zeggen.`} Jullie laten klanten liggen. Niet expres, maar het gebeurt. Ik leg uit waarom. 😊`,
      audit: `- 📱 Site werkt niet lekker op telefoon - daar verliezen jullie mensen\n- 🤔 Bezoekers weten niet wat ze moeten doen - en dan vertrekken ze\n- ⏳ Site is aan de trage kant - mensen wachten niet meer`,
      boosters: `- 🌟 Mobielvriendelijke site = iedereen kan bij jullie terecht\n- 👆 Duidelijke actieknop = bezoekers worden klanten\n- ⚡ Snelle site = mensen blijven en nemen actie`,
      resultaat: `Als ${nicheLabel} met een site die wél werkt? Klanten die al overtuigd zijn voordat ze contact opnemen. En dat terwijl je niks extra hoeft te doen - de site doet het werk. 🌟`,
      cta: `Zullen we bellen? 10 minuten. Ik laat zien wat ik bedoel. Geen druk, gewoon info. 😊`
    }
  };

  const content = toneContent[emailTone] || toneContent.professional;

  return {
    subject: content.subject,
    body: `${content.intro}\n\n${content.audit}\n\n${content.boosters}\n\n${content.resultaat}\n\n${content.cta}`,
    sections: {
      intro: content.intro,
      audit: content.audit,
      boosters: content.boosters,
      resultaat: content.resultaat,
      cta: content.cta
    }
  };
}

// 🆕 BROKEN DOMAIN OPPORTUNITY EMAIL
// Sent when a website is unreachable - turns the problem into an opportunity
function generateBrokenDomainEmail(data) {
  // We use a single, high-quality 4-line structure that follows all 5 HARD RULES
  // This ensures consistency even when the scraper fails.

  const intro = `Toen ik op de site wilde kijken, viel me op dat de verbinding met de pagina niet tot stand komt.

Op dat moment gaan mensen vaak direct verder naar een andere optie.

Dit zie ik vaker bij bedrijven die offline hun zaken heel goed op orde hebben.

Zal ik je laten zien wat ik precies bedoel?`;

  return {
    subject: `Over de bereikbaarheid van je site`,
    body: intro,
    sections: {
      intro: intro,
      audit: '',
      boosters: '',
      resultaat: '',
      cta: ''
    },
    isBrokenDomainEmail: true
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    toEmail,
    businessName,
    websiteUrl,
    contactPerson,
    emailTone: requestedTone = "professional",
    dryRun = false,
    humanizePass = false, // Optional: extra Gemini rewrite pass (slower)
    analyzeFirst = true,  // Nieuwe optie: analyseer website eerst
    preGeneratedData = null, // Nieuwe optie: gebruik bestaande data
    customSubject = "", // Custom subject line (leeg = auto)
    customPreheader = "", // Custom pre-header (leeg = auto)
    sessionPrompt = "", // Tijdelijke extra AI instructies (voor batch sessie)
    smtpConfig: providedSmtpConfig = null, // Directe SMTP config (voor campaign systeem)
    smtpAccountId = null, // SMTP account ID om credentials op te halen
    // ⚡ Speed optimizations
    skipQualityCheck = false, // Skip AI quality validation for speed
    skipHumanize = true // Skip humanize pass for speed (default: skip)
  } = req.body;

  console.log('\n🟦 SEND-EMAIL HANDLER STARTED');
  console.log(`   To: ${toEmail}`);
  console.log(`   Business: ${businessName}`);
  console.log(`   DryRun: ${dryRun}`);

  // Als er een smtpAccountId is meegegeven, haal de config op
  let smtpConfig = providedSmtpConfig;
  if (!smtpConfig && smtpAccountId) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const smtpRes = await fetch(`${baseUrl}/api/get-smtp-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: smtpAccountId })
      });
      const smtpData = await smtpRes.json();
      if (smtpData.success) {
        smtpConfig = smtpData.smtpConfig;
        console.log(`📧 SMTP account geladen: ${smtpConfig.user}`);
      } else {
        console.warn(`⚠️ SMTP account niet gevonden: ${smtpAccountId}`);
      }
    } catch (err) {
      console.error('Error loading SMTP config:', err);
    }
  }

  // Handle "random" tone - kies willekeurige stijl
  const availableTones = ["professional", "casual", "urgent", "friendly"];
  const emailTone = requestedTone === "random"
    ? availableTones[Math.floor(Math.random() * availableTones.length)]
    : requestedTone;

  console.log("API Key Status:", !!process.env.OPENAI_API_KEY ? "Aanwezig" : "NIET AANWEZIG");

  // Log welke stijl is gekozen (handig voor debugging)
  if (requestedTone === "random") {
    console.log(`🎲 Random stijl gekozen: ${emailTone}`);
  }

  if (!toEmail || !businessName || !websiteUrl) {
    const error = new AppError(ERROR_CODES.VALIDATION_MISSING_FIELDS, null, {
      missing: {
        toEmail: !toEmail,
        businessName: !businessName,
        websiteUrl: !websiteUrl
      }
    });
    return res.status(400).json(error.toJSON());
  }

  try {
    // STAP 0: Validate MX records voor recipient domain (indien ingeschakeld)
    // Dit voorkomt bounces naar niet-bestaande domeinen
    if (isApiEnabled('mxValidation')) {
      const mxResult = await validateMX(toEmail);
      if (!mxResult.valid) {
        console.log(`❌ MX validatie gefaald voor ${toEmail}: ${mxResult.error}`);
        return res.status(400).json({
          success: false,
          error: {
            code: 'MX_VALIDATION_FAILED',
            message: `Email domein "${mxResult.domain}" heeft geen geldige mail server`,
            details: mxResult.error,
            domain: mxResult.domain
          }
        });
      }
      if (mxResult.warning) {
        console.log(`⚠️ MX warning voor ${mxResult.domain}: ${mxResult.warning}`);
      } else {
        console.log(`✅ MX OK voor ${mxResult.domain}`);
      }
    } else {
      console.log(`⏸️ MX validatie uitgeschakeld - email wordt direct verstuurd`);
    }

    let subject, body;
    let sections = null;
    let usedAI = false;
    let siteAnalysis = null;

    // STAP 1: Analyseer de website
    if (analyzeFirst) {
      console.log(`🔍 Analyseren: ${websiteUrl}...`);
      siteAnalysis = await analyzeWebsite(websiteUrl);

      // 🆕 Check if website is unreachable - use broken domain opportunity email
      if (siteAnalysis.error || siteAnalysis.issues?.includes('Website niet bereikbaar of te traag')) {
        console.log(`\n⚠️ Website onbereikbaar of fout voor ${businessName}:`);
        console.log(`   🚫 Analysis Error: ${siteAnalysis.error || 'Geen'}`);
        console.log(`   🚫 Issues: ${siteAnalysis.issues?.join(', ') || 'Geen'}`);
        console.log(`   💡 Gebruik "broken domain opportunity" email template`);

        // Generate special email for unreachable websites
        const brokenEmail = generateBrokenDomainEmail({
          businessName,
          websiteUrl,
          contactPerson,
          emailTone
        });
        subject = brokenEmail.subject;
        body = brokenEmail.body;
        sections = brokenEmail.sections;
        usedAI = false; // Template-based, not AI

        // Mark that this is a broken domain email for tracking
        siteAnalysis.isBrokenDomain = true;
        siteAnalysis.brokenDomainReason = siteAnalysis.error || 'Website niet bereikbaar';

      } else {
        console.log(`\n✅ Analyse klaar voor ${businessName}:`);
        console.log(`   📌 Niche (scraper): ${siteAnalysis.niche || 'onbekend'} (${siteAnalysis.nicheConfidence || 'low'})`);
        console.log(`   📌 Scraped Title: "${siteAnalysis.title}"`);
        console.log(`   📌 Signals: ${siteAnalysis.issues?.join(', ') || 'geen'}`);
        console.log(`   📌 Services found: ${siteAnalysis.services?.length || 0}`);
        console.log(`   📝 Eerste kop: ${siteAnalysis.headings?.[0] || 'geen gevonden'}`);
        console.log(`   🛠️ Diensten: ${siteAnalysis.services?.slice(0, 3).join(', ') || 'geen gevonden'}`);
        console.log(`   ⚠️ Problemen: ${siteAnalysis.issues?.length || 0}`);
        if (siteAnalysis.issues?.length > 0) {
          console.log(`      → ${siteAnalysis.issues[0]}`);
        }
      }
    }

    // 🆕 If broken domain email was already generated, skip to sending
    if (siteAnalysis?.isBrokenDomain && subject && sections) {
      console.log(`📧 Broken domain email klaar, ga door naar versturen...`);
      // Skip the AI generation step - we already have the email content
    } else if (preGeneratedData && !dryRun) {
      console.log(`\n📦 Gebruik pre-generated data uit preview...`);
      subject = preGeneratedData.subject;
      body = preGeneratedData.body;
      sections = preGeneratedData.sections;
      siteAnalysis = preGeneratedData.siteAnalysis || siteAnalysis;
      usedAI = true;
      console.log(`✅ Pre-generated content ingeladen!`);
    } else if (process.env.OPENAI_API_KEY && isApiEnabled('openai')) {
      console.log(`\n🤖 AI generatie starten...`);

      // Track the actual error for response
      let aiErrorDetails = null;

      try {
        // ⚡ Vereenvoudigd: één AI call, geen retries of quality check
        const result = await generateEmailWithAnalysis({
          businessName,
          websiteUrl,
          contactPerson,
          emailTone,
          siteAnalysis: siteAnalysis || {},
          humanize: false, // Altijd uit voor snelheid
          sessionPrompt
        });

        subject = result.subject;
        body = result.body;
        sections = result.sections;
        usedAI = true;

        console.log(`✅ AI email gegenereerd! Subject: ${subject}`);
        console.log(`   📝 Body preview: ${body?.slice(0, 100)}...`);

        // Apply AI-chosen niche
        if (!siteAnalysis) siteAnalysis = {};
        siteAnalysis.aiNiche = result.niche;
        siteAnalysis.aiNicheConfidence = result.nicheConfidence;
        if (result.nicheConfidence === 'high' || result.nicheConfidence === 'medium') {
          siteAnalysis.niche = result.niche;
          siteAnalysis.nicheConfidence = result.nicheConfidence;
        } else {
          siteAnalysis.niche = 'bedrijf';
          siteAnalysis.nicheConfidence = result.nicheConfidence || 'low';
        }

        console.log(`✅ AI email gegenereerd!`);
      } catch (outerError) {
        // Fallback als ALLE pogingen mislukken
        console.error(`\n❌ AI FOUT - Fallback wordt gebruikt!`);
        console.error(`   Error Type: ${outerError.name}`);
        console.error(`   Error Message: ${outerError.message}`);
        console.error(`   Error Code: ${outerError.code || outerError.status || 'N/A'}`);
        console.error(`   Error Status Code: ${outerError.statusCode || 'N/A'}`);
        console.error(`   Full Stack: ${outerError.stack}`);

        // Check voor billing/quota errors
        const errorMsg = (outerError.message || '').toLowerCase();
        const errorCode = String(outerError.code || outerError.status || '').toLowerCase();
        if (errorMsg.includes('quota') || errorMsg.includes('billing') ||
          errorMsg.includes('payment') || errorCode === '429' ||
          errorCode === '402' || errorMsg.includes('resource_exhausted')) {
          console.error(`\n💳 BILLING/QUOTA PROBLEEM GEDETECTEERD!`);
          console.error(`   💡 Mogelijke oorzaken:`);
          console.error(`      - Je OpenAI API billing is niet correct ingesteld`);
          console.error(`      - Je quota is op`);
          console.error(`      - Je creditcard/betaling is niet geconfigureerd`);
          console.error(`   💡 Controleer: https://platform.openai.com/account/billing`);
        }

        // Save error details for response
        aiErrorDetails = {
          message: outerError.message,
          name: outerError.name,
          code: outerError.code || outerError.status || 'AI_ERROR',
          statusCode: outerError.statusCode,
          isBillingError: errorMsg.includes('quota') || errorMsg.includes('billing') ||
            errorMsg.includes('payment') || errorCode === '429' ||
            errorCode === '402' || errorMsg.includes('resource_exhausted'),
          stack: outerError.stack?.split('\n').slice(0, 3).join(' | ')
        };

        const fallback = generateFallbackEmail({ businessName, websiteUrl, contactPerson, siteAnalysis, emailTone });
        subject = fallback.subject;
        body = fallback.body;
        sections = fallback.sections;
      }

      // Store error details for response if AI failed
      if (aiErrorDetails && !usedAI) {
        // Attach to request for later use in response
        req.aiErrorDetails = aiErrorDetails;
      }
    } else if (process.env.OPENAI_API_KEY && !isApiEnabled('openai')) {
      // OpenAI is available but disabled in settings
      console.log(`\n⏸️ OpenAI API is uitgeschakeld in settings - Fallback template wordt gebruikt`);
      const fallback = generateFallbackEmail({ businessName, websiteUrl, contactPerson, siteAnalysis, emailTone });
      subject = fallback.subject;
      body = fallback.body;
      sections = fallback.sections;
    } else {
      console.warn(`\n⚠️ GEEN OPENAI_API_KEY gevonden! Fallback template wordt gebruikt.`);
      console.warn(`   💡 Voeg OPENAI_API_KEY toe aan je .env.local bestand`);
      console.warn(`   📎 Krijg een key via: https://platform.openai.com/api-keys`);
      const fallback = generateFallbackEmail({ businessName, websiteUrl, contactPerson, siteAnalysis, emailTone });
      subject = fallback.subject;
      body = fallback.body;
      sections = fallback.sections;
    }

    // Override subject als custom is opgegeven
    if (customSubject && customSubject.trim()) {
      const cleanUrl = (url) => url.replace(/(^\w+:|^)\/\//, '').replace('www.', '').replace(/\/$/, '');
      subject = customSubject.trim()
        .replace(/{businessName}/g, businessName)
        .replace(/{websiteUrl}/g, cleanUrl(websiteUrl));
      console.log(`📝 Custom subject gebruikt: "${subject}"`);
    }

    // Bereken pre-header (custom of auto)
    let preheader = '';
    if (customPreheader && customPreheader.trim()) {
      const cleanUrl = (url) => url.replace(/(^\w+:|^)\/\//, '').replace('www.', '').replace(/\/$/, '');
      preheader = customPreheader.trim()
        .replace(/{businessName}/g, businessName)
        .replace(/{websiteUrl}/g, cleanUrl(websiteUrl))
        .replace(/{niche}/g, siteAnalysis?.niche || 'bedrijf');
      console.log(`📝 Custom pre-header gebruikt: "${preheader}"`);
    } else {
      // Auto pre-header gebaseerd op niche
      preheader = `Je mist ${getNicheStat(siteAnalysis?.niche) || 'klanten'}. Ik laat zien waarom.`;
    }

    // Als dry run, return preview + analyse met ALLE personalisatie data
    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        usedAI,
        subject,
        preheader,
        sections,
        toEmail,
        businessName,
        // Stijl info (handig voor random)
        selectedTone: emailTone,
        wasRandom: requestedTone === "random",
        siteAnalysis: siteAnalysis ? {
          title: siteAnalysis.title,
          // Personalisatie data
          niche: siteAnalysis.niche,
          nicheConfidence: siteAnalysis.nicheConfidence,
          aiNiche: siteAnalysis.aiNiche,
          aiNicheConfidence: siteAnalysis.aiNicheConfidence,
          headings: siteAnalysis.headings,
          services: siteAnalysis.services,
          slogans: siteAnalysis.slogans,
          rawSlogans: siteAnalysis.rawSlogans,
          stats: siteAnalysis.stats,
          teamMembers: siteAnalysis.teamMembers,
          city: siteAnalysis.city,
          aboutContent: siteAnalysis.aboutContent,
          uniqueObservations: siteAnalysis.uniqueObservations,
          // Facebook detectie
          isFacebookPage: siteAnalysis.isFacebookPage,
          usesFacebookAsWebsite: siteAnalysis.usesFacebookAsWebsite,
          // Extra info
          hasTestimonials: siteAnalysis.hasTestimonials,
          hasBlog: siteAnalysis.hasBlog,
          hasOpeningHours: siteAnalysis.hasOpeningHours
        } : null
      });
    }

    // STAP 3: Verstuur email met complete SKYE HTML template
    const emailId = uuidv4();

    // Dynamische SMTP: gebruik smtpConfig als aanwezig, anders env vars
    let transporter;
    let fromAddress;

    if (smtpConfig && smtpConfig.host && smtpConfig.user && smtpConfig.pass) {
      // Gebruik dynamische SMTP configuratie
      console.log(`📡 Dynamische SMTP: ${smtpConfig.host}:${smtpConfig.port || 587}`);
      transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: parseInt(smtpConfig.port) || 587,
        secure: parseInt(smtpConfig.port) === 465,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000
      });
      fromAddress = smtpConfig.fromName
        ? `"${smtpConfig.fromName}" <${smtpConfig.user}>`
        : smtpConfig.user;
    } else {
      // Fallback naar env vars (Gmail)
      console.log('📡 SMTP via env vars (Gmail)');
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });
      fromAddress = `"SKYE" <${process.env.GMAIL_USER}>`;
    }

    // Extract sections (or fallback if empty)
    if (!sections) {
      // No sections provided, create empty structure
      sections = {
        intro: '',
        audit: '',
        boosters: '',
        resultaat: '',
        cta: ''
      };
    }

    // ONLY use hardcoded fallback if ALL sections are truly empty
    if (!sections || (!sections.intro && !sections.audit && !sections.boosters && !sections.resultaat && !sections.cta)) {
      console.log('⚠️ Geen content geparsed, gebruik hardcoded fallback');
      sections = {
        intro: `Toen ik op de site kwam, viel me op dat de eerste tekst vrij breed is ingestoken.\n\nOp dat moment klikken bezoekers vaak door zonder verder te lezen.\n\nDit zie ik vaker bij bedrijven die offline al stevig staan.\n\nWil je dat ik je laat zien waar dit gebeurt?`,
        audit: '',
        boosters: '',
        resultaat: '',
        cta: ''
      };
    }

    // Log sections for debugging
    console.log('📧 Email sections:');
    console.log(`   intro: ${sections.intro ? '✅' : '❌'} (${sections.intro?.length || 0} chars)`);
    console.log(`   audit: ${sections.audit ? '✅' : '❌'} (${sections.audit?.length || 0} chars)`);
    console.log(`   boosters: ${sections.boosters ? '✅' : '❌'} (${sections.boosters?.length || 0} chars)`);
    console.log(`   resultaat: ${sections.resultaat ? '✅' : '❌'} (${sections.resultaat?.length || 0} chars)`);
    console.log(`   cta: ${sections.cta ? '✅' : '❌'} (${sections.cta?.length || 0} chars)`);

    // Plain text formatting - preserve paragraph structure
    const formatSectionContent = (text) => {
      if (!text) return '';
      // Remove any signature that AI might have added
      let cleaned = text.trim();
      cleaned = cleaned.replace(/Groet,?\s*\n?\s*Hope\s*$/i, '');
      cleaned = cleaned.replace(/^Hope\s*$/im, '');
      // Remove greetings if AI added them (we add our own dynamic one)
      // Safer line-by-line approach to avoid eating the whole body
      let lines = cleaned.split('\n');
      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        // Check if first line starts with a greeting and is relatively short (prevents eating first real sentence)
        if (/^(Hallo|Beste|Goedendag|Goedemorgen|Goedemiddag|Goedenavond)/i.test(firstLine) && firstLine.length < 40) {
          lines.shift();
          // Remove potential empty line after greeting
          if (lines.length > 0 && lines[0].trim() === '') {
            lines.shift();
          }
        }
      }
      cleaned = lines.join('\n');
      return cleaned.trim();
    };

    const toHtmlParagraphs = (text) => formatSectionContent(text);

    // Build plain text email body - 4-part structure
    let plainBody = '';

    // Greeting logic (favors contactPerson, then time-based or generic)
    const getGreeting = () => {
      if (contactPerson && contactPerson.trim().length > 1) {
        return `Beste ${contactPerson.trim()},`;
      }

      const hour = new Date().getHours();
      const options = ['Hallo,', 'Goedendag,'];

      // Time-based options
      if (hour >= 5 && hour < 12) options.push('Goedemorgen,');
      if (hour >= 12 && hour < 18) options.push('Goedemiddag,');
      if (hour >= 18 && hour < 23) options.push('Goedenavond,');

      // Pick random from options
      return options[Math.floor(Math.random() * options.length)];
    };

    plainBody += getGreeting() + '\n\n';

    // Email body (AI generates as single block now with 4 parts)
    if (sections.intro) plainBody += formatSectionContent(sections.intro) + '\n\n';
    if (sections.audit) plainBody += formatSectionContent(sections.audit) + '\n\n';
    if (sections.boosters) plainBody += formatSectionContent(sections.boosters) + '\n\n';
    if (sections.resultaat) plainBody += formatSectionContent(sections.resultaat) + '\n\n';
    if (sections.cta) plainBody += formatSectionContent(sections.cta) + '\n\n';

    // Sign-off: alleen "Hope" (geen "Groet,")
    plainBody += 'Hope';

    // For email clients that need HTML, wrap plain text in minimal HTML
    const fullHtml = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222222; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto;">
    ${plainBody.split('\n').map(line => {
      if (!line.trim()) return '<br>';
      // Convert **bold** to <strong>bold</strong>
      let formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return formatted;
    }).join('<br>\n')}
    <!-- No tracking pixel for better deliverability -->
  </div>
</body>
</html>`;

    // 📧 SEND EMAIL: Check API settings first
    let info;
    let sendMethod = 'smtp'; // Track which method was used

    // 🔧 Load global API settings
    const apiSettings = loadApiSettings();
    const globalDryRun = apiSettings.dryRunMode;
    const effectiveDryRun = dryRun || globalDryRun;

    // If dry run mode is active, skip actual sending
    if (effectiveDryRun) {
      console.log(`🧪 DRY RUN MODUS - Email wordt NIET verzonden`);
      if (globalDryRun) console.log(`   (Global dry run is ingeschakeld in settings)`);

      info = {
        messageId: `dry - run - ${Date.now()} `,
        dryRun: true
      };
      sendMethod = 'dry-run';
    } else {
      // 🚀 Try Resend API FIRST (PRIMARY - best deliverability)
      if (isResendEnabled()) {
        try {
          console.log(`🚀 Verzenden via Resend API...`);

          // Check from address - MUST be from a verified domain in Resend
          const requestedFrom = smtpConfig?.fromEmail || smtpConfig?.user || 'info@skye-unlimited.be';
          let finalFrom = requestedFrom;
          let replyTo = null;

          // If from address doesn't end with our verified domain, fallback to default
          // and set replyTo to the requested address so the user gets replies
          if (!requestedFrom.toLowerCase().endsWith('@skye-unlimited.be') && !requestedFrom.toLowerCase().endsWith('@skye-unlimited.com')) {
            console.log(`⚠️ From address "${requestedFrom}" matches no verified domain. Falling back to default for Resend.`);
            finalFrom = 'info@skye-unlimited.be';
            replyTo = requestedFrom;
          }

          const resendResult = await sendEmailViaResend({
            to: toEmail,
            subject: subject,
            html: fullHtml,
            text: plainBody,
            from: finalFrom,
            fromName: smtpConfig?.fromName || 'SKYE',
            replyTo: replyTo
          });

          info = { messageId: resendResult.messageId };
          sendMethod = 'resend';
          console.log(`✅ Email verstuurd via Resend naar ${toEmail}: ${info.messageId}`);
        } catch (resendError) {
          console.error(`⚠️ Resend fout: ${resendError.message}`);
          console.log(`   Probeer fallback provider...`);
        }
      } else {
        console.log(`⏸️ Resend API uitgeschakeld of niet geconfigureerd`);
      }

      // 📧 Try Mailgun API if Resend failed (FALLBACK 1)
      if (!info && isMailgunEnabled()) {
        try {
          console.log(`📧 Verzenden via Mailgun API(FALLBACK)...`);
          const mailgunResult = await sendEmailViaMailgun({
            to: toEmail,
            subject: subject,
            html: fullHtml,
            text: plainBody,
            from: smtpConfig?.fromEmail || smtpConfig?.user || 'info@skye-unlimited.be',
            fromName: smtpConfig?.fromName || 'SKYE'
          });
          info = { messageId: mailgunResult.messageId };
          sendMethod = 'mailgun';
          console.log(`✅ Email verstuurd via Mailgun naar ${toEmail}: ${info.messageId} `);
        } catch (mailgunError) {
          console.error(`⚠️ Mailgun fout: ${mailgunError.message} `);
        }
      } else if (!info) {
        console.log(`⏸️ Mailgun API uitgeschakeld of niet geconfigureerd`);
      }

      // 🚀 Try AWS SES if both Resend and Mailgun failed (FALLBACK 2)
      if (!info && isSESEnabled()) {
        try {
          console.log(`☁️ Verzenden via Amazon SES API(FALLBACK 2)...`);
          const sesResult = await sendEmailViaSES({
            to: toEmail,
            subject: subject,
            html: fullHtml,
            text: plainBody,
            from: smtpConfig?.fromEmail || smtpConfig?.user || 'info@skye-unlimited.be',
            fromName: smtpConfig?.fromName || 'SKYE'
          });
          info = { messageId: sesResult.messageId };
          sendMethod = 'ses';
          console.log(`✅ Email verstuurd via SES naar ${toEmail}: ${info.messageId} `);
        } catch (sesError) {
          console.error(`⚠️ SES fout: ${sesError.message} `);
        }
      }

      // Fallback to SMTP (only if valid SMTP config exists)
      if (!info && smtpConfig && smtpConfig.host && smtpConfig.host !== 'API') {
        console.log(`📧 Verzenden via SMTP...`);
        info = await transporter.sendMail({
          from: fromAddress,
          to: toEmail,
          subject: subject,
          text: plainBody,
          html: fullHtml
        });
        console.log(`✅ Email verstuurd via SMTP naar ${toEmail}: ${info.messageId} `);
      }

      // Error if no sending method worked
      if (!info) {
        throw new Error('Geen verzendmethode beschikbaar - configureer Resend API (aanbevolen), Mailgun, of SMTP');
      }
    }

    // Sla email op in database voor analytics
    try {
      await saveEmail({
        id: emailId,
        toEmail,
        businessName,
        websiteUrl,
        niche: siteAnalysis?.niche || null,
        emailTone,
        subject,
        contactPerson: contactPerson || null
      });
      console.log(`📊 Email opgeslagen in analytics DB: ${emailId} `);
    } catch (dbError) {
      console.error('⚠️ Database save failed (email was still sent):', dbError.message);
    }

    const aiStatus = {
      used: usedAI,
      hasApiKey: !!process.env.OPENAI_API_KEY
    };

    if (usedAI) {
      aiStatus.reason = 'OpenAI succesvol gebruikt';
    } else if (process.env.OPENAI_API_KEY) {
      aiStatus.reason = 'AI fout - fallback template gebruikt';
      // Include error details if available
      if (req.aiErrorDetails) {
        aiStatus.error = req.aiErrorDetails;
        aiStatus.reason = `AI fout: ${req.aiErrorDetails.message} `;
      }
    } else {
      aiStatus.reason = 'Geen OPENAI_API_KEY - fallback template gebruikt';
    }

    return res.status(200).json({
      success: true,
      emailId,  // Toegevoegd voor tracking referentie
      messageId: info.messageId,
      sendMethod,  // 🚀 'ses' of 'smtp' - laat zien welke methode is gebruikt
      usedAI,
      aiStatus,
      niche: siteAnalysis?.aiNiche || 'bedrijf',
      nicheConfidence: siteAnalysis?.aiNicheConfidence || 'low',
      subject,
      body: plainBody,
      sections, // Email sections (intro, audit, boosters, resultaat, cta)
      toEmail,
      businessName,
      emailTone,
      isBrokenDomain: siteAnalysis?.isBrokenDomain || false, // 🆕 Flag for broken domain emails
      brokenDomainReason: siteAnalysis?.brokenDomainReason || null,
      siteAnalysis: siteAnalysis ? {
        niche: siteAnalysis.niche,
        issues: siteAnalysis.issues,
        isBrokenDomain: siteAnalysis.isBrokenDomain || false
      } : null,
      sentAt: new Date().toISOString()
    });

  } catch (err) {
    // Log the error with context
    console.error('\n🔴 CAUGHT ERROR IN SEND-EMAIL:');
    console.error(err);
    console.error('Stack:', err.stack);

    // Also write to file for debugging
    const fs = require('fs');
    const errorLog = `
=== ERROR AT ${new Date().toISOString()} ===
Message: ${err.message}
Stack: ${err.stack}
ToEmail: ${toEmail}
BusinessName: ${businessName}
=====================================
`;
    fs.appendFileSync('error-log.txt', errorLog);

    logError(err, 'send-email');

    // Wrap and format the error for user-friendly response
    const formattedError = formatErrorResponse(err, {
      toEmail,
      businessName,
      websiteUrl,
      smtpAccountId
    });

    // Determine status code based on error type
    let statusCode = 500;
    if (formattedError.error.code?.startsWith('VAL_')) {
      statusCode = 400; // Validation errors
    } else if (formattedError.error.code?.startsWith('SMTP_005')) {
      statusCode = 400; // Not configured
    }

    return res.status(statusCode).json(formattedError);
  }
}
