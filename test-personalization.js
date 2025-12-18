// Test script voor personalisatie verbetering
// Stuurt test emails naar develop.json@gmail.com met verschillende websites

const testWebsites = [
    {
        email: 'develop.json@gmail.com',
        businessName: 'Test Restaurant',
        websiteUrl: 'https://www.lacucinadimaurizio.nl',
        tone: 'friendly'
    },
    {
        email: 'develop.json@gmail.com',
        businessName: 'Test Kapper',
        websiteUrl: 'https://www.kapsalonkorstanje.nl',
        tone: 'casual'
    },
    {
        email: 'develop.json@gmail.com',
        businessName: 'Test Loodgieter',
        websiteUrl: 'https://www.loodgieterbedrijfvandijk.nl',
        tone: 'professional'
    },
    {
        email: 'develop.json@gmail.com',
        businessName: 'Test Coach',
        websiteUrl: 'https://www.lifecoachingamsterdam.nl',
        tone: 'friendly'
    }
];

async function sendTestEmail(website) {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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
                dryRun: false, // Echte emails versturen
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
                console.log(`   Hooks: ${data.siteAnalysis.uniqueObservations.slice(0, 3).join(', ')}`);
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
    console.log('\n🚀 START TEST EMAILS VOOR PERSONALISATIE\n');
    console.log(`📬 Alle emails gaan naar: develop.json@gmail.com`);
    console.log(`📊 Aantal tests: ${testWebsites.length}\n`);

    const results = [];

    for (const website of testWebsites) {
        const result = await sendTestEmail(website);
        results.push(result);

        // Wacht 3 seconden tussen emails
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SAMENVATTING');
    console.log('='.repeat(60));
    console.log(`✅ Succesvol: ${results.filter(r => r.success).length}`);
    console.log(`❌ Mislukt: ${results.filter(r => !r.success).length}`);
    console.log('\n🏁 KLAAR! Check je inbox op develop.json@gmail.com');
}

runTests();
