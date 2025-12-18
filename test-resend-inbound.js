// Test what data we get from inbound email API
const RESEND_API_KEY = 're_UMRZo723_EEkSBs6tQtbiJEZsecGh31tZ';

async function testInboundData() {
    console.log('🔍 TESTING INBOUND EMAIL DATA STRUCTURE\n');

    try {
        // 1. List inbound emails
        console.log('1. Listing inbound emails...');
        const listRes = await fetch('https://api.resend.com/emails/receiving', {
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` }
        });
        const listData = await listRes.json();
        console.log('List response:', JSON.stringify(listData, null, 2).slice(0, 1000));

        if (listData.data && listData.data.length > 0) {
            const firstEmail = listData.data[0];
            console.log('\n2. First email fields:', Object.keys(firstEmail));
            console.log('First email:', JSON.stringify(firstEmail, null, 2));

            // 3. Get full email details
            console.log('\n3. Getting full email details for ID:', firstEmail.id);
            const detailRes = await fetch(`https://api.resend.com/emails/receiving/${firstEmail.id}`, {
                headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` }
            });
            const detailData = await detailRes.json();
            console.log('Detail response fields:', Object.keys(detailData));
            console.log('Detail response:', JSON.stringify(detailData, null, 2).slice(0, 2000));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testInboundData();
