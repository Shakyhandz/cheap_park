import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ParkingFeature, ParkingFeatureCollection, CityId, CityMeta, Tariff, TariffsSnapshot,
} from "@cheap-park/tariff";
import { fetchAllParkings, type RawParking } from "./fetch.js";
import { fetchStockholm, type RawStockholmFC } from "./fetch-stockholm.js";
import { normalize } from "./normalize.js";
import { normalizeStockholm } from "./normalize-stockholm.js";
import { sanityCheckAll } from "./sanity.js";
import { getRegisteredTariffs } from "./tariff-templates.js";
import { getStockholmTariffs } from "./tariff-templates-stockholm.js";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const GEOJSON_PATH = resolve(REPO_ROOT, "apps/web/public/data/parkings.geojson");
const TARIFFS_PATH = resolve(REPO_ROOT, "apps/web/public/data/tariffs.json");
const SIZE_WARN_BYTES = 6 * 1024 * 1024;

const CITY_META: Record<CityId, CityMeta> = {
  goteborg: {
    source: "data.goteborg.se ParkingService v2.1",
    timeZone: "Europe/Stockholm", holidayCalendar: "SE", center: [11.9685, 57.7068],
  },
  stockholm: {
    source: "openparking.stockholm.se LTF-Tolken v1 (ptillaten)",
    timeZone: "Europe/Stockholm", holidayCalendar: "SE", center: [18.0686, 59.3293],
  },
};

export type RunOptions = {
  gbgAppId: string;
  sthlmApiKey: string;
  fetchGbg: (appId: string) => Promise<{ toll: RawParking[]; time: RawParking[] }>;
  fetchSthlm: (apiKey: string) => Promise<RawStockholmFC>;
  readPrevious: () => Promise<ParkingFeatureCollection | null>;
  writeJson: (path: string, data: unknown) => Promise<void>;
};

export type RunResult =
  | { committed: true; count: number }
  | { committed: false; reason: string };

function countByCity(features: ParkingFeature[]): Partial<Record<CityId, number>> {
  const out: Partial<Record<CityId, number>> = {};
  for (const f of features) out[f.properties.city] = (out[f.properties.city] ?? 0) + 1;
  return out;
}

export async function runPoll(opts: RunOptions): Promise<RunResult> {
  const [gbgRaw, sthlmRaw] = await Promise.all([
    opts.fetchGbg(opts.gbgAppId),
    opts.fetchSthlm(opts.sthlmApiKey),
  ]);

  const features: ParkingFeature[] = [...normalize(gbgRaw), ...normalizeStockholm(sthlmRaw)];

  const previous = await opts.readPrevious();
  const lastCounts = previous ? countByCity(previous.features) : {};
  const sanity = sanityCheckAll(lastCounts, countByCity(features));
  if (!sanity.ok) return { committed: false, reason: sanity.reason };

  const tariffs: Tariff[] = [...getRegisteredTariffs(), ...getStockholmTariffs()];
  const usedIds = new Set(features.map((f) => f.properties.tariffId).filter((x): x is string => !!x));
  const usedTariffs = tariffs.filter((t) => usedIds.has(t.id));

  const collection: ParkingFeatureCollection = {
    type: "FeatureCollection",
    generatedAt: new Date().toISOString(),
    cities: CITY_META,
    features,
  };
  const tariffsSnapshot: TariffsSnapshot = { tariffs: usedTariffs };

  await opts.writeJson(GEOJSON_PATH, collection);
  await opts.writeJson(TARIFFS_PATH, tariffsSnapshot);

  const bytes = Buffer.byteLength(JSON.stringify(collection));
  if (bytes > SIZE_WARN_BYTES) {
    console.warn(`WARN: parkings.geojson is ${(bytes / 1e6).toFixed(1)} MB (>6 MB); consider line simplification.`);
  }

  return { committed: true, count: features.length };
}

async function readPreviousFromDisk(): Promise<ParkingFeatureCollection | null> {
  try {
    const text = await readFile(GEOJSON_PATH, "utf8");
    return JSON.parse(text) as ParkingFeatureCollection;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function writeJsonToDisk(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const isMain =
  typeof process.argv[1] === "string" && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const gbgAppId = process.env["GBG_APPID"];
  const sthlmApiKey = process.env["STHLM_TK_APIKEY"];
  if (!gbgAppId) { console.error("GBG_APPID env var is required"); process.exit(1); }
  if (!sthlmApiKey) { console.error("STHLM_TK_APIKEY env var is required"); process.exit(1); }

  runPoll({
    gbgAppId, sthlmApiKey,
    fetchGbg: fetchAllParkings,
    fetchSthlm: fetchStockholm,
    readPrevious: readPreviousFromDisk,
    writeJson: writeJsonToDisk,
  })
    .then((result) => {
      if (result.committed) console.log(`OK: wrote ${result.count} features`);
      else { console.error(`ABORT: ${result.reason}`); process.exit(2); }
    })
    .catch((err) => { console.error("FAIL:", err); process.exit(1); });
}
