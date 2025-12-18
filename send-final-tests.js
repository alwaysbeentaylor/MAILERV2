// Stuur 2 echte test emails met volledige logging
async function sendTests() {
    const BASE_URL = 'http://localhost:3000';

    const tests = [
        { name: 'SKYE', url: 'https://www.skye-unlimited.be', tone: 'professional' },
        { name: 'Bol', url: 'https://www.bol.com', tone: 'casual' }
    ];

    for (const t of tests) {
        console.log(`\n📧 ${t.name}...`);

        const res = await fetch(`${BASE_URL}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                toEmail: 'develop.json@gmail.com',
                businessName: t.name,
                websiteUrl: t.url,
                emailTone: t.tone,
                dryRun: false,
                analyzeFirst: true
            })
        });

        const data = await res.json();
        console.log(data.success ? `✅ Verzonden: ${data.subject}` : `❌ ${data.error}`);

        await new Promise(r => setTimeout(r, 5000));
    }

    console.log('\n🏁 KLAAR! Check develop.json@gmail.com');
}

sendTests();
