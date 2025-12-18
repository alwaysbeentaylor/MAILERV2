const fs = require('fs');

const niches = {
    "generiek": [
        {
            "type": "structureel",
            "signals": ["VAGUE_INTRO"],
            "zin_varianten": [
                "Op de homepage zag ik dat de tekst begint met algemene termen.",
                "Toen ik op de site kwam, viel me op dat de eerste tekst vrij breed is ingestoken.",
                "Ik zag dat de openingszin op de homepage over veel verschillende zaken tegelijk gaat."
            ],
            "gedrag_varianten": [
                "Op dat moment klikken bezoekers vaak door zonder verder te lezen.",
                "Mensen haken op dat punt vaak af nog vóór ze verder kijken.",
                "Bezoekers aarzelen dan vaak of ze wel op de juiste plek zijn."
            ],
            "patroon_varianten": [
                "Dit zie ik vaker bij bedrijven die offline heel sterk presteren.",
                "Dit komt vaker voor bij bedrijven die offline al stevig staan.",
                "Dit zie ik vaker bij bedrijven die hun zaken offline goed op orde hebben."
            ]
        }
    ],
    "aannemer_bouw": [
        {
            "type": "structureel",
            "signals": ["NO_PORTFOLIO"],
            "zin_varianten": [
                "Op de homepage zag ik dat beelden van projecten of voor-na resultaten niet direct zichtbaar zijn.",
                "Toen ik op de site keek, viel me op dat visuele voorbeelden van recent werk niet meteen in beeld komen.",
                "Ik merkte dat afgeronde projecten niet direct op de voorgrond staan op de site."
            ],
            "gedrag_varianten": [
                "Op dat moment gaan bezoekers vaak verder zonder echt te blijven hangen.",
                "Mensen klikken dan vaak weg zonder echt door te gaan naar de rest.",
                "Bezoekers zoeken op dat punt vaak elders naar een visuele indruk."
            ],
            "patroon_varianten": [
                "Dit zie ik vaker bij bedrijven die offline heel sterk presteren.",
                "Dit komt vaker voor bij bedrijven die offline al stevig staan.",
                "Dit zie ik vaker bij bedrijven die hun zaken offline goed op orde hebben."
            ]
        },
        {
            "type": "gedragsmoment",
            "signals": ["NO_BOOKING", "NO_CTA"],
            "zin_varianten": [
                "Ik merkte dat bezoekers de telefoon moeten gebruiken om een afspraak te regelen.",
                "Op de site zag ik dat er geen directe knop is om een aanvraag te doen na het scrollen.",
                "Ik zocht naar de plek om direct een vraag te stellen zonder eerst te hoeven bellen."
            ],
            "gedrag_varianten": [
                "Op dat moment haken mensen vaak af voordat ze verder kijken.",
                "Bezoekers scrollen dan vaak door zonder een actie te ondernemen.",
                "Mensen twijfelen op dat punt vaak of ze wel direct contact moeten opnemen."
            ],
            "patroon_varianten": [
                "Dit zie ik vaker bij bedrijven die offline heel sterk presteren.",
                "Dit komt vaker voor bij bedrijven die offline al stevig staan.",
                "Dit zie ik vaker bij bedrijven die hun zaken offline goed op orde hebben."
            ]
        }
    ],
    "schilder": [
        {
            "type": "structureel",
            "signals": ["NO_PORTFOLIO"],
            "zin_varianten": [
                "Op de homepage zag ik dat beelden van recent schilderwerk niet direct zichtbaar zijn.",
                "Ik merkte dat resultaten van uitgevoerd werk of een portfolio niet meteen in beeld komen.",
                "Toen ik op de site keek, viel me op dat visuele voorbeelden niet direct op de voorgrond staan."
            ],
            "gedrag_varianten": [
                "Op dat moment gaan bezoekers vaak verder zonder echt te blijven hangen.",
                "Mensen klikken dan vaak weg zonder echt door te gaan.",
                "Bezoekers zoeken op dat punt vaak elders verder."
            ],
            "patroon_varianten": [
                "Dit zie ik vaker bij bedrijven die offline heel sterk presteren.",
                "Dit komt vaker voor bij bedrijven die offline al stevig staan.",
                "Dit zie ik vaker bij bedrijven die hun zaken offline goed op orde hebben."
            ]
        },
        {
            "type": "gedragsmoment",
            "signals": ["NO_CTA"],
            "zin_varianten": [
                "Op de website zag ik dat er geen prijzen of richtlijnen te vinden zijn.",
                "Tijdens het scrollen keek ik waar iemand een eerste prijsindicatie kan vinden.",
                "Ik zocht naar de plek waar iemand direct een offerte kan aanvragen."
            ],
            "gedrag_varianten": [
                "Op dat punt blijven bezoekers vaak twijfelen of zoeken ze verder.",
                "Mensen haken dan vaak af omdat de volgende stap niet meteen zichtbaar is.",
                "Bezoekers gaan op dat moment vaak vergelijken met andere sites."
            ],
            "patroon_varianten": [
                "Dit zie ik vaker bij bedrijven die offline heel sterk presteren.",
                "Dit komt vaker voor bij bedrijven die offline al stevig staan.",
                "Dit zie ik vaker bij bedrijven die hun zaken offline goed op orde hebben."
            ]
        }
    ],
    "tuinier_hovenier": [
        {
            "type": "structureel",
            "signals": ["NO_PORTFOLIO"],
            "zin_varianten": [
                "Op de homepage zag ik dat beelden van gerealiseerde tuinen niet direct zichtbaar zijn.",
                "Toen ik op de site keek, viel me op dat voor-na projecten niet meteen in beeld komen.",
                "Ik merkte dat beelden van recent buitenwerk niet direct op de voorgrond staan."
            ],
            "gedrag_varianten": [
                "Op dat moment gaan bezoekers vaak verder zonder echt te blijven hangen.",
                "Mensen klikken dan vaak weg zonder echt door te gaan.",
                "Bezoekers zoeken op dat punt vaak elders verder."
            ],
            "patroon_varianten": [
                "Dit zie ik vaker bij bedrijven die offline heel sterk presteren.",
                "Dit komt vaker voor bij bedrijven die offline al stevig staan.",
                "Dit zie ik vaker bij bedrijven die hun zaken offline goed op orde hebben."
            ]
        }
    ],
    "kapper_barbershop": [
        {
            "type": "structureel",
            "signals": ["NO_BOOKING"],
            "zin_varianten": [
                "Op de homepage zag ik dat er geen manier is om direct online een afspraak te plannen.",
                "Ik merkte dat de stap om een stoel te boeken niet meteen zichtbaar is.",
                "Toen ik op de site keek, viel me op dat bezoekers niet direct een tijdstip kunnen vastleggen."
            ],
            "gedrag_varianten": [
                "Op dat moment haken mensen vaak af als ze buiten openingstijden willen beslissen.",
                "Bezoekers gaan op dat punt vaak verder naar een plek waar ze wel direct kunnen boeken.",
                "Mensen twijfelen dan of ze wel de telefoon moeten pakken voor een afspraak."
            ],
            "patroon_varianten": [
                "Dit zie ik vaker bij bedrijven die offline heel sterk presteren.",
                "Dit komt vaker voor bij bedrijven die offline al stevig staan.",
                "Dit zie ik vaker bij bedrijven die hun zaken offline goed op orde hebben."
            ]
        }
    ],
    "horeca_restaurant": [
        {
            "type": "gedragsmoment",
            "signals": ["NO_BOOKING"],
            "zin_varianten": [
                "Op de homepage zag ik dat er geen knop is om direct een tafel te reserveren.",
                "Ik merkte dat beelden van gerechten of reviews niet meteen zichtbaar zijn op de homepage.",
                "Toen ik op de site kwam, zocht ik naar de plek om direct de beschikbaarheid te zien."
            ],
            "gedrag_varianten": [
                "Op dat moment gaan bezoekers vaak verder zonder echt te blijven hangen.",
                "Mensen haken op dat punt vaak af als ze buiten openingstijden willen beslissen.",
                "Bezoekers klikken dan vaak weg naar externe sites om te kijken of er plek is."
            ],
            "patroon_varianten": [
                "Dit zie ik vaker bij bedrijven die offline heel sterk presteren.",
                "Dit komt vaker voor bij bedrijven die offline al stevig staan.",
                "Dit zie ik vaker bij bedrijven die hun zaken offline goed op orde hebben."
            ]
        }
    ]
};

const cta_varianten = [
    "Zal ik je laten zien waar dit gebeurt?",
    "Wil je dat ik je laat zien wat ik bedoel?",
    "Zal ik je tonen waar ik dit zag?",
    "Wil je dat ik even aanwijs waar dit gebeurt?"
];

const finalJson = {
    meta: {
        versie: "2.1",
        beschrijving: "Master Prompt V2.1 - STRICT QUALITY FILTER (No Niche, No Stats, No Sales)",
        cta_varianten: cta_varianten
    },
    niches: niches
};

fs.writeFileSync('niche-observaties-v2.json', JSON.stringify(finalJson, null, 2));
console.log('✅ niche-observaties-v2.json bijgewerkt met STRICTE QUALITY filters.');
