# Cheap Park — MVP Design

**Datum:** 2026-05-07
**Status:** Godkänd för implementation plan

## Sammanfattning

Mobil PWA som visar parkeringspriser i Göteborg på en karta och hjälper
användaren hitta billigaste parkeringen givet hur länge hen ska stå.
MVP täcker kommunal gatumark via Göteborgs öppna API. Stacken är
Vite + React + TypeScript + MapLibre GL JS, hostad på Cloudflare Pages.
Data uppdateras dagligen via GitHub Actions cron och commit:as som JSON
i samma repo.

## Scope

**I MVP:**

- Kommunal gatumark i Göteborg (avgiftsbelagd + tidsbegränsade fickor)
- Hämtad från `data.goteborg.se/ParkingService/v2.1/`
- Pris-just-nu och totalkostnad för planerad tid
- Karta med pris-etiketter, färgkodade pins, filter
- Mobil webb (PWA) som primär målplattform; fungerar på desktop som bonus

**Inte i MVP (uttryckligen):**

- Privata p-hus (APCOA, Aimo, Q-Park) — fas 2
- Beläggning / lediga platser i realtid — fas 2
- Adress-/destinationssökruta — fas 1.5 om behov uppstår
- Användarkonton, favoriter, historik
- Native iOS/Android (planeras fas 3 via Capacitor)
- Helgdagshantering i tariff — dokumenterad lucka
- E2E-tester
- Push-notiser om "din parkering går snart ut"

**Målgrupp:** Publik gratisapp för Göteborgsbor. Korrekthet och drift­säkerhet
prioriteras, ingen monetarisering på dag ett.

## UX-design

### Skärmar

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  ParkingDuration    │    │     MapView         │    │     MapView         │
│  (modal, default)   │    │                     │    │  + DetailSheet      │
│                     │    │  ┌───────────────┐  │    │  ┌───────────────┐  │
│  "Hur länge?"       │ →  │  │   Karta med   │ →  │  │   Karta       │  │
│  ──•─────  1 tim    │    │  │   pris-pins   │  │    │  │               │  │
│                     │    │  └───────────────┘  │    │  ├───────────────┤  │
│  [ Vet ej ]         │    │  [ Tid: 1 tim ▾ ]   │    │  │ Stora Nygatan │  │
│  [ Visa parkering ] │    │  [ ≡ Lista ]        │    │  │ 25 kr/tim     │  │
└─────────────────────┘    └─────────────────────┘    │  │ Total: 25 kr  │  │
                                                     │  │ [ Vägbeskr. ] │  │
                                                     │  └───────────────┘  │
                                                     └─────────────────────┘
