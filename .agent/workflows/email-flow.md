---
description: Volledige flow van email inladen tot versturen - SKYE Mailer
---

# 📧 SKYE Mailer - Complete Email Flow

Dit document beschrijft de volledige flow van het inladen van email-lijsten tot het daadwerkelijk versturen van gepersonaliseerde cold emails.

---

## 🗂️ FASE 1: EMAIL INLADEN

### 1.1 Methodes voor Email Import

#### A. Via Index Page (Individueel)
**Bestand:** `pages/index.js`

Je kunt handmatig één email invoeren met:
- Email adres
- Bedrijfsnaam
- Website URL
- Contactpersoon (optioneel)
- Email tone (professional/casual/urgent/friendly/random)

#### B. Via Batch Upload (Bulk)
**Bestand:** `pages/batch.js`

Upload een CSV/Excel bestand met:
- Email adres (verplicht)
- Bedrijfsnaam (optioneel - wordt verrijkt)
- Website URL (optioneel - wordt verrijkt)
- Contactpersoon (optioneel)

#### C. Via Enricher
**Bestand:** `pages/enrich.js`

Upload alleen email-adressen, het systeem verrijkt automatisch:
- Haalt bedrijfsnaam op uit email-domein
- Vindt website URL
- Zoekt contactpersoon

---

## 🔄 FASE 2: DATA ENRICHMENT

### 2.1 Email Enrichment Flow
**Bestand:** `pages/api/enrich-lead.js` + Campaigns `enrichEmail()`

Als een email binnenkomt zonder bedrijfsdata:

```
Email: info@voorbeeld.nl
         ↓
   Extract domein: "voorbeeld.nl"
         ↓
   Zoek website: "https://voorbeeld.nl"
         ↓
   Haal bedrijfsnaam op uit website title
         ↓
   Zoek contactpersoon (indien beschikbaar)
```

### 2.2 Fallback bij Geen Data
Als enrichment faalt, wordt het **email-domein** gebruikt:
- `websiteUrl` → `https://{email-domain}`
- `businessName` → domeinnaam zonder extensie

---

## 🏭 FASE 3: CAMPAGNE CREATIE

### 3.1 Campagne Aanmaken
**Bestand:** `pages/batch.js` → slaat op via `utils/campaignStore.js`

Een campagne bevat:
```javascript
{
  id: "unieke-id",
  name: "Campagne naam",
  status: "pending", // pending | running | paused | completed | stopped
  emailTone: "professional", // professional | casual | urgent | friendly | random
  customSubject: "", // Optionele custom subject line
  customPreheader: "", // Optionele pre-header
  sessionPrompt: "", // Extra AI instructies voor deze sessie
  smtpMode: "rotate", // single | rotate | random
  emails: [
    {
      email: "info@bedrijf.nl",
      businessName: "Bedrijf B.V.",
      websiteUrl: "https://bedrijf.nl",
      contactPerson: "Jan",
      status: "pending", // pending | sending | sent | failed
      needsEnrichment: false
    }
  ],
  createdAt: "2025-12-18T12:00:00Z"
}
```

---

## 🔍 FASE 4: WEBSITE SCRAPING

### 4.1 Website Analyse
**Bestand:** `utils/scraper.js` → `analyzeWebsite(url)`

Voor elke email wordt de website gescraped om personalisatie-data te halen:

```
Website URL
    ↓
┌─────────────────────────────────────────┐
│ STAP 1: Fetch homepage                  │
│ - HTTP request met User-Agent           │
│ - Fallback naar Puppeteer als nodig     │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STAP 2: Zoek subpagina's (max 4)        │
│ PRIORITEIT:                             │
│ 1. Over-ons / About pagina's            │
│ 2. Team pagina's                        │
│ 3. Contact pagina's                     │
│ 4. Diensten pagina's                    │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STAP 3: Content Extractie               │
│ - Koppen (H1, H2, H3)                   │
│ - Diensten                              │
│ - Slogans (alleen met cijfers = proof)  │
│ - Team namen + rollen                   │
│ - Owner/oprichter namen                 │
│ - Story hooks (missie, passie, begin)   │
│ - Claims (jaartallen, aantallen, %)     │
│ - Testimonials/reviews                  │
│ - Prijzen en acties                     │
│ - Stad via postcode regex               │
│ - Specialisaties                        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STAP 4: Return Analysis Object          │
│ {                                       │
│   title: "Bedrijfsnaam",                │
│   niche: "bedrijf",                     │
│   city: "Amsterdam",                    │
│   services: [...],                      │
│   teamMembers: [...],                   │
│   ownerNames: [...],                    │
│   foundStoryHooks: [...],               │
│   claims: [...],                        │
│   testimonials: [...],                  │
│   ...                                   │
│ }                                       │
└─────────────────────────────────────────┘
```

