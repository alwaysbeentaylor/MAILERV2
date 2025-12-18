// Test Resend API directly
const RESEND_API_KEY = 're_UMRZo723_EEkSBs6tQtbiJEZsecGh31tZ';

async function testResend() {
    console.log('🧪 DIRECT RESEND API TEST\n');

    const body = {
        from: 'SKYE <info@skye-unlimited.be>',
        to: ['develop.json@gmail.com'],
        subject: 'Test Email - Plain Text',
        text: 'Dit is een plain text test email.\n\nGroet,\nHope',
        html: '<p>Dit is een plain text test email.</p><p>Groet,<br>Hope</p>'
    };

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));

        if (!response.ok) {
            console.log('\n❌ ERROR');
        } else {
            console.log('\n✅ SUCCESS!');
            console.log('Message ID:', data.id);
        }
    } catch (error) {
        console.error('❌ FETCH ERROR:', error.message);
    }
}

testResend();
