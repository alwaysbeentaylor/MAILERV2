const http = require('http');

function testTone(tone) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            toEmail: 'test@debug.com',
            businessName: 'Pizzeria Milano',
            websiteUrl: 'https://pizzeria-milano.be',
            emailTone: tone,
            dryRun: true,
            analyzeFirst: false
        });

        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/send-email',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const result = JSON.parse(body);
                resolve({
                    subject: result.subject,
                    intro: result.sections?.intro
                });
            });
        });
        req.write(data);
        req.end();
    });
}

async function main() {
    // Test each tone with delay
    const tones = ['professional', 'casual', 'urgent', 'friendly'];
    const allResults = {};

    for (const tone of tones) {
        const result = await testTone(tone);
        allResults[tone] = result;
        await new Promise(r => setTimeout(r, 500)); // wait 500ms
    }

    // Output final JSON
    require('fs').writeFileSync('tone-results.json', JSON.stringify(allResults, null, 2));
    console.log('Results saved to tone-results.json');

    // Also print subjects
    console.log('SUBJECTS:');
    for (const tone of tones) {
        console.log(tone + ': ' + allResults[tone].subject);
    }
}

main();
