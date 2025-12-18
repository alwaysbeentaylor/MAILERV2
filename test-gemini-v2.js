// Test script voor nieuwe @google/genai SDK
require('dotenv').config({ path: '.env.local' });
const { GoogleGenAI } = require("@google/genai");

async function testGeminiV2() {
    console.log("\n=== GEMINI SDK V2 TEST ===\n");

    // Check API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ FOUT: GEMINI_API_KEY niet gevonden in .env.local!");
        return;
    }
    console.log("✅ API Key gevonden:", apiKey.slice(0, 15) + "...");

    // Initialize nieuwe SDK
    const genAI = new GoogleGenAI({ apiKey: apiKey });

    // Test verschillende modellen met fallback
    const models = [
        "gemini-2.5-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
    ];

    for (const modelName of models) {
        console.log(`\n🔄 Testen: ${modelName}...`);
        try {
            const result = await genAI.models.generateContent({
                model: modelName,
                contents: "Zeg alleen: Hello!",
                config: {
                    temperature: 0.9,
                }
            });

            const text = result.text;
            console.log(`✅ ${modelName} WERKT! Antwoord: "${text.trim()}"`);
            
            // Als dit model werkt, test met een echte prompt
            console.log(`\n🎯 Volledige test met ${modelName}...`);
            const fullResult = await genAI.models.generateContent({
                model: modelName,
                contents: "Schrijf een korte zin (max 20 woorden) over waarom AI nuttig is.",
                config: {
                    temperature: 0.9,
                    topP: 0.95,
                    topK: 40,
                }
            });
            console.log("\n📧 Volledige response:");
            console.log("─".repeat(50));
            console.log(fullResult.text);
            console.log("─".repeat(50));
            console.log("\n✅ MIGRATIE GESLAAGD! Nieuwe SDK werkt perfect.");
            return; // Stop na succesvolle test

        } catch (error) {
            console.log(`❌ ${modelName} faalde: ${error.message?.slice(0, 100) || error}`);
        }
    }

    console.log("\n❌ GEEN enkel model werkt! Check je API key en of de nieuwe SDK correct is geïnstalleerd.");
}

testGeminiV2().catch(console.error);

