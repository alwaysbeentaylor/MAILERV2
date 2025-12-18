// Test email generation naar develop.json@gmail.com
const http = require('http');

async function testEmail() {
    console.log('🧪 TEST EMAIL NAAR develop.json@gmail.com\n');

    const postData = JSON.stringify({
        toEmail: 'develop.json@gmail.com',
        businessName: 'Test Bedrijf',
        websiteUrl: 'https://www.skye-unlimited.be',
        emailTone: 'professional',
        dryRun: false // SEND IT!
    });

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/send-email',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);

                    console.log('=== RESPONSE STATUS ===');
                    console.log(`Status: ${res.statusCode}\n`);

                    if (res.statusCode !== 200) {
                        console.log('❌ ERROR - RAW RESPONSE:');
                        console.log(data);
                        console.log('\n❌ ERROR - PARSED:');
                        console.log(JSON.stringify(jsonData, null, 2));
                        resolve();
                        return;
                    }

                    console.log('✅ SUCCESS!');
                    console.log('\n=== SUBJECT ===');
                    console.log(jsonData.subject);

                    console.log('\n=== BODY (PLAIN TEXT) ===');
                    console.log(jsonData.body);

                    console.log('\n=== METADATA ===');
                    console.log(`Message ID: ${jsonData.messageId}`);
                    console.log(`Send Method: ${jsonData.sendMethod}`);
                    console.log(`Used AI: ${jsonData.usedAI}`);
                    console.log(`Niche: ${jsonData.siteAnalysis?.niche || 'unknown'}`);

                    if (jsonData.sections) {
                        console.log('\n=== SECTIONS ===');
                        console.log(`Intro: ${jsonData.sections.intro ? '✅' : '❌'}`);
                        console.log(`Audit: ${jsonData.sections.audit ? '✅' : '❌'}`);
                        console.log(`Boosters: ${jsonData.sections.boosters ? '✅' : '❌'}`);
                        console.log(`Resultaat: ${jsonData.sections.resultaat ? '✅' : '❌'}`);
                        console.log(`CTA: ${jsonData.sections.cta ? '✅' : '❌'}`);
                    }

                    resolve();
                } catch (e) {
                    console.error('❌ PARSE ERROR:', e.message);
                    console.log('Raw response:', data);
                    reject(e);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ REQUEST ERROR:', error.message);
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

testEmail().catch(console.error);
