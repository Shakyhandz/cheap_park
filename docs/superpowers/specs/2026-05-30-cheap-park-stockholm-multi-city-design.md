# Cheap Park — Stockholm & multi-stad-design

**Datum:** 2026-05-30
**Status:** Godkänd design, redo för implementationsplan
**Omfattning:** Lägg till Stockholms gatumarksparkering (Trafikkontorets
LTF-Tolken-API) som en fullvärdig andra stad bredvid befintlig Göteborgs-data,
på en gemensam karta.

## Mål och beslut

Stockholm ska skeppas på riktigt — samma kvalitet som Göteborg, live för
användare. Bärande beslut fattade under brainstorm:

1. **Skeppa Stockholm på riktigt** (inte bara teknisk grund).
2. **En gemensam karta** — båda städer i samma vy, ingen explicit stad-väljare.
3. **Stockholm renderas som linjer** (gatusträckor), Göteborg som punkter.
   Linjerna är sannare för Stockholm (man parkerar längs en sträcka) — vi
   accepterar två visuella språk på samma karta.
4. **Svensk helgkalender byggs nu** — Stockholms taxor är formulerade kring
   "dag före helgdag" och "helgdag"; utan helgstöd blir priset systematiskt
   fel kring röda dagar. Fixar samtidigt Göteborgs kända helgdags-bug.
5. **Ett enat `parkings.geojson`** — en FeatureCollection med både punkter och
   linjer, en fetch i klienten, en MapLibre-källa, två renderingslager.
6. **`vehicle`-fält i schemat** — allt taggas `"bilar"` nu så MC/buss kan
   adderas senare utan schemaändring.
7. **Ingen beläggning för Stockholm** (`spaces: null`) — finns inte på gatumark.

Arkitekturen behåller Alternativ A (statisk data på GitHub Pages, ingen
backend). Endast pollern och klientens renderingslager ändras väsentligt.

## Datakälla (Stockholm)

- **API:** `https://openparking.stockholm.se/LTF-Tolken/v1/ptillaten/all?outputFormat=json&apiKey=...`
- **Format:** GeoJSON, WGS 84 (lat/lng), UTF-8.
- **Nyckel:** registreras på `https://openstreetgs.stockholm.se/Home/Key`,
  lagras som GitHub Actions repository secret **`STHLM_TK_APIKEY`** (samma
  mönster som Göteborgs `GBG_APPID`), aldrig i klienten.
- **Validerat live 2026-05-30:** hela staden = 18 973 objekt, varav 15 755
  bilar (`VEHICLE=fordon`). Geometri: LineString (15 694) + MultiLineString (61).

### Viktigt: live-schemat ≠ dataportalens metadata

Metadata-sidan listar gamla svenska fältnamn (`P_AVGIFT`, `BPLATS_*`) som är
**tomma/saknas** i live-API:t. Det skarpa `ptillaten`-svaret har **engelska**
fält. Relevanta fält per Feature:

| Fält | Exempel | Användning |
|------|---------|-----------|
| `geometry` | LineString / MultiLineString | ritas som linje |
| `STREET_NAME` | `"Sveavägen"` | `name` |
| `VEHICLE` | `fordon` / `motorcykel` / … | filter (endast `fordon`) |
| `PARKING_RATE` | `"taxa 2: 31 kr/tim …"` | parsas → `tariffId` |
| `VF_PLATS_TYP`, `VF_METER`, `CITY_DISTRICT`, `START_TIME`, `OTHER_INFO`, `CITATION`, `RDT_URL` | … | ej i MVP-payload (kan loggas) |

### Tariff-mönster (extremt regelbundna)

Endast **6 distinkta `PARKING_RATE`-strängar för bilar** i hela Stockholm.
Taxenumren matchar exakt Stockholms officiella Taxa 1–5 (inbyggd kalibrering):

