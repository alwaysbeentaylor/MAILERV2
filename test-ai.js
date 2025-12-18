// Test script om AI functie te testen - Probeer meerdere modellen
require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testAI() {
    console.log("\n=== AI TEST SCRIPT ===\n");

    // Check API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ FOUT: GEMINI_API_KEY niet gevonden in .env.local!");
        return;
    }
    console.log("✅ API Key gevonden:", apiKey.slice(0, 15) + "...");

    const genAI = new GoogleGenerativeAI(apiKey);

    // Test verschillende modellen
    const modelsToTry = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-pro",
        "gemini-1.0-pro",
    ];

    for (const modelName of modelsToTry) {
        console.log(`\n🔄 Testen: ${modelName}...`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Zeg alleen: Hallo, ik werk!");
            const text = result.response.text();
            console.log(`✅ ${modelName} WERKT! Antwoord: "${text.trim()}"`);

            // Als dit model werkt, test met een echte prompt
            console.log(`\n🎯 Volledige test met ${modelName}...`);
            const fullResult = await model.generateContent(`
Schrijf een korte cold email (max 60 woorden) voor een energieadvies bedrijf.
Ze doen luchtdichtheidsmetingen en hebben geen WhatsApp.
Start met iets persoonlijks over hun dienst.
Eindig met: Hope

SUBJECT: [onderwerp]
BODY:
[tekst]
`);
            console.log("\n📧 Gegenereerde email:");
            console.log("─".repeat(50));
            console.log(fullResult.response.text());
            console.log("─".repeat(50));
            return; // Stop na succesvolle test

        } catch (error) {
            console.log(`❌ ${modelName} faalde: ${error.message?.slice(0, 50) || error.status}`);
        }
    }

    console.log("\n❌ GEEN enkel model werkt! Check je API key.");
}

testAI();
