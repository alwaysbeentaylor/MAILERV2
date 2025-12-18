
async function sendEmail() {
    try {
        console.log("Sending request to API...");
        const response = await fetch('http://localhost:3000/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                toEmail: "develop.json@gmail.com",
                businessName: "Astro Tax",
                websiteUrl: "https://www.astro.tax/",
                dryRun: false,
                emailTone: "professional"
            })
        });

        const data = await response.json();
        console.log("Response Status:", response.status);
        console.log("Response Body:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

sendEmail();