| Antal (bilar) | Sträng |
|---:|---|
| 4350 | `taxa 3: 20 kr/tim vardagar 7-19, 15 kr/tim dag före helgdag 11-17, Boende: …` |
| 4223 | `taxa 4: 10 kr/tim vardagar 7-19, dag före helgdag 11-17, Boende: …` |
| 3565 | `taxa 5: 5 kr/tim vardagar 7-19, Boende: …` |
| 2730 | `avgiftsfri` |
| 820 | `taxa 2: 31 kr/tim vardagar 7-21 och dag före helgdag och helgdag 9-19, 20 kr/tim övrig tid, Boende: …` |
| 67 | `taxa 1: 55 kr/tim alla dagar 00-24 Boende: ingen boendeparkering` |

Specialtaxor `taxa 11–14` (MC/special) parsas också för fullständighet men
rör inte MVP:ns bil-features. `Boende:`-suffixet (boendeparkering) ignoreras —
appen visar besökspris från nu och framåt.

## Arkitektur

```
GitHub Actions cron (04:00 UTC)
        │
   poller (orkestrator)
   ├── Göteborg-producent  → Point-features
   └── Stockholm-producent → LineString-features
        │  merge + per-stad sanity-gate
        ▼
 apps/web/public/data/parkings.geojson   (allt: punkter + linjer)
 apps/web/public/data/tariffs.json       (delad taxekatalog)
        │  commit → Pages auto-deploy
        ▼
   klient: 1 fetch → 1 MapLibre-källa → 2 lager, priser beräknas från-nu
```

Klienten beräknar "pris just nu" och "totalkostnad för X tid" lokalt mot den
delade tariff-motorn, som utökas med svensk helgkalender.

## Dataschema

### `parkings.geojson`

```jsonc
{
  "type": "FeatureCollection",
  "generatedAt": "2026-05-30T04:00:00Z",
  "sources": {
    "goteborg": "data.goteborg.se ParkingService v2.1",
    "stockholm": "openparking.stockholm.se LTF-Tolken v1 (ptillaten)"
  },
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [11.9249, 57.6850] },
      "properties": {
        "id": "gbg:1480 2005-00518",
        "city": "goteborg",
        "vehicle": "bilar",
        "name": "Godhemsgatan",
        "tariffId": "free-30min",
        "spaces": 10,
        "maxParkingMinutes": 30
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "LineString", "coordinates": [[18.0628,59.3331],[18.0625,59.3330]] },
      "properties": {
        "id": "sthlm:0180 2021-05253",
        "city": "stockholm",
        "vehicle": "bilar",
        "name": "Sveavägen",
        "tariffId": "sthlm-taxa-2",
        "spaces": null,
        "maxParkingMinutes": null
      }
    }
  ]
}
```

- `city` styr rendering (punkt vs linje) och stad-specifik UI (dölj beläggning
  för Stockholm).
- `vehicle` är `"bilar"` för alla features i MVP; framtidssäkrar fler typer.
- `id`-prefix (`gbg:` / `sthlm:`) garanterar unika nycklar över städer.
- `spaces`/`maxParkingMinutes` är `null` där datan saknas (alla Stockholm).
- Dagens Göteborg-`raw`-blob tas bort ur den enade filen (bantning); behövs
  felsökning kan den loggas i pollern, inte skickas till klienten.

### `tariffs.json` (delad katalog)

Befintliga Göteborgs-taxor + Stockholms taxor (`sthlm-taxa-1..5`,
`sthlm-avgiftsfri`, samt `sthlm-taxa-11..14`). Features refererar via
`tariffId`. Endast använda taxor skrivs (som idag).

## Tariff-modell: dagtyp + helgkalender

Stockholm-texten har tre dagklasser:

| Klass | Definition |
|-------|-----------|
| `helgdag` | söndagar + svenska röda dagar |
| `preHelgdag` | en vardag vars *nästa* dag är `helgdag` (t.ex. lördagar) |
| `vardag` | vardag som inte är `preHelgdag` (vanlig mån–fre) |

