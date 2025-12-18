// Extra tests met echte BE/NL websites
const testWebsites = [
    {
        email: 'develop.json@gmail.com',
        businessName: 'Bakkerij Test',
        websiteUrl: 'https://www.bakkerijdekoning.nl',
        tone: 'friendly'
    },
    {
        email: 'develop.json@gmail.com',
        businessName: 'Fitness Test',
        websiteUrl: 'https://www.basic-fit.com/nl-nl',
        tone: 'casual'
    },
    {
        email: 'develop.json@gmail.com',
        businessName: 'Garage Test',
        websiteUrl: 'https://www.halfords.nl',
        tone: 'professional'
    }
];

async function sendTestEmail(website) {
    const BASE_URL = 'http://localhost:3000';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📧 Versturen naar: ${website.websiteUrl}`);
    console.log(`   Stijl: ${website.tone}`);
    console.log('='.repeat(60));

    try {
        const response = await fetch(`${BASE_URL}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                toEmail: website.email,
                businessName: website.businessName,
                websiteUrl: website.websiteUrl,
                emailTone: website.tone,
                dryRun: false,
                analyzeFirst: true
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log(`✅ Email verzonden!`);
            console.log(`   Subject: ${data.subject}`);
            console.log(`   Niche: ${data.siteAnalysis?.niche || 'onbekend'}`);
            console.log(`   Personalisatie hooks: ${data.siteAnalysis?.uniqueObservations?.length || 0}`);
            if (data.siteAnalysis?.uniqueObservations?.length > 0) {
                console.log(`   Hooks gevonden:`);
                data.siteAnalysis.uniqueObservations.forEach((h, i) => {
                    console.log(`      ${i + 1}. ${h}`);
                });
            }
            // Toon nieuwe data
            if (data.siteAnalysis?.claims?.length > 0) {
                console.log(`   Claims: ${data.siteAnalysis.claims.slice(0, 2).join(', ')}`);
            }
            if (data.siteAnalysis?.testimonials?.length > 0) {
                console.log(`   Testimonials: ${data.siteAnalysis.testimonials.length} gevonden`);
            }
            if (data.siteAnalysis?.prices?.length > 0) {
                console.log(`   Prijzen: ${data.siteAnalysis.prices.slice(0, 3).join(', ')}`);
            }
        } else {
            console.log(`❌ Fout: ${data.error || 'Onbekende fout'}`);
        }

        return data;
    } catch (error) {
        console.log(`❌ Netwerk fout: ${error.message}`);
        return { error: error.message };
    }
}

async function runTests() {
    console.log('\n🚀 EXTRA TEST EMAILS - RONDE 2\n');

    for (const website of testWebsites) {
        await sendTestEmail(website);
        await new Promise(r => setTimeout(r, 5000));
    }

    console.log('\n🏁 KLAAR!');
}

runTests();
