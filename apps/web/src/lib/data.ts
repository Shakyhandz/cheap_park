import type { Tariff, TariffsSnapshot, ParkingFeatureCollection } from "@cheap-park/tariff";
import { flattenCollection, type ClientParking } from "./client-model.js";

export type Snapshot = {
  generatedAt: Date;
  sources: Record<string, string>;
  centers: Record<string, [number, number]>;
  parkings: ClientParking[];
  tariffs: Map<string, Tariff>;
};

export type LoadOptions = { basePath: string; fetcher?: typeof fetch };

export async function loadSnapshot(opts: LoadOptions): Promise<Snapshot> {
  const f = opts.fetcher ?? fetch;
  const [pRes, tRes] = await Promise.all([
    f(`${opts.basePath}/parkings.geojson`),
    f(`${opts.basePath}/tariffs.json`),
  ]);
  if (!pRes.ok) throw new Error(`parkings.geojson: ${pRes.status} ${pRes.statusText}`);
  if (!tRes.ok) throw new Error(`tariffs.json: ${tRes.status} ${tRes.statusText}`);

  const fc = (await pRes.json()) as ParkingFeatureCollection;
  const tariffs = (await tRes.json()) as TariffsSnapshot;

  const sources: Record<string, string> = {};
  const centers: Record<string, [number, number]> = {};
  for (const [city, meta] of Object.entries(fc.cities)) {
    sources[city] = meta.source;
    centers[city] = meta.center;
  }

  return {
    generatedAt: new Date(fc.generatedAt),
    sources,
    centers,
    parkings: flattenCollection(fc),
    tariffs: new Map(tariffs.tariffs.map((t) => [t.id, t])),
  };
}

export function tariffFor(parking: ClientParking, tariffs: Map<string, Tariff>): Tariff | null {
  if (!parking.tariffId) return null;
  return tariffs.get(parking.tariffId) ?? null;
}