### 4.2 Broken Domain Handling
Als website niet bereikbaar is:
- **NIET skippen** - er wordt een speciale "opportunity email" verstuurd
- Template: "Site niet bereikbaar → dit is een verkoopkans"

---

## 🤖 FASE 5: AI EMAIL GENERATIE

### 5.1 Email Content Generatie
**Bestand:** `pages/api/send-email.js` → `generateEmailWithAnalysis()`

```
Site Analysis + Niche Context
    ↓
┌─────────────────────────────────────────┐
│ STAP 1: Niche Context Laden             │
│ - Laad uit niche-database               │
│ - Haal Master Prompt V2 context         │
│ - Selecteer observatie + CTA            │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STAP 2: Personalisatie Hooks Bepalen    │
│                                         │
│ PRIMARY HOOK (gebruik voor intro):      │
│ 1. Story hooks (missie/passie/verhaal)  │
│ 2. About content                        │
│ 3. Owner/oprichter naam                 │
│ 4. Teamleden met rollen                 │
│ 5. Teamlid naam alleen                  │
│                                         │
│ SECONDARY HOOK (expertise):             │
│ 1. Specialisatie                        │
│ 2. Claims met bewijskracht              │
│ 3. Diensten                             │
│ 4. Reviews                              │
│                                         │
│ TERTIARY HOOK (extra context):          │
│ 1. Stad                                 │
│ 2. Slogans                              │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STAP 3: AI Prompt Samenstellen          │
│                                         │
│ SYSTEM MESSAGE (Master Prompt):         │
│ - 5 HARD RULES                          │
│   1. GEEN niche benoemen                │
│   2. GEEN cijfers/statistieken          │
│   3. GEEN tijdsvoorstel                 │
│   4. GEEN evaluatieve woorden           │
│   5. CTA mag geen oplossing suggereren  │
│                                         │
│ - Exact 4-delige structuur:             │
│   1. Concrete observatie (1 zin)        │
│   2. Gedrag bezoekers (1 zin)           │
│   3. Patroon (1 zin)                    │
│   4. Open CTA (1 zin)                   │
│                                         │
│ - Verboden woorden checklist            │
│ - Format: 60-95 woorden                 │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STAP 4: OpenAI API Call                 │
│                                         │
│ Models (met fallback):                  │
│ 1. gpt-4o-mini (snel, goedkoop)         │
│ 2. gpt-4o (krachtiger backup)           │
│                                         │
│ Temperature: 0.9                        │
│ Top_p: 0.95                             │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STAP 5: Quality Gate Check              │
│                                         │
│ Checks op:                              │
│ - Woordenaantal (35-105)                │
│ - Verboden woorden                      │
│ - Evaluatieve woorden                   │
│ - Sector woorden                        │
│ - Geen cijfers in body                  │
│                                         │
│ Bij FAIL → retry met zelfde model       │
└─────────────────────────────────────────┘
```

### 5.2 Fallback Template
Als AI faalt, wordt een pre-built template gebruikt:
- **Onderdelen:** intro, audit, boosters, resultaat, cta
- **Tone-specific:** professional/casual/urgent/friendly

### 5.3 Broken Domain Template
Speciale email voor onbereikbare websites:
```
"Toen ik op de site wilde kijken, viel me op dat de verbinding 
met de pagina niet tot stand komt..."
```

---

## ✅ FASE 6: VALIDATIE

### 6.1 MX Record Validatie
**Bestand:** `utils/mx-validator.js`

Voordat een email verstuurd wordt:
```
Email adres
    ↓
Extract domein
    ↓
DNS MX lookup
    ↓
Heeft geldige mail server? 
    ├─ JA → Doorgaan
    └─ NEE → Error: domein heeft geen mail server
```

**Doel:** Voorkom bounces naar niet-bestaande domeinen

---

## 📤 FASE 7: EMAIL VERSTUREN

### 7.1 Verzend Pipeline
**Bestand:** `pages/api/send-email.js` (regel 1448+)

```
Email Content Klaar
    ↓
┌─────────────────────────────────────────┐
│ STAP 1: Check Dry Run Mode              │
│ - Global setting check                  │
│ - Als DRY RUN → simuleer, niet sturen   │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STAP 2: Verzendmethode Prioriteit       │
│                                         │
│ ✅ PRIORITY 1: Resend API (PRIMARY)     │
│    ↓ (als Resend faalt)                 │
│ 📧 FALLBACK 1: Mailgun API              │
│    ↓ (als Mailgun faalt)                │
│ ☁️ FALLBACK 2: Amazon SES               │
│    ↓ (als SES faalt)                    │
│ 📡 FALLBACK 3: SMTP                     │
│                                         │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STAP 3: Email Samenstellen              │
│                                         │
│ - Dynamische begroeting:                │
│   → Met contactpersoon: "Beste Jan,"    │
│   → Zonder: tijd-gebaseerd              │
│     (Goedemorgen/middag/avond/Hallo)    │
│                                         │
│ - Body: 4-delige structuur              │
│ - Sign-off: alleen "Hope"               │
│ - HTML wrapper voor email clients       │
│ - Tracking pixel voor opens             │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STAP 4: SMTP Configuratie               │
│                                         │
│ Dynamisch of via env vars:              │
│ - smtpConfig meegegeven → gebruik dat   │
│ - Anders → Gmail via GMAIL_USER +       │
│           GMAIL_APP_PASSWORD            │
└─────────────────────────────────────────┘
    ↓
Email Verstuurd!
```

