import nodemailer from "nodemailer";
import * as cheerio from "cheerio";

// Note: This file only uses Cheerio for HTML scraping - no AI needed

// Niche-specifieke stats voor dynamische content (Pre-header etc.)
const SHARED_NICHE_STATS = {
    // HORECA
    restaurant: '10+ reserveringen',
    horeca: '10+ reserveringen',
    bakker: '15+ bestellingen',
    slager: '10+ voorbestellingen',

    // PERSONAL CARE
    kapper: '15+ boekingen',
    beauty: '10+ behandelingen',
    fysiotherapie: '8+ afspraken',
    tandarts: '12+ controles',

    // BOUW & ENERGIE
    energieadvies: '5+ EPC aanvragen',
    bouwadvies: '3+ projectaanvragen',
    aannemer: '5+ offerteaanvragen',
    architect: '3+ projectaanvragen',

    // INSTALLATEURS
    loodgieter: '5+ geplande klussen',
    elektricien: '5+ installatieaanvragen',
    hvac: '3+ installaties',

    // ZAKELIJKE DIENSTEN
    accountant: '5+ nieuwe klanten',
    advocaat: '3+ nieuwe cliënten',
    verzekeringsmakelaar: '5+ adviesgesprekken',

    // AUTO & VOERTUIGEN
    garage: '8+ afspraken',
    carwash: '20+ boekingen',

    // RETAIL & VASTGOED
    webshop: '25+ extra verkopen',
    bloemen: '15+ bestellingen',
    makelaar: '5+ bezichtigingen',
    bloemist: '15+ bestellingen',
    immobilien: '5+ bezichtigingen',

    // CREATIEF & COACHING
    fotograaf: '5+ boekingen',
    coach: '5+ coachees',
    fitness: '10+ nieuwe leden',

    // SCHOONMAAK
    schoonmaak: '3+ contracten'
};

