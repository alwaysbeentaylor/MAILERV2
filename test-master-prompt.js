// Test DEFINITIEVE MASTER PROMPT - 4 echte emails
const http = require('http');

// Echte websites die bestaan
const websites = [
    { name: 'Ventuno Skylounge', url: 'https://ventunoskylounge.com/' },
    { name: 'Ramzy Group', url: 'https://www.ramzygroup.nl/', contactPerson: 'Ramzy' },
    { name: 'Kipperij', url: 'https://www.kipperij.nl/' },
    { name: 'Restaurant Yasumi', url: 'https://restaurantyasumi.nl/' }
];

async function sendTestEmail(businessName, websiteUrl, index) {
    return new Promise((resolve, reject) => {
        console.log(`\n📧 EMAIL ${index + 1}/4: ${businessName}`);

        const postData = JSON.stringify({
            toEmail: 'develop.json@gmail.com',
            businessName,
            websiteUrl,
            contactPerson: websites[index].contactPerson || null,
            emailTone: 'professional',
            dryRun: false
        });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/send-email',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 60000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode === 200) {
                        const wordCount = json.body?.split(/\s+/).filter(w => w.length > 0).length || 0;
                        console.log(`   ✅ VERSTUURD!`);
                        console.log(`   Subject: ${json.subject}`);
                        console.log(`   Woorden: ${wordCount}`);
                        console.log(`   Niche: ${json.niche} (${json.nicheConfidence})`);
                        console.log(`   --- BODY SNIPPET ---`);
                        console.log(json.body?.substring(0, 150) + '...');
                        console.log(`   --------------------`);
                    } else {
                        console.log(`   ❌ ERROR: ${json.error?.code || json.error?.message || res.statusCode}`);
                    }
                    resolve(json);
                } catch (e) {
                    console.log(`   ❌ Parse error: ${e.message}`);
                    console.log(`   Raw: ${data.slice(0, 200)}...`);
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            console.log(`   ❌ Request error: ${e.message}`);
            reject(e);
        });

        req.on('timeout', () => {
            console.log(`   ❌ Timeout!`);
            req.destroy();
            reject(new Error('Timeout'));
        });

        req.write(postData);
        req.end();
    });
}

async function runTests() {
    console.log('🧪 DEFINITIEVE MASTER PROMPT TEST\n');
    console.log('Naar: develop.json@gmail.com');
    console.log('Verwacht: 60-95 woorden, sign-off "Hope"\n');

    let success = 0;

    for (let i = 0; i < websites.length; i++) {
        try {
            const result = await sendTestEmail(websites[i].name, websites[i].url, i);
            if (result.success) success++;
            // Delay tussen emails
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            console.log(`   Doorgaan naar volgende...`);
        }
    }

    console.log(`\n✅ Klaar! ${success}/4 emails verstuurd.`);
    console.log('Check inbox: develop.json@gmail.com');
}

runTests();
