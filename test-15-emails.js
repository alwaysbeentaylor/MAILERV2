// 15 test emails met echte NL/BE bedrijven
async function send15Tests() {
    const BASE_URL = 'http://localhost:3000';

    const tests = [
        // SLAGERS (4)
        { name: 'Slagerij de Wild', url: 'https://www.slagerijdewild.nl', tone: 'friendly' },
        { name: 'Slagerij van den Berg', url: 'https://www.slagerijvandenberg.nl', tone: 'professional' },
        { name: 'Keurslager', url: 'https://www.keurslager.nl', tone: 'casual' },
        { name: 'Slagerij Jansen', url: 'https://www.slagerij-jansen.nl', tone: 'friendly' },

        // BAKKERS (4)
        { name: 'Bakkerij de Koning', url: 'https://www.bakkerijdekoning.nl', tone: 'casual' },
        { name: 'Bakker Bart', url: 'https://www.bakkerbart.nl', tone: 'friendly' },
        { name: 'Echte Bakker', url: 'https://www.echtebakker.nl', tone: 'professional' },
        { name: 'Banketbakkerij', url: 'https://www.banketbakkerijvandam.nl', tone: 'friendly' },

        // LOODGIETERS (4)
        { name: 'Loodgieter 24', url: 'https://www.loodgieter24.nl', tone: 'urgent' },
        { name: 'CV Monteur', url: 'https://www.cvmonteur.nl', tone: 'professional' },
        { name: 'Riool Expert', url: 'https://www.rioolexpert.nl', tone: 'casual' },
        { name: 'Installatiewerk', url: 'https://www.installatiewerk.nl', tone: 'friendly' },

        // SCHILDERS (3)
        { name: 'Schilder Amsterdam', url: 'https://www.schilderamsterdam.nl', tone: 'professional' },
        { name: 'Schildersbedrijf', url: 'https://www.schildersbedrijf.nl', tone: 'friendly' },
        { name: 'Verfspecialist', url: 'https://www.verfspecialist.nl', tone: 'casual' }
    ];

    console.log(`\n🚀 VERSTUREN VAN ${tests.length} TEST EMAILS\n`);
    console.log('Categorieën: Slagers, Bakkers, Loodgieters, Schilders\n');

    let success = 0;
    let failed = 0;

    for (let i = 0; i < tests.length; i++) {
        const t = tests[i];
        console.log(`[${i + 1}/${tests.length}] ${t.name} (${t.tone})...`);

        try {
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

            if (data.success) {
                console.log(`   ✅ ${data.subject?.slice(0, 50)}`);
                success++;
            } else {
                console.log(`   ❌ ${data.error}`);
                failed++;
            }
        } catch (e) {
            console.log(`   ❌ Network error: ${e.message}`);
            failed++;
        }

        // 4 sec wachten tussen emails
        await new Promise(r => setTimeout(r, 4000));
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 RESULTAAT: ${success} verzonden, ${failed} mislukt`);
    console.log('📬 Check develop.json@gmail.com voor alle emails!');
    console.log('='.repeat(50));
}

send15Tests();
