// get-gmail-refresh-token.js
// Eénmalig script om je Gmail refresh token op te halen
// Vereist: gmail_credentials.json in dezelfde map

const fs = require("fs");
const { google } = require("googleapis");

const SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly"  // Voor reply scanning
];
const CREDENTIALS_PATH = "gmail_credentials.json";

async function main() {
    // Check of credentials bestand bestaat
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        console.error("❌ Fout: gmail_credentials.json niet gevonden!");
        console.log("\n📋 Instructies:");
        console.log("1. Ga naar https://console.cloud.google.com/");
        console.log("2. Maak een nieuw project of selecteer een bestaand project");
        console.log("3. Ga naar 'APIs & Services' → 'Credentials'");
        console.log("4. Klik op 'Create Credentials' → 'OAuth client ID'");
        console.log("5. Kies 'Desktop app' als applicatie type");
        console.log("6. Download de JSON en hernoem naar 'gmail_credentials.json'");
        console.log("7. Plaats het bestand in deze map en run dit script opnieuw");
        process.exit(1);
    }

    const content = fs.readFileSync(CREDENTIALS_PATH);
    const credentials = JSON.parse(content);

    // Ondersteuning voor zowel 'installed' als 'web' credentials
    const creds = credentials.installed || credentials.web;

    if (!creds) {
        console.error("❌ Fout: Ongeldige credentials structuur!");
        console.log("De JSON moet een 'installed' of 'web' object bevatten.");
        process.exit(1);
    }

    const { client_id, client_secret, redirect_uris } = creds;

    // For web credentials, redirect_uris might not exist, use a fixed one
    const redirectUri = (redirect_uris && redirect_uris[0]) || "http://localhost:3000/oauth-callback";

    const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirectUri
    );

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent", // Forceer om altijd refresh token te krijgen
    });

    console.log("\n🔐 Gmail OAuth Setup\n");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("\n📱 Stap 1: Open deze URL in je browser:\n");
    console.log(authUrl);
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("\n📋 Stap 2: Log in met je Gmail account en geef toestemming.");
    console.log("📋 Stap 3: Je wordt doorgestuurd naar een pagina (mogelijk localhost).");
    console.log("📋 Stap 4: Kopieer de 'code' parameter uit de URL.\n");
    console.log("   Voorbeeld URL: http://localhost/?code=4/0ABC...XYZ&scope=...");
    console.log("   Je hebt alleen het deel na 'code=' en voor '&' nodig.\n");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const readline = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    readline.question("🔑 Plak hier de code uit de URL: ", async (code) => {
        readline.close();

        try {
            const { tokens } = await oAuth2Client.getToken(code.trim());

            console.log("\n✅ SUCCESS! Tokens ontvangen:\n");
            console.log("═══════════════════════════════════════════════════════════════");
            console.log("\n📦 Alle tokens:");
            console.log(JSON.stringify(tokens, null, 2));

            // Sla tokens automatisch op naar tokens.json
            const tokensPath = "tokens.json";
            fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
            console.log(`\n💾 Tokens automatisch opgeslagen naar ${tokensPath}`);

            console.log("\n═══════════════════════════════════════════════════════════════");
            console.log("\n🎯 BELANGRIJK: Voeg deze waarden toe aan je .env.local bestand:\n");
            console.log(`GMAIL_CLIENT_ID=${client_id}`);
            console.log(`GMAIL_CLIENT_SECRET=${client_secret}`);
            console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
            console.log(`GMAIL_USER=jouw-email@gmail.com  # Vervang met je Gmail adres`);

            console.log("\n═══════════════════════════════════════════════════════════════");
            console.log("\n✨ Kopieer de GMAIL_REFRESH_TOKEN hierboven en bewaar deze veilig!");
            console.log("   Deze token verloopt niet en is nodig om emails te versturen.\n");

            process.exit(0);
        } catch (err) {
            console.error("\n❌ Fout bij het ophalen van tokens:");
            console.error(err.message);
            console.log("\nMogelijke oorzaken:");
            console.log("• De code is al gebruikt (probeer opnieuw met een nieuwe code)");
            console.log("• De code is verlopen (codes zijn maar kort geldig)");
            console.log("• Verkeerde credentials");
            process.exit(1);
        }
    });
}

main().catch(console.error);
