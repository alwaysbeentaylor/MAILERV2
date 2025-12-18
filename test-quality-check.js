// Test quality check met 3 emails
async function testQualityCheck() {
    const BASE_URL = 'http://localhost:3000';

    const tests = [
        { name: 'Slagerij Test', url: 'https://www.slagerijdewild.nl', tone: 'friendly' },
        { name: 'Bakker Test', url: 'https://www.bakkerbart.nl', tone: 'casual' },
        { name: 'Loodgieter Test', url: 'https://www.loodgieter24.nl', tone: 'professional' }
    ];

    console.log('🧪 QUALITY CHECK TEST - 3 emails\n');

    for (const t of tests) {
        console.log(`📧 ${t.name}...`);

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
        console.log(data.success ? `✅ ${data.subject}` : `❌ ${data.error}`);

        await new Promise(r => setTimeout(r, 6000)); // Extra tijd voor quality check
    }

    console.log('\n📬 Check develop.json@gmail.com!');
}

testQualityCheck();
