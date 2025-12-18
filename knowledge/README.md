# Implementatie Kennisbank
✅ **Mappenstructuur**:
- `knowledge/niches/`: Bevat `horeca.md`, `bouw-energie.md`, `personal-care.md`, etc.
- `knowledge/prompts/`: Bevat `tone-professional.md`, `tone-casual.md`, etc.

✅ **Functionaliteit**:
- **Dynamisch laden**: `send-email.js` leest nu live de Markdown bestanden. Aanpassingen in een MD file zijn direct zichtbaar zonder herstart.
- **Slimme Niche Detectie**: De AI zoekt naar keywords uit de MD files.
- **Micro-Targeting**: Als de AI bv. 'kapper' detecteert, krijgt hij in de prompt *alleen* de pijnpunten (last-minute afzeggingen, gaten in agenda) en resultaten (volle agenda) van de kapper te zien. Niet die van een aannemer.
- **Toonsturing**: De toon (zakelijk/casual) komt uit de `knowledge/prompts` bestanden, inclusief voorbeelden.

✅ **Status**:
- Code refactoring compleet.
- Test script geslaagd: 25 sub-niches ingeladen met pijnpunten.
- Geen hardcoded data meer in `send-email.js`.
