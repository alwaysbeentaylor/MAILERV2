// Batch email API - Verstuur meerdere emails met rate limiting

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { leads, delayBetweenEmails = 5000 } = req.body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({
            error: "Leads array is verplicht",
            details: "Stuur een array met lead objecten"
        });
    }

    // Validatie van leads
    const validLeads = leads.filter(lead =>
        lead.toEmail && lead.businessName && lead.websiteUrl
    );

    if (validLeads.length === 0) {
        return res.status(400).json({
            error: "Geen geldige leads gevonden",
            details: "Elke lead moet toEmail, businessName en websiteUrl bevatten"
        });
    }

    const results = {
        total: validLeads.length,
        sent: 0,
        failed: 0,
        details: []
    };

    // Process each lead
    for (let i = 0; i < validLeads.length; i++) {
        const lead = validLeads[i];

        try {
            // Call the single email API internally
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;

            const response = await fetch(`${baseUrl}/api/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    toEmail: lead.toEmail,
                    businessName: lead.businessName,
                    websiteUrl: lead.websiteUrl,
                    contactPerson: lead.contactPerson || "",
                    emailTone: lead.emailTone || "professional",
                    customNotes: lead.customNotes || ""
                })
            });

            const data = await response.json();

            if (response.ok) {
                results.sent++;
                results.details.push({
                    status: 'sent',
                    email: lead.toEmail,
                    business: lead.businessName,
                    messageId: data.gmailMessageId
                });
            } else {
                results.failed++;
                results.details.push({
                    status: 'failed',
                    email: lead.toEmail,
                    business: lead.businessName,
                    error: data.error || 'Unknown error'
                });
            }
        } catch (err) {
            results.failed++;
            results.details.push({
                status: 'failed',
                email: lead.toEmail,
                business: lead.businessName,
                error: err.message
            });
        }

        // Rate limiting - wait between emails (except for last one)
        if (i < validLeads.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
        }
    }

    return res.status(200).json({
        success: true,
        ...results
    });
}