### 7.2 SMTP Rotatie
**Bestand:** `utils/campaignStore.js`

Bij campagnes met meerdere SMTP accounts:
- **rotate**: Rouleer door accounts (1,2,3,1,2,3...)
- **single**: Gebruik alleen geselecteerd account
- **random**: Willekeurige keuze per email

### 7.3 Warm-up Limieten
**Bestand:** `utils/warmupStore.js`

Per SMTP account wordt bijgehouden:
- Hoeveel emails vandaag verstuurd
- Dagelijks limiet (warm-up profiel)
- Als limiet bereikt → skip naar volgend account

---

## 📊 FASE 8: TRACKING & OPSLAG

### 8.1 Database Opslag
**Bestand:** `utils/database.js`

Elke verstuurde email wordt opgeslagen:
```javascript
{
  id: "uuid",
  toEmail: "...",
  businessName: "...",
  websiteUrl: "...",
  niche: "...",
  emailTone: "...",
  subject: "...",
  contactPerson: "...",
  sentAt: "..."
}
```

### 8.2 Open Tracking
Via tracking pixel in email:
```html
<img src="/api/track?id={emailId}&type=open" width="1" height="1" />
```

### 8.3 Click Tracking
Links worden omgeleid via:
```
/api/track?id={emailId}&type=click&url={originalUrl}
```

---

## 📈 FASE 9: CAMPAGNE MANAGEMENT

### 9.1 Campagne Status Updates
**Bestand:** `pages/campaigns.js`

```
PENDING → RUNNING → COMPLETED
    ↓         ↓
  PAUSED   STOPPED
```

### 9.2 Per-Email Status
```
pending → sending → sent
              ↓
           failed (met error message)
```

### 9.3 Retry Mechanisme
- Mislukte emails worden gemarkeerd
- "Retry Mislukte" knop reset status naar `pending`
- Campaign herstart voor alleen die emails

---

## ⚡ FASE 10: SNELHEID OPTIMALISATIE

### 10.1 Speed Profiles
**Bestand:** `utils/godmode.js`

| Profile  | Delay   | Beschrijving                    |
|----------|---------|--------------------------------|
| Normal   | 5000ms  | Standaard, veilig              |
| Turbo    | 2000ms  | Sneller, nog steeds veilig     |
| Max      | 500ms   | Snel, monitor deliverability   |
| Godmode  | 0ms     | Maximum snelheid (riskant)     |

### 10.2 Skip Opties
- `skipQualityCheck`: Sla AI quality validatie over
- `skipHumanize`: Sla second-pass rewrite over

---

## 🔧 CONFIGURATIE BESTANDEN

| Bestand | Doel |
|---------|------|
| `.env.local` | API keys (OpenAI, Resend, etc.) |
| `utils/api-settings.js` | Toggle APIs aan/uit |
| `knowledge/prompts/tone-*.md` | Tone-specifieke templates |
| `knowledge/niches/*.md` | Niche-specifieke content |
| `skye-niche-database.json` | Pain points, CTAs, observaties |

---

## 🎯 SAMENVATTING FLOW

```
┌────────────────┐
│ EMAIL IMPORT   │ ← CSV/Excel of handmatig
└───────┬────────┘
        ↓
┌────────────────┐
│ ENRICHMENT     │ ← Domein → Bedrijfsdata
└───────┬────────┘
        ↓
┌────────────────┐
│ CAMPAGNE       │ ← Sla op met settings
└───────┬────────┘
        ↓
┌────────────────┐
│ SCRAPING       │ ← Website → Personalisatie data
└───────┬────────┘
        ↓
┌────────────────┐
│ AI GENERATIE   │ ← OpenAI → Gepersonaliseerde email
└───────┬────────┘
        ↓
┌────────────────┐
│ MX VALIDATIE   │ ← Check of domein emails ontvangt
└───────┬────────┘
        ↓
┌────────────────┐
│ VERZENDEN      │ ← Resend/Mailgun/SES/SMTP
└───────┬────────┘
        ↓
┌────────────────┐
│ TRACKING       │ ← Opens & clicks registreren
└────────────────┘
```

---

*Laatst bijgewerkt: 18 december 2025*
