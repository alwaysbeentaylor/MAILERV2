import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

let _cachedNiches = null;
const isDev = process.env.NODE_ENV !== 'production';

// Laad alle niche data uit /knowledge/niches/*.md
export function loadNiches() {
    // In development: altijd vers laden voor live updates
    if (!isDev && _cachedNiches) return _cachedNiches;

    const nichesDir = path.join(process.cwd(), 'knowledge', 'niches');

    if (!fs.existsSync(nichesDir)) {
        console.warn("⚠️ Kennisbank niches map niet gevonden!");
        return {};
    }

    const files = fs.readdirSync(nichesDir).filter(f => f.endsWith('.md'));
    const niches = {};

    files.forEach(file => {
        const content = fs.readFileSync(path.join(nichesDir, file), 'utf8');
        const { data, content: body } = matter(content);

        // Parse de markdown body
        const sections = body.split('###');

        sections.forEach(section => {
            const lines = section.trim().split('\n');
            const subNicheName = lines[0].trim().toLowerCase();

            if (!subNicheName || subNicheName === 'keywords' || subNicheName === 'observatie vragen') return;

            const keywordsLine = lines.find(l => l.includes('**keywords**'));
            const statLine = lines.find(l => l.includes('**stat**'));
            const resultLine = lines.find(l => l.includes('**result**') || l.includes('**resultaat**'));
            const painPointsLine = lines.find(l => l.includes('**pijnpunten**'));

            if (keywordsLine) {
                const keywordsStr = keywordsLine.split(':')[1] || '';
                const keywords = keywordsStr.split(',').map(k => k.trim());

                const stat = statLine ? statLine.split(':')[1].trim() : (data.stat || '');
                const result = resultLine ? resultLine.split(':')[1].trim() : '';
                const painPoints = painPointsLine ? painPointsLine.split(':')[1].trim() : '';

                niches[subNicheName] = {
                    category: data.name,
                    displayName: data.displayName,
                    keywords,
                    stat,
                    resultClaim: result,
                    painPoints,
                    sourceFile: file // Track which .md file this niche came from
                };
            }
        });
    });

    _cachedNiches = niches;
    return niches;
}
