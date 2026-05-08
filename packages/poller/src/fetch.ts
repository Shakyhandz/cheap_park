const BASE = "https://data.goteborg.se/ParkingService/v2.1";
const FORMAT = "json";

// Bounding box covering all of Göteborg with margin.
const BBOX_LAT = 57.75;
const BBOX_LONG = 11.95;
const BBOX_RADIUS_M = 20000;

export type RawParking = Record<string, unknown> & {
  Id: string;
  Name?: string;
  Owner?: string;
  Lat?: number;
  Long?: number;
};

async function fetchEndpoint(path: string, appId: string): Promise<RawParking[]> {
  const url = `${BASE}/${path}/${encodeURIComponent(appId)}?latitude=${BBOX_LAT}&longitude=${BBOX_LONG}&radius=${BBOX_RADIUS_M}&format=${FORMAT}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as RawParking[];
}

export async function fetchAllParkings(appId: string): Promise<{
  toll: RawParking[];
  time: RawParking[];
}> {
  const [toll, time] = await Promise.all([
    fetchEndpoint("PublicTollParkings", appId),
    fetchEndpoint("PublicTimeParkings", appId),
  ]);
  return { toll, time };
}
