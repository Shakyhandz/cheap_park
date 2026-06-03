# Cheap Park — Stockholm & multi-stad-design

**Datum:** 2026-05-30
**Status:** Godkänd design (rev. 2 efter codex-granskning), redo för
implementationsplan
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
   fel kring röda dagar. Fixar samtidigt Göteborgs kända helgdags-bug i samma
   veva.
5. **Ett enat `parkings.geojson`** — en FeatureCollection med både punkter och
   linjer, en fetch i klienten, en MapLibre-källa, två renderingslager.
6. **`vehicle`-fält i schemat** — allt taggas `"bilar"` nu så MC/buss kan
   adderas senare utan schemaändring.
7. **Ingen beläggning för Stockholm** (`spaces: null`) — finns inte på gatumark.
8. **Tidszon och helgkalender är egenskaper hos platsen, inte enheten** —
   varje stad bär `timeZone` + `holidayCalendar`; priset för en feature
   beräknas i dess egen lokala tid och röd-dags-kalender (se nedan).

Arkitekturen behåller Alternativ A (statisk data på GitHub Pages, ingen
backend). Pollern, tariff-motorn och klientens renderingslager ändras.

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
| `PARKING_RATE` | `"taxa 2: 31 kr/tim …"` | parsas → `tariffId`; även `rulesText` |
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
   └── Stockholm-producent → LineString/MultiLineString-features
        │  merge + per-stad sanity-gate
        ▼
 apps/web/public/data/parkings.geojson   (allt: punkter + linjer + stad-metadata)
 apps/web/public/data/tariffs.json       (delad taxekatalog)
        │  commit → Pages auto-deploy
        ▼
   klient: 1 fetch → web-facing modell → 1 MapLibre-källa → 2 lager,
           priser beräknas från-nu i varje features egen tidszon/kalender
```

## Tidszon och kalender (generaliserad modell)

**Princip:** tidszon och röd-dags-kalender är egenskaper hos *platsen*, inte
hos användarens enhet. Enheten bidrar bara med det absoluta tidsögonblicket
(epoch). Det ögonblicket renderas in i varje features lokala väggklocka för
regelmatchning.

Motorn blir `priceNow(tariff, instant, ctx)` där `ctx = { timeZone, calendar }`
hämtas från featurens stad:

- Samma `instant`, en Stockholm-feature → 13:31 → Stockholm-regler 13:31.
- Samma `instant`, en (framtida) Helsingfors-feature → 14:31 (EET) →
  Helsingfors-regler 14:31.

Detta gäller **per feature** (via dess stad), inte per kartvyport — så
Stockholm- och framtida Helsingfors-features kan visas samtidigt och var och
en prissätts korrekt i sin egen locale, utan vyport-spårning.

**Kalendern är också locale-specifik:** "helgdag" skiljer sig mellan länder
(svenska röda dagar ≠ finska). Därför bär en stad både `timeZone` och
`holidayCalendar`. I nuvarande scope är båda städerna `Europe/Stockholm` + `SE`,
så beteendet är identiskt idag — men modellen bär det per stad, så att en ny
stad bara blir en ny rad (t.ex. `Europe/Helsinki` + `FI`) utan motoromskrivning.

Implementation: väggklockans delar (veckodag, timme, datum) härleds för en
given `timeZone` via `Intl.DateTimeFormat(...).formatToParts(instant)`. Vi
litar aldrig på enhetens tidszons-inställning, bara dess absoluta klocka.

## Dataschema

### `parkings.geojson`

```jsonc
{
  "type": "FeatureCollection",
  "generatedAt": "2026-05-30T04:00:00Z",
  "cities": {
    "goteborg": {
      "source": "data.goteborg.se ParkingService v2.1",
      "timeZone": "Europe/Stockholm",
      "holidayCalendar": "SE",
      "center": [11.9685, 57.7068]
    },
    "stockholm": {
      "source": "openparking.stockholm.se LTF-Tolken v1 (ptillaten)",
      "timeZone": "Europe/Stockholm",
      "holidayCalendar": "SE",
      "center": [18.0686, 59.3293]
    }
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
        "provider": "Stadsmiljöförvaltningen",
        "tariffId": "free-30min",
        "rulesText": "30 min. Tidsbegränsningen gäller vardag 07.00–23.00 …",
        "accessible": false,
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
        "provider": "Stockholms stad",
        "tariffId": "sthlm-taxa-2",
        "rulesText": "taxa 2: 31 kr/tim vardagar 7-21 och dag före helgdag och helgdag 9-19, 20 kr/tim övrig tid",
        "accessible": false,
        "spaces": null,
        "maxParkingMinutes": null
      }
    }
  ]
}
```

Designval kring properties (svar på granskningens fynd #3):

- **`raw`-blobben skeppas inte** — istället **normaliserar pollern** de
  klient-relevanta fälten till stad-agnostiska egenskaper, så klienten slipper
  stad-specifik logik:
  - `provider` ersätter dagens `owner` (visas i list-/detaljvy).
  - `rulesText` är den människoläsbara regeltexten i detaljvyn. För Stockholm
    = `PARKING_RATE`. För Göteborg = sammansatt av dagens
    `ParkingCost` / `MaxParkingTimeLimitation` / `ExtraInfo`.
  - `accessible` (bool) bakas i pollern. Göteborg: regex på `ExtraInfo`
    (`rörelsehindrade|handikapp|permit`, som dagens klient). Stockholm: `false`
    (fordon-only; rörelsehindrad-rader utesluts — konsekvent med `vehicle`).
- `city` refererar in i `cities`-blocket → ger `timeZone`, `holidayCalendar`,
  `center`.
- `vehicle` är `"bilar"` för alla features i MVP; framtidssäkrar fler typer.
- `id`-prefix (`gbg:` / `sthlm:`) garanterar unika nycklar över städer.
- `spaces`/`maxParkingMinutes` är `null` där datan saknas (alla Stockholm).
- **Geometri:** `Point` (Göteborg) eller `LineString | MultiLineString`
  (Stockholm). Klienten hanterar alla tre (fynd #4).

### `tariffs.json` (delad katalog)

Befintliga Göteborgs-taxor + Stockholms taxor (`sthlm-taxa-1..5`,
`sthlm-avgiftsfri`, samt `sthlm-taxa-11..14`). Features refererar via
`tariffId`. Endast använda taxor skrivs (som idag).

## Tariff-modell: dagtyp + helgkalender

Stockholm-texten har tre dagklasser. Klassificeringen är en **strikt prioritet**
(svar på fynd #2) så att varje datum hamnar i exakt en klass:

1. `helgdag` — om datumet är söndag **eller** en röd dag (oavsett veckodag).
2. `preHelgdag` — annars, om *nästa kalenderdag* är `helgdag`. Täcker lördagar
   (före söndag), aftnar (t.ex. julafton 24/12 före juldagen), och årsskiftet
   (31/12 före nyårsdagen 1/1).
3. `vardag` — i övriga fall (vanlig mån–fre).

En röd dag som infaller på en lördag blir alltså `helgdag` (steg 1 vinner), inte
`preHelgdag`.

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

Regelmatchningen tar nu ett locale-context och ett absolut ögonblick:

```ts
type EvalContext = { timeZone: string; calendar: "SE" /* | "FI" … */ };

