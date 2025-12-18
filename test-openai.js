// Test script to verify OpenAI integration
require('dotenv').config({ path: '.env.local' });
const OpenAI = require('openai').default;

async function testOpenAI() {
    console.log('🔍 Checking OpenAI API key...');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error('❌ OPENAI_API_KEY is niet ingesteld in .env.local');
        process.exit(1);
    }

    console.log('✅ API key gevonden:', apiKey.slice(0, 20) + '...');

    try {
        const openai = new OpenAI({ apiKey });

        console.log('\n🤖 Testen van OpenAI API...');
        const result = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Je bent een behulpzame assistent.' },
                { role: 'user', content: 'Zeg alleen: "OpenAI werkt perfect!"' }
            ],
            max_tokens: 50
        });

        console.log('✅ Response:', result.choices[0].message.content);
        console.log('\n🎉 OpenAI integratie werkt!');

    } catch (error) {
        console.error('❌ OpenAI API fout:', error.message);
        if (error.code) console.error('   Error code:', error.code);
        if (error.status) console.error('   Status:', error.status);
        process.exit(1);
    }
}

testOpenAI();
