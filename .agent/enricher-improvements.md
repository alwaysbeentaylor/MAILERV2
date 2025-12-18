# Enricher Pagina - Verbeterplan

> Gegenereerd: 15 december 2024
> Status: In behandeling

---

## 🔴 Hoge Prioriteit (Nu aan werken)

| # | Probleem | Type | Status |
|---|----------|------|--------|
| 1 | **Seriële verwerking** - Leads 1-voor-1, extreem traag | Performance | ⏳ Todo |
| 2 | **Styling conflict** - Lichte CSS vs dark neon theme | UI/UX | ⏳ Todo |
| 3 | **Geen Pause/Resume** - Kan niet stoppen bij grote batch | Feature | ⏳ Todo |
| 4 | **Geen Retry Failed** - Mislukte items handmatig opnieuw | Feature | ⏳ Todo |

---

## 🟡 Medium Prioriteit (Later)

### UI/UX Verbeteringen

| Probleem | Beschrijving | Oplossing |
|----------|--------------|-----------|
| **Geen loading skeleton** | Bij verwerking alleen "🔄" icon, geen visuele feedback | Animated progress bar + ETA tonen |
| **Control panel layout** | 3-kolom layout werkt slecht op medium screens (768-1024px) | Responsive grid met breakpoints |
| **Geen bulk selectie** | Kan niet specifieke items selecteren om te verwerken | Checkboxes + "Verwerk geselecteerde" knop |

### Performance Verbeteringen

| Probleem | Beschrijving | Oplossing |
|----------|--------------|-----------|
| **Check-host latency** | Elke domain check kost 3-5 sec door polling | Optioneel maken of cachen van recente checks |
| **Geen rate limiting indicator** | Gebruiker ziet niet of/waarom het traag is | Visuele indicator voor throttling status |

### Missing Features

| Feature | Beschrijving | Prioriteit |
|---------|--------------|------------|
| **Concurrency slider** | Kies 1-5 parallelle requests | 🟡 Medium |
| **Filter/zoek in resultaten** | Zoek op bedrijfsnaam, email, status | 🟡 Medium |
| **Duplicate detectie** | Waarschuw bij dubbele emails/domeinen in import | 🟡 Medium |
| **Batch size limiet** | Waarschuw/blokkeer bij >500 items | 🟡 Medium |

---

## 🟢 Lage Prioriteit (Nice to have)

### Features

| Feature | Beschrijving |
|---------|--------------|
| **Statistieken dashboard** | Success rate, avg time per lead, totale tijd, ETA |
| **Export history** | Bewaar vorige exports met datum/tijd |
| **Scheduling** | Plan enrichment voor later (bijv. 's nachts) |
| **Webhook notifications** | Stuur melding als batch klaar is |
| **Dark/Light mode toggle** | Optionele lichte modus voor de enricher |

### Code Quality

| Issue | Locatie | Oplossing |
|-------|---------|-----------|
| `emails` state misleidend | `enrich.js:9` | Hernoem naar `items` of `leads` |
| Grote component (1000+ regels) | `enrich.js` | Splits in subcomponents |
| CSS in JSX string (900+ regels) | `enrich.js:614-1023` | Verplaats naar CSS module |
| Duplicate extractie logic | `enrich.js:67-128` | Maak gedeelde util functie |

---

## 🏗️ Refactoring Ideas

### Component Structuur (Toekomst)

```
components/
├── enricher/
│   ├── EnricherPage.js          # Main container
│   ├── InputPanel.js            # Mode toggle + file/paste input
│   ├── ActionPanel.js           # Start/Pause/Resume buttons
│   ├── ExportPanel.js           # Download/copy buttons
│   ├── NicheExports.js          # Per-niche export cards
│   ├── ResultsGrid.js           # Paginated results list
│   ├── ResultItem.js            # Single lead item
│   ├── StatsBar.js              # Real-time statistics
│   └── enricher.module.css      # Dedicated styles
```

### State Management (Toekomst)

```javascript
// Mogelijk Zustand store voor complexere state
const useEnricherStore = create((set) => ({
  items: [],
  results: [],
  processing: false,
  paused: false,
  progress: { current: 0, total: 0 },
  concurrency: 3,
  
  // Actions
  addItems: (newItems) => set(...),
  startProcessing: () => set(...),
  pauseProcessing: () => set(...),
  retryFailed: () => set(...),
}));
```

---

## 📝 Notities

- Scraper (`utils/scraper.js`) is al vrij compleet met deep personalization
- Check-host validatie (`utils/check-host.js`) werkt goed maar is traag
- Knowledge files in `knowledge/niches/` worden correct gedetecteerd
- LocalStorage persistentie werkt, maar kan vol raken bij grote datasets

---

## ✅ Voltooide Items

_Hier komen afgeronde verbeteringen_

| Datum | Item | Notes |
|-------|------|-------|
| - | - | - |