ruleAppliesAt(rule, instant, ctx): boolean
// sant om:
//   (dayClasses saknas ∨ innehåller dayClassOf(instant, ctx))
//   ∧ (daysOfWeek tom ∨ innehåller veckodag(instant, ctx.timeZone))
//   ∧ (hourStart ≤ timme(instant, ctx.timeZone) < hourEnd)
```

`priceNow(tariff, instant, ctx)` och `totalCost(tariff, instant, durMin, ctx)`
får samma `ctx`-parameter. Göteborgs befintliga regler saknar `dayClasses` och
beter sig oförändrat (utöver att de nu evalueras i `Europe/Stockholm` explicit
istället för enhetens lokala tid).

### `packages/tariff/src/holidays.ts` (ny)

Beräknar röda dagar per år och kalender utan underhållstabell. För `SE`:

- **Fasta:** nyårsdagen (1/1), trettondedag jul (6/1), första maj (1/5),
  nationaldagen (6/6), juldagen (25/12), annandag jul (26/12).
- **Påskberäknade (Gauss/Computus):** långfredag (−2), påskdagen (söndag),
  annandag påsk (+1), Kristi himmelsfärd (+39), pingstdagen (+49).
- **Rörliga lördagar:** midsommardagen (lördag 20–26 juni), alla helgons dag
  (lördag 31 okt–6 nov).

Exponerar `isHoliday(date, calendar)` och `dayClassOf(instant, ctx): DayClass`.
Strukturen tar en `calendar`-parameter så att fler länder kan adderas senare.

### Göteborg-bonus (in-scope i denna spec)

De Göteborg-mallar i `tariff-templates.ts` som refererar helgdag uppgraderas
att använda `dayClasses` + svensk kalender. Detta stänger den kända
helgdags-buggen direkt. Mallar utan helg-beroende lämnas orörda.

## Pipeline-moduler (poller)

`runPoll` blir en tunn orkestrator; varje stad är en isolerad producent med
gemensamt `Feature[]`-kontrakt.

| Modul | Ansvar |
|-------|--------|
| `producers/goteborg.ts` | Återanvänder `fetch.ts` + `normalize.ts`, ger Point-features med normaliserade `provider`/`rulesText`/`accessible` |
| `fetch-stockholm.ts` | Hämtar `ptillaten/all` (nyckel `STHLM_TK_APIKEY`), UTF-8, returnerar GeoJSON |
| `normalize-stockholm.ts` | Filtrerar `VEHICLE=fordon`, behåller linjegeometri (`LineString \| MultiLineString`), kapar koordinatprecision (5 decimaler, ~1 m), mappar `PARKING_RATE → tariffId` + `rulesText`, sätter `provider`/`accessible`, bygger Feature |
| `tariff-templates-stockholm.ts` | `PARKING_RATE`-mönster → `Tariff` med `dayClasses` (taxa 1–5, avgiftsfri, taxa 11–14) |
| orkestrator (`main.ts`) | Slår ihop features + `cities`-metadata, kör per-stad sanity, skriver `parkings.geojson` + `tariffs.json` |

Delade GeoJSON-typer (`ParkingFeature`, `ParkingFeatureCollection`,
`CityMeta`) flyttas in i `packages/tariff` och delas av poller + web.

## Klient (apps/web)

### Web-facing modell (fynd #3)

Loadern plattar GeoJSON till en stad-agnostisk klientmodell som alla
komponenter konsumerar:

```ts
type ClientParking = {
  id: string;
  city: "goteborg" | "stockholm";
  name: string;
  provider: string;
  geometry: GeoJSON.Geometry;        // för rendering
  displayPoint: { lat: number; lng: number }; // härledd: punkt = sig själv,
                                              // linje/multiline = mittpunkt
  tariffId: string | null;
  rulesText: string;
  accessible: boolean;
  spaces: number | null;
  maxParkingMinutes: number | null;
  ctx: { timeZone: string; calendar: string }; // från cities[city]
};
```

- **`displayPoint`** löser de fyra ställen en linje saknar en punkt:
  vägbeskrivnings-länk (`DetailSheet.directionsUrl`), avståndssortering
  (`haversine` i list-/sorteringslogik), popup-ankare och centrering.
  Beräknas en gång vid laddning (mittpunkt för linje/multiline).
- `provider` ersätter `owner` i `ListView`/`DetailSheet`.
- `rulesText` ersätter detaljvyns nuvarande tre separata `raw`-fält.
- Pris beräknas alltid med `feature.ctx` (per-stad tidszon/kalender).

### Rendering och färgläggning (fynd #5)

MapLibre-stiluttryck kan inte anropa `priceNow()`. Därför:

- MapView skrivs om från individuella `<Marker>` till **data-drivna lager**:
  ett cirkel-/symbol-lager för `Point`-features (Göteborg) och ett linje-lager
  för `LineString/MultiLineString`-features (Stockholm).
- Klienten härleder en **runtime-GeoJSON-källa** där varje feature får
  beräknade properties: `tier` (pris-bucket från `priceNow` i featurens locale)
  och `dimmed` (bortfiltrerad). Lagren färgas via data-drivna uttryck
  (`["match", ["get","tier"], …]`).
- Källan **räknas om** när tid (minut-tick), vald duration eller filter ändras.
  Färgläggning använder `priceNow` (billigt) — inte `totalCost`.
- Detta löser samtidigt den redan flaggade clustering-/prestanda-skulden
  (2603 + ~15k features kan inte vara enskilda React-markers).

### Prestanda för "billigast"

`totalCost` (när duration är vald) används för list-rankning. Nuvarande
implementation stegar minut-för-minut; vid ~18k features blir det dyrt.
**In-scope:** optimera `totalCost` att hoppa till nästa regelgräns analytiskt
(O(regelsegment) istället för O(minuter)). Gynnar även Göteborg. `totalCost`
för enskild vald feature i detaljvyn är oförändrat billigt.

### Startvy (fynd #8)

Vid laddning: om position finns (befintlig `geo.ts`), centrera på **närmaste
stad** (Göteborg/Stockholm via `cities[].center`), annars Göteborg som idag.
Ingen stad-väljare — bara initial centrering. Användarens lokalisera-knapp
(`flyTo`) är oförändrad.

### Migration (fynd #6)

- Loadern hämtar **`parkings.geojson`** istället för `parkings.json`.
- Gamla `apps/web/public/data/parkings.json` (inkl. placeholder) tas bort;
  `tariffs.json` behålls.
- **Stale-banner epoch-guard** vävs in (känd tactical fix) eftersom laddaren
  ändå rörs.

## Felhantering

- **Per-stad sanity-gate (fynd #7):** ersätter dagens totala 90 %-check.
  Varje stads feature-antal jämförs mot förra snapshotets per-stad-antal
  (härleds genom att räkna features per `city` i förra filen — ingen separat
  lagring). Faller en stad till 0 eller tappar **mer än 20 %** → avbryt hela
  skrivningen och behåll förra filen (aldrig en halvtom karta). Båda städer
  måste passera.
- **Första körningen (bootstrap):** ingen tidigare `parkings.geojson` →
  tillåt skrivning (som dagens ENOENT-väg). Gamla `parkings.json` läses inte.
- En stads fetch/auth-fel → avbryt snapshotet, logga vilken stad. (Per-stad
  "last good" är mer komplext och ligger utanför scope.)
- **Otolkbar `PARKING_RATE`** → `tariffId: null`; featuren visas ändå med
  "pris okänt"; pollern skriver ut en sammanfattning av okända mönster
  (kalibreringssignal).
- Stockholm-svaret läses som UTF-8.

## Payload-budget

- Linjer behålls; geometri slås **inte** ihop.
- Bantning: endast `fordon`, normaliserade minimala properties (ingen `raw`),
  koordinatprecision 5 decimaler (~1 m), taxor externaliserade till
  `tariffs.json`.
- Uppskattning: ~15,7k linjer ≈ **2–4 MB** rå JSON → Pages gzip/brotli →
  **~300–600 kB** över nätet. Service-workern cachar. Acceptabelt.
- **Guardrail:** pollern loggar utdatans storlek och varnar över en tröskel
  (t.ex. 6 MB okomprimerat) som signal för framtida linjeförenkling. Ej
  blockerande.

## Tester

- `holidays`: röda dagar över flera år inkl. påskberäknade + rörliga lördagar;
  `dayClassOf`-prioritet (helgdag-på-lördag → helgdag; lördag → preHelgdag;
  31/12 → preHelgdag; dag före nationaldagen → preHelgdag).
- **Tidszon:** samma `instant` ger rätt väggklocka/dagklass för olika
  `timeZone`; oberoende av processens lokala tidszon (testa med fejkad TZ).
- Tariff-motor: `dayClass`-matchning i `priceNow` och `totalCost`; locale-`ctx`.
- `totalCost`-optimering: regelgräns-stegning ger samma resultat som
  minut-stegningen (regressionstest), och hanterar dygns-/dagklass-övergångar.
- Stockholm-mallar: varje `PARKING_RATE`-sträng → förväntade regler;
  `avgiftsfri`; okänt mönster → `null`.
- **Kalibreringstest:** parsade taxa 1–5-timpriser == officiella tabellen
  (CI-signal när Stockholm ändrar taxor).
- `normalize-stockholm`: fordon-filter, `LineString`/`MultiLineString`,
  precision, namn/`provider`/`rulesText`/`accessible`-mappning.
- `displayPoint`: mittpunkt för `LineString` och `MultiLineString`; punkt = sig
  själv.
- Göteborg helguppgradering: berörda mallar ger rätt pris på röd dag / dag före.
- Orkestrator: merge + `cities`-metadata + per-stad sanity (en stads >20 %-drop
  → abort, förra filen bevaras; bootstrap tillåts).
- Web: en källa → två lager renderas; `tier`-färgbuckets via uttryck; popup +
  vägbeskrivning för både punkt och linje (via `displayPoint`); Stockholm
  döljer beläggning; närmaste-stad-centrering.

## Granskningsåtgärder (codex 2026-05-30)

Alla åtta fynd verifierade mot koden och åtgärdade i denna revision:

| # | Fynd | Åtgärd |
|---|------|--------|
| 1 | Tidszon under-specad | Generaliserad: per-stad `timeZone`/`holidayCalendar`, motorn tar `ctx` |
| 2 | `preHelgdag`-semantik | Strikt prioritetsordning + årsskifte explicit |
| 3 | Schema-migration större | Web-facing modell: `provider`/`rulesText`/`accessible`/`displayPoint`, ingen `raw` tappas |
| 4 | MultiLineString | Typ + normalisering + `displayPoint` + klick hanterar `LineString \| MultiLineString` |
| 5 | MapLibre-färgläggning | Runtime-GeoJSON med beräknade `tier`/`dimmed`, data-drivna uttryck, omräkning på state-ändring |
| 6 | `.json`→`.geojson`-migration | Loader-byte, bootstrap-väg, gammal fil tas bort |
| 7 | Per-stad sanity | Ersätter total-check; per-stad-antal härleds; >20 %-drop → abort |
| 8 | Startvy i Göteborg | Lätt närmaste-stad-centrering vid laddning |

## Utanför scope (YAGNI)

- Stockholm Parkering AB:s p-hus (fas 2, privata garage).
- Beläggning/lediga platser för Stockholm.
- Andra fordonstyper (schemat lämnar plats via `vehicle`).
- Boendeparkering-pris.
- Säsong/månadsintervall-regler (sällsynt på bil) — känd begränsning, loggas.
- Per-kalenderdag `maxPerDay` (befintlig begränsning, oförändrad).
- Stad-väljare (en gemensam karta med initial centrering räcker).
- Vyport-baserad tidszon (vi använder per-feature locale istället).
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
