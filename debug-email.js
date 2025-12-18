// Uitgebreide debug
async function debugEmail() {
    const BASE_URL = 'http://localhost:3000';

    console.log('🔍 DEBUG: Email generatie testen...\n');

    const res = await fetch(`${BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            toEmail: 'test@test.com',
            businessName: 'Test Bedrijf',
            websiteUrl: 'https://www.bol.com',
            emailTone: 'friendly',
            dryRun: true,
            analyzeFirst: true
        })
    });

    const data = await res.json();

    console.log('=== SECTIONS ===\n');

    if (data.sections) {
        console.log('INTRO:');
        console.log(data.sections.intro || '(leeg)');
        console.log('\nAUDIT:');
        console.log(data.sections.audit || '(leeg)');
        console.log('\nBOOSTERS/OPLOSSING:');
        console.log(data.sections.boosters || '(leeg)');
        console.log('\nRESULTAAT:');
        console.log(data.sections.resultaat || '(leeg)');
        console.log('\nCTA:');
        console.log(data.sections.cta || '(leeg)');
    } else {
        console.log('GEEN SECTIONS!');
        console.log('Body:', data.body);
    }
}

debugEmail();
