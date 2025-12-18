const { analyzeWebsite } = require('./utils/scraper');

async function testScraper() {
    const urls = [
        'https://www.deschilderspecialist.nl',
        'https://www.tuiniergroep.nl',
        'https://www.bouwbedrijfdekempen.nl',
        'https://www.hairstudiokim.nl'
    ];

    for (const url of urls) {
        console.log(`\n🔍 Testing ${url}...`);
        try {
            const result = await analyzeWebsite(url);
            if (result.error) {
                console.log(`❌ Error: ${result.error}`);
            } else {
                console.log(`✅ Success! Title: ${result.title}`);
                console.log(`   Services: ${result.services?.join(', ')}`);
                console.log(`   Signals: ${result.issues?.join(', ') || 'none'}`);
            }
        } catch (e) {
            console.log(`❌ Fatal error: ${e.message}`);
        }
    }
}

testScraper();
