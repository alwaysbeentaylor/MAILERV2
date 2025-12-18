const { google } = require("googleapis");
const fs = require("fs");

const creds = JSON.parse(fs.readFileSync("gmail_credentials.json")).web;
const client = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    "http://localhost:3000/oauth-callback"
);

const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.send"],
    prompt: "consent",
});

console.log("\n=== OPEN DEZE URL ===\n");
console.log(authUrl);
console.log("\n=== PLAK DE CODE HIERONDER ===\n");

const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
});

readline.question("Code: ", async (code) => {
    readline.close();
    try {
        const { tokens } = await client.getToken(code.trim());

        // Write to file
        fs.writeFileSync("tokens.json", JSON.stringify(tokens, null, 2));
        console.log("\n=== SUCCESS ===");
        console.log("Tokens saved to tokens.json");
        console.log("\nREFRESH_TOKEN:", tokens.refresh_token);

    } catch (e) {
        console.error("Error:", e.message);
    }
});
