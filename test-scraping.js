// Dry run test om scraping output te bekijken (geen echte email)
async function testScraping() {
    const BASE_URL = 'http://localhost:3000';

    const testUrls = [
        'https://www.skye-unlimited.be',
        'https://www.bol.com',
        'https://www.coolblue.nl'
    ];

    console.log('\n🔍 SCRAPING TEST (dry run - geen emails)\n');

    for (const url of testUrls) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📧 Testing: ${url}`);
        console.log('='.repeat(60));

        try {
            const response = await fetch(`${BASE_URL}/api/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toEmail: 'test@example.com',
                    businessName: 'Test',
                    websiteUrl: url,
                    emailTone: 'friendly',
                    dryRun: true, // Alleen preview, geen verzending
                    analyzeFirst: true
                })
            });

            const data = await response.json();

            if (data.success) {
                const a = data.siteAnalysis || {};
                console.log(`\n📊 ANALYSE RESULTATEN:`);
                console.log(`   Bedrijfsnaam: ${a.title || 'onbekend'}`);
                console.log(`   Niche: ${a.niche || 'onbekend'} (${a.nicheConfidence || '?'})`);
                console.log(`   Stad: ${a.city || 'niet gevonden'}`);

                console.log(`\n🎯 PERSONALISATIE DATA:`);
                console.log(`   Slogans: ${a.slogans?.length || 0} → ${a.slogans?.slice(0, 2).join(' | ') || 'geen'}`);
                console.log(`   Services: ${a.services?.length || 0} → ${a.services?.slice(0, 3).join(', ') || 'geen'}`);
                console.log(`   Claims: ${a.claims?.length || 0} → ${a.claims?.slice(0, 2).join(' | ') || 'geen'}`);
                console.log(`   USPs: ${a.usps?.length || 0} → ${a.usps?.slice(0, 2).join(' | ') || 'geen'}`);
                console.log(`   Testimonials: ${a.testimonials?.length || 0}`);
                console.log(`   Prijzen: ${a.prices?.length || 0} → ${a.prices?.slice(0, 3).join(', ') || 'geen'}`);
                console.log(`   Promos: ${a.promos?.length || 0} → ${a.promos?.slice(0, 2).join(' | ') || 'geen'}`);
                console.log(`   Specialisaties: ${a.specializations?.length || 0} → ${a.specializations?.join(', ') || 'geen'}`);
                console.log(`   Team: ${a.teamMembers?.join(', ') || 'geen'}`);

                console.log(`\n💬 UNIEKE OBSERVATIES (${a.uniqueObservations?.length || 0}):`);
                a.uniqueObservations?.forEach((o, i) => console.log(`   ${i + 1}. ${o}`));

                console.log(`\n📧 GEGENEREERDE EMAIL:`);
                console.log(`   Subject: ${data.subject}`);
                console.log(`   Intro: ${data.sections?.intro?.slice(0, 150)}...`);
            } else {
                console.log(`❌ Fout: ${data.error}`);
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }

        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('\n\n🏁 SCRAPING TEST KLAAR');
}

testScraping();
