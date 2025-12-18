// Test BROKEN DOMAIN FALLBACK
const http = require('http');

async function testBrokenDomain() {
    console.log('🧪 TESTING BROKEN DOMAIN FALLBACK\n');

    const postData = JSON.stringify({
        toEmail: 'develop.json@gmail.com',
        businessName: 'Unreachable Shop',
        websiteUrl: 'https://this-domain-should-definitely-not-exist-123.com',
        contactPerson: 'Dennis',
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
        timeout: 30000
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                console.log(`Status: ${res.statusCode}`);
                console.log(`Subject: ${json.subject}`);
                console.log(`--- BODY ---`);
                console.log(json.body);
                console.log(`------------`);
            } catch (e) {
                console.log('Error parsing JSON:', e.message);
                console.log('Raw:', data.slice(0, 200));
            }
        });
    });

    req.on('error', (e) => console.log('Request error:', e.message));
    req.write(postData);
    req.end();
}

testBrokenDomain();