```

### Flöde

1. App öppnas → `ParkingDuration` overlay modal.
2. Användaren väljer tid på slider (15 min – 8 tim, default 1 tim) och
   trycker **"Visa parkeringar"**, eller trycker **"Vet ej"**.
3. **"Visa parkeringar"** → `MapView` med totalkostnad-pins.
   **"Vet ej"** → `MapView` med timpris-pins (eller "Gratis nu").
4. `MapView` har en chip uppe: `Tid: 1 tim ▾`. Tap öppnar duration-väljaren
   igen. Tid är alltid "från nu och framåt" — start är aktuell tid.
5. Tap på pin → `DetailSheet` slidar upp underifrån med fullständig info.
6. **Lista**-knapp → byter till listvy sorterad efter pris (sekundär).

### Tidsväljare (B med "Vet ej"-knapp)

- Slider 15 min – 8 tim, default 1 tim
- "Vet ej" är en tydlig sekundär knapp som stänger modalen och visar
  pris-just-nu-vyn på kartan
- Aktuell vald tid speglas i URL-query (`?duration=60`) för delningsbarhet

### Geolocation

- Begärs när `MapView` öppnas, inte i duration-popupen (lazy)
- Avslag → karta zoomar till Brunnsparken som default

### Inga konton, ingen autentisering

Allt är anonymt. Ingen lagring av användardata.

## Karta och pin-stil

**Stil A med B:s färgkodning:**

- Alla pins har **pris-etikett** (Google Maps reservation-stil)
- Färg-tier:
  - **Grön** — billigast tredjedelen i nuvarande kartvy, eller "Gratis nu"
  - **Gul** — mellantriden
  - **Röd** — dyraste tredjedelen
  - **Grå** — `tariffId: null`, etikett "N/A"
- Tröskelvärden är **relativa till nuvarande viewport** (median ± 33%-iler),
  inte absoluta. Säkerställer att färgen säger något oavsett zonens
  prisnivå.
- Klustring av överlappande pins vid låg zoom hanteras av MapLibre's
  inbyggda klusterstöd; visuell stil bestäms under implementation.

**Användarens position** ritas som en blå punkt (om geolocation accepterad).

## Filter

Knapp i `MapView` öppnar `FilterSheet`:

```
┌─────────────────────────┐
│  Filter           [×]   │
├─────────────────────────┤
│  □  Endast avgiftsfri   │
│  □  Handikapp           │
│  □  Endast långtid (≥6h)│
│                         │
│  Max pris per timme     │
│  Av ──•─────── 60 kr    │
│                         │
│  [ Återställ ]  [ Visa ]│
└─────────────────────────┘
```

**Beteende:**

- **Endast avgiftsfri** → `tariff.rules` har bara 0 kr/h-regler för aktuell tid
- **Handikapp** → best-effort: `ExtraInfo` matchas mot ord som
  "rörelsehindrade", "handikapp", "permit". UI flaggar att täckningen är
  ofullständig.
- **Endast långtid** → `maxParkingMinutes ≥ 360` eller saknas (obegränsat)
- **Max pris per timme** → filtrerar på `priceNow(tariff, now) ≤ X`.
  `"free"` passerar alltid; `"n/a"` filtreras bort. Slår på *aktuellt
  timpris*, inte total — annars ändras filtret oförutsägbart med duration.

**Filter-state i URL-query** (`?free=1&max=30&access=1`) → delningslänkar
fungerar; back-button är förutsägbar.

**Korrekthetsregel (alltid på, inte ett filter):** parkeringar med
`maxParkingMinutes < userDurationMinutes` *dimmas* (50% opacity) så
användaren ser dem men inte väljer dem av misstag. Sorteras sist i
listvyn.

## Arkitektur

```
[ Daily poller — GitHub Actions cron, 04:00 ]
        │
        │ HTTPS, APPID från GitHub secret
        ▼
[ data.goteborg.se ParkingService API ]
        │
        │ Normaliserar + berikar med tariff-modell
        ▼
[ git commit till apps/web/public/data/ i samma repo ]
        │
        │ Cloudflare Pages auto-deployar
        ▼
[ Mobilbrowser — Cloudflare Pages (statisk PWA) ]
   Vite + React + MapLibre + TS
   Beräknar pris-just-nu och totalkostnad lokalt
