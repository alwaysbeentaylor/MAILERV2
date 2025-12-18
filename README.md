# 🚀 SKYE Mail Agent

**AI-Powered Cold Email Outreach** - Genereer en verstuur gepersonaliseerde cold emails automatisch via Gmail.

![SKYE Mail Agent](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-blue)

## ✨ Features

- **🤖 AI-Generated Emails** - OpenAI GPT-4o-mini schrijft gepersonaliseerde cold emails
- **📧 Direct Gmail Versturen** - Emails worden direct verstuurd via je eigen Gmail account
- **🎨 4 Email Tonen** - Professioneel, Casual, Urgent, of Persoonlijk
- **👁️ Preview Modus** - Bekijk de gegenereerde email voor je verstuurt
- **📦 Batch Modus** - Verstuur meerdere emails tegelijk met rate limiting
- **📊 CSV Import** - Importeer leads vanuit Excel/CSV
- **📈 Statistieken** - Houdt bij hoeveel emails je hebt verstuurd
- **🌙 Premium Dark UI** - Strakke, moderne interface met glassmorphism

## 🛠️ Installatie

### 1. Clone & Install

```bash
cd skye-mail-agent
npm install
```

### 2. Gmail API Setup (eenmalig)

1. Ga naar [Google Cloud Console](https://console.cloud.google.com/)
2. Maak een nieuw project (of selecteer een bestaand project)
3. Ga naar **APIs & Services** → **Enabled APIs & Services**
4. Klik **+ ENABLE APIS AND SERVICES**
5. Zoek naar "Gmail API" en enable deze
6. Ga naar **APIs & Services** → **Credentials**
7. Klik **+ CREATE CREDENTIALS** → **OAuth client ID**
8. Configureer OAuth consent screen (External, basic info)
9. Maak OAuth client ID aan:
   - Application type: **Desktop app**
   - Name: `SKYE Mail Agent`
10. Download de JSON en hernoem naar `gmail_credentials.json`
11. Plaats in de root van het project

### 3. Gmail Refresh Token Ophalen

```bash
node get-gmail-refresh-token.js
```

1. Open de URL die getoond wordt in je browser
2. Log in met je Gmail account
3. Geef toestemming
4. Kopieer de code uit de redirect URL
5. Plak in de terminal
6. Je krijgt je `GMAIL_REFRESH_TOKEN`

### 4. Environment Variables

Maak een `.env.local` bestand:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Gmail OAuth
GMAIL_CLIENT_ID=xxxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-...
GMAIL_REFRESH_TOKEN=1//...
GMAIL_USER=jouw-email@gmail.com
```

### 5. Start de App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📧 Gebruik

### Single Email
1. Vul de lead gegevens in
2. Kies een email toon
3. (Optioneel) Voeg extra notities toe
4. Klik **Preview** om de email te zien
5. Klik **Verstuur Email** om te versturen

### Batch Modus
1. Ga naar [/batch](http://localhost:3000/batch)
2. Voeg leads handmatig toe, of:
3. Upload een CSV bestand
4. Klik **Alle Versturen**

### CSV Formaat
```csv
email,bedrijfsnaam,website,contactpersoon,tone
info@bakkerij.be,Bakkerij Jan,https://bakkerij-jan.be,Jan,professional
info@restaurant.be,Restaurant De Gouden Leeuw,https://goudenleeuw.be,Pieter,casual
```

## 🔧 API Endpoints

### POST /api/send-email
Verstuur een enkele email.

```json
{
  "toEmail": "info@bedrijf.be",
  "businessName": "Bedrijf BV",
  "websiteUrl": "https://bedrijf.be",
  "contactPerson": "Jan Janssen",
  "emailTone": "professional",
  "customNotes": "Focus op mobiele website",
  "dryRun": false
}
```

### POST /api/send-batch
Verstuur meerdere emails.

```json
{
  "leads": [
    { "toEmail": "...", "businessName": "...", "websiteUrl": "..." },
    { "toEmail": "...", "businessName": "...", "websiteUrl": "..." }
  ],
  "delayBetweenEmails": 5000
}
```

## ⚠️ Rate Limits

- Gmail API: ~500 emails/dag voor gratis accounts
- De batch modus wacht 5 seconden tussen emails
- OpenAI: Afhankelijk van je tier

## 🔒 Beveiliging

- Bewaar je `.env.local` veilig
- Voeg `.env.local` en `gmail_credentials.json` toe aan `.gitignore`
- Gebruik nooit je refresh token in client-side code

## 📁 Project Structuur

```
skye-mail-agent/
├── pages/
│   ├── api/
│   │   ├── send-email.js      # Single email API
│   │   └── send-batch.js      # Batch email API
│   ├── index.js               # Main UI
│   └── batch.js               # Batch mode UI
├── get-gmail-refresh-token.js # OAuth setup script
├── gmail_credentials.json     # OAuth credentials (niet committen!)
├── .env.local                 # Environment variables (niet committen!)
└── env.example                # Voorbeeld env bestand
```

## 🚀 Deploy

### Vercel (Aanbevolen)
1. **Repository**: Push je code naar GitHub/GitLab.
2. **Importeer**: Importeer het project in Vercel.
3. **Storage (BELANGRIJK!)**:
   - Ga naar het tabblad **Storage** in je Vercel project.
   - Klik op **Create Store** -> Kies **KV (Redis)**.
   - Koppel de store aan je project (Environment variables `KV_URL` etc. worden automatisch toegevoegd).
4. **Environment Variables**:
   Ga naar **Settings** > **Environment Variables** en voeg toe:
   
   - `GEMINI_API_KEY`: Je Google Gemini API sleutel.
   - `GMAIL_USER`: Je Gmail adres (voor verzenden).
   - `GMAIL_APP_PASSWORD`: Je Gmail App Password (voor verzenden).
   - `NEXT_PUBLIC_BASE_URL`: De URL van je deploy (bijv. `https://jouw-project.vercel.app`).
   
   **Voor Analytics & Reply Scanning (Gmail API):**
   - `GMAIL_CREDENTIALS`: De *inhoud* van je `gmail_credentials.json` bestand (als platte tekst).
   - `GMAIL_TOKENS`: De *inhoud* van je `tokens.json` bestand (als platte tekst).

5. **QStash Setup (Voor Background Jobs)**:
   Om emails te kunnen inplannen die verstuurd worden zelfs nadat je browser sluit:
   
   - Ga naar [console.upstash.com](https://console.upstash.com)
   - Maak een gratis account aan
   - Maak een nieuwe **QStash** instance
   - Kopieer de keys en voeg toe aan Vercel:
     - `QSTASH_TOKEN`: Je QStash API token
     - `QSTASH_CURRENT_SIGNING_KEY`: Voor webhook verificatie
     - `QSTASH_NEXT_SIGNING_KEY`: Rotatie key
   
6. **Deploy**: Klik op Deploy!

### QStash Features
Met QStash kun je:
- 📬 **Batch emails inplannen** - Sluit browser, emails worden toch verstuurd
- 🔥 **Warmup emails schedulen** - Bouw email reputatie op automatisch
- ⏰ **Delayed sending** - Plan emails in voor later (bijv. volgende ochtend 9:00)
- 🔄 **Automatic retries** - Als een email faalt, probeert QStash opnieuw

## 📝 License

MIT - Gebruik het hoe je wilt!

---

**Built with ⚡ by SKYE Unlimited**
