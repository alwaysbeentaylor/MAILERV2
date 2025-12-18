// Batch email API with Server-Sent Events for real-time progress
// Streams updates to the client as each email is processed

export const config = {
    api: {
        responseLimit: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { leads, delayBetweenEmails = 5000, sessionPrompt = "" } = req.body;

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

    // Setup Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Helper to send SSE message
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial state
    sendEvent('start', {
        total: validLeads.length,
        leads: validLeads.map((lead, index) => ({
            index,
            email: lead.toEmail,
            business: lead.businessName,
            status: 'waiting' // waiting, processing, sent, failed
        }))
    });

    const results = {
        total: validLeads.length,
        sent: 0,
        failed: 0,
        details: []
    };

    // Process each lead
    for (let i = 0; i < validLeads.length; i++) {
        const lead = validLeads[i];

        // Send processing status
        sendEvent('processing', {
            index: i,
            email: lead.toEmail,
            business: lead.businessName,
            current: i + 1,
            total: validLeads.length
        });

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
                    customNotes: lead.customNotes || "",
                    sessionPrompt: sessionPrompt // Extra AI instructies voor deze sessie
                })
            });

            const data = await response.json();

            if (response.ok) {
                results.sent++;
                const detail = {
                    status: 'sent',
                    index: i,
                    email: lead.toEmail,
                    business: lead.businessName,
                    messageId: data.gmailMessageId || data.messageId,
                    usedAI: data.usedAI,
                    aiStatus: data.aiStatus,
                    emailTone: data.emailTone
                };
                results.details.push(detail);
                sendEvent('sent', detail);
            } else {
                results.failed++;
                const detail = {
                    status: 'failed',
                    index: i,
                    email: lead.toEmail,
                    business: lead.businessName,
                    error: data.error?.message || data.error || 'Unknown error',
                    errorCode: data.error?.code || 'UNKNOWN',
                    errorDetails: data.error?.details || null,
                    errorSuggestion: data.error?.suggestion || null,
                    fullError: data.error || data
                };
                results.details.push(detail);
                sendEvent('failed', detail);
            }
        } catch (err) {
            results.failed++;
            const detail = {
                status: 'failed',
                index: i,
                email: lead.toEmail,
                business: lead.businessName,
                error: err.message,
                errorCode: 'NETWORK_ERROR',
                fullError: { message: err.message, stack: err.stack }
            };
            results.details.push(detail);
            sendEvent('failed', detail);
        }

        // Rate limiting - wait between emails (except for last one)
        if (i < validLeads.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
        }
    }

    // Send completion event
    sendEvent('complete', {
        success: true,
        ...results
    });

    res.end();
}
