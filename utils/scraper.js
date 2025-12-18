import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

// Scrape en analyseer de website - DEEP PERSONALIZATION VERSION
export async function analyzeWebsite(url) {
    try {
        let response;
        try {
            response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 8000
            });
        } catch (e) {
            console.log(`   ⚠️ Fetch gefaald voor ${url}: ${e.message}. Proberen met Puppeteer...`);
        }

        let html;
        if (response?.ok) {
            html = await response.text();
        } else {
            // Puppeteer fallback
            console.log(`   🚀 Puppeteer fallback gestart voor: ${url}`);
            const browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
            html = await page.content();
            await browser.close();
            console.log(`   ✅ Puppeteer succes: ${html.length} bytes`);
        }
        const $ = cheerio.load(html);

        // === STAP 1: BASIS CONTENT (zonder niche keyword-scoring) ===
        // We houden de extractie light; niche wordt later gekozen door Gemini in dezelfde generatie-call.

        // === DIEPE ANALYSE: Scrape tot 4 pagina's voor maximale personalisatie ===
        let extraHtmlPages = [];
        let aboutTeamPages = []; // Track About/Team pages separately
        const urlObj = new URL(url);
        const baseOrigin = urlObj.origin;

        // Zoek relevante subpagina's - FOCUS OP ABOUT/TEAM VOOR PERSONALISATIE
        const subPagePatterns = [
            // PRIORITEIT 1: About/Team pages (belangrijkste voor personalisatie)
            { keywords: ['over', 'over-ons', 'over ons', 'about', 'wie zijn wij', 'wie-zijn-wij', 'ons verhaal', 'ons-verhaal', 'onze missie', 'onze-missie'], priority: 1, type: 'about' },
            { keywords: ['team', 'ons-team', 'ons team', 'medewerkers', 'wie we zijn'], priority: 1, type: 'team' },
            // PRIORITEIT 2: Contact (kan ook namen bevatten)
            { keywords: ['contact', 'locatie', 'bereikbaar'], priority: 2, type: 'contact' },
            // PRIORITEIT 3: Diensten (minder belangrijk voor personalisatie)
            { keywords: ['diensten', 'services', 'aanbod', 'wat we doen', 'producten'], priority: 3, type: 'services' }
        ];

        const foundLinks = [];
        const seenHrefs = new Set([url, urlObj.pathname]);

        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto') || href.startsWith('tel:')) return;

            const text = $(el).text().toLowerCase().trim();
            const hrefLower = href.toLowerCase();
            if (seenHrefs.has(href)) return;

            // Normaliseer href
            let fullUrl;
            try {
                if (href.startsWith('http')) {
                    if (!href.startsWith(baseOrigin)) return; // Skip externe links
                    fullUrl = href;
                } else if (href.startsWith('/')) {
                    fullUrl = baseOrigin + href;
                } else {
                    fullUrl = new URL(href, url).href;
                }
            } catch { return; }

            // Check of dit een interessante pagina is - check zowel tekst als href
            for (const pattern of subPagePatterns) {
                const matchesText = pattern.keywords.some(kw => text.includes(kw));
                const matchesHref = pattern.keywords.some(kw => hrefLower.includes(kw));

                if (matchesText || matchesHref) {
                    foundLinks.push({
                        url: fullUrl,
                        priority: pattern.priority,
                        type: pattern.type,
                        text: text || hrefLower
                    });
                    seenHrefs.add(href);
                    seenHrefs.add(fullUrl);
                    break;
                }
            }
        });

        // Sorteer op prioriteit (About/Team eerst) en neem max 4 extra pagina's (medium crawl limit)
        foundLinks.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            // Binnenzelfde prioriteit: About/Team eerst
            if (a.type === 'about' || a.type === 'team') return -1;
            if (b.type === 'about' || b.type === 'team') return 1;
            return 0;
        });
        const pagesToFetch = foundLinks.slice(0, 4);

        console.log(`   🔍 DEEP MODE: ${pagesToFetch.length} extra pagina's gevonden (max 4, ~12s budget)`);

        // Fetch alle extra pagina's parallel met timeout budget
        const fetchPromises = pagesToFetch.map(async (link) => {
            try {
                console.log(`   ↪️ Fetching ${link.type}: ${link.text} (${link.url.slice(0, 50)}...)`);
                const res = await fetch(link.url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 3000 // 3s per page, max 4 = ~12s total
                });
                if (res.ok) {
                    const html = await res.text();
                    console.log(`   ✅ ${link.type}: ${html.length} bytes`);
                    return { html, type: link.type, url: link.url };
                }
            } catch (e) {
                console.log(`   ⚠️ Kon ${link.type} niet laden: ${e.message}`);
            }
            return { html: '', type: link.type, url: link.url };
        });

        try {
            const fetchedPages = await Promise.all(fetchPromises);
            extraHtmlPages = fetchedPages.map(p => p.html);

            // Track About/Team pages separately for better extraction
            aboutTeamPages = fetchedPages
                .filter(p => (p.type === 'about' || p.type === 'team') && p.html)
                .map(p => ({ html: p.html, type: p.type, url: p.url }));

            console.log(`   📄 About/Team pagina's geladen: ${aboutTeamPages.length}`);
        } catch (e) {
            console.log(`   ⚠️ Fout bij parallel laden: ${e.message}`);
            aboutTeamPages = [];
        }

        // Combineer HTML voor extractie (homepage + alle subpagina's)
        const combinedHtml = html + '\n' + extraHtmlPages.join('\n');

        // === CONTENT EXTRACTIE ===
        const $fresh = cheerio.load(combinedHtml);

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

        // Slogans (alleen gebruiken als ze verifieerbaar zijn; anders marketing-noise)
        const isVerifiableSlogan = (text) => {
            if (!text) return false;
            const t = text.toLowerCase();
            if (!/\d/.test(t)) return false; // zonder cijfers: vrijwel altijd marketing-taal

            // 24/7 / 24-7
            if (/(?:\b24\s*\/\s*7\b|\b24-7\b)/.test(t)) return true;

            // Sinds 1998 / since 2012
            if (/\b(sinds|since)\b/.test(t) && /\b(19|20)\d{2}\b/.test(t)) return true;

            // 5+ jaar / 200+ klanten / 120 reviews / 300 projecten
            if (/\b\d+\s*\+?\s*(jaar|jaren|klanten|projecten|reviews?|cases|opdrachten|bezoekers|leden|reserveringen|afspraken)\b/.test(t)) return true;

            // 98% / 10%
            if (/\b\d+\s*%/.test(t)) return true;

            // € 49 / 49 euro
            if (/€\s*\d+/.test(t) || /\b\d+\s*euro\b/.test(t)) return true;

            // 10 min / 2 uur / 24 uur
            if (/\b\d+\s*(min(uten)?|uur|u|dagen|dag|week|weken|maand|maanden)\b/.test(t)) return true;

            return false;
        };

        const slogans = [];
        $fresh('h1, h2, .hero, [class*="hero"], [class*="slogan"]').each((i, el) => {
            let text = $fresh(el).text().trim();
            if (text.includes('\n')) text = text.split('\n')[0].trim();
            if (text && text.length > 10 && text.length < 120 &&
                !text.toLowerCase().includes('menu') &&
                !text.toLowerCase().includes('cookie')) {
                slogans.push(text);
            }
        });
        const rawSlogans = [...new Set(slogans)].slice(0, 5);
        const verifiableSlogans = rawSlogans.filter(isVerifiableSlogan).slice(0, 3);

        // Stats
        const statsRegex = /(\d+)\s*(?:\+|plus)?\s*(?:jaar|jaren|klanten|projecten|reviews)/gi;
        const foundStats = combinedHtml.toLowerCase().match(statsRegex) || [];

        // === 🆕 VERBETERDE OWNER/TEAM EXTRACTIE UIT ABOUT/TEAM PAGINA'S ===
        const teamNames = [];
        const teamMembersWithRoles = []; // Nieuwe: naam + rol
        const ownerNames = []; // Nieuwe: eigenaar/oprichter namen
        const foundStoryHooks = []; // Nieuwe: quotable story details
        const extractedEmails = []; // 🆕 Verzamel alle emails voor domain-only enrichment
        const genericNames = ['info', 'contact', 'sales', 'support', 'admin', 'hello', 'hi', 'office', 'boekhouding', 'klantenservice', 'webmaster', 'no-reply', 'marketing', 'jobs', 'vacature'];

        // Extract from About/Team pages specifically (if we fetched them)
        if (aboutTeamPages && aboutTeamPages.length > 0) {
            aboutTeamPages.forEach(({ html: pageHtml, type: pageType }) => {
                const $page = cheerio.load(pageHtml);

                // OWNER/OPRICHTER EXTRACTIE
                const ownerPatterns = [
                    /(?:opgericht|gestart|begonnen|opgezet)\s+(?:door|in|met)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
                    /(?:ik ben|mijn naam is|wij zijn)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
                    /(?:eigenaar|oprichter|directeur|founder|owner)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi
                ];

                const pageText = $page('body').text();
                ownerPatterns.forEach(pattern => {
                    let match;
                    while ((match = pattern.exec(pageText)) !== null) {
                        const name = match[1].trim();
                        if (name.length > 5 && name.length < 40 && !genericNames.some(g => name.toLowerCase().includes(g))) {
                            if (!ownerNames.includes(name)) {
                                ownerNames.push(name);
                                console.log(`   👑 Eigenaar gevonden: ${name}`);
                            }
                        }
                    }
                });

                // TEAM MEMBERS MET ROLEN (uit team cards/sections)
                $page('[class*="team"], [class*="medewerker"], [class*="persoon"]').each((i, el) => {
                    const $card = $page(el);
                    const cardText = $card.text();

                    // Zoek naam pattern
                    const nameMatch = cardText.match(/\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})\b/);
                    if (nameMatch) {
                        const name = nameMatch[1];

                        // Zoek rol (vaak na de naam of in h3/h4)
                        const rolePatterns = [
                            /(?:functie|rol|positie|job|title)[:\s]+([^.\n]{3,40})/i,
                            /(?:is|als)\s+([^.\n]{3,40})/i
                        ];

                        let role = null;
                        const h3h4 = $card.find('h3, h4').text();
                        if (h3h4) {
                            const parts = h3h4.split(/\n|–|-/);
                            if (parts.length >= 2) {
                                role = parts[1].trim();
                            }
                        }

                        if (!role) {
                            rolePatterns.forEach(pattern => {
                                const match = cardText.match(pattern);
                                if (match && match[1]) {
                                    role = match[1].trim().slice(0, 50);
                                }
                            });
                        }

                        if (name.length < 30 && !genericNames.some(g => name.toLowerCase().includes(g))) {
                            teamMembersWithRoles.push({
                                name: name,
                                role: role || 'Teamlid'
                            });
                            if (!teamNames.includes(name)) {
                                teamNames.push(name);
                            }
                        }
                    }
                });

                // STORY HOOKS EXTRACTIE (quotable details)
                const storyPatterns = [
                    { regex: /(?:onze missie|onze visie|wij geloven)[:\s]+([^.!?]{20,120})/gi, type: 'missie' },
                    { regex: /(?:sinds|sinds\s+\d{4})[^.!?]{0,30}([^.!?]{15,100})/gi, type: 'historie' },
                    { regex: /(?:begonnen|gestart)[^.!?]{0,30}([^.!?]{15,100})/gi, type: 'begin' },
                    { regex: /(?:passie|passie voor)[:\s]+([^.!?]{10,80})/gi, type: 'passie' }
                ];

                storyPatterns.forEach(({ regex, type }) => {
                    let match;
                    while ((match = regex.exec(pageText)) !== null && foundStoryHooks.length < 3) {
                        const hook = match[1].trim();
                        if (hook.length > 15 && hook.length < 120) {
                            foundStoryHooks.push({
                                text: hook,
                                type: type,
                                source: pageType
                            });
                            console.log(`   📖 Story hook (${type}): "${hook.slice(0, 60)}..."`);
                        }
                    }
                });
            });
        }

        // Methode 1: Zoek in Team/Over secties (bestaande logica - fallback)
        $fresh('[class*="team"], [class*="over"], [class*="about"]').each((i, el) => {
            const text = $fresh(el).text().trim();
            // Zoek naar "Voornaam Achternaam" patterns - iets strenger
            const nameMatch = text.match(/\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})\b/g);
            if (nameMatch) {
                nameMatch.forEach(name => {
                    // Filter uit als het op de blocklist lijkt of te lang is
                    if (!genericNames.some(g => name.toLowerCase().includes(g)) && name.length < 30) {
                        if (!teamNames.includes(name)) {
                            teamNames.push(name);
                        }
                    }
                });
            }
        });

        // Methode 2: Extractie uit mailto links (NIEUW)
        $('a[href^="mailto:"]').each((i, el) => {
            const href = $(el).attr('href');
            const email = href.replace('mailto:', '').split('?')[0].trim(); // Verwijder subject params
            if (email && email.includes('@')) {
                // 🆕 Voeg email toe aan extractedEmails (voor domain-only enrichment)
                if (!extractedEmails.includes(email.toLowerCase())) {
                    extractedEmails.push(email.toLowerCase());
                }

                const parts = email.split('@');
                const localPart = parts[0];

                // Als de naam geen punt bevat (bijv. jan@...) en niet generiek is
                if (!localPart.includes('.') && !genericNames.includes(localPart.toLowerCase()) && localPart.length > 2) {
                    // Capitalize first letter
                    const name = localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase();
                    if (!teamNames.includes(name)) {
                        console.log(`   👤 Naam gevonden via email: ${name}`);
                        teamNames.push(name);
                    }
                }
                // Als naam wel punt bevat (jan.jansen@...)
                else if (localPart.includes('.') && !genericNames.includes(localPart.toLowerCase())) {
                    const nameParts = localPart.split('.');
                    // Neem de voornaam
                    if (nameParts[0].length > 2) {
                        const name = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase();
                        if (!teamNames.includes(name)) {
                            console.log(`   👤 Naam gevonden via email (punt): ${name}`);
                            teamNames.push(name);
                        }
                    }
                }
            }
        });

        // Stad detectie (Geavanceerd via Postcodes)
        // Oude methode: statische lijst
        // Nieuwe methode: Regex voor BE (4 cijfers) en NL (4 cijfers + 2 letters) postcodes
        let detectedCity = null;

        // Regex voor BE: 1000-9999 gevolgd door Stad (bijv: 3000 Leuven)
        // We zoeken naar een patroon in de tekst van de hele pagina
        const beZipRegex = /\b([1-9]\d{3})\s+([A-Z][a-z\u00C0-\u00FF]+(?:[\s-][A-Z][a-z\u00C0-\u00FF]+)*)/g;

        // Regex voor NL: 1000 AA - 9999 ZZ gevolgd door Stad
        const nlZipRegex = /\b([1-9]\d{3})\s?[A-Z]{2}\s+([A-Z][a-z\u00C0-\u00FF]+(?:[\s-][A-Z][a-z\u00C0-\u00FF]+)*)/g;

        // Scan footer en contact secties met voorrang (meest betrouwbaar)
        const contactText = $fresh('footer, [class*="footer"], [class*="contact"], [id*="contact"]').text().replace(/\s+/g, ' ');

        let match = beZipRegex.exec(contactText) || nlZipRegex.exec(contactText);

        if (!match) {
            // Fallback: scan hele body als niet gevonden in footer
            const bodyText = $fresh('body').text().replace(/\s+/g, ' ');
            match = beZipRegex.exec(bodyText) || nlZipRegex.exec(bodyText);
        }

        if (match && match[2]) {
            detectedCity = match[2].trim();
            // Filter uit valse positieven (bijv. "2023 Copyright")
            if (detectedCity.toLowerCase() === 'copyright' || detectedCity.toLowerCase() === 'all' || detectedCity.length < 3) {
                detectedCity = null;
            } else {
                console.log(`   📍 Stad gedetecteerd via postcode: ${detectedCity} (Code: ${match[1]})`);
            }
        }

        // Fallback naar de oude lijsten als regex faalt (voor grote steden zonder zichtbare postcode)
        if (!detectedCity) {
            const cities = ['Brussel', 'Antwerpen', 'Gent', 'Brugge', 'Leuven', 'Mechelen', 'Aalst', 'Hasselt', 'Oostende', 'Kortrijk', 'Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Almere', 'Breda', 'Nijmegen'];
            for (const city of cities) {
                if (new RegExp(`\\b${city}\\b`, 'i').test(combinedHtml)) {
                    detectedCity = city;
                    break;
                }
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

        // === 🆕 DEEP PERSONALIZATION EXTRACTIE ===

        // 1. USP's en unieke claims extractie
        const usps = [];
        // Zoek in feature/voordeel/usp secties
        $fresh('[class*="feature"], [class*="voordeel"], [class*="usp"], [class*="benefit"], [class*="waarom"], [class*="kenmerk"]').each((i, el) => {
            $fresh(el).find('li, h3, h4, p').each((j, item) => {
                const text = $fresh(item).text().trim();
                if (text.length > 8 && text.length < 80 && !usps.includes(text)) {
                    usps.push(text);
                }
            });
        });

        // Zoek naar specifieke claim-patronen in de tekst
        const claimPatterns = [
            { regex: /(\d+)\s*(?:\+)?\s*(?:jaar|jaren)\s+(?:ervaring|actief|in het vak)/gi, type: 'ervaring' },
            { regex: /(?:meer dan|ruim|>|al)\s*(\d+)\s*(?:\+)?\s*(?:klanten|projecten|bedrijven|opdrachten|tevreden)/gi, type: 'volume' },
            { regex: /(gratis|kosteloos|vrijblijvend).{0,25}(?:offerte|advies|bezorging|consult|intake)/gi, type: 'gratis' },
            { regex: /24[\/\s]*7.{0,20}(?:bereikbaar|service|support|beschikbaar)/gi, type: 'bereikbaarheid' },
            { regex: /(\d+)%\s*(?:tevredenheid|garantie|korting)/gi, type: 'garantie' },
            { regex: /(?:familie|familiebedrijf|sinds\s+\d{4})/gi, type: 'historie' },
            { regex: /(?:gecertificeerd|erkend|gediplomeerd|vakbekwaam)/gi, type: 'certificering' }
        ];

        const foundClaims = [];
        const bodyText = $fresh('body').text();
        for (const pattern of claimPatterns) {
            const matches = bodyText.match(pattern.regex);
            if (matches) {
                matches.forEach(m => {
                    const clean = m.trim();
                    if (clean.length > 5 && clean.length < 60 && !foundClaims.includes(clean)) {
                        foundClaims.push(clean);
                        console.log(`   💎 Claim gevonden: "${clean}" (${pattern.type})`);
                    }
                });
            }
        }

        // 2. Testimonials/Reviews tekst extractie
        const testimonials = [];
        $fresh('[class*="review"], [class*="testimonial"], [class*="klant"], [class*="quote"], blockquote').each((i, el) => {
            const text = $fresh(el).text().trim().replace(/\s+/g, ' ');
            // Zoek naar quotes (tekst tussen aanhalingstekens of in blockquote)
            if (text.length > 20 && text.length < 200) {
                // Probeer naam te extraheren (vaak aan het eind)
                const nameMatch = text.match(/[-–—]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*$/);
                testimonials.push({
                    text: nameMatch ? text.replace(nameMatch[0], '').trim() : text,
                    author: nameMatch ? nameMatch[1] : null
                });
            }
        });
        if (testimonials.length > 0) {
            console.log(`   ⭐ ${testimonials.length} testimonial(s) gevonden`);
        }

        // 3. Prijzen detectie
        const prices = [];
        const pricePatterns = [
            /€\s*(\d+(?:[.,]\d{2})?)/g,
            /vanaf\s+€?\s*(\d+)/gi,
            /(\d+)\s*euro/gi,
            /prijs[:\s]+€?\s*(\d+)/gi
        ];
        for (const pattern of pricePatterns) {
            const matches = combinedHtml.match(pattern);
            if (matches) {
                matches.slice(0, 3).forEach(m => {
                    if (!prices.includes(m)) prices.push(m);
                });
            }
        }
        if (prices.length > 0) {
            console.log(`   💰 Prijzen gevonden: ${prices.slice(0, 3).join(', ')}`);
        }

        // 4. Aanbiedingen/Acties detectie
        const promos = [];
        const promoPatterns = [
            /(\d+)%\s*korting/gi,
            /gratis\s+(?:bij|vanaf|actie)/gi,
            /actie[:\s].{5,40}/gi,
            /aanbieding[:\s].{5,40}/gi,
            /nu\s+(?:slechts|maar|voor)\s+€?\d+/gi
        ];
        for (const pattern of promoPatterns) {
            const matches = combinedHtml.match(pattern);
            if (matches) {
                matches.slice(0, 2).forEach(m => {
                    const clean = m.trim();
                    if (!promos.includes(clean)) promos.push(clean);
                });
            }
        }
        if (promos.length > 0) {
            console.log(`   🏷️ Promo's gevonden: ${promos.join(', ')}`);
        }

        // 5. Specialisaties uit tekst
        const specializations = [];
        const specPatterns = [
            /gespecialiseerd\s+in\s+([^.!?,]{5,50})/gi,
            /specialist\s+(?:in|op\s+het\s+gebied\s+van)\s+([^.!?,]{5,50})/gi,
            /expert\s+(?:in|op)\s+([^.!?,]{5,50})/gi
        ];
        for (const pattern of specPatterns) {
            let m;
            while ((m = pattern.exec(combinedHtml)) !== null) {
                if (m[1] && !specializations.includes(m[1].trim())) {
                    specializations.push(m[1].trim());
                    console.log(`   🎯 Specialisatie: "${m[1].trim()}"`);
                }
            }
        }

        // Feature flags
        const hasOpeningHours = /openingstijden|geopend|open van/i.test(combinedHtml);
        const hasTestimonials = testimonials.length > 0 || $fresh('[class*="review"], [class*="testimonial"]').length > 0;
        const hasBlog = $fresh('[class*="blog"], [class*="news"], article').length > 0;
        const isFacebookPage = /facebook\.com|fb\.com/i.test(url);
        const hasPricing = prices.length > 0;
        const hasPromos = promos.length > 0;

        // Build analysis object
        // Niche wordt niet meer door de scraper gekozen (scheelt tijd + voorkomt foute aannames)
        const detectedNiche = 'bedrijf';
        const nicheConfidence = 'low';
        const knowledgeFile = 'overig.md';

        // 🆕 SLIMME BEDRIJFSNAAM EXTRACTIE
        // Haal alleen de bedrijfsnaam uit de title (niet de hele header/slogan)
        const rawTitle = $fresh('title').text().trim();
        const ogSiteName = $fresh('meta[property="og:site_name"]').attr('content')?.trim();
        const firstH1 = $fresh('h1').first().text().trim();

        // Functie om bedrijfsnaam te extraheren uit title
        const extractCompanyName = (title) => {
            if (!title) return null;

            // Veel voorkomende scheidingstekens in website titels
            const separators = [' | ', ' - ', ' – ', ' · ', ' • ', ' :: ', ' » ', ' › '];

            for (const sep of separators) {
                if (title.includes(sep)) {
                    // Neem het EERSTE deel (voor het scheidingsteken) = meestal bedrijfsnaam
                    const parts = title.split(sep);
                    const firstPart = parts[0].trim();

                    // Check dat het geen generieke tekst is
                    const genericStarts = ['home', 'welkom', 'welcome', 'startpagina', 'homepage'];
                    if (firstPart.length > 2 && !genericStarts.some(g => firstPart.toLowerCase().startsWith(g))) {
                        return firstPart;
                    }
                    // Als eerste deel generiek is, probeer tweede deel
                    if (parts.length > 1 && parts[1].trim().length > 2) {
                        return parts[1].trim();
                    }
                }
            }

            // Geen scheidingsteken gevonden, check of titel niet te lang is
            if (title.length <= 40) {
                return title;
            }

            return null;
        };

        // Prioriteit: 1. og:site_name, 2. Geparsde title, 3. H1, 4. Raw title
        let companyName = ogSiteName || extractCompanyName(rawTitle) || firstH1 || rawTitle || 'Geen titel';

        // Extra cleanup: verwijder " - Home", " | Home" etc aan het einde
        companyName = companyName.replace(/\s*[-|·•]\s*(home|welkom|hoofdpagina|homepage)$/i, '').trim();

        console.log(`   🏢 Bedrijfsnaam: "${companyName}" (raw title: "${rawTitle?.slice(0, 50)}...")`);

        const analysis = {
            title: companyName,
            h1: $fresh('h1').first().text().trim() || '',
            niche: detectedNiche,
            nicheConfidence,
            headings: allHeadings.slice(0, 5),
            services: [...new Set(services)].slice(0, 6),
            slogans: verifiableSlogans,
            rawSlogans, // debug/inspectie: slogans die we niet gebruiken voor Hook B tenzij verifieerbaar
            stats: [...new Set(foundStats)].slice(0, 3),
            teamMembers: [...new Set(teamNames)].slice(0, 3),
            teamMembersWithRoles: teamMembersWithRoles.slice(0, 5), // 🆕 Naam + rol
            ownerNames: [...new Set(ownerNames)].slice(0, 3), // 🆕 Eigenaar/oprichter namen
            foundStoryHooks: foundStoryHooks.slice(0, 3), // 🆕 Quotable story details
            city: detectedCity,
            aboutContent,
            hasOpeningHours,
            hasTestimonials,
            hasBlog,
            isFacebookPage,
            usesFacebookAsWebsite: isFacebookPage,
            knowledgeFile, // Which .md file in knowledge/niches/ to consult
            uniqueObservations: [],
            extractedEmails: [...new Set(extractedEmails)], // Alle gevonden emails
            // 🆕 DEEP PERSONALIZATION DATA
            usps: [...new Set(usps)].slice(0, 5),
            claims: foundClaims.slice(0, 5),
            testimonials: testimonials.slice(0, 3),
            prices: prices.slice(0, 5),
            promos: promos.slice(0, 3),
            specializations: specializations.slice(0, 3),
            hasPricing,
            hasPromos
        };

        // Generate observations - ENHANCED voor meer personalisatie opties
        if (analysis.slogans.length > 0) analysis.uniqueObservations.push(`Slogan: "${analysis.slogans[0]}"`);
        if (analysis.city) analysis.uniqueObservations.push(`Gevestigd in ${analysis.city}`);
        if (analysis.claims.length > 0) analysis.uniqueObservations.push(`Claim: "${analysis.claims[0]}"`);
        if (analysis.testimonials.length > 0) {
            const t = analysis.testimonials[0];
            analysis.uniqueObservations.push(`Review${t.author ? ` van ${t.author}` : ''}: "${t.text.slice(0, 60)}..."`);
        }
        if (analysis.specializations.length > 0) analysis.uniqueObservations.push(`Gespecialiseerd in: ${analysis.specializations[0]}`);
        if (analysis.stats.length > 0) analysis.uniqueObservations.push(`Ze noemen: ${analysis.stats[0]}`);
        if (analysis.promos.length > 0) analysis.uniqueObservations.push(`Actie: "${analysis.promos[0]}"`);
        if (analysis.services.length > 0) analysis.uniqueObservations.push(`Dienst: "${analysis.services[0]}"`);
        if (analysis.teamMembers.length > 0) analysis.uniqueObservations.push(`Team: ${analysis.teamMembers[0]}`);
        if (analysis.hasTestimonials && analysis.testimonials.length === 0) analysis.uniqueObservations.push("Heeft reviews op de site");
        if (analysis.isFacebookPage) analysis.uniqueObservations.push(`🔥 Gebruikt Facebook als website`);

        // Log samenvatting
        console.log(`   📊 Personalisatie score: ${analysis.uniqueObservations.length} unieke hooks gevonden`);

        return analysis;
    } catch (error) {
        return {
            error: `Kon website niet analyseren: ${error.message}`,
            issues: ["Website niet bereikbaar of te traag"]
        };
    }
}
