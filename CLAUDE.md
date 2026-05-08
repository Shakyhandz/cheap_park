# Cheap Park — projektkontext

Mobil webbapp (sedan iOS/Android) som visar parkeringspriser i realtid på en
karta över Göteborg och låter användaren hitta billigaste parkeringen.

## Status

- ✅ **Fas 1 (mobil webb, live):** Kommunal gatumark via Göteborgs öppna
  API. 2603 parkeringar, 100% tariff-täckning. Daglig cron 04:00 UTC,
  GitHub Pages-deploy. https://shakyhandz.github.io/cheap_park/
- 🟡 **Fas 1.5 (utvärdera):** Pausat för användartester. Se "Nästa steg"
  nedan för known issues och prioriterade följduppgifter.
- ⏳ **Fas 2:** Publika p-hus (APCOA, Aimo, Q-Park m.fl.) via scraping
  eller B2B-API. Kräver troligen flytt av poller till en riktig backend.
- ⏳ **Fas 3:** Native iOS/Android via Capacitor-inlindning av webbappen.
  Beläggningsdata bredare, ev. privata p-platser.

## UX-grundregler (låsta)

- App öppnas med popup: **"Hur länge ska du parkera?"**
  - Slider med tidsspann 15 min – 8 tim.
  - **"Vet ej"** är en *knapp* som stänger popupen och visar pris-just-nu-vyn.
- Användaren kan **byta tid** senare i flödet, men priset räknas alltid
  **från nu och framåt** — historisk tid är ovidkommande efter parkering.
- "Billigast" = total kostnad för planerad tid om duration angivits;
  annars aktuellt timpris.

## Vald arkitektur (Alternativ A, reviderad)

**Stack:** Vite + React + TypeScript + MapLibre GL JS (OSM-tiles) → PWA,
hostad på GitHub Pages.

**Datapipeline:** GitHub Actions cron kör en daglig poller (04:00) som
hämtar Göteborgs ParkingService-API, normaliserar till strukturerad
tariff-modell, och commit:ar resultatet till `/public/data/parkings.json`
i samma repo. Pages auto-deployar på commit och serverar JSON:en från
samma domän (ingen CORS, ingen proxy-server).

Klienten hämtar `parkings.json` vid laddning, beräknar "pris just nu" och
"totalkostnad för X timmar" lokalt mot tariff-modellen.

Skäl: snabbast till lansering, noll driftkostnad, ingen backend att drifta,
gratis versionshistorik på Göteborgs parkeringsdata via git log,
framtidsklar för Capacitor-inlindning till App Store/Play utan omskrivning.

**APPID till Göteborgs API** lagras som GitHub Actions secret, aldrig i klienten.

## Övervägda men inte valda alternativ (sparat för framtiden)

### Alternativ B — Backend med cache + tariff-motor

Frontend som A, plus Node/Fastify-backend (Fly.io / Railway) som cachar
API-svar och kör tariff-beräkningar server-side.

- Pros: bättre läge för fas 2 (scrapa p-hus) utan att röra klienten;
  lägre latens; vi äger datan för analys/historik.
- Cons: drift, monitoring, kostnader; onödig komplexitet för MVP.

**När byter vi till B?** När fas 2 börjar — så fort vi behöver aggregera
flera datakällor (p-hus-scraping) blir backend rätt plats för det.

### Alternativ A2 — Azure Function poller + Blob Storage

Övervägt men avfärdat: GitHub Actions ger samma resultat gratis, plus
inbyggd versionshistorik via git. Azure Function är rimligt val om man
redan är djupt inne i Azure-stacken eller om datan blir för stor för git.

### Alternativ C — React Native (Expo) från dag ett

Expo + React Native + react-native-maps. Webb via Expo Web.

- Pros: en kodbas för iOS, Android, webb.
- Cons: Expo Web är inte lika smidigt som ren webb; långsammare MVP;
  bryter "mobil webb först"-strategin.

**När byter vi till C?** Inte aktuellt. När fas 3 (native) kommer lindar
vi A med Capacitor istället — billigare migrering, behåller webb-versionen.

## Datakällor

