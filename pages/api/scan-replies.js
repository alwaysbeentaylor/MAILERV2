// pages/api/scan-replies.js
// Scant Gmail inbox voor replies op verzonden emails

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import {
    getAllEmails,
    findEmailByRecipient,
    saveReply,
    markEmailAsReplied
} from '../../utils/database';

// OAuth2 client setup
function getOAuth2Client() {
    let credentials, tokens;

    // Probeer eerst Environment Variables (voor Vercel)
    if (process.env.GMAIL_CREDENTIALS && process.env.GMAIL_TOKENS) {
        try {
            credentials = JSON.parse(process.env.GMAIL_CREDENTIALS);
            tokens = JSON.parse(process.env.GMAIL_TOKENS);
        } catch (e) {
            console.error("Fout bij parsen van GMAIL ENV variabelen:", e);
        }
    }

    // Fallback naar lokale bestanden
    if (!credentials || !tokens) {
        const credentialsPath = path.join(process.cwd(), 'gmail_credentials.json');
        const tokensPath = path.join(process.cwd(), 'tokens.json');

        if (fs.existsSync(credentialsPath) && fs.existsSync(tokensPath)) {
            credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        }
    }

    if (!credentials || !tokens) {
        throw new Error('Gmail credentials of tokens niet gevonden (Check ENV of lokale bestanden)');
    }

    const creds = credentials.installed || credentials.web;
    const { client_id, client_secret, redirect_uris } = creds;

    const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris?.[0] || (process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/oauth-callback` : 'http://localhost:3000/oauth-callback')
    );

    oAuth2Client.setCredentials(tokens);
    return oAuth2Client;
}

export default async function handler(req, res) {
    // Allow GET for easy testing, POST for production
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('🔍 Scanning Gmail inbox for replies...');

        const auth = getOAuth2Client();
        const gmail = google.gmail({ version: 'v1', auth });

        // Haal alle verzonden emails uit database
        const sentEmails = await getAllEmails({ hasReply: false });

        if (sentEmails.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Geen emails om te scannen',
                scanned: 0,
                newReplies: 0
            });
        }

        console.log(`📧 Scannen voor replies op ${sentEmails.length} emails...`);

        // Verzamel alle email adressen om te zoeken
        const emailAddresses = [...new Set(sentEmails.map(e => e.to_email))];

        let newReplies = 0;
        const repliesFound = [];

        for (const emailAddr of emailAddresses) {
            try {
                // Zoek naar emails VAN dit adres (= replies)
                const searchQuery = `from:${emailAddr} is:inbox`;

                const response = await gmail.users.messages.list({
                    userId: 'me',
                    q: searchQuery,
                    maxResults: 10
                });

                const messages = response.data.messages || [];

                if (messages.length > 0) {
                    console.log(`📬 Gevonden: ${messages.length} berichten van ${emailAddr}`);

                    for (const msg of messages) {
                        // Haal volledige bericht op
                        const fullMessage = await gmail.users.messages.get({
                            userId: 'me',
                            id: msg.id,
                            format: 'metadata',
                            metadataHeaders: ['From', 'To', 'Subject', 'Date']
                        });

                        // Extract headers
                        const headers = fullMessage.data.payload?.headers || [];
                        const fromHeader = headers.find(h => h.name === 'From')?.value || '';
                        const dateHeader = headers.find(h => h.name === 'Date')?.value || '';
                        const subjectHeader = headers.find(h => h.name === 'Subject')?.value || '';

                        // Snippet (preview van bericht)
                        const snippet = fullMessage.data.snippet || '';

                        // Vind de originele email uit onze database
                        const originalEmail = await findEmailByRecipient(emailAddr);

                        if (originalEmail && !originalEmail.has_reply) {
                            // Controleer of dit bericht nieuwer is dan onze verzonden email
                            const replyDate = new Date(dateHeader);
                            const sentDate = new Date(originalEmail.sent_at);

                            if (replyDate > sentDate) {
                                // Dit is een nieuwe reply!
                                await saveReply(
                                    originalEmail.id,
                                    fullMessage.data.threadId,
                                    replyDate.toISOString(),
                                    snippet.slice(0, 200)
                                );

                                newReplies++;
                                repliesFound.push({
                                    emailId: originalEmail.id,
                                    from: emailAddr,
                                    businessName: originalEmail.business_name,
                                    subject: subjectHeader,
                                    snippet: snippet.slice(0, 100),
                                    receivedAt: replyDate.toISOString()
                                });

                                console.log(`✅ Nieuwe reply gevonden van ${emailAddr} (${originalEmail.business_name})`);
                            }
                        }
                    }
                }
            } catch (searchError) {
                console.error(`⚠️ Fout bij zoeken naar ${emailAddr}:`, searchError.message);
            }
        }

        console.log(`📊 Scan compleet: ${newReplies} nieuwe replies gevonden`);

        return res.status(200).json({
            success: true,
            scanned: emailAddresses.length,
            newReplies,
            repliesFound
        });

    } catch (error) {
        console.error('❌ Reply scan error:', error);

        // Check voor specifieke OAuth errors
        if (error.message?.includes('invalid_grant') || error.message?.includes('Token')) {
            return res.status(401).json({
                error: 'Gmail authenticatie verlopen',
                details: 'Voer get-gmail-refresh-token.js opnieuw uit om een nieuwe token te krijgen',
                needsReauth: true
            });
        }

        return res.status(500).json({
            error: 'Reply scan mislukt',
            details: error.message
        });
    }
}