### Modelländring (additiv, bakåtkompatibel)

`TariffRule` utökas med valfritt fält:

```ts
export type DayClass = "vardag" | "preHelgdag" | "helgdag";

export type TariffRule = {
  daysOfWeek: number[];        // 0=Sun..6=Sat. Tom = alla dagar. (oförändrat)
  dayClasses?: DayClass[];     // NYTT. Saknas = ingen dagklass-begränsning.
  hourStart: number;
  hourEnd: number;
  pricePerHour: number;
  maxPerDay?: number | null;
};
```

`ruleAppliesAt(rule, at)` matchar om:
`(dayClasses saknas ∨ innehåller dayClassOf(at)) ∧ (daysOfWeek tom ∨ innehåller veckodag) ∧ (hourStart ≤ timme < hourEnd)`.

Göteborgs befintliga regler saknar `dayClasses` och beter sig oförändrat.

### `packages/tariff/src/holidays.ts` (ny)

Beräknar röda dagar per år utan underhållstabell:

- **Fasta:** nyårsdagen (1/1), trettondedag jul (6/1), första maj (1/5),
  nationaldagen (6/6), juldagen (25/12), annandag jul (26/12).
- **Påskberäknade (Gauss/Computus):** långfredag (−2), påskdagen (söndag),
  annandag påsk (+1), Kristi himmelsfärd (+39), pingstdagen (+49).
- **Rörliga lördagar:** midsommardagen (lördag 20–26 juni), alla helgons dag
  (lördag 31 okt–6 nov).

Exponerar `isHoliday(date): boolean` och `dayClassOf(date): DayClass`.

### Göteborg-bonus (in-scope om billigt)

Samma motor gör att Göteborgs `"vardag utom dag före sön- och helgdag"`-mönster
äntligen kan tolkas rätt. De Göteborg-mallar i `tariff-templates.ts` som
refererar helgdag uppgraderas att använda `dayClasses`. Detta stänger den
kända helgdags-buggen. Om det visar sig icke-trivialt bryts det ut till
egen följduppgift.

## Pipeline-moduler (poller)

`runPoll` blir en tunn orkestrator; varje stad är en isolerad producent med
gemensamt `Feature[]`-kontrakt.

| Modul | Ansvar |
|-------|--------|
| `producers/goteborg.ts` | Återanvänder `fetch.ts` + `normalize.ts`, ger Point-features |
| `fetch-stockholm.ts` | Hämtar `ptillaten/all` (nyckel `STHLM_TK_APIKEY`), UTF-8, returnerar GeoJSON |
| `normalize-stockholm.ts` | Filtrerar `VEHICLE=fordon`, behåller linjegeometri, kapar koordinatprecision (5 decimaler, ~1 m), mappar `PARKING_RATE → tariffId`, bygger Feature |
| `tariff-templates-stockholm.ts` | `PARKING_RATE`-mönster → `Tariff` med `dayClasses` (taxa 1–5, avgiftsfri, taxa 11–14) |
| orkestrator (`main.ts`) | Slår ihop features, kör per-stad sanity, skriver `parkings.geojson` + `tariffs.json` |

Delade GeoJSON-typer (`ParkingFeature`, `ParkingFeatureCollection`) flyttas in
i `packages/tariff` och delas av poller + web.

## Klient (apps/web)

- **Laddning:** en fetch av `parkings.geojson` + `tariffs.json`.
- **MapView skrivs om** från individuella `<Marker>` till data-drivna lager:
  - ett cirkel-/symbol-lager för `Point`-features (Göteborg),
  - ett linje-lager för `LineString`-features (Stockholm),
  - båda färgade efter pris-just-nu-bucket (beräknat lokalt).
  - Detta löser samtidigt den redan flaggade clustering-/prestanda-skulden
    (2603 + ~15k features kan inte vara enskilda React-markers).
