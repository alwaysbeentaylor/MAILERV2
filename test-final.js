// Echte test emails met goed scrapeable websites
async function sendRealTests() {
    const BASE_URL = 'http://localhost:3000';

    const tests = [
        {
            email: 'develop.json@gmail.com',
            businessName: 'Bol.com',
            websiteUrl: 'https://www.bol.com',
            tone: 'casual'
        },
        {
            email: 'develop.json@gmail.com',
            businessName: 'Coolblue',
            websiteUrl: 'https://www.coolblue.nl',
            tone: 'friendly'
        },
        {
            email: 'develop.json@gmail.com',
            businessName: 'SKYE',
            websiteUrl: 'https://www.skye-unlimited.be',
            tone: 'professional'
        }
    ];

    console.log('\n🚀 ECHTE TEST EMAILS VERSTUREN\n');

    for (const test of tests) {
        console.log(`\n📧 ${test.businessName} (${test.tone})...`);

        try {
            const res = await fetch(`${BASE_URL}/api/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toEmail: test.email,
                    businessName: test.businessName,
                    websiteUrl: test.websiteUrl,
                    emailTone: test.tone,
                    dryRun: false,
                    analyzeFirst: true
                })
            });

            const data = await res.json();
            console.log(data.success ? `   ✅ VERZONDEN: ${data.subject?.slice(0, 50)}` : `   ❌ FOUT: ${data.error}`);
        } catch (e) {
            console.log(`   ❌ ${e.message}`);
        }

        await new Promise(r => setTimeout(r, 5000));
    }

    console.log('\n\n✅ KLAAR! Check develop.json@gmail.com');
}

sendRealTests();
