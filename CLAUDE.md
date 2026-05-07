# Cheap Park — projektkontext

Mobil webbapp (sedan iOS/Android) som visar parkeringspriser i realtid på en
karta över Göteborg och låter användaren hitta billigaste parkeringen.

## Status

- **Fas 1 (MVP, mobil webb):** Kommunal gatumark via Göteborgs öppna API.
- **Fas 2:** Publika p-hus (APCOA, Aimo, Q-Park m.fl.) via scraping/avtal.
- **Fas 3:** Native iOS/Android, beläggningsdata bredare, ev. privata p-platser.

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
hostad på Cloudflare Pages.

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

## Spec

Den slutliga designen sparas i `docs/superpowers/specs/` när
brainstorming-fasen är klar.