- **Popup** vid klick: namn + pris just nu + (om duration vald) totalkostnad.
  För Stockholm visas ingen beläggning; för Göteborg som idag.
- **Stale-banner epoch-guard** vävs in (känd tactical fix) eftersom laddaren
  ändå rörs.

## Payload-budget

- Linjer behålls; geometri slås **inte** ihop.
- Bantning: endast `fordon`, minimala properties, koordinatprecision 5
  decimaler (~1 m), taxor externaliserade till `tariffs.json`.
- Uppskattning: ~15,7k linjer ≈ **2–4 MB** rå JSON → Pages gzip/brotli →
  **~300–600 kB** över nätet. Service-workern cachar. Acceptabelt.
- **Guardrail:** pollern loggar utdatans storlek och varnar över en tröskel
  (t.ex. 6 MB okomprimerat) som signal för framtida linjeförenkling. Ej
  blockerande.

## Felhantering

- **Per-stad sanity-gate:** varje stads feature-antal jämförs mot förra
  snapshotets per-stad-antal. Faller en stad till 0 eller tappar mer än en
  tröskel (t.ex. 20 %) → avbryt hela skrivningen och behåll förra filen
  (aldrig en halvtom karta). Båda städer måste passera.
- En stads fetch/auth-fel → avbryt snapshotet, logga vilken stad. (Per-stad
  "last good" är mer komplext och ligger utanför scope.)
- **Otolkbar `PARKING_RATE`** → `tariffId: null`; featuren visas ändå med
  "pris okänt"; pollern skriver ut en sammanfattning av okända mönster
  (kalibreringssignal).
- Stockholm-svaret läses som UTF-8.

## Tester

- `holidays`: röda dagar över flera år inkl. påskberäknade + rörliga lördagar;
  `dayClassOf`-övergångar (fre/lör/sön, dag före nationaldagen m.fl.).
- Tariff-motor: `dayClass`-matchning i `priceNow` och `totalCost`.
- Stockholm-mallar: varje `PARKING_RATE`-sträng → förväntade regler;
  `avgiftsfri`; okänt mönster → `null`.
- **Kalibreringstest:** parsade taxa 1–5-timpriser == officiella tabellen
  (CI-signal när Stockholm ändrar taxor).
- `normalize-stockholm`: fordon-filter, geometri/precision, namnmappning.
- Orkestrator: merge + per-stad sanity (en stads drop → abort, förra filen
  bevaras).
- Web: en källa → två lager renderas; pris-färgbuckets; popup för både punkt
  och linje; Stockholm döljer beläggning.

## Utanför scope (YAGNI)

- Stockholm Parkering AB:s p-hus (fas 2, privata garage).
- Beläggning/lediga platser för Stockholm.
- Andra fordonstyper (schemat lämnar plats via `vehicle`).
- Boendeparkering-pris.
- Säsong/månadsintervall-regler (sällsynt på bil) — känd begränsning, loggas.
- Per-kalenderdag `maxPerDay` (befintlig begränsning, oförändrad).
- Stad-väljare / geolocation-centrering (en gemensam karta räcker).
- Vektor-tiles / backend (återbesöks bara om payloaden blir ett problem).

## Officiell kalibreringstabell (Stockholm Taxa 1–5)

| Zon | Pris |
|-----|------|
| Taxa 1 | 55 kr/tim, alla dagar 00–24 |
| Taxa 2 | 31 kr/tim vardag 7–21 (+ dag före helgdag/helgdag 9–19), 20 kr/tim övrig tid |
| Taxa 3 | 20 kr/tim vardag 7–19, 15 kr/tim dag före helgdag 11–17 |
| Taxa 4 | 10 kr/tim vardag 7–19 (+ dag före helgdag 11–17) |
| Taxa 5 | 5 kr/tim vardag 7–19 |

Källa: Stockholms stad, Taxeområden och avgifter.
