import { analyzeWebsite, extractEmailsFromWebsite } from '../../utils/scraper';
// import { validateDomain } from '../../utils/check-host'; // DISABLED: scraper checks site already

const GENERIC_PROVIDERS = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
    'msn.com', 'icloud.com', 'me.com', 'protonmail.com', 'aol.com',
    'telenet.be', 'skynet.be', 'proximus.be', 'scarlet.be', 'kpnmail.nl',
    'ziggo.nl', 'home.nl', 'planet.nl', 'hetnet.nl', 'chello.nl'
];

// Generieke email prefixes die we liever overslaan
const GENERIC_EMAIL_PREFIXES = [
    'info', 'contact', 'sales', 'support', 'admin', 'hello', 'hi', 'office',
    'boekhouding', 'klantenservice', 'webmaster', 'no-reply', 'noreply',
    'marketing', 'jobs', 'vacature', 'hr', 'algemeen', 'receptie', 'team'
];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, domain: inputDomain, skipValidation = false } = req.body;

    // Bepaal of dit een email of domein input is
    const isEmailInput = email && email.includes('@');
    const isDomainInput = inputDomain && !inputDomain.includes('@');

    if (!isEmailInput && !isDomainInput) {
        return res.status(400).json({ error: 'Voer een email of domein in' });
    }

    try {
        // Extract domain from email or use direct domain input
        let domain;
        let originalEmail = null;

        if (isEmailInput) {
            domain = email.split('@')[1].toLowerCase().trim();
            originalEmail = email;
        } else {
            // Clean domain input (remove https://, www., trailing slashes)
            domain = inputDomain
                .toLowerCase()
                .trim()
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .replace(/\/.*$/, '');
        }

        // 1. Check of het een generiek domein is
        if (GENERIC_PROVIDERS.includes(domain)) {
            return res.status(200).json({
                success: false,
                status: 'no_website_generic',
                email,
                domain,
                message: 'Generiek email domein (geen bedrijfswebsite)'
            });
        }

        // 2. CHECK-HOST VALIDATIE UITGESCHAKELD - Scraper controleert site al
        // De analyzeWebsite functie doet al een bereikbaarheidscheck, dus dubbele check is niet nodig
        
        // 3. Volledige website analyse (scraper controleert bereikbaarheid)
        // We proberen eerst met www. omdat dat veiliger is voor bedrijfsinfo
        let urlToTest = `https://www.${domain}`;
        let analysis = await analyzeWebsite(urlToTest);

        // Als dat faalt of een error geeft, probeer zonder www
        if (analysis.error) {
            console.log(`   ⚠️ www.${domain} faalde, probeer naked domain...`);
            urlToTest = `https://${domain}`;
            analysis = await analyzeWebsite(urlToTest);
        }

        // 4. Verwerk het resultaat
        if (analysis.error) {
            return res.status(200).json({
                success: false,
                status: 'website_unreachable',
                email,
                domain,
                message: 'Website niet bereikbaar'
            });
        }

        // 5. Succes! Extract only the required info for the CSV
        // We keep it minimal - the agent will use the knowledgeFile for guidance

        // 🆕 Als dit een domain-only input is, probeer email te vinden
        let foundEmail = originalEmail; // Als er al een email was, gebruik die
        let foundEmails = [];

        if (!originalEmail && analysis.extractedEmails) {
            // Emails zijn geëxtraheerd door de scraper
            foundEmails = analysis.extractedEmails || [];

            // Sorteer: persoonlijke emails eerst (niet info@, contact@, etc.)
            const personalEmails = foundEmails.filter(e => {
                const prefix = e.split('@')[0].toLowerCase();
                return !GENERIC_EMAIL_PREFIXES.includes(prefix);
            });

            const genericEmails = foundEmails.filter(e => {
                const prefix = e.split('@')[0].toLowerCase();
                return GENERIC_EMAIL_PREFIXES.includes(prefix);
            });

            // Gebruik persoonlijke email als die er is, anders generieke
            foundEmail = personalEmails[0] || genericEmails[0] || null;

            console.log(`   📧 Gevonden emails: ${foundEmails.length} (persoonlijk: ${personalEmails.length})`);
            if (foundEmail) {
                console.log(`   ✅ Beste email: ${foundEmail}`);
            }
        }

        // Als er geen email gevonden is bij domain-only input
        if (!originalEmail && !foundEmail) {
            return res.status(200).json({
                success: false,
                status: 'no_email_found',
                email: null,
                domain,
                websiteUrl: urlToTest,
                message: 'Geen email gevonden op website',
                data: {
                    companyName: analysis.title || domain,
                    contactPerson: analysis.teamMembers?.[0] || '',
                    knowledgeFile: analysis.knowledgeFile || 'overig.md',
                    allEmails: foundEmails // Alle gevonden emails (mogelijk leeg)
                }
            });
        }

        return res.status(200).json({
            success: true,
            status: 'success',
            email: foundEmail,
            domain,
            websiteUrl: urlToTest,
            inputType: originalEmail ? 'email' : 'domain',
            data: {
                companyName: analysis.title || domain, // Bedrijfsnaam
                contactPerson: analysis.teamMembers?.[0] || '', // Contactpersoon (optioneel)
                knowledgeFile: analysis.knowledgeFile || 'overig.md', // Pointer naar juiste niche file
                allEmails: foundEmails // Alle gevonden emails (voor referentie)
            }
        });

    } catch (error) {
        console.error('Enrichment error:', error);
        return res.status(500).json({
            success: false,
            status: 'error',
            email: email || null,
            domain: inputDomain || null,
            message: error.message
        });
    }
}