```

**Stack:**

- Frontend: Vite + React + TypeScript + MapLibre GL JS + OpenStreetMap-tiles
- Hostning: Cloudflare Pages (gratis tier)
- Datapipeline: GitHub Actions cron (gratis)
- Datalagring: JSON-filer i `apps/web/public/data/` i samma repo
- Service Worker: vite-plugin-pwa, app shell + parkings.json pre-cache

**Driftkostnad MVP:** 0 kr. Pages, Actions och OSM-tiles är gratis inom MVP-volym.

## Repostruktur (monorepo)

```
cheap_park/
├── apps/web/                      # PWA
│   ├── src/
│   │   ├── components/
│   │   │   ├── ParkingDuration.tsx
│   │   │   ├── MapView.tsx
│   │   │   ├── DetailSheet.tsx
│   │   │   ├── FilterSheet.tsx
│   │   │   └── ListView.tsx
│   │   ├── lib/
│   │   │   ├── tariff.ts          # priceNow(), totalCost()
│   │   │   ├── filter.ts          # query-state ↔ URL
│   │   │   ├── data.ts            # fetch /data/parkings.json
│   │   │   └── colors.ts          # viewport-relativ färg-tier
│   │   └── App.tsx
│   ├── public/
│   │   └── data/                  # ← skrivs av poller-action
│   │       ├── parkings.json
│   │       └── tariffs.json
│   └── package.json
├── packages/poller/               # Daglig poller
│   ├── src/
│   │   ├── fetch.ts
│   │   ├── normalize.ts
│   │   ├── tariff-templates.ts    # text → tariffId regelmotor
│   │   ├── sanity.ts              # 90%-grinden
│   │   └── main.ts
│   ├── tests/
│   └── package.json
├── .github/workflows/
│   ├── poll-data.yml              # cron 04:00 dagligen
│   └── deploy.yml                 # Pages-deploy via push till main
├── docs/superpowers/specs/        # denna fil
├── CLAUDE.md
└── package.json (workspaces)
```

## Datapipeline

### Pollerns flöde (`packages/poller/src/main.ts`)

1. Läs `APPID` från env (GitHub secret).
2. Hämta från Göteborgs API (parallellt):
   - `PublicTollParkings` (search bbox över hela Göteborg)
   - `PublicTimeParkings`
   - `PublicPayMachines` (för referens; inte renderat i MVP)
3. Normalisera: filtrera bort objekt utan koordinater, dedup på `Id`.
4. Sanity-check: aborta om `newCount < lastCount * 0.9` (skydd mot partial
   fetch). Ingen commit görs vid abort — föregående snapshot kvarstår.
5. Tariff-template-matchning per parkering. Okänd tariff → `tariffId: null`,
   logga som varning i action-loggen.
6. Skriv `apps/web/public/data/parkings.json` (sorterad på `id` för
   stabila git-diffar).
7. Skriv `apps/web/public/data/tariffs.json` (alla mallar som matchat).
8. `git commit -m "chore(data): daglig snapshot $(date -I)"` && push.

### parkings.json — schema

```json
{
  "generatedAt": "2026-05-07T04:00:00Z",
  "source": "data.goteborg.se ParkingService v2.1",
  "parkings": [
    {
      "id": "P-12345",
      "name": "Stora Nygatan 12",
      "owner": "Parkering Göteborg",
      "lat": 57.7042,
      "lng": 11.9678,
      "spaces": 8,
      "tariffId": "gbg-zon-A-2026",
      "maxParkingMinutes": 240,
      "raw": {
        "ParkingCost": "...",
        "ParkingCharge": "...",
        "MaxParkingTime": "...",
        "ExtraInfo": "..."
      }
    }
  ]
}
```

`raw`-fältet bevaras så `DetailSheet` kan visa originaltexten — det är
försvarsmekanism för felaktig tariff-mappning.

### tariffs.json — schema

```json
{
  "tariffs": [
    {
      "id": "gbg-zon-A-2026",
      "name": "Centrum kärnan, måndag-fredag",
      "rules": [
        {
          "daysOfWeek": [1, 2, 3, 4, 5],
          "hourStart": 8,
          "hourEnd": 18,
          "pricePerHour": 35,
          "maxPerDay": null
        },
        {
          "daysOfWeek": [1, 2, 3, 4, 5],
          "hourStart": 18,
          "hourEnd": 24,
          "pricePerHour": 0,
          "maxPerDay": null
        }
      ]
    }
  ]
}
```

### Klientens load-flöde

1. Service Worker pre-cachar app shell + senast laddade `parkings.json`.
2. App start:
   - Visa duration-popup direkt (statisk, ingen data behövs).
   - I bakgrunden fetcha `/data/parkings.json` (cache-first via SW).
   - Validera `generatedAt` — om >7 dagar gammal, visa banner
     "Data senast uppdaterad YYYY-MM-DD — kan vara inaktuell".
3. Användaren stänger popupen → `MapView` renderar med tariff-beräkningar
   lokalt.

## Tariff-datamodell

```ts
type Tariff = {
  id: string;
  name: string;
  rules: TariffRule[];           // staplade i utvärderingsordning
};

type TariffRule = {
  daysOfWeek: number[];          // 0=söndag … 6=lördag, [] = alla dagar
  hourStart: number;             // 0-24, decimaltid
  hourEnd: number;               // 0-24, decimaltid (24 = midnatt)
  pricePerHour: number;          // kr/h, 0 = gratis
  maxPerDay?: number | null;     // kr/dygn-tak om finns
};
```

### Två funktioner i `lib/tariff.ts`

```ts
priceNow(tariff: Tariff, now: Date): number | "free" | "n/a"
totalCost(tariff: Tariff, fromNow: Date, durationMinutes: number):
  { total: number; breakdown: { from: Date; to: Date; rate: number }[] }
