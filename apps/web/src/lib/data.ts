import type { Parking, Tariff, ParkingsSnapshot, TariffsSnapshot } from "@cheap-park/tariff";

export type Snapshot = {
  generatedAt: Date;
  source: string;
  parkings: Parking[];
  tariffs: Map<string, Tariff>;
};

export type LoadOptions = {
  basePath: string;
  fetcher?: typeof fetch;
};

export async function loadSnapshot(opts: LoadOptions): Promise<Snapshot> {
  const f = opts.fetcher ?? fetch;
  const [parkingsRes, tariffsRes] = await Promise.all([
    f(`${opts.basePath}/parkings.json`),
    f(`${opts.basePath}/tariffs.json`),
  ]);

  if (!parkingsRes.ok) {
    throw new Error(`parkings.json: ${parkingsRes.status} ${parkingsRes.statusText}`);
  }
  if (!tariffsRes.ok) {
    throw new Error(`tariffs.json: ${tariffsRes.status} ${tariffsRes.statusText}`);
  }

  const parkings = (await parkingsRes.json()) as ParkingsSnapshot;
  const tariffs = (await tariffsRes.json()) as TariffsSnapshot;

  return {
    generatedAt: new Date(parkings.generatedAt),
    source: parkings.source,
    parkings: parkings.parkings,
    tariffs: new Map(tariffs.tariffs.map((t) => [t.id, t])),
  };
}

export function tariffFor(parking: Parking, tariffs: Map<string, Tariff>): Tariff | null {
  if (!parking.tariffId) return null;
  return tariffs.get(parking.tariffId) ?? null;
}
