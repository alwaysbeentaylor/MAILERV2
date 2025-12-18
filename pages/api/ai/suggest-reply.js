// AI Reply Suggestion API - Uses OpenAI to suggest replies
import OpenAI from 'openai';

// Initialize OpenAI
let openai = null;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { inboundEmail, originalEmail, format = 'text' } = req.body;

    if (!inboundEmail) {
        return res.status(400).json({ error: 'Inbound email content is required' });
    }

    if (!openai) {
        return res.status(500).json({ error: 'OpenAI is not configured' });
    }

    try {
        const systemPrompt = `Je bent Hope, de vriendelijke en professionele assistent van SKYE Unlimited.
SKYE Unlimited is een webdesign en automatiseringsbedrijf dat helpt met:
- Moderne, converterende websites
- WhatsApp en chat integraties
- Automatische afspraaksystemen
- Online zichtbaarheid

BELANGRIJKE REGELS:
1. Schrijf in het Nederlands, tenzij de inkomende mail in een andere taal is
2. Houd het kort en to-the-point (max 100 woorden)
3. Wees vriendelijk maar professioneel
4. Beantwoord de vraag direct
5. Als ze interesse tonen, stel een kort gesprek voor
6. Onderteken met "Hope" (geen "Groeten" of "Met vriendelijke groet")
7. ${format === 'html' ? 'Gebruik <p> tags voor alineas, geen <br> tags' : 'Gebruik plain text, geen HTML'}

CONTEXT:
- Wij hebben hen eerst benaderd met een cold email over hun website
- Dit is hun antwoord op onze email
- We willen een conversatie starten, niet direct verkopen`;

        const userPrompt = `
ONTVANGEN EMAIL:
Van: ${inboundEmail.from}
Onderwerp: ${inboundEmail.subject}
Inhoud:
${inboundEmail.body || inboundEmail.text || '(geen tekst)'}

${originalEmail ? `
ONZE ORIGINELE EMAIL (waar ze op antwoorden):
Onderwerp: ${originalEmail.subject}
Inhoud:
${originalEmail.body || '(niet beschikbaar)'}
` : ''}

Schrijf een passend antwoord op deze email. ${format === 'html' ? 'Gebruik HTML formatting.' : 'Gebruik plain text.'}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        const suggestedReply = response.choices[0].message.content.trim();

        res.status(200).json({
            success: true,
            reply: suggestedReply,
            format
        });
    } catch (error) {
        console.error('AI Reply error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
