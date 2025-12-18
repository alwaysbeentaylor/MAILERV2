// 5 snelle test emails zonder slogan
async function test5() {
    const BASE_URL = 'http://localhost:3000';

    const tests = [
        { name: 'Bakker Test', url: 'https://www.bakkerbart.nl', tone: 'friendly' },
        { name: 'Slager Test', url: 'https://www.slagerijdewild.nl', tone: 'casual' },
        { name: 'Schilder Test', url: 'https://www.schildersbedrijf.nl', tone: 'professional' },
        { name: 'Kapper Test', url: 'https://www.kapsalonkorstanje.nl', tone: 'friendly' },
        { name: 'Garage Test', url: 'https://www.halfords.nl', tone: 'casual' }
    ];

    console.log('🚀 5 TEST EMAILS (zonder slogan optie)\n');

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
        await new Promise(r => setTimeout(r, 5000));
    }

    console.log('\n📬 Check develop.json@gmail.com!');
}

test5();