- **Öppna API:** `https://data.goteborg.se/ParkingService/v2.1/`
  - `PublicTollParkings` — avgiftsbelagd gatumark
  - `PublicTimeParkings` — gratis tidsbegränsade fickor (10/15/30 min m.m.)
  - `PublicPayMachines` — betalautomater
  - Kräver `APPID` (registrera på data.goteborg.se).
- Nyckelfält: `CurrentParkingCost` (int, server-beräknat),
  `FreeSpaces` + `FreeSpacesDate` (beläggning där det finns),
  `ParkingCost`/`ParkingCharge`/`MaxParkingTime`/`ExtraInfo` (fritext —
  parsas till tariff-mallar).

## Spec och planer

- `docs/superpowers/specs/2026-05-07-cheap-park-mvp-design.md` — den
  godkända MVP-designen (UX, arkitektur, datapipeline, felhantering, tester).
- `docs/superpowers/plans/2026-05-07-cheap-park-data-foundation.md` — Plan 1
  (tariff-paket + poller + cron). Implementerad.
- `docs/superpowers/plans/2026-05-08-cheap-park-web-app.md` — Plan 2
  (Vite/React/MapLibre PWA + GitHub Pages deploy). Implementerad.

## Nästa steg

Pausat efter Plan 1+2 för användartester. När arbete återupptas, dessa är
prioriterade i fallande ordning:

### Tactical (snabba fixar)

- **Riktiga PWA-ikoner** — nuvarande 192/512-ikoner är 1×1-pixel
  platshållare. Ful blob på hemskärm. SVG → PNG-export räcker.
- **Stale-banner false positive** — placeholder `parkings.json` har
  `generatedAt: "1970-01-01"`, så banner triggar på första laddningen
  innan bot:en commitar riktig data. Lägg null/epoch-guard i `isStale`.
- **DRY: extrahera `formatDuration(min)`** — duplicerat i
  `ParkingDuration.tsx` och `MapView.tsx` toolbar (toolbar visar
  "Tid: 1 tim 0 min" för rund timme; duration-popup formaterar korrekt).
- **`defaultState` import oanvänd** i `App.tsx` — cosmetic cleanup.
- **`FilterSheet` lokala state synkar inte med `initial`-prop** —
  latent bug om parent någon gång reset:ar filters externt.

### Datatäckning och kvalitet

- **Helgdagshantering** — visar fel pris på svenska röda dagar.
  Tariff-mallar har inget begrepp om helger.
- **Kalibreringscheck** — jämför vår `priceNow` mot API:ts
  `CurrentParkingCost`-fält som CI-signal när Göteborg ändrar taxor
  eller introducerar nya mönster vi inte parsar.
- **30-min-granularitet i `totalCost`** — för "23 kr/30 min"-zoner ger
  vår linjära modell ungefär rätt totalt men inte exakt mot verklig
  rundning till 30-min-block.

### UX-förbättringar

- **Pin-clustering vid låg zoom** — 2603 pins samtidigt blir trögt och
  rörigt. MapLibres GeoJSON-cluster kräver omskrivning av MapView från
  individuella `<Marker>` till en data-driven layer.
- **Adress-sökruta** — "hitta parkering nära Avenyn". Inte i MVP.
- **Dark mode-tokens** — locked till light just nu (`color-scheme: light`).
- **Duration-popup blockeras av loading-vy på första cold load** — service
  worker mitigerar för upprepade besök, men första gången måste
  parkings.json laddas innan popupen kan visas. Hoist popupen.
- **OSM-attribuering klickbar** — fixat licens-compliance-mässigt; kunde
  formateras finare.

### Fas 2 (privata p-hus)

Större arbete — kräver troligen att poller flyttas till backend och att
vi får B2B-avtal eller bygger scraping mot APCOA/Aimo/Q-Park.

### Fas 3 (native)

Capacitor-inlindning av samma webb-kodbas till App Store och Play.

## Deployment

Webbappen deployas till GitHub Pages via `.github/workflows/deploy-web.yml`
vid push till `main` som rör `apps/web/**` eller `packages/tariff/**`.

Live-URL: https://shakyhandz.github.io/cheap_park/

För att aktivera Pages första gången:
1. Repo Settings → Pages → Source: "GitHub Actions"
2. Pusha en commit som triggar workflow:en (eller kör Actions → "Deploy web app to GitHub Pages" → Run workflow)
3. Första körningen tar ~1–2 min, sedan är sajten live
