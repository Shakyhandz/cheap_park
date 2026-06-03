# Review: 2026-05-30 Cheap Park Stockholm Multi-City Design

Source spec: `2026-05-30-cheap-park-stockholm-multi-city-design.md`

## Findings

1. Timezone handling is under-specified and currently fragile.

   The tariff engine reads local runtime time via `Date#getDay()` and
   `Date#getHours()` in `packages/tariff/src/days.ts`. The plan adds Stockholm
   holiday/day-class logic, but does not change this assumption. That will
   price incorrectly for users outside Sweden and for CI/server callers unless
   dates are converted to `Europe/Stockholm` before rule matching.

2. The `preHelgdag` model needs sharper semantics.

   The spec defines `preHelgdag` as a weekday whose next day is `helgdag`, but
   gives Saturday as an example. Implementation should explicitly decide:

   - Saturday before Sunday is `preHelgdag`.
   - Day before a Swedish public holiday is `preHelgdag`, including year
     boundaries like December 31 before January 1.
   - If the current day itself is a public holiday that falls on Saturday, it
     should probably be `helgdag`, not `preHelgdag`.

3. The schema migration is larger than the plan makes it sound.

   Current shared types are flat `Parking` objects with `lat`, `lng`, `owner`,
   `spaces: number`, and `raw`. The proposed GeoJSON model removes or changes
   several of these. That affects `MapView`, loader code, directions URLs,
   detail rules text, accessibility filtering, and list metadata. The plan
   should define a web-facing normalized model or add replacement fields such
   as `displayPoint`, `provider`, `rulesText`, and `accessible`.

4. MultiLineString support is acknowledged in source data but not carried
   through the design.

   The plan says Stockholm has 61 `MultiLineString` objects, but later talks
   mostly about `LineString` features. MapLibre line layers can render both,
   but the TypeScript schema, normalization tests, click handling, and popup
   selection should explicitly allow `LineString | MultiLineString`, or flatten
   them deliberately.

5. Data-driven MapLibre coloring needs a concrete client strategy.

   The plan says layers are colored by price-now bucket, computed locally.
   MapLibre style expressions cannot call `priceNow()` directly. The web app
   will need to derive a GeoJSON source with computed properties like `rate`,
   `tier`, `isDimmed`, and `label`, then update it when duration, filters, or
   time changes.

6. The migration from `parkings.json` to `parkings.geojson` needs a
   compatibility/bootstrap step.

   The current poller writes `parkings.json`, and the web loader fetches
   `parkings.json`. If the new poller writes `parkings.geojson`, the first run's
   sanity gate cannot compare against a prior per-city GeoJSON snapshot unless
   it has explicit migration logic from the old file.

7. Per-city sanity is the right direction, but the threshold conflicts with
   current behavior.

   Current sanity aborts below 90% of previous total count. The plan proposes
   "drop more than 20%" per city. That is reasonable, but it should explicitly
   replace the old total-count check and persist previous counts by `city`.

8. Geolocation/start viewport is listed out of scope, but the app currently
   centers Goteborg.

   With one shared map and no city selector, Stockholm users will initially land
   in Goteborg unless geolocation succeeds. Since city selector and geolocation
   centering are out of scope in the plan, this is a product risk worth
   revisiting.

## Overall

The architecture is sound: static data, one merged GeoJSON, shared tariff
engine, city-tagged features, and MapLibre layers are the right shape for 15k
Stockholm line features. The main gaps are migration details and time/date
correctness. Before implementation, tighten the plan by adding explicit
Stockholm-time conversion, precise `dayClassOf` semantics, a web-facing
geometry/display model, `MultiLineString` handling, and a first-run migration
path from `parkings.json`.
