// Stuur 1 echte test email
async function sendOneTest() {
    const BASE_URL = 'http://localhost:3000';

    console.log('📧 Versturen van echte test email...\n');

    const res = await fetch(`${BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            toEmail: 'develop.json@gmail.com',
            businessName: 'Coolblue Test',
            websiteUrl: 'https://www.coolblue.nl',
            emailTone: 'friendly',
            dryRun: false, // ECHTE VERZENDING
            analyzeFirst: true
        })
    });

    const data = await res.json();

    if (data.success) {
        console.log('✅ Email verzonden!');
        console.log('Subject:', data.subject);
        console.log('\nCheck develop.json@gmail.com!');
    } else {
        console.log('❌ Fout:', data.error);
    }
}

sendOneTest();
