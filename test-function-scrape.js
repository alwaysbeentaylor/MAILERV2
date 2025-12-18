import * as cheerio from "cheerio";

async function analyzeWebsite(url) {
    try {
        console.log(`Fetching ${url}...`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        if (!response.ok) {
            console.error(`Failed: ${response.status} ${response.statusText}`);
            return { error: `Website niet bereikbaar (${response.status})`, issues: [] };
        }

        const html = await response.text();
        console.log(`Got HTML, length: ${html.length}`);
        const $ = cheerio.load(html);

        // === STAP 1: HAAL BELANGRIJKE TEKST OP ===
        const pageTitle = $('title').text().trim().toLowerCase();

        // ... [Copy minimal logic to test extraction] ...

        const teamNames = [];
        $('[class*="team"], [class*="over"], [class*="about"]').each((i, el) => {
            const text = $(el).text().trim();
            const nameMatch = text.match(/([A-Z][a-z]+ [A-Z][a-z]+)/g);
            if (nameMatch) teamNames.push(...nameMatch);
        });

        console.log("Team names found:", teamNames);

        const slogans = [];
        $('h1, h2, .hero, [class*="hero"], [class*="slogan"]').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 10 && text.length < 120 &&
                !text.toLowerCase().includes('menu') &&
                !text.toLowerCase().includes('cookie')) {
                slogans.push(text);
            }
        });
        console.log("Slogans found:", slogans);

        return { title: pageTitle, teamMembers: teamNames, slogans };

    } catch (error) {
        console.error("Error:", error);
        return {
            error: `Kon website niet analyseren: ${error.message}`,
            issues: ["Website niet bereikbaar of te traag"]
        };
    }
}

analyzeWebsite("https://www.tropical-joy.be");
