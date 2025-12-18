
async function testApi() {
    try {
        const response = await fetch('http://localhost:3000/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                toEmail: "test@test.com",
                businessName: "Tropical Joy",
                websiteUrl: "https://www.tropical-joy.be",
                dryRun: true,
                emailTone: "casual"
            })
        });

        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

testApi();
