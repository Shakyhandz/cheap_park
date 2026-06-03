const BASE = "https://openparking.stockholm.se/LTF-Tolken/v1";

export type RawStockholmFeature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
};

export type RawStockholmFC = {
  type: "FeatureCollection";
  features: RawStockholmFeature[];
};

export async function fetchStockholm(apiKey: string): Promise<RawStockholmFC> {
  const url = `${BASE}/ptillaten/all?outputFormat=json&apiKey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ptillaten failed: ${res.status} ${res.statusText}`);
  }
  // Response is UTF-8 GeoJSON; res.json() decodes UTF-8 by default.
  return (await res.json()) as RawStockholmFC;
}