// Scrape en analyseer de website - DEEP PERSONALIZATION VERSION
async function analyzeWebsite(url) {
    try {
        // Fetch de website
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        if (!response.ok) {
            return { error: `Website niet bereikbaar (${response.status})`, issues: [] };
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // === STAP 1: HAAL BELANGRIJKE TEKST OP ===
        const pageTitle = $('title').text().trim().toLowerCase();
        const metaDescription = $('meta[name="description"]').attr('content')?.toLowerCase() || '';
        const h1Text = $('h1').first().text().trim().toLowerCase();
        const mainHeadings = $('h1, h2').map((i, el) => $(el).text().trim().toLowerCase()).get().join(' ');

        // Combineer de BELANGRIJKSTE content voor niche detectie (gewogen)
        const priorityContent = `${pageTitle} ${pageTitle} ${pageTitle} ${h1Text} ${h1Text} ${metaDescription} ${mainHeadings}`;

        // === NICHE/BRANCHE DETECTIE - SPECIFIEKE KEYWORDS ===
        const nicheKeywords = {
            // BOUW & ENERGIE
            energieadvies: ['epc-attest', 'epb-attest', 'energieadvies', 'energie-audit', 'energielabel', 'luchtdichtheidsmeting', 'blowerdoor', 'thermografie', 'energiekeurder'],
            bouwadvies: ['bouwadvies', 'bouwbegeleiding', 'bouwinspectie', 'rioolkeuring', 'stabiliteitsstudie', 'bouwexpert', 'asbestattest'],
            aannemer: ['aannemer', 'aannemersbedrijf', 'renovatiewerken', 'verbouwingswerken', 'dakwerker', 'metselaar', 'bouwbedrijf'],
            architect: ['architectenbureau', 'architectuur', 'bouwplan ontwerp'],

            // INSTALLATEURS
            loodgieter: ['loodgieter', 'loodgietersbedrijf', 'sanitair installatie', 'cv-ketel installatie'],
            elektricien: ['elektricien', 'elektrische installatie', 'elektriciteitswerken'],
            hvac: ['hvac installatie', 'airconditioning installatie', 'klimaattechniek'],

            // ZAKELIJKE DIENSTEN
            accountant: ['accountantskantoor', 'boekhoudkantoor', 'boekhouder', 'fiscaal advies'],
            advocaat: ['advocaat', 'advocatenkantoor', 'juridisch advies'],
            verzekeringsmakelaar: ['verzekeringsmakelaar', 'verzekeringskantoor'],

            // HORECA
            restaurant: ['restaurant', 'reserveer een tafel', 'menukaart', 'chef-kok'],
            horeca: ['café', 'brasserie', 'bistro', 'taverne'],
            bakker: ['bakkerij', 'ambachtelijke bakker', 'patisserie'],
            slager: ['slagerij', 'ambachtelijke slager', 'traiteur'],

            // PERSONAL CARE
            kapper: ['kapsalon', 'hairstylist', 'barbershop', 'coiffeur'],
            beauty: ['schoonheidssalon', 'beautysalon', 'nagelstudio'],
            fysiotherapie: ['fysiotherapie', 'fysiotherapeut', 'kinesist', 'kinesitherapie'],
            tandarts: ['tandartspraktijk', 'tandheelkunde', 'orthodontie'],

            // AUTO
            garage: ['autogarage', 'autoreparatie', 'apk keuring', 'bandencentrale'],
            carwash: ['carwash', 'autowasstraat'],

            // VASTGOED
            immobilien: ['immobiliënkantoor', 'vastgoedmakelaar', 'immo kantoor'],

            // CREATIEF
            fotograaf: ['fotograaf', 'fotostudio', 'fotoshoot', 'huwelijksfotograaf'],

            // COACHING
            coach: ['life coach', 'business coach', 'loopbaancoach'],
            fitness: ['fitnesscentrum', 'sportschool', 'personal trainer'],

            // SCHOONMAAK
            schoonmaak: ['schoonmaakbedrijf', 'schoonmaakdiensten', 'glazenwasser'],

            // BLOEMIST
            bloemist: ['bloemist', 'bloemenwinkel', 'bloemenzaak'],
        };

        let detectedNiche = 'bedrijf';
        let nicheScore = 0;
        let allScores = {};

        for (const [niche, keywords] of Object.entries(nicheKeywords)) {
            let score = 0;
            for (const keyword of keywords) {
                // Check in PRIORITEIT content (title, h1, meta) - 5x gewicht
                if (priorityContent.includes(keyword.toLowerCase())) {
                    score += 5;
                }
                // Check in volledige pagina - 1 punt, max 2 per keyword
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                const fullPageMatches = html.toLowerCase().match(regex);
                if (fullPageMatches) {
                    score += Math.min(fullPageMatches.length, 2);
                }
            }
            allScores[niche] = score;
            if (score > nicheScore) {
                nicheScore = score;
                detectedNiche = niche;
            }
        }

        // Alleen niche toekennen als score minimaal 5 is
        if (nicheScore < 5) {
            detectedNiche = 'bedrijf';
        }

        // Log scores voor debugging
        const topScores = Object.entries(allScores)
            .filter(([_, s]) => s > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        console.log(`   🔍 Niche scores: ${topScores.map(([n, s]) => `${n}(${s})`).join(', ') || 'geen'}`);
        console.log(`   ✅ Gekozen niche: ${detectedNiche} (score: ${nicheScore})`);

        // === CONTENT EXTRACTIE ===
        const $fresh = cheerio.load(html);

        // Haal koppen op
        const allHeadings = [];
        $fresh('h1, h2, h3').each((i, el) => {
            const text = $fresh(el).text().trim();
            if (text && text.length > 5 && text.length < 100 &&
                !text.toLowerCase().includes('menu') &&
                !text.toLowerCase().includes('navigat')) {
                allHeadings.push(text);
            }
        });

        // Diensten uit specifieke secties
        const services = [];
        $fresh('[class*="service"] li, [class*="dienst"] li, main h3, article h3').each((i, el) => {
            let text = $fresh(el).text().trim();
            if (text.includes('\n')) text = text.split('\n')[0].trim();
            if (text && text.length > 3 && text.length < 60 &&
                !text.toLowerCase().includes('meer info') &&
                !text.toLowerCase().includes('lees meer')) {
                services.push(text);
            }
        });

        // Slogans
        const slogans = [];
        $fresh('h1, h2, .hero, [class*="hero"], [class*="slogan"]').each((i, el) => {
            const text = $fresh(el).text().trim();
            if (text && text.length > 10 && text.length < 120 &&
                !text.toLowerCase().includes('menu') &&
                !text.toLowerCase().includes('cookie')) {
                slogans.push(text);
            }
        });

        // Stats
        const statsRegex = /(\d+)\s*(?:\+|plus)?\s*(?:jaar|jaren|klanten|projecten|reviews)/gi;
        const foundStats = html.toLowerCase().match(statsRegex) || [];

        // Team namen
        const teamNames = [];
        $fresh('[class*="team"], [class*="over"], [class*="about"]').each((i, el) => {
            const text = $fresh(el).text().trim();
            const nameMatch = text.match(/([A-Z][a-z]+ [A-Z][a-z]+)/g);
            if (nameMatch) teamNames.push(...nameMatch);
        });

        // Stad detectie
        const cities = ['Brussel', 'Antwerpen', 'Gent', 'Brugge', 'Leuven', 'Mechelen', 'Aalst', 'Hasselt', 'Oostende', 'Kortrijk', 'Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven'];
        let detectedCity = null;
        for (const city of cities) {
            if (new RegExp(`\\b${city}\\b`, 'i').test(html)) {
                detectedCity = city;
                break;
            }
        }

        // About content
        let aboutContent = '';
        $fresh('[class*="about"], [class*="over"]').each((i, el) => {
            const text = $fresh(el).text().trim();
            if (text && text.length > 30 && text.length < 500 && !aboutContent) {
                aboutContent = text.replace(/\s+/g, ' ').slice(0, 200);
            }
        });

        // Feature flags
        const hasOpeningHours = /openingstijden|geopend|open van/i.test(html);
        const hasTestimonials = $fresh('[class*="review"], [class*="testimonial"]').length > 0;
        const hasBlog = $fresh('[class*="blog"], [class*="news"], article').length > 0;
        const isFacebookPage = /facebook\.com|fb\.com/i.test(url);

        // Build analysis object
        const analysis = {
            title: $fresh('title').text().trim() || 'Geen titel',
            h1: $fresh('h1').first().text().trim() || '',
            niche: detectedNiche,
            nicheConfidence: nicheScore > 10 ? 'hoog' : nicheScore > 5 ? 'medium' : 'laag',
            headings: allHeadings.slice(0, 5),
            services: [...new Set(services)].slice(0, 6),
            slogans: [...new Set(slogans)].slice(0, 3),
            stats: [...new Set(foundStats)].slice(0, 3),
            teamMembers: [...new Set(teamNames)].slice(0, 3),
            city: detectedCity,
            aboutContent,
            hasOpeningHours,
            hasTestimonials,
            hasBlog,
            isFacebookPage,
            usesFacebookAsWebsite: isFacebookPage,
            uniqueObservations: []
        };

        // Generate observations
        if (analysis.city) analysis.uniqueObservations.push(`Gevestigd in ${analysis.city}`);
        if (analysis.slogans.length > 0) analysis.uniqueObservations.push(`Slogan: "${analysis.slogans[0]}"`);
        if (analysis.stats.length > 0) analysis.uniqueObservations.push(`Ze noemen: ${analysis.stats[0]}`);
        if (analysis.hasTestimonials) analysis.uniqueObservations.push("Heeft reviews op de site");
        if (analysis.isFacebookPage) analysis.uniqueObservations.push(`🔥 Gebruikt Facebook als website`);

        return analysis;
    } catch (error) {
        return {
            error: `Kon website niet analyseren: ${error.message}`,
            issues: ["Website niet bereikbaar of te traag"]
        };
    }
}