```

`totalCost` segmenterar duration över relevanta `TariffRule`s. Exempel:
"stannar 4 tim från 16:00 i Centrum" → 2 tim @ 35 kr/h + 2 tim @ 0 kr/h
(gratis efter 18:00) = 70 kr total. Breakdown visas i `DetailSheet`.

### Edge cases

- **Parkering över midnatt:** `hourEnd: 24` följs av nästa dags regel.
- **Maxavgift per dygn:** total kapas vid `maxPerDay` om regeln har det.
- **Helgdagar:** *inte* hanterat i MVP. Dokumenterad lucka — adderas i
  fas 1.5 om felaktiga priser visas vid svenska helgdagar.
- **Okänd tariff:** `tariffId: null` → klient visar grå pin med "N/A".
  `DetailSheet` visar `raw`-text.

## Felhantering

| Scenario | Hantering |
|---|---|
| Klient: `parkings.json` 404 / nätverksfel | Felskärm med "Försök igen"; använd cachad version om SW har en |
| Klient: data >7 dagar gammal | Banner med datum, fortsätt visa karta |
| Klient: geolocation nekad | Karta zoomar till Brunnsparken |
| Klient: ingen tariff för parkering | Grå pin med "N/A"; DetailSheet visar `raw` |
| Klient: ingen parkering i kartvyn | Tom-state: "Inga parkeringar i området — panorera ut" |
| Poller: API långsamt | Timeout 30 s; 3 försök med exp. backoff |
| Poller: API helt nere | Action loggar fel; ingen commit; gårdagens data kvarstår |
| Poller: misstänkt partiellt svar (<90% av senast) | Abort, ingen commit |
| Poller: ny tariff-text inte i mall | Logga, parkering får `tariffId: null` |

## Testning

Tre nivåer, ingen mer.

1. **Unit, tariff-logiken** — `priceNow()` och `totalCost()` mot ~20
   hand-skrivna scenarior (gratis nu, mitt i en regel, över midnatt, med
   tak, okänd tariff). Detta är hjärtat. **Skrivs TDD.**
2. **Integration, poller** — mock data.goteborg.se-svaret från en sparad
   fixture; verifiera att normalize + tariff-matchning ger förväntad JSON.
   Inkluderar sanity-check-grinden (90%-tröskel).
3. **Manuell smoke** — efter deploy: öppna mobil-Chrome, verifiera popup
   → karta → tap pin → DetailSheet. Två minuter.

**Inget end-to-end-testverktyg** (Playwright/Cypress) i MVP. Lägg till om
en regression dyker upp som E2E hade fångat.

### Kalibreringscheck mot verkligheten

Stickprov på ~50 parkeringar från API:t. Jämför vår `priceNow()` mot
API:ts `CurrentParkingCost`-fält. Rapporterar diffar i CI som *signal*,
inte pass/fail (eftersom CurrentParkingCost också är fritext-tolkat hos
Göteborg). Varnar om vår tariff-matchning driver iväg eller om Göteborg
ändrar något oväntat.

## Skerhet och GDPR

- **Ingen användardata lagras.** Inga konton, inga cookies utöver
  service worker cache.
- **APPID** till Göteborgs API ligger som GitHub secret, exponeras aldrig
  i klient-bundle.
- **Geolocation** behandlas i klienten lokalt, skickas aldrig nånstans.
- Eftersom inga personuppgifter behandlas behövs ingen GDPR-registerföring
  för MVP.

## Öppna frågor / framtida arbete

- **Fas 2 — privata p-hus:** scraping av APCOA, Aimo, Q-Park, eller B2B-API
  via parkeringsoperatörsavtal. Kräver troligen flytt av poller till en
  riktig backend.
- **Fas 2 — beläggning:** `FreeSpaces`-fältet finns i Göteborgs schema.
  Måste verifieras live om det är ifyllt och hur färskt det är.
- **Fas 1.5 — adress­sökruta** om användarna saknar det.
- **Fas 1.5 — helgdagar** om felaktiga priser visas på röda dagar.
- **Fas 3 — native iOS/Android** via Capacitor-inlindning av samma
  webb-kodbas.
- **Tariff-täckning:** initialt manuellt kuraterad mall-uppsättning —
  kalibreringschecken visar oss när vi behöver lägga till nya mallar.
