
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter'); // Zorg dat we gray-matter gebruiken net als in de echte code
const cheerio = require('cheerio');

// Mock loadNiches functie (simulatie van wat in send-email.js staat, maar dan direct hier uitvoerbaar)
// We lezen de echte bestanden om te checken of DE BESTANDEN valide zijn.
function loadNiches() {
    const nichesDir = path.join(process.cwd(), 'knowledge', 'niches');
    if (!fs.existsSync(nichesDir)) {
        console.log("❌ Niches dir not found");
        return {};
    }
    const files = fs.readdirSync(nichesDir).filter(f => f.endsWith('.md'));
    const niches = {};

    files.forEach(file => {
        const content = fs.readFileSync(path.join(nichesDir, file), 'utf8');
        const { data, content: body } = matter(content);

        // Simpele parse simulatie
        const sections = body.split('###');
        sections.forEach(section => {
            const lines = section.trim().split('\n');
            const subNicheName = lines[0].trim().toLowerCase();
            if (subNicheName && subNicheName !== 'keywords' && !subNicheName.includes('##')) {
                niches[subNicheName] = { data, lines };
            }
        });
    });
    return niches;
}

// Test runner
async function testKnowledgeBase() {
    console.log("🚀 Start Knowledge Base Verification\n");

    // 1. Test Niche Loading
    try {
        const niches = loadNiches();
        console.log(`✅ Loaded ${Object.keys(niches).length} sub-niches.`);

        const requiredNiches = ['restaurant', 'kapper', 'aannemer', 'loodgieter'];
        const missing = requiredNiches.filter(n => !niches[n]);

        if (missing.length > 0) {
            console.error(`❌ Missing critical niches: ${missing.join(', ')}`);
        } else {
            console.log("✅ Critical niches found.");
        }

        // Check content of 'kapper'
        if (niches['kapper']) {
            const kapperContent = niches['kapper'].lines.join('\n');
            if (kapperContent.includes('pijnpunten')) console.log("✅ 'Kapper' has pain points.");
            else console.warn("⚠️ 'Kapper' is missing 'pijnpunten'.");
        }

    } catch (error) {
        console.error("❌ Error loading niches:", error);
    }

    // 2. Test Prompt Loading
    const promptsDir = path.join(process.cwd(), 'knowledge', 'prompts');
    if (fs.existsSync(promptsDir)) {
        const files = fs.readdirSync(promptsDir);
        console.log(`✅ Found ${files.length} prompt templates.`);
    } else {
        console.error("❌ Prompts directory missing.");
    }

    console.log("\n🏁 Verification Complete.");
}

testKnowledgeBase();
