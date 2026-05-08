# @cheap-park/web

Mobil PWA som visar parkeringspriser i Göteborg på en karta.

## Local development

```sh
npm install
npm run dev --workspace @cheap-park/web
```

Öppna http://localhost:5173/cheap_park/ — appen körs mot
`apps/web/public/data/parkings.json` (snapshot:en som poller-cron:en
committar dagligen).

## Tests

```sh
npm test --workspace @cheap-park/web
```

Tester ligger i `src/tests/` och täcker `lib/`-funktioner.
UI-komponenter testas manuellt (smoke-listan nedan).

## Manual smoke test (innan PR / deploy)

Öppna i mobil-Chrome / mobil-Safari (eller dev tools mobil-emulator).
Klicka igenom:

1. **Duration popup** öppnas vid första laddningen.
2. **Slider** funkar — minutvärde + måltid uppdateras.
3. **"Visa parkeringar"** stänger popup → karta renderas med pins.
4. **Pin-färger** är gröna/gula/röda relativt zoom-nivån (eller grå för N/A).
5. **Tap på pin** → DetailSheet visar pris, regler, vägbeskrivnings-knapp.
6. **"Vägbeskrivning"** öppnar Google Maps i ny flik med rätt koordinater.
7. **Filter-chip** öppnar FilterSheet → toggle "avgiftsfri" → "Visa" filtrerar kartan.
8. **≡-knapp** byter till listvy, sorterad billigast först.
9. **"Karta"-knapp** byter tillbaka till kartan.
10. **"Tid:"-chip** öppnar duration-popup; "Vet ej" visar timpris istället för totalkostnad.
11. **Stale-banner** visas om data är >7 dagar gammal (kan testas genom att tillfälligt sätta `parkings.json:generatedAt` till ett gammalt datum lokalt).

## Build

```sh
npm run build --workspace @cheap-park/web
```

Output i `apps/web/dist/`. Auto-deployas till GitHub Pages via
`.github/workflows/deploy-web.yml` vid push till `main`.

## Architecture notes

- **State:** URL query (`?duration=60&free=1&max=30`) är källan. Back-button
  fungerar förutsägbart, delningslänkar bevarar filter.
- **Data:** Statisk JSON från `/data/parkings.json` + `/data/tariffs.json`,
  cacheas av service worker (StaleWhileRevalidate, 7 dagars TTL).
- **Map:** MapLibre GL JS + raw OpenStreetMap-tiles. Inga API-nycklar.
- **Pris-tier (grön/gul/röd):** beräknas relativt nuvarande viewport-prisbild,
  inte absoluta tröskelvärden. Centrum = allt rött funkar inte → vi vill att
  färgen säger något oavsett zonnivå.
- **Geolocation:** lazy via `useGeolocation` hook. Avslag faller tillbaka
  till Brunnsparken-koordinaten.
