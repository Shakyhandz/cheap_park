# Cheap Park

Mobil webbapp som visar parkeringspriser i realtid på en karta över
Göteborg och hjälper användaren hitta billigaste parkeringen.

**Live:** https://shakyhandz.github.io/cheap_park/

## Hur det funkar

- **Daglig poller** (GitHub Actions cron, 04:00 UTC) hämtar Göteborgs
  öppna parkeringsdata från `data.goteborg.se/ParkingService/v2.1/`,
  parsar taxorna, och commit:ar en JSON-snapshot till repot.
- **Webbappen** är en statisk PWA hostad på GitHub Pages. Den läser
  JSON-snapshoten, beräknar pris-just-nu och totalkostnad lokalt mot
  tariff-modellen, och renderar parkeringarna som färgkodade pins
  (grön/gul/röd relativt nuvarande kartvy) på en MapLibre-karta med
  OpenStreetMap-tiles.
- **Ingen backend** — bara en daglig cron som skriver JSON och en
  statisk SPA som läser den. Allt gratis (GitHub Actions + Pages).

## Funktioner i v1

- Duration-popup vid start ("Hur länge ska du parkera?" — slider eller "Vet ej")
- Karta med pris-etiketter (totalkostnad eller timpris beroende på
  duration-val)
- Färg-tier per pin relativt zoomade området
- Filter: avgiftsfri, handikapp, långtid (≥6 tim), max kr/timme
- Listvy som alternativ till kartan (sorterad billigast först)
- Detaljpanel med taxor, max-tid, regeltext, vägbeskrivnings-länk
- Auto-dimning av parkeringar med max-tid kortare än vald duration
- URL-state — delningsbara länkar och fungerande back-knapp
- PWA — installerbar på hemskärm, fungerar offline mellan dagliga
  data-uppdateringar

## Begränsningar (kända, prioriterade post-MVP)

- Bara kommunal gatumark — inte privata p-hus (APCOA, Aimo, Q-Park)
- Ingen beläggningsdata (lediga platser i realtid)
- Ingen helgdagshantering — visar fel pris på röda dagar
- 1×1-pixel placeholder-ikoner (PWA fungerar men hemskärms-ikon är ful)
- Pin-clustering saknas vid låg zoom

Full lista i [`CLAUDE.md`](./CLAUDE.md) under "Nästa steg".

## Repostruktur

```
cheap_park/
├── apps/web/                  # PWA (Vite + React + TS + MapLibre)
│   ├── src/lib/               # Pure functions (tested)
│   ├── src/components/        # React components
│   └── public/data/*.json     # Daily snapshot from poller
├── packages/
│   ├── tariff/                # priceNow, totalCost, types — shared
│   └── poller/                # Daily fetch + parse + commit
├── .github/workflows/
│   ├── poll-data.yml          # Daily cron 04:00 UTC
│   └── deploy-web.yml         # Pages deploy on push
└── docs/superpowers/          # Spec + implementation plans
```

## Local development

```sh
# Install all workspaces
npm install

# Run tests (89 tests across 3 packages)
npm test --workspaces --if-present

# Run web dev server
npm run dev --workspace @cheap-park/web
# → http://localhost:5173/cheap_park/

# Build web for production
npm run build --workspace @cheap-park/web

# Run poller locally (requires GBG_APPID env var)
$env:GBG_APPID = "your-appid-from-data.goteborg.se"
npm run poll --workspace @cheap-park/poller
```

Detaljerade README-filer per paket:
- [`apps/web/README.md`](./apps/web/README.md) — webbappens dev-loop
  och manuell smoke-test-lista.
- [`packages/poller/README.md`](./packages/poller/README.md) — poller-
  konfiguration och GitHub-secret-setup.

## Datakälla

- API: https://data.goteborg.se/ParkingService/v2.1/
- Endpoints i bruk: `PublicTollParkings`, `PublicTimeParkings`
- Kräver gratis APPID (registrera på https://data.goteborg.se/Account/Register.aspx)
- Daglig snapshot ~5 MB JSON, sanity-grindad (avbryter om ≥10% drop i
  parkeringsantal jämfört med föregående körning).

## Designbeslut värda att veta

- **Tariff-tier är viewport-relativ.** Grön/gul/röd beräknas mot
  prisspannet i nuvarande kartvy, inte absoluta tröskelvärden. Annars
  blir allt rött i centrum (där allt är dyrt) och allt grönt i
  förorten — färgen säger inget då.
- **Pris alltid framåt från nu.** Användaren kan ändra duration när
  som helst, men vi räknar alltid "från nu och X timmar framåt"
  — historisk tid är ovidkommande efter parkering.
- **Tariff-parsning är dynamisk.** Poller-koden parsar
  `ParkingCost`-fält som "X kr/tim 8-22 alla dagar. Övrig tid: Y kr/tim.
  Maxtaxa Z kr/dag." och bygger en strukturerad `Tariff`-modell
  on-the-fly. Inga hand-kuraterade mallar — funktionen täcker 100% av
  Göteborgs nuvarande 9 unika cost-strings och ska tåla små variationer.

## Licens

Inget explicit licensval ännu. OSM-tiles används enligt deras
[ODbL-attribuering](https://www.openstreetmap.org/copyright).
